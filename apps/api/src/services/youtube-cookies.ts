import { readFile } from 'node:fs/promises'
import { getYtdlpCookiesPath } from './ytdlp-cookies'

interface ParsedCookie {
  domain: string
  name: string
  value: string
}

let cachedHeader: string | null | undefined

function parseNetscapeCookies(content: string): ParsedCookie[] {
  const out: ParsedCookie[] = []
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#'))
      continue
    const parts = line.split('\t')
    if (parts.length < 7)
      continue
    const domain = parts[0]
    const name = parts[5]
    const value = parts.slice(6).join('\t')
    if (!name)
      continue
    if (domain.includes('youtube.com') || domain.includes('google.com'))
      out.push({ domain, name, value })
  }
  return out
}

function buildCookieHeader(cookies: ParsedCookie[]): string {
  const seen = new Set<string>()
  const pairs: string[] = []
  for (const c of cookies) {
    if (seen.has(c.name))
      continue
    seen.add(c.name)
    pairs.push(`${c.name}=${c.value}`)
  }
  return pairs.join('; ')
}

/** 供 fetch / InnerTube 使用的 Cookie 头（与 yt-dlp cookies 文件同源） */
export async function getYoutubeCookieHeader(): Promise<string | null> {
  if (cachedHeader !== undefined)
    return cachedHeader

  const path = getYtdlpCookiesPath()
  if (!path) {
    cachedHeader = null
    return null
  }

  try {
    const raw = await readFile(path, 'utf8')
    const header = buildCookieHeader(parseNetscapeCookies(raw))
    cachedHeader = header || null
    return cachedHeader
  }
  catch {
    cachedHeader = null
    return null
  }
}

export function invalidateYoutubeCookieHeader(): void {
  cachedHeader = undefined
}
