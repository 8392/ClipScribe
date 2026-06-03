import { fetchTranscriptViaProxies } from '@clipscribe/shared'
import type { TranscriptProvider, TranscriptResult } from './transcript-provider'
import { config } from '../config'
import { AppError } from '../lib/errors'

export class ProxyCaptionsProvider implements TranscriptProvider {
  readonly name = 'proxy'

  async fetch(url: string, _workDir: string): Promise<TranscriptResult> {
    const result = await fetchTranscriptViaProxies(url, {
      preferZh: config.subtitleLang === 'zh',
      pageTimeoutMs: config.youtubePageTimeoutMs,
      captionTimeoutMs: config.youtubeCaptionTimeoutMs,
    })
    if (!result)
      throw new AppError('代理实例无法获取字幕', 502, 'YTDLP_FAILED')
    return result
  }
}

export const proxyCaptionsProvider = new ProxyCaptionsProvider()
