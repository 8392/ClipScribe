import type { LlmConfig } from '@clipscribe/shared'
import type { LlmProvider } from './types'
import { config } from '../../config'
import { AppError } from '../../lib/errors'
import { OpenAiLlmProvider, QwenLlmProvider } from './qwen'

export function createLlmProvider(cfg: LlmConfig = config.llm): LlmProvider {
  switch (cfg.provider) {
    case 'qwen':
      return new QwenLlmProvider(cfg.dashscopeApiKey || '', cfg.model)
    case 'openai':
      return new OpenAiLlmProvider(
        cfg.openaiApiKey || '',
        cfg.model,
        cfg.openaiBaseUrl || 'https://api.openai.com/v1',
      )
    default:
      throw new AppError(`Unknown LLM provider: ${cfg.provider}`, 500, 'LLM_FAILED')
  }
}

export type { LlmProvider } from './types'
