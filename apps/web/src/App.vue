<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { isRemoteApi, warmupApi } from './api/client'

onMounted(() => {
  if (isRemoteApi())
    warmupApi().catch(() => { /* 静默预热，失败时 analyze 会再试 */ })
})
</script>

<template>
  <v-app theme="clipscribeDark">
    <v-main class="min-h-screen bg-[#0f1419]">
      <RouterView />
    </v-main>
  </v-app>
</template>
