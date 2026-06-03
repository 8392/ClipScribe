import type { TranscriptResult } from './transcript-provider'
import { config } from '../config'
import { AppError } from '../lib/errors'
import { cleanupWorkDir, createWorkDir, ytdlpProvider } from './ytdlp'
import { youtubeCaptionsProvider } from './youtube-captions'

const RETRYABLE = new Set(['RATE_LIMITED', 'NO_SUBTITLES', 'YTDLP_FAILED'])

export async function fetchTranscript(url: string): Promise<TranscriptResult> {
  const workDir = await createWorkDir(config.tempDir)
  const providers = config.isRender
    ? [youtubeCaptionsProvider, ytdlpProvider]
    : [ytdlpProvider, youtubeCaptionsProvider]

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
