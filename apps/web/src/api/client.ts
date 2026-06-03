import type { AnalyzeRequest, AnalyzeResponse, ApiErrorResponse, ErrorCode } from '@clipscribe/shared'
import { fetchTranscriptViaProxies } from '@clipscribe/shared'

const PROD_API_FALLBACK = 'https://clipscribe-api.onrender.com'

const WARMUP_TIMEOUT_MS = 120_000
const ANALYZE_TIMEOUT_MS = 300_000

function resolveApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE as string | undefined)?.trim()
  if (fromEnv)
    return fromEnv.replace(/\/$/, '')
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io'))
    return PROD_API_FALLBACK
  return ''
}

const API_BASE = resolveApiBase()

export function getApiBase(): string {
  return API_BASE
}

export function isRemoteApi(): boolean {
  return Boolean(API_BASE && !API_BASE.includes('localhost') && !API_BASE.includes('127.0.0.1'))
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  }
  finally {
    clearTimeout(timer)
  }
}

function networkErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return isRemoteApi()
      ? '请求超时。Render 免费实例唤醒较慢，请稍等 1 分钟后重试。'
      : '请求超时，请稍后重试。'
  }
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return isRemoteApi()
      ? '无法连接 API 服务器。请确认 Render 已启动，或稍后重试。'
      : '无法连接 API，请确认本地 API 已启动（apps/api）。'
  }
  return err instanceof Error ? err.message : '请求失败'
}

export async function warmupApi(): Promise<void> {
  if (!API_BASE)
    return
  await fetchWithTimeout(`${API_BASE}/health`, { method: 'GET' }, WARMUP_TIMEOUT_MS)
}

export class ApiClientError extends Error {
  code?: ErrorCode

  constructor(message: string, code?: ErrorCode) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
  }
}

export function formatApiError(message: string, code?: ErrorCode): string {
  if (code === 'RATE_LIMITED' && /YTDLP_COOKIES|YOUTUBE_COOKIES|限流|刷新/.test(message))
    return message

  const hints: Partial<Record<ErrorCode, string>> = {
    RATE_LIMITED: '（YouTube 限流，请刷新重试或配置 Render Cookie）',
    NO_SUBTITLES: '（请换一个有字幕的视频）',
    YTDLP_FAILED: '（请换视频或稍后重试）',
    LLM_FAILED: '（请检查 DASHSCOPE_API_KEY）',
    INVALID_URL: '（请检查 YouTube 链接格式）',
  }
  const hint = code ? hints[code] : ''
  return `${message}${hint ? ` ${hint}` : ''}`
}

export async function analyzeVideo(
  url: string,
  onStatus?: (message: string) => void,
): Promise<AnalyzeResponse> {
  if (isRemoteApi()) {
    onStatus?.('正在连接 API 服务器…')
    try {
      await warmupApi()
    }
    catch (e) {
      throw new ApiClientError(networkErrorMessage(e))
    }

    onStatus?.('正在用您的浏览器网络获取字幕…')
    const local = await fetchTranscriptViaProxies(url, {
      preferZh: true,
      pageTimeoutMs: 30_000,
      captionTimeoutMs: 45_000,
    })

    if (local?.transcript?.trim()) {
      onStatus?.('字幕已获取，正在生成 AI 总结…')
      return postAnalyze({
        url,
        transcript: local.transcript,
        videoTitle: local.videoTitle,
      })
    }
  }

  onStatus?.('正在通过服务器获取字幕并总结…')
  return postAnalyze({ url })
}

async function postAnalyze(body: AnalyzeRequest): Promise<AnalyzeResponse> {
  let res: Response
  try {
    res = await fetchWithTimeout(
      `${API_BASE}/api/analyze`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      ANALYZE_TIMEOUT_MS,
    )
  }
  catch (e) {
    throw new ApiClientError(networkErrorMessage(e))
  }

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
