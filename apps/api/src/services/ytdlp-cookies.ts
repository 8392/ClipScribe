import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from '../config'

let resolvedCookiesPath: string | null = null

export async function initYtdlpCookies(): Promise<void> {
  if (config.ytdlpCookiesFile) {
    resolvedCookiesPath = config.ytdlpCookiesFile
    return
  }

  const raw = config.ytdlpCookiesBase64
  if (!raw)
    return

  try {
    const content = Buffer.from(raw, 'base64').toString('utf8')
    const dir = join(config.tempDir, '_cookies')
    await mkdir(dir, { recursive: true })
    resolvedCookiesPath = join(dir, 'youtube.txt')
    await writeFile(resolvedCookiesPath, content, 'utf8')
    console.log('yt-dlp: loaded cookies from YTDLP_COOKIES_BASE64 (also used for page caption fetch)')
  }
  catch (e) {
    console.error('Failed to load YTDLP_COOKIES_BASE64:', e)
  }
}

export function getYtdlpCookiesPath(): string | null {
  return resolvedCookiesPath
}

export function hasServerCookies(): boolean {
  return Boolean(resolvedCookiesPath)
}
