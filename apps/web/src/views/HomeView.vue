<script setup lang="ts">
import { isValidYoutubeUrl } from '@clipscribe/shared'
import { computed, ref } from 'vue'
import { downloadText } from '../api/client'
import { useVideoStore } from '../stores/video'

const store = useVideoStore()
const inputUrl = ref('')
const urlError = ref('')

const canSubmit = computed(() => !store.loading && inputUrl.value.trim().length > 0)

function validate(): boolean {
  urlError.value = ''
  if (!inputUrl.value.trim()) {
    urlError.value = '请输入 YouTube 链接'
    return false
  }
  if (!isValidYoutubeUrl(inputUrl.value)) {
    urlError.value = '请输入有效的 YouTube 视频链接'
    return false
  }
  return true
}

async function onAnalyze() {
  if (!validate())
    return
  await store.analyze(inputUrl.value.trim())
}

function downloadFmt(ext: 'txt' | 'srt' | 'vtt') {
  const f = store.formats
  if (!f)
    return
  const content = f[ext]
  const base = (store.videoTitle || 'subtitle').replace(/[^\w\u4E00-\u9FFF-]+/g, '_').slice(0, 80)
  const mime = ext === 'vtt' ? 'text/vtt' : ext === 'srt' ? 'application/x-subrip' : 'text/plain'
  downloadText(content, `${base}.${ext}`, `${mime};charset=utf-8`)
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10 md:py-16">
    <header class="mb-10 text-center">
      <h1 class="text-3xl font-bold tracking-tight text-[#e7ecf3] md:text-4xl">
        ClipScribe
      </h1>
      <p class="mt-2 text-[#8b9cb3]">
        YouTube 字幕提取 · AI 视频总结
      </p>
    </header>

    <v-card class="rounded-xl border border-[#2a3548] bg-[#1a2332]" elevation="0">
      <v-card-text class="pa-6">
        <v-text-field
          v-model="inputUrl"
          label="YouTube 视频链接"
          placeholder="https://www.youtube.com/watch?v=..."
          variant="outlined"
          density="comfortable"
          :error-messages="urlError || (store.error && !store.loading ? [] : undefined)"
          :disabled="store.loading"
          hide-details="auto"
          prepend-inner-icon="mdi-youtube"
          @keyup.enter="onAnalyze"
        />

        <div class="mt-4 flex flex-wrap gap-3">
          <v-btn
            color="primary"
            size="large"
            :loading="store.loading"
            :disabled="!canSubmit"
            @click="onAnalyze"
          >
            分析视频
          </v-btn>
          <v-btn
            v-if="store.videoTitle"
            variant="outlined"
            :disabled="store.loading"
            @click="store.reset(); inputUrl = ''"
          >
            清除
          </v-btn>
        </div>

        <v-alert
          v-if="store.error && !store.loading"
          type="error"
          variant="tonal"
          class="mt-4"
          density="compact"
        >
          {{ store.error }}
        </v-alert>
      </v-card-text>
    </v-card>

    <v-overlay
      :model-value="store.loading"
      class="align-center justify-center"
      persistent
      scrim="rgba(0,0,0,0.7)"
    >
      <div class="text-center">
        <v-progress-circular indeterminate color="primary" size="56" />
        <p class="mt-4 text-lg text-[#e7ecf3]">
          正在提取字幕并生成 AI 总结…
        </p>
        <p class="mt-1 text-sm text-[#8b9cb3]">
          长视频可能需要 1–2 分钟
        </p>
      </div>
    </v-overlay>

    <template v-if="store.summary && !store.loading">
      <section class="mt-8">
        <h2 class="mb-3 text-xl font-semibold text-[#e7ecf3]">
          {{ store.videoTitle }}
        </h2>

        <v-card class="rounded-xl border border-[#2a3548] bg-[#1a2332]" elevation="0">
          <v-card-title class="text-lg">
            AI 总结
          </v-card-title>
          <v-card-subtitle v-if="store.summary.title">
            {{ store.summary.title }}
          </v-card-subtitle>
          <v-card-text>
            <p class="mb-4 leading-relaxed text-[#c5d0de]">
              {{ store.summary.summary }}
            </p>

            <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-[#8b9cb3]">
              核心观点
            </h3>
            <v-list density="compact" class="bg-transparent pa-0">
              <v-list-item
                v-for="(point, i) in store.summary.keyPoints"
                :key="i"
                class="px-0"
              >
                <template #prepend>
                  <v-icon size="small" color="primary">
                    mdi-circle-small
                  </v-icon>
                </template>
                {{ point }}
              </v-list-item>
            </v-list>

            <div v-if="store.summary.details" class="mt-4">
              <h3 class="mb-1 text-sm font-semibold text-[#8b9cb3]">
                关键细节
              </h3>
              <p class="text-[#c5d0de]">
                {{ store.summary.details }}
              </p>
            </div>

            <div v-if="store.summary.conclusion" class="mt-4">
              <h3 class="mb-1 text-sm font-semibold text-[#8b9cb3]">
                结论
              </h3>
              <p class="text-[#c5d0de]">
                {{ store.summary.conclusion }}
              </p>
            </div>

            <v-chip v-if="store.summary.audience" class="mt-4" variant="outlined" size="small">
              适合人群：{{ store.summary.audience }}
            </v-chip>
          </v-card-text>
        </v-card>
      </section>

      <section class="mt-6">
        <v-card class="rounded-xl border border-[#2a3548] bg-[#1a2332]" elevation="0">
          <v-card-title class="d-flex flex-wrap align-center justify-space-between gap-2">
            <span>字幕全文</span>
            <div class="flex flex-wrap gap-2">
              <v-btn size="small" variant="tonal" @click="downloadFmt('txt')">
                TXT
              </v-btn>
              <v-btn size="small" variant="tonal" @click="downloadFmt('srt')">
                SRT
              </v-btn>
              <v-btn size="small" variant="tonal" @click="downloadFmt('vtt')">
                VTT
              </v-btn>
            </div>
          </v-card-title>
          <v-card-text>
            <pre class="transcript-scroll whitespace-pre-wrap rounded-lg bg-[#0f1419] p-4 text-sm leading-relaxed text-[#b8c5d6]">{{ store.transcript }}</pre>
          </v-card-text>
        </v-card>
      </section>
    </template>
  </div>
</template>
