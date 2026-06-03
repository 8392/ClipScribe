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

export function subtitleBodyToPlain(body: string): string {
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

export function buildTranscriptFormats(plain: string): { txt: string, srt: string, vtt: string } {
  return { txt: plain, srt: plainTextToSrt(plain), vtt: plainTextToVtt(plain) }
}
