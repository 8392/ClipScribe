import type { VideoSummary } from '@clipscribe/shared'

export function parseSummaryJson(raw: string): VideoSummary {
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence)
    text = fence[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start)
    text = text.slice(start, end + 1)

  const parsed = JSON.parse(text) as Partial<VideoSummary>
  return {
    title: String(parsed.title ?? ''),
    summary: String(parsed.summary ?? ''),
    keyPoints: Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints.map(String)
      : [],
    details: String(parsed.details ?? ''),
    conclusion: String(parsed.conclusion ?? ''),
    audience: String(parsed.audience ?? ''),
  }
}
