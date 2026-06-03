import type { TranscriptProvider, TranscriptResult } from './transcript-provider'
import { AppError } from '../lib/errors'

/** Whisper fallback — not implemented in MVP */
export class WhisperTranscriptProvider implements TranscriptProvider {
  readonly name = 'whisper'

  async fetch(_url: string, _workDir: string): Promise<TranscriptResult> {
    throw new AppError(
      'Whisper transcription is not available yet. Try a video with captions.',
      501,
      'WHISPER_NOT_AVAILABLE',
    )
  }
}

export const whisperProvider = new WhisperTranscriptProvider()
