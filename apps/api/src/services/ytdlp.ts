import type { TranscriptProvider, TranscriptResult } from './transcript-provider'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from '../config'
import { AppError } from '../lib/errors'
import { findSubtitleFile, readSubtitleBundle } from './transcript'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRateLimited(text: string): boolean {
  return /429|too many requests/i.test(text)
}

function isCookieError(text: string): boolean {
  return /cookie database|cookies-from-browser|could not copy chrome/i.test(text)
}

function hasCookieConfig(): boolean {
  return Boolean(config.ytdlpCookiesFromBrowser || config.ytdlpCookiesFile)
}

async function readStream(
  stream: number | ReadableStream<Uint8Array> | null | undefined,
): Promise<string> {
  if (stream == null || typeof stream === 'number')
    return ''
  return new Response(stream).text()
}

function buildBaseArgs(useCookies: boolean): string[] {
  const args = [
    '--sleep-requests',
    String(config.ytdlpSleepRequestsSec),
    '--sleep-interval',
    '1',
    '--max-sleep-interval',
    '5',
    '--extractor-retries',
    '3',
    '--retry-sleep',
    '10',
    '--no-playlist',
  ]
  if (useCookies) {
    if (config.ytdlpCookiesFromBrowser)
      args.push('--cookies-from-browser', config.ytdlpCookiesFromBrowser)
    else if (config.ytdlpCookiesFile)
      args.push('--cookies', config.ytdlpCookiesFile)
  }
  return args
}

async function runYtDlp(args: string[], cwd: string, timeoutMs: number): Promise<{ stdout: string, stderr: string, code: number }> {
  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn([config.ytdlpPath, ...args], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })
  }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new AppError(
      `无法运行 yt-dlp（${config.ytdlpPath}）。请安装 yt-dlp 并加入 PATH。${msg}`,
      500,
      'YTDLP_FAILED',
    )
  }

  const timer = setTimeout(() => proc.kill(), timeoutMs)
  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(proc.stdout),
    readStream(proc.stderr),
    proc.exited,
  ])
  clearTimeout(timer)

  const combined = `${stderr}\n${stdout}`
  if (isRateLimited(combined)) {
    throw new AppError(
      'YouTube 请求过于频繁（429）。请等待 5–15 分钟后重试；或关闭 Chrome 后在 .env 启用 YTDLP_COOKIES_FROM_BROWSER=chrome。',
      429,
      'RATE_LIMITED',
    )
  }

  const lower = combined.toLowerCase()
  if (exitCode !== 0 && (lower.includes('not found') || lower.includes('不是内部或外部命令') || lower.includes('enoent'))) {
    throw new AppError(
      '未找到 yt-dlp。请安装：https://github.com/yt-dlp/yt-dlp#installation',
      500,
      'YTDLP_FAILED',
    )
  }

  return { stdout, stderr, code: exitCode }
}

function getSubtitleStrategies(): Array<{ extra: string[] }> {
  const zh = { extra: ['--skip-download', '--write-subs', '--write-auto-subs', '--sub-langs', 'zh-Hans,zh-Hant,zh,zh-CN'] }
  const en = { extra: ['--skip-download', '--write-subs', '--write-auto-subs', '--sub-langs', 'en,en-US,en-GB'] }
  return config.subtitleLang === 'zh' ? [zh, en] : [en, zh]
}

export class YtDlpTranscriptProvider implements TranscriptProvider {
  readonly name = 'ytdlp'

  async fetch(url: string, workDir: string): Promise<TranscriptResult> {
    await mkdir(workDir, { recursive: true })
    const cookieModes = hasCookieConfig() ? [true, false] : [false]
    let lastError = ''
    let sawCookieError = false

    for (const useCookies of cookieModes) {
      const result = await this.tryDownloadSubs(url, workDir, useCookies)
      if (result.ok)
        return result.data
      lastError = result.error
      if (result.cookieError)
        sawCookieError = true
    }

    if (sawCookieError && !lastError.includes('429')) {
      throw new AppError(
        '无法读取浏览器 Cookies（请关闭 Chrome 后重试，或删除 .env 中的 YTDLP_COOKIES_FROM_BROWSER）。',
        422,
        'YTDLP_FAILED',
      )
    }

    throw new AppError(
      lastError
        ? `无法获取字幕：${lastError.slice(0, 600)}`
        : '该视频没有可用字幕。请换一个有 CC/自动字幕的视频。',
      422,
      'NO_SUBTITLES',
    )
  }

  private async tryDownloadSubs(
    url: string,
    workDir: string,
    useCookies: boolean,
  ): Promise<{ ok: true, data: TranscriptResult } | { ok: false, error: string, cookieError: boolean }> {
    const outputTemplate = '%(id)s.%(ext)s'
    const base = buildBaseArgs(useCookies)
    let lastError = ''
    let cookieError = false

    const strategies = getSubtitleStrategies()
    for (let i = 0; i < strategies.length; i++) {
      if (i > 0)
        await sleep(3000)

      const args = [...base, ...strategies[i].extra, '-o', outputTemplate, url]
      const { stderr, code } = await runYtDlp(args, workDir, config.ytdlpTimeoutMs)

      if (code !== 0) {
        lastError = stderr.trim() || `yt-dlp exited with code ${code}`
        if (isCookieError(lastError))
          cookieError = true
      }

      const subPath = await findSubtitleFile(workDir)
      if (subPath) {
        const title = await this.getTitle(url, useCookies)
        const { transcript, formats } = await readSubtitleBundle(workDir, subPath)
        return {
          ok: true,
          data: { videoTitle: title, transcript, formats },
        }
      }
    }

    return { ok: false, error: lastError, cookieError }
  }

  private async getTitle(url: string, useCookies: boolean): Promise<string> {
    try {
      const { stdout, code } = await runYtDlp(
        [...buildBaseArgs(useCookies), '--skip-download', '--print', 'title:%(title)s', url],
        process.cwd(),
        60_000,
      )
      if (code !== 0)
        return 'YouTube Video'
      const line = stdout.trim().split('\n').map(l => l.replace(/^title:/, '').trim()).filter(Boolean).pop()
      return line || 'YouTube Video'
    }
    catch (e) {
      if (e instanceof AppError && e.code === 'RATE_LIMITED')
        throw e
      return 'YouTube Video'
    }
  }
}

export async function createWorkDir(baseDir: string): Promise<string> {
  const id = crypto.randomUUID()
  const dir = join(baseDir, id)
  await mkdir(dir, { recursive: true })
  return dir
}

export async function cleanupWorkDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true })
  }
  catch {
    // ignore
  }
}

export const ytdlpProvider = new YtDlpTranscriptProvider()
