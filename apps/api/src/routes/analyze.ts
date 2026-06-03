import type { AnalyzeRequest, AnalyzeResponse } from '@clipscribe/shared'
import { isValidYoutubeUrl, normalizeYoutubeUrl } from '@clipscribe/shared'
import { AppError } from '../lib/errors'
import { createLlmProvider } from '../services/llm'
import { fetchTranscript } from '../services/transcript-pipeline'

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
  const { videoTitle, transcript, formats } = await fetchTranscript(normalized)

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
