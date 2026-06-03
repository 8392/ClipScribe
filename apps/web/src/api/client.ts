import type { AnalyzeRequest, AnalyzeResponse, ApiErrorResponse, ErrorCode } from '@clipscribe/shared'

const PROD_API_FALLBACK = 'https://clipscribe-api.onrender.com'

/** Render 免费实例冷启动 + 字幕 + LLM 可能超过 2 分钟 */
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
      ? '请求超时。Render 免费实例唤醒较慢，请稍等 1 分钟后重试；若仍失败，可先刷新页面再点「分析」。'
      : '请求超时，请稍后重试。'
  }
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return isRemoteApi()
      ? '无法连接 API 服务器（Failed to fetch）。常见原因：Render 实例正在冷启动（约 30–90 秒），请等待后重试；或检查网络与 CORS。'
      : '无法连接 API，请确认本地 API 已启动（apps/api）。'
  }
  return err instanceof Error ? err.message : '请求失败'
}

/** 唤醒 Render 等休眠中的 API，避免首次 /api/analyze 在 TCP 阶段超时 */
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
  if (code === 'RATE_LIMITED' && /YTDLP_COOKIES|YOUTUBE_COOKIES|限流/.test(message))
    return message

  const hints: Partial<Record<ErrorCode, string>> = {
    RATE_LIMITED:
      '（YouTube 限流：请稍后重试，或在 Render 配置 YTDLP_COOKIES_BASE64，见 docs/YOUTUBE_COOKIES.md）',
    NO_SUBTITLES: '（请换一个有字幕的视频）',
    YTDLP_FAILED: '（请确认已安装 yt-dlp，或检查 .env 中的 Cookies 配置）',
    LLM_FAILED: '（请检查 apps/api/.env 中的 DASHSCOPE_API_KEY）',
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
    onStatus?.('正在连接 API 服务器（免费实例首次唤醒可能需要 1 分钟）…')
    try {
      await warmupApi()
    }
    catch (e) {
      throw new ApiClientError(networkErrorMessage(e))
    }
  }

  onStatus?.('正在提取字幕并生成 AI 总结…')

  let res: Response
  try {
    res = await fetchWithTimeout(
      `${API_BASE}/api/analyze`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url } satisfies AnalyzeRequest),
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
