import type { AnalyzeResponse, VideoSummary } from '@clipscribe/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { analyzeVideo } from '../api/client'

export const useVideoStore = defineStore('video', () => {
  const url = ref('')
  const loading = ref(false)
  const transcript = ref('')
  const videoTitle = ref('')
  const summary = ref<VideoSummary | null>(null)
  const formats = ref<AnalyzeResponse['formats'] | null>(null)
  const error = ref('')

  async function analyze(inputUrl: string) {
    url.value = inputUrl
    loading.value = true
    error.value = ''
    transcript.value = ''
    videoTitle.value = ''
    summary.value = null
    formats.value = null

    try {
      const data = await analyzeVideo(inputUrl)
      videoTitle.value = data.videoTitle
      transcript.value = data.transcript
      summary.value = data.summary
      formats.value = data.formats
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : 'Analysis failed'
    }
    finally {
      loading.value = false
    }
  }

  function reset() {
    url.value = ''
    loading.value = false
    transcript.value = ''
    videoTitle.value = ''
    summary.value = null
    formats.value = null
    error.value = ''
  }

  return {
    url,
    loading,
    transcript,
    videoTitle,
    summary,
    formats,
    error,
    analyze,
    reset,
  }
})
