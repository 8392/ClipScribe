import type { TranscriptProvider, TranscriptResult } from './transcript-provider'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from '../config'
import { AppError } from '../lib/errors'
import { findSubtitleFile, readSubtitleBundle } from './transcript'
import { getYtdlpCookiesPath, hasServerCookies } from './ytdlp-cookies'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRateLimited(text: string): boolean {
  return /429|too many requests/i.test(text)
}

function isCookieError(text: string): boolean {
  return /cookie database|cookies-from-browser|could not copy chrome/i.test(text)
}

function rateLimitHint(): string {
  if (hasServerCookies()) {
    return 'YouTube 仍返回限流（429）。请等待 15 分钟后重试，或更新 Render 中的 YTDLP_COOKIES_BASE64。'
  }
  if (config.isRender) {
    return 'YouTube 限流（429）。Render 云端 IP 易被拦。请在 Render 环境变量配置 YTDLP_COOKIES_BASE64（见 docs/YOUTUBE_COOKIES.md），或等待 15 分钟后换视频重试。'
  }
  return 'YouTube 限流（429）。请等待 15 分钟后重试；或在 apps/api/.env 设置 YTDLP_COOKIES_FROM_BROWSER=chrome（需先完全关闭 Chrome）。'
}

async function readStream(
  stream: number | ReadableStream<Uint8Array> | null | undefined,
): Promise<string> {
  if (stream == null || typeof stream === 'number')
    return ''
  return new Response(stream).text()
}

function buildBaseArgs(): string[] {
  const args = [
    '--sleep-requests',
    String(config.ytdlpSleepRequestsSec),
    '--sleep-interval',
    '2',
    '--max-sleep-interval',
    '8',
    '--extractor-retries',
    '5',
    '--retry-sleep',
    '15',
    '--no-playlist',
    '--extractor-args',
    'youtube:player_client=android,web',
  ]

  const cookiesPath = getYtdlpCookiesPath()
  if (cookiesPath)
    args.push('--cookies', cookiesPath)
  else if (!config.isRender && config.ytdlpCookiesFromBrowser)
    args.push('--cookies-from-browser', config.ytdlpCookiesFromBrowser)

  return args
}

interface YtDlpRunResult {
  stdout: string
  stderr: string
  code: number
  rateLimited: boolean
}

async function runYtDlp(args: string[], cwd: string, timeoutMs: number): Promise<YtDlpRunResult> {
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
  return {
    stdout,
    stderr,
    code: exitCode,
    rateLimited: isRateLimited(combined),
  }
}

function subtitleLangs(): string {
  return config.subtitleLang === 'zh' ? 'zh-Hans,zh-Hant,zh,en' : 'en,zh-Hans'
}

export class YtDlpTranscriptProvider implements TranscriptProvider {
  readonly name = 'ytdlp'

  async fetch(url: string, workDir: string): Promise<TranscriptResult> {
    await mkdir(workDir, { recursive: true })

    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        console.log('yt-dlp: 429 retry after 60s...')
        await sleep(60_000)
      }

      const result = await this.tryDownloadSubs(url, workDir)
      if (result.ok)
        return result.data
      if (result.rateLimited)
        continue
      throw new AppError(
        result.error
          ? `无法获取字幕：${result.error.slice(0, 600)}`
          : '该视频没有可用字幕。请换一个有 CC/自动字幕的视频。',
        422,
        'NO_SUBTITLES',
      )
    }

    throw new AppError(rateLimitHint(), 429, 'RATE_LIMITED')
  }

  private async tryDownloadSubs(
    url: string,
    workDir: string,
  ): Promise<
    | { ok: true, data: TranscriptResult }
    | { ok: false, rateLimited: boolean, error: string }
  > {
    const outputTemplate = '%(id)s.%(ext)s'
    const base = buildBaseArgs()
    let lastError = ''
    let sawRateLimit = false

    const playerClients = ['android', 'web', 'mweb']
    for (let c = 0; c < playerClients.length; c++) {
      if (c > 0)
        await sleep(8000)

      const args = [
        ...base,
        '--extractor-args',
        `youtube:player_client=${playerClients[c]}`,
        '--skip-download',
        '--write-subs',
        '--write-auto-subs',
        '--sub-langs',
        subtitleLangs(),
        '-o',
        outputTemplate,
        url,
      ]

      const { stderr, code, rateLimited } = await runYtDlp(args, workDir, config.ytdlpTimeoutMs)
      if (rateLimited) {
        sawRateLimit = true
        lastError = stderr.trim() || 'HTTP 429'
        continue
      }

      if (code !== 0)
        lastError = stderr.trim() || `yt-dlp exited with code ${code}`

      const subPath = await findSubtitleFile(workDir)
      if (subPath) {
        const { transcript, formats } = await readSubtitleBundle(workDir, subPath)
        const title = await this.getTitleSafe(url, workDir)
        return {
          ok: true,
          data: { videoTitle: title, transcript, formats },
        }
      }
    }

    return {
      ok: false,
      rateLimited: sawRateLimit,
      error: lastError || 'No subtitles',
    }
  }

  private async getTitleSafe(url: string, workDir: string): Promise<string> {
    try {
      const { stdout, code, rateLimited } = await runYtDlp(
        [...buildBaseArgs(), '--skip-download', '--print', 'title:%(title)s', url],
        workDir,
        45_000,
      )
      if (rateLimited || code !== 0)
        return 'YouTube Video'
      const line = stdout.trim().split('\n').map(l => l.replace(/^title:/, '').trim()).filter(Boolean).pop()
      return line || 'YouTube Video'
    }
    catch {
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
