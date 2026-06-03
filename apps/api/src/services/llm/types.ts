import type { VideoSummary } from '@clipscribe/shared'

export interface LlmProvider {
  readonly id: string
  summarize: (transcript: string, videoTitle: string) => Promise<VideoSummary>
}
