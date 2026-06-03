<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <v-app theme="clipscribeDark">
    <v-main class="min-h-screen bg-[#0f1419]">
      <RouterView />
    </v-main>
  </v-app>
</template>
