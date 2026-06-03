import type { AnalyzeRequest, AnalyzeResponse, ApiErrorResponse, ErrorCode } from '@clipscribe/shared'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || ''

export class ApiClientError extends Error {
  code?: ErrorCode

  constructor(message: string, code?: ErrorCode) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
  }
}

export function formatApiError(message: string, code?: ErrorCode): string {
  const hints: Partial<Record<ErrorCode, string>> = {
    RATE_LIMITED: '（YouTube 限流：请稍后再试）',
    NO_SUBTITLES: '（请换一个有字幕的视频）',
    YTDLP_FAILED: '（请确认已安装 yt-dlp，或检查 .env 中的 Cookies 配置）',
    LLM_FAILED: '（请检查 apps/api/.env 中的 DASHSCOPE_API_KEY）',
    INVALID_URL: '（请检查 YouTube 链接格式）',
  }
  const hint = code ? hints[code] : ''
  return `${message}${hint ? ` ${hint}` : ''}`
}

export async function analyzeVideo(url: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url } satisfies AnalyzeRequest),
  })

  if (!res.ok) {
    let message = `请求失败 (${res.status})`
    let code: ErrorCode | undefined
    try {
      const err = await res.json() as ApiErrorResponse
      if (err.error)
        message = err.error
      code = err.code
    }
    catch {
      // ignore
    }
    throw new ApiClientError(formatApiError(message, code), code)
  }

  return res.json() as Promise<AnalyzeResponse>
}

export function downloadText(content: string, filename: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
