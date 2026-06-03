import type { TranscriptResult } from './transcript-provider'
import { config } from '../config'
import { AppError } from '../lib/errors'
import { cleanupWorkDir, createWorkDir, ytdlpProvider } from './ytdlp'
import { hasServerCookies } from './ytdlp-cookies'
import { proxyCaptionsProvider } from './proxy-captions'
import { youtubeCaptionsProvider } from './youtube-captions'

const RETRYABLE = new Set(['RATE_LIMITED', 'NO_SUBTITLES', 'YTDLP_FAILED'])

function buildProviders() {
  if (config.isRender) {
    if (hasServerCookies())
      return [proxyCaptionsProvider, youtubeCaptionsProvider, ytdlpProvider]
    // 无 Cookie：仅代理，避免直连 YouTube 触发 429 提示
    return [proxyCaptionsProvider]
  }
  return [ytdlpProvider, proxyCaptionsProvider, youtubeCaptionsProvider]
}

export async function fetchTranscript(url: string): Promise<TranscriptResult> {
  const workDir = await createWorkDir(config.tempDir)
  const providers = buildProviders()

  let lastError: AppError | null = null

  try {
    for (const provider of providers) {
      try {
        console.log(`transcript: trying ${provider.name}`)
        return await provider.fetch(url, workDir)
      }
      catch (error) {
        if (error instanceof AppError) {
          lastError = error
          if (RETRYABLE.has(error.code ?? ''))
            continue
          throw error
        }
        const message = error instanceof Error ? error.message : 'Subtitle fetch failed'
        lastError = new AppError(message, 502, 'YTDLP_FAILED')
      }
    }

    if (config.isRender && !hasServerCookies()) {
      throw new AppError(
        '服务器无法拉取字幕。请刷新页面后重试（将使用您浏览器的网络获取字幕）；仍失败可在 Render 配置 YTDLP_COOKIES_BASE64，见 docs/YOUTUBE_COOKIES.md。',
        502,
        'YTDLP_FAILED',
      )
    }

    if (lastError)
      throw lastError
    throw new AppError('无法获取字幕', 502, 'YTDLP_FAILED')
  }
  finally {
    await cleanupWorkDir(workDir)
  }
}
