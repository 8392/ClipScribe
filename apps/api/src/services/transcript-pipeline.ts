import type { TranscriptResult } from './transcript-provider'
import { config } from '../config'
import { AppError } from '../lib/errors'
import { cleanupWorkDir, createWorkDir, ytdlpProvider } from './ytdlp'

export async function fetchTranscript(url: string): Promise<TranscriptResult> {
  const workDir = await createWorkDir(config.tempDir)
  try {
    return await ytdlpProvider.fetch(url, workDir)
  }
  catch (error) {
    if (error instanceof AppError)
      throw error
    const message = error instanceof Error ? error.message : 'Subtitle fetch failed'
    throw new AppError(message, 502, 'YTDLP_FAILED')
  }
  finally {
    await cleanupWorkDir(workDir)
  }
}
