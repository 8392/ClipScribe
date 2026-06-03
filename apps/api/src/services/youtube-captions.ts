import { extractVideoId } from '@clipscribe/shared'
import type { TranscriptProvider, TranscriptResult } from './transcript-provider'
import { config } from '../config'
import { AppError } from '../lib/errors'
import { plainTextToSrt, plainTextToVtt } from './transcript'
import { hasServerCookies } from './ytdlp-cookies'
import { getYoutubeCookieHeader } from './youtube-cookies'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const INNERTUBE_ANDROID_KEY = 'AIzaSyA8eiZmM1FaDVBDdkkeR8_qtR7D_1NQX0E'

interface CaptionTrack {
  baseUrl: string
  languageCode?: string
  kind?: string
  name?: { simpleText?: string }
}

function isRateLimited(status: number, body: string): boolean {
  return status === 429 || /too many requests|login required|consent/i.test(body)
}

function captionTracksFromPlayer(player: Record<string, unknown>): CaptionTrack[] {
  const captions = player.captions as Record<string, unknown> | undefined
  const list = captions?.playerCaptionsTracklistRenderer as Record<string, unknown> | undefined
  return (list?.captionTracks as CaptionTrack[] | undefined) ?? []
}

function videoTitleFromPlayer(player: Record<string, unknown>): string {
  const details = player.videoDetails as { title?: string } | undefined
  return details?.title?.trim() || 'YouTube Video'
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

async function baseFetchHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Accept-Language': config.subtitleLang === 'zh' ? 'zh-CN,zh;q=0.9,en;q=0.8' : 'en-US,en;q=0.9',
    Accept: 'text/html,application/json,*/*',
  }
  const cookie = await getYoutubeCookieHeader()
  if (cookie)
    headers.Cookie = cookie
  return headers
}

async function fetchText(
  url: string,
  timeoutMs: number,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number, body: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { ...await baseFetchHeaders(), ...extraHeaders },
    })
    const body = await res.text()
    return { status: res.status, body }
  }
  finally {
    clearTimeout(timer)
  }
}

async function fetchJsonPost(url: string, payload: unknown, timeoutMs: number): Promise<{ status: number, body: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        ...await baseFetchHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const body = await res.text()
    return { status: res.status, body }
  }
  finally {
    clearTimeout(timer)
  }
}

async function fetchViaInnertube(videoId: string): Promise<Record<string, unknown> | null> {
  const hl = config.subtitleLang === 'zh' ? 'zh-CN' : 'en'
  const payload = {
    context: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '20.10.38',
        androidSdkVersion: 30,
        hl,
        gl: 'US',
      },
    },
    videoId,
  }

  const { status, body } = await fetchJsonPost(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_ANDROID_KEY}`,
    payload,
    config.youtubePageTimeoutMs,
  )

  if (status !== 200 || isRateLimited(status, body))
    return null

  try {
    return JSON.parse(body) as Record<string, unknown>
  }
  catch {
    return null
  }
}

async function fetchPlayerFromWatchPage(videoId: string): Promise<Record<string, unknown> | null> {
  const urls = [
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://m.youtube.com/watch?v=${videoId}`,
  ]

  for (const watchUrl of urls) {
    const page = await fetchText(watchUrl, config.youtubePageTimeoutMs)
    if (isRateLimited(page.status, page.body))
      continue
    if (page.status !== 200)
      continue
    const player = parsePlayerResponse(page.body)
    if (player)
      return player
  }
  return null
}

async function loadPlayer(videoId: string): Promise<Record<string, unknown>> {
  const strategies: Array<() => Promise<Record<string, unknown> | null>> = config.isRender
    ? [() => fetchViaInnertube(videoId), () => fetchPlayerFromWatchPage(videoId)]
    : [() => fetchPlayerFromWatchPage(videoId), () => fetchViaInnertube(videoId)]

  for (const run of strategies) {
    const player = await run()
    if (player && captionTracksFromPlayer(player).length > 0)
      return player
    if (player?.videoDetails)
      return player
  }

  const probe = await fetchText(
    `https://www.youtube.com/watch?v=${videoId}`,
    config.youtubePageTimeoutMs,
  )
  if (isRateLimited(probe.status, probe.body)) {
    const hint = hasServerCookies()
      ? 'Cookies 已配置但仍被限流，请重新导出 cookies 并更新 YTDLP_COOKIES_BASE64，等待 15 分钟后重试。'
      : 'Render 机房 IP 被 YouTube 限流。请在 Render 环境变量配置 YTDLP_COOKIES_BASE64（导出浏览器 youtube.com cookies），详见 docs/YOUTUBE_COOKIES.md。'
    throw new AppError(`YouTube 页面请求被限流。${hint}`, 429, 'RATE_LIMITED')
  }

  throw new AppError('无法获取视频信息（页面无字幕数据）', 502, 'YTDLP_FAILED')
}

function rateLimitMessage(): string {
  if (hasServerCookies()) {
    return 'YouTube 仍返回限流（429）。请重新导出 cookies 更新 YTDLP_COOKIES_BASE64，或等待 15 分钟后重试。'
  }
  if (config.isRender) {
    return 'YouTube 限流（429）。请在 Render 配置 YTDLP_COOKIES_BASE64（见 docs/YOUTUBE_COOKIES.md），导出时请先登录 youtube.com。'
  }
  return 'YouTube 限流（429）。可在 apps/api/.env 设置 YTDLP_COOKIES_FROM_BROWSER=chrome（需先完全关闭 Chrome）。'
}

export class YoutubeCaptionsProvider implements TranscriptProvider {
  readonly name = 'youtube-captions'

  async fetch(url: string, _workDir: string): Promise<TranscriptResult> {
    const videoId = extractVideoId(url)
    if (!videoId)
      throw new AppError('无效的 YouTube 链接', 400, 'INVALID_URL')

    const player = await loadPlayer(videoId)
    const tracks = captionTracksFromPlayer(player)
    const track = pickTrack(tracks)
    if (!track?.baseUrl)
      throw new AppError('该视频没有可用字幕', 422, 'NO_SUBTITLES')

    const captionUrl = track.baseUrl.includes('fmt=')
      ? track.baseUrl
      : `${track.baseUrl}${track.baseUrl.includes('?') ? '&' : '?'}fmt=vtt`
    const cap = await fetchText(captionUrl, config.youtubeCaptionTimeoutMs)
    if (isRateLimited(cap.status, cap.body))
      throw new AppError(rateLimitMessage(), 429, 'RATE_LIMITED')
    if (cap.status !== 200 || !cap.body.trim())
      throw new AppError('无法下载字幕轨道', 502, 'YTDLP_FAILED')

    const plain = vttOrXmlToPlain(cap.body)
    if (!plain.trim())
      throw new AppError('字幕内容为空', 422, 'NO_SUBTITLES')

    const title = videoTitleFromPlayer(player)
    const vtt = cap.body.startsWith('WEBVTT') ? cap.body : plainTextToVtt(plain)
    const srt = plainTextToSrt(plain)
    const formats = { txt: plain, srt, vtt }

    return { videoTitle: title, transcript: plain, formats }
  }
}

export const youtubeCaptionsProvider = new YoutubeCaptionsProvider()
