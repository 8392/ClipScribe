export type LlmProviderId = 'qwen' | 'openai'

export interface VideoSummary {
  title: string
  summary: string
  keyPoints: string[]
  details: string
  conclusion: string
  audience: string
}

export interface AnalyzeRequest {
  url: string
}

export interface TranscriptFormats {
  txt: string
  srt: string
  vtt: string
}

export interface AnalyzeResponse {
  videoTitle: string
  transcript: string
  summary: VideoSummary
  formats: TranscriptFormats
}

export type ErrorCode
  = | 'INVALID_URL'
    | 'NO_SUBTITLES'
    | 'RATE_LIMITED'
    | 'YTDLP_FAILED'
    | 'LLM_FAILED'
    | 'WHISPER_NOT_AVAILABLE'
    | 'INTERNAL_ERROR'

export interface ApiErrorResponse {
  error: string
  code: ErrorCode
}

export interface LlmConfig {
  provider: LlmProviderId
  model: string
  dashscopeApiKey?: string
  openaiApiKey?: string
  openaiBaseUrl?: string
}
