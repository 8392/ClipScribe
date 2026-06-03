const YOUTUBE_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/i,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/i,
  /^https?:\/\/youtu\.be\/[\w-]+/i,
  /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/i,
]

export function isValidYoutubeUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed)
    return false
  try {
    const parsed = new URL(trimmed)
    if (!['http:', 'https:'].includes(parsed.protocol))
      return false
    return YOUTUBE_PATTERNS.some(p => p.test(trimmed))
  }
  catch {
    return false
  }
}

export function normalizeYoutubeUrl(url: string): string {
  const trimmed = url.trim()
  const parsed = new URL(trimmed)
  const videoId = extractVideoId(trimmed)
  if (videoId)
    return `https://www.youtube.com/watch?v=${videoId}`
  return parsed.href
}

export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    if (parsed.hostname === 'youtu.be')
      return parsed.pathname.slice(1).split('/')[0] || null
    const v = parsed.searchParams.get('v')
    if (v)
      return v
    const shorts = parsed.pathname.match(/\/shorts\/([\w-]+)/)
    if (shorts)
      return shorts[1]
    const embed = parsed.pathname.match(/\/embed\/([\w-]+)/)
    if (embed)
      return embed[1]
    return null
  }
  catch {
    return null
  }
}
