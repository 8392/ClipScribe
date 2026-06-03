import { extractVideoId } from '@clipscribe/shared'
import type { TranscriptProvider, TranscriptResult } from './transcript-provider'
import { config } from '../config'
import { AppError } from '../lib/errors'
import { plainTextToSrt, plainTextToVtt } from './transcript'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

interface CaptionTrack {
  baseUrl: string
  languageCode?: string
  kind?: string
  name?: { simpleText?: string }
}

function isRateLimited(status: number, body: string): boolean {
  return status === 429 || /too many requests/i.test(body)
}

function parsePlayerResponse(html: string): Record<string, unknown> | null {
  const marker = 'ytInitialPlayerResponse = '
  const idx = html.indexOf(marker)
  if (idx < 0)
    return null
  const jsonStart = idx + marker.length
  if (html[jsonStart] !== '{')
    return null

  let depth = 0
  for (let i = jsonStart; i < html.length; i++) {
    const c = html[i]
    if (c === '{')
      depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(jsonStart, i + 1)) as Record<string, unknown>
        }
        catch {
          return null
        }
      }
    }
  }
  return null
}

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length)
    return null

  const preferZh = config.subtitleLang === 'zh'
  const score = (t: CaptionTrack): number => {
    const lang = (t.languageCode || '').toLowerCase()
    const manual = t.kind !== 'asr' ? 4 : 0
    if (preferZh) {
      if (lang.startsWith('zh'))
        return 10 + manual
      if (lang === 'en')
        return 5 + manual
    }
    else {
      if (lang === 'en')
        return 10 + manual
      if (lang.startsWith('zh'))
        return 5 + manual
    }
    return manual
  }

  return [...tracks].sort((a, b) => score(b) - score(a))[0] ?? null
}

function xmlTranscriptToPlain(xml: string): string {
  const lines: string[] = []
  const re = /<text[^>]*>([\s\S]*?)<\/text>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const text = m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, '\'')
      .replace(/\n/g, ' ')
      .trim()
    if (text)
      lines.push(text)
  }
  return lines.filter((line, i, arr) => line !== arr[i - 1]).join('\n')
}

function vttOrXmlToPlain(body: string): string {
  if (/^WEBVTT/m.test(body))
    return body
      .replace(/^WEBVTT.*$/gm, '')
      .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, '')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .filter((line, i, arr) => line !== arr[i - 1])
      .join('\n')
  return xmlTranscriptToPlain(body)
}

async function fetchText(url: string, timeoutMs: number): Promise<{ status: number, body: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        'Accept-Language': config.subtitleLang === 'zh' ? 'zh-CN,zh;q=0.9,en;q=0.8' : 'en-US,en;q=0.9',
      },
    })
    const body = await res.text()
    return { status: res.status, body }
  }
  finally {
    clearTimeout(timer)
  }
}

export class YoutubeCaptionsProvider implements TranscriptProvider {
  readonly name = 'youtube-captions'

  async fetch(url: string, _workDir: string): Promise<TranscriptResult> {
    const videoId = extractVideoId(url)
    if (!videoId)
      throw new AppError('无效的 YouTube 链接', 400, 'INVALID_URL')

    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
    const page = await fetchText(watchUrl, config.youtubePageTimeoutMs)
    if (isRateLimited(page.status, page.body))
      throw new AppError('YouTube 页面请求被限流', 429, 'RATE_LIMITED')
    if (page.status !== 200)
      throw new AppError(`无法加载视频页（HTTP ${page.status}）`, 502, 'YTDLP_FAILED')

    const player = parsePlayerResponse(page.body)
    const captions = player?.captions as Record<string, unknown> | undefined
    const list = captions?.playerCaptionsTracklistRenderer as Record<string, unknown> | undefined
    const tracks = (list?.captionTracks as CaptionTrack[] | undefined) ?? []
    const track = pickTrack(tracks)
    if (!track?.baseUrl)
      throw new AppError('该视频没有可用字幕', 422, 'NO_SUBTITLES')

    const captionUrl = track.baseUrl.includes('fmt=')
      ? track.baseUrl
      : `${track.baseUrl}${track.baseUrl.includes('?') ? '&' : '?'}fmt=vtt`
    const cap = await fetchText(captionUrl, config.youtubeCaptionTimeoutMs)
    if (isRateLimited(cap.status, cap.body))
      throw new AppError('YouTube 字幕请求被限流', 429, 'RATE_LIMITED')
    if (cap.status !== 200 || !cap.body.trim())
      throw new AppError('无法下载字幕轨道', 502, 'YTDLP_FAILED')

    const plain = vttOrXmlToPlain(cap.body)
    if (!plain.trim())
      throw new AppError('字幕内容为空', 422, 'NO_SUBTITLES')

    const details = player?.videoDetails as { title?: string } | undefined
    const title = details?.title?.trim() || 'YouTube Video'
    const vtt = cap.body.startsWith('WEBVTT') ? cap.body : plainTextToVtt(plain)
    const srt = plainTextToSrt(plain)
    const formats = { txt: plain, srt, vtt }

    return { videoTitle: title, transcript: plain, formats }
  }
}

export const youtubeCaptionsProvider = new YoutubeCaptionsProvider()
