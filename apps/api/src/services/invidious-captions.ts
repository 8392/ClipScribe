import { extractVideoId } from '@clipscribe/shared'
import type { TranscriptProvider, TranscriptResult } from './transcript-provider'
import { config } from '../config'
import { AppError } from '../lib/errors'
import { plainTextToSrt, plainTextToVtt } from './transcript'

const INVIDIOUS_INSTANCES = [
  'https://invidious.fdn.fr',
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.nerdvpn.de',
  'https://invidious.private.coffee',
]

interface InvidiousCaptionMeta {
  label: string
  language_code?: string
  languageCode?: string
}

function pickCaptionMeta(list: InvidiousCaptionMeta[]): InvidiousCaptionMeta | null {
  if (!list.length)
    return null
  const preferZh = config.subtitleLang === 'zh'
  const score = (c: InvidiousCaptionMeta): number => {
    const code = (c.language_code || c.languageCode || c.label || '').toLowerCase()
    if (preferZh) {
      if (code.includes('zh') || code.includes('chinese'))
        return 10
      if (code.includes('en') || code.includes('english'))
        return 5
    }
    else {
      if (code.includes('en') || code.includes('english'))
        return 10
      if (code.includes('zh') || code.includes('chinese'))
        return 5
    }
    return 1
  }
  return [...list].sort((a, b) => score(b) - score(a))[0] ?? null
}

function vttOrXmlToPlain(body: string): string {
  if (/^WEBVTT/m.test(body)) {
    return body
      .replace(/^WEBVTT.*$/gm, '')
      .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, '')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .filter((line, i, arr) => line !== arr[i - 1])
      .join('\n')
  }
  const lines: string[] = []
  const re = /<text[^>]*>([\s\S]*?)<\/text>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').trim()
    if (text)
      lines.push(text)
  }
  return lines.filter((line, i, arr) => line !== arr[i - 1]).join('\n')
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok)
      return null
    return await res.text()
  }
  catch {
    return null
  }
  finally {
    clearTimeout(timer)
  }
}

export class InvidiousCaptionsProvider implements TranscriptProvider {
  readonly name = 'invidious'

  async fetch(url: string, _workDir: string): Promise<TranscriptResult> {
    const videoId = extractVideoId(url)
    if (!videoId)
      throw new AppError('无效的 YouTube 链接', 400, 'INVALID_URL')

    const timeout = config.youtubePageTimeoutMs
    let lastError = 'Invidious 实例不可用'

    for (const base of INVIDIOUS_INSTANCES) {
      const listRaw = await fetchText(`${base}/api/v1/captions/${videoId}`, timeout)
      if (!listRaw)
        continue

      let list: InvidiousCaptionMeta[]
      try {
        list = JSON.parse(listRaw) as InvidiousCaptionMeta[]
      }
      catch {
        continue
      }
      if (!Array.isArray(list) || !list.length) {
        lastError = '该视频无字幕'
        continue
      }

      const meta = pickCaptionMeta(list)
      if (!meta?.label) {
        lastError = '无匹配语言字幕'
        continue
      }

      const label = encodeURIComponent(meta.label)
      const subRaw = await fetchText(
        `${base}/api/v1/captions/${videoId}?label=${label}`,
        config.youtubeCaptionTimeoutMs,
      )
      if (!subRaw?.trim()) {
        lastError = '字幕下载失败'
        continue
      }

      const plain = vttOrXmlToPlain(subRaw)
      if (!plain.trim()) {
        lastError = '字幕内容为空'
        continue
      }

      let title = 'YouTube Video'
      const videoRaw = await fetchText(`${base}/api/v1/videos/${videoId}`, timeout)
      if (videoRaw) {
        try {
          const video = JSON.parse(videoRaw) as { title?: string }
          if (video.title?.trim())
            title = video.title.trim()
        }
        catch { /* ignore */ }
      }

      const vtt = /^WEBVTT/m.test(subRaw) ? subRaw : plainTextToVtt(plain)
      const srt = plainTextToSrt(plain)
      return {
        videoTitle: title,
        transcript: plain,
        formats: { txt: plain, srt, vtt },
      }
    }

    throw new AppError(lastError, 502, 'YTDLP_FAILED')
  }
}

export const invidiousCaptionsProvider = new InvidiousCaptionsProvider()
