export interface TranscriptResult {
  videoTitle: string
  transcript: string
  formats: {
    txt: string
    srt: string
    vtt: string
  }
}

export interface TranscriptProvider {
  readonly name: string
  fetch: (url: string, workDir: string) => Promise<TranscriptResult>
}
