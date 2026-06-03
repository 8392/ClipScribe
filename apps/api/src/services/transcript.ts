import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function findSubtitleFile(dir: string): Promise<string | null> {
  const files = await readdir(dir)
  const subs = files.filter(f =>
    /\.(vtt|srt|ass)$/i.test(f) && !f.endsWith('.json3'),
  )
  const manual = subs.filter(f => !/\.auto\./i.test(f))
  const pick = manual[0] ?? subs[0]
  return pick ? join(dir, pick) : null
}

export function vttToPlainText(vtt: string): string {
  return vtt
    .replace(/^WEBVTT.*$/gm, '')
    .replace(/^\d+$/gm, '')
    .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*$/gm, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter((line, i, arr) => line !== arr[i - 1])
    .join('\n')
}

export function srtToPlainText(srt: string): string {
  return srt
    .replace(/^\d+$/gm, '')
    .replace(/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/g, '')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter((line, i, arr) => line !== arr[i - 1])
    .join('\n')
}

export function toPlainText(content: string, filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.vtt'))
    return vttToPlainText(content)
  if (lower.endsWith('.srt'))
    return srtToPlainText(content)
  return content.trim()
}

export function plainTextToVtt(text: string): string {
  const lines = text.split('\n').filter(Boolean)
  let t = 0
  const blocks: string[] = ['WEBVTT', '']
  for (const line of lines) {
    const start = formatVttTime(t)
    t += 3
    const end = formatVttTime(t)
    blocks.push(`${start} --> ${end}`, line, '')
  }
  return blocks.join('\n')
}

export function plainTextToSrt(text: string): string {
  const lines = text.split('\n').filter(Boolean)
  let t = 0
  const blocks: string[] = []
  lines.forEach((line, i) => {
    const start = formatSrtTime(t)
    t += 3
    const end = formatSrtTime(t)
    blocks.push(String(i + 1), `${start} --> ${end}`, line, '')
  })
  return blocks.join('\n')
}

function formatVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${pad(h)}:${pad(m)}:${s.toFixed(3).padStart(6, '0')}`
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, '0')}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export async function buildFormats(
  rawPath: string,
  rawContent: string,
): Promise<{ txt: string, srt: string, vtt: string }> {
  const plain = toPlainText(rawContent, rawPath)
  const lower = rawPath.toLowerCase()
  let srt = rawContent
  let vtt = rawContent
  if (lower.endsWith('.vtt')) {
    srt = vttToSrtApprox(rawContent) || plainTextToSrt(plain)
    vtt = rawContent
  }
  else if (lower.endsWith('.srt')) {
    vtt = plainTextToVtt(plain)
    srt = rawContent
  }
  else {
    srt = plainTextToSrt(plain)
    vtt = plainTextToVtt(plain)
  }
  return { txt: plain, srt, vtt }
}

function vttToSrtApprox(vtt: string): string | null {
  try {
    const plain = vttToPlainText(vtt)
    return plainTextToSrt(plain)
  }
  catch {
    return null
  }
}

export async function readSubtitleBundle(dir: string, subPath: string) {
  const raw = await readFile(subPath, 'utf-8')
  const formats = await buildFormats(subPath, raw)
  return { transcript: formats.txt, formats }
}
