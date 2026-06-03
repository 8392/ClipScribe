import type { VideoSummary } from '@clipscribe/shared'
import type { LlmProvider } from './types'
import { config } from '../../config'
import { AppError } from '../../lib/errors'
import { parseSummaryJson } from './parse'
import { buildSummaryPrompt, buildSystemMessage } from './prompt'

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

export class QwenLlmProvider implements LlmProvider {
  readonly id = 'qwen'

  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async summarize(transcript: string, videoTitle: string): Promise<VideoSummary> {
    if (!this.apiKey) {
      throw new AppError('DASHSCOPE_API_KEY is not configured', 500, 'LLM_FAILED')
    }
    return callChatApi({
      baseUrl: DASHSCOPE_BASE,
      apiKey: this.apiKey,
      model: this.model,
      transcript,
      videoTitle,
    })
  }
}

export class OpenAiLlmProvider implements LlmProvider {
  readonly id = 'openai'

  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl: string,
  ) {}

  async summarize(transcript: string, videoTitle: string): Promise<VideoSummary> {
    if (!this.apiKey) {
      throw new AppError('OPENAI_API_KEY is not configured', 500, 'LLM_FAILED')
    }
    const base = this.baseUrl.replace(/\/$/, '')
    return callChatApi({
      baseUrl: base,
      apiKey: this.apiKey,
      model: this.model,
      transcript,
      videoTitle,
    })
  }
}

async function callChatApi(opts: {
  baseUrl: string
  apiKey: string
  model: string
  transcript: string
  videoTitle: string
}): Promise<VideoSummary> {
  const prompt = buildSummaryPrompt(opts.transcript, opts.videoTitle)
  let lastErr: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${opts.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          messages: [
            {
              role: 'system',
              content: buildSystemMessage(),
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(config.llmTimeoutMs),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`LLM HTTP ${res.status}: ${body.slice(0, 500)}`)
      }

      const data = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = data.choices?.[0]?.message?.content
      if (!content)
        throw new Error('Empty LLM response')
      return parseSummaryJson(content)
    }
    catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }

  throw new AppError(
    lastErr?.message || 'Failed to generate summary',
    502,
    'LLM_FAILED',
  )
}
