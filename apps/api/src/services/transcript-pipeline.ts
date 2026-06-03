import type { TranscriptResult } from './transcript-provider'
import { config } from '../config'
import { AppError } from '../lib/errors'
import { cleanupWorkDir, createWorkDir, ytdlpProvider } from './ytdlp'
import { hasServerCookies } from './ytdlp-cookies'
import { invidiousCaptionsProvider } from './invidious-captions'
import { pipedCaptionsProvider } from './piped-captions'
import { youtubeCaptionsProvider } from './youtube-captions'

const RETRYABLE = new Set(['RATE_LIMITED', 'NO_SUBTITLES', 'YTDLP_FAILED'])

function buildProviders() {
  if (config.isRender) {
    if (hasServerCookies())
      return [youtubeCaptionsProvider, pipedCaptionsProvider, invidiousCaptionsProvider, ytdlpProvider]
    // 无 Cookie：先走第三方代理，避免直连 youtube.com 被机房 IP 限流
    return [pipedCaptionsProvider, invidiousCaptionsProvider, youtubeCaptionsProvider]
  }
  return [ytdlpProvider, youtubeCaptionsProvider, pipedCaptionsProvider]
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

    if (lastError)
      throw lastError
    throw new AppError('无法获取字幕', 502, 'YTDLP_FAILED')
  }
  finally {
    await cleanupWorkDir(workDir)
  }
}
