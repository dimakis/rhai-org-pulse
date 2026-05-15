<script setup>
import { ref, inject, onMounted } from 'vue'
import { apiRequest } from '@shared/client'

const nav = inject('moduleNav')
const status = ref(null)
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    status.value = await apiRequest('/modules/deep-analytics/status')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
      Deep Analytics
    </h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-8">
      Feature health, TV/FV alignment, and release hygiene — powered by Jupyter notebook pipelines.
    </p>

    <div v-if="loading" class="text-gray-500 dark:text-gray-400">Loading status...</div>
    <div v-else-if="error" class="text-red-600 dark:text-red-400">{{ error }}</div>

    <div v-else class="grid gap-6 md:grid-cols-2">
      <!-- TV/FV Delta card -->
      <button
        class="text-left p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all bg-white dark:bg-gray-800"
        @click="nav.navigateTo('tv-fv-delta')"
      >
        <div class="flex items-center gap-3 mb-3">
          <div class="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">TV vs FV Delta</h2>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Compare PM intent (Target Version) vs engineering commitment (Fix Version) across releases.
        </p>
        <div v-if="status.tv_fv_delta.available" class="text-xs text-gray-500 dark:text-gray-400">
          <span class="inline-flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-green-500"></span>
            Data available
          </span>
          &middot;
          Releases: {{ status.tv_fv_delta.releases?.join(', ') }}
          &middot;
          Updated: {{ new Date(status.tv_fv_delta.generated_at).toLocaleDateString() }}
        </div>
        <div v-else class="text-xs text-yellow-600 dark:text-yellow-400">
          <span class="inline-flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
            No data — run the export pipeline
          </span>
        </div>
      </button>

      <!-- Release Health card -->
      <button
        class="text-left p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all bg-white dark:bg-gray-800"
        @click="nav.navigateTo('release-health')"
      >
        <div class="flex items-center gap-3 mb-3">
          <div class="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
            <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Release Health</h2>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Per-release hygiene: color status, staleness, TV drift, outcome alignment, action items.
        </p>
        <div v-if="status.release_healthcheck.available" class="text-xs text-gray-500 dark:text-gray-400">
          <span class="inline-flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-green-500"></span>
            Data available
          </span>
          &middot;
          Release: {{ status.release_healthcheck.target_version }}
          &middot;
          Updated: {{ new Date(status.release_healthcheck.generated_at).toLocaleDateString() }}
        </div>
        <div v-else class="text-xs text-yellow-600 dark:text-yellow-400">
          <span class="inline-flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
            No data — run the export pipeline
          </span>
        </div>
      </button>
    </div>
  </div>
</template>
