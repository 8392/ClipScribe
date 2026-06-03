import type { AnalyzeRequest, AnalyzeResponse } from '@clipscribe/shared'
import { buildTranscriptFormats, isValidYoutubeUrl, normalizeYoutubeUrl } from '@clipscribe/shared'
import { AppError } from '../lib/errors'
import { createLlmProvider } from '../services/llm'
import { fetchTranscript } from '../services/transcript-pipeline'

const MAX_TRANSCRIPT_CHARS = 500_000

export async function handleAnalyze(req: Request): Promise<Response> {
  let body: AnalyzeRequest
  try {
    body = await req.json() as AnalyzeRequest
  }
  catch {
    throw new AppError('Invalid JSON body', 400, 'INVALID_URL')
  }

  const url = body?.url?.trim()
  if (!url || !isValidYoutubeUrl(url)) {
    throw new AppError('Invalid YouTube URL', 400, 'INVALID_URL')
  }

  const normalized = normalizeYoutubeUrl(url)

  let videoTitle: string
  let transcript: string
  let formats: AnalyzeResponse['formats']

  const clientTranscript = body.transcript?.trim()
  if (clientTranscript) {
    if (clientTranscript.length > MAX_TRANSCRIPT_CHARS) {
      throw new AppError('Transcript too long', 400, 'INVALID_URL')
    }
    transcript = clientTranscript
    videoTitle = body.videoTitle?.trim() || 'YouTube Video'
    formats = buildTranscriptFormats(transcript)
    console.log('analyze: using client-provided transcript')
  }
  else {
    const fetched = await fetchTranscript(normalized)
    videoTitle = fetched.videoTitle
    transcript = fetched.transcript
    formats = fetched.formats
  }

  if (!transcript.trim()) {
    throw new AppError('Empty transcript', 422, 'NO_SUBTITLES')
  }

  const llm = createLlmProvider()
  const summary = await llm.summarize(transcript, videoTitle)

  const response: AnalyzeResponse = {
    videoTitle,
    transcript,
    summary,
    formats,
  }

  return Response.json(response)
}
