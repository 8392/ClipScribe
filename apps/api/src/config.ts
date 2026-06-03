import type { LlmConfig, LlmProviderId } from '@clipscribe/shared'

function env(key: string, fallback = ''): string {
  return process.env[key]?.trim() || fallback
}

export const config = {
  port: Number.parseInt(env('PORT', '3000'), 10),
  corsOrigins: env('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  ytdlpPath: env('YTDLP_PATH', 'yt-dlp'),
  tempDir: env('TEMP_DIR', './tmp/clipscribe'),
  ytdlpCookiesFromBrowser: env('YTDLP_COOKIES_FROM_BROWSER'),
  ytdlpCookiesFile: env('YTDLP_COOKIES_FILE'),
  /** Render 可用：把 cookies.txt 用 base64 编码后整段粘贴 */
  ytdlpCookiesBase64: env('YTDLP_COOKIES_BASE64'),
  ytdlpSleepRequestsSec: Number.parseFloat(
    env('YTDLP_SLEEP_REQUESTS', process.env.RENDER ? '5' : '1'),
  ) || 1,
  isRender: Boolean(process.env.RENDER),
  /** 总结输出语言：zh | en */
  summaryLanguage: env('SUMMARY_LANGUAGE', 'zh').toLowerCase() === 'en' ? 'en' : 'zh',
  /** 字幕优先语言：zh | en */
  subtitleLang: env('SUBTITLE_LANG', 'zh').toLowerCase() === 'en' ? 'en' : 'zh',
  llm: {
    provider: (env('LLM_PROVIDER', 'qwen') as LlmProviderId),
    model: env('LLM_MODEL', 'qwen-turbo'),
    dashscopeApiKey: env('DASHSCOPE_API_KEY'),
    openaiApiKey: env('OPENAI_API_KEY'),
    openaiBaseUrl: env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
  } satisfies LlmConfig,
  ytdlpTimeoutMs: process.env.RENDER ? 50_000 : 180_000,
  youtubePageTimeoutMs: process.env.RENDER ? 25_000 : 45_000,
  youtubeCaptionTimeoutMs: process.env.RENDER ? 30_000 : 60_000,
  llmTimeoutMs: 120_000,
}
