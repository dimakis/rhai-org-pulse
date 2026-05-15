<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { apiRequest } from '@shared/client'
import ClickableCount from '../components/ClickableCount.vue'
import FeatureTable from '../components/FeatureTable.vue'

const nav = inject('moduleNav')
const data = ref(null)
const loading = ref(true)
const error = ref(null)

const selectedRelease = ref('')
const drillDown = ref({ visible: false, title: '', features: [] })

onMounted(async () => {
  try {
    data.value = await apiRequest('/modules/deep-analytics/tv-fv-delta')
    if (data.value?.metadata?.releases?.length) {
      selectedRelease.value = data.value.metadata.releases[0]
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

const releaseData = computed(() => {
  if (!data.value || !selectedRelease.value) return null
  return data.value.releases[selectedRelease.value]
})

const releaseSummary = computed(() => {
  if (!data.value) return null
  return data.value.executive_summary.find(s => s.release === selectedRelease.value)
})

function showDrillDown(title, features) {
  drillDown.value = { visible: true, title, features }
}

function closeDrillDown() {
  drillDown.value = { visible: false, title: '', features: [] }
}
</script>

<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header -->
    <div class="mb-6">
      <button
        class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2"
        @click="nav.navigateTo('overview')"
      >
        &larr; Deep Analytics
      </button>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
        TV vs FV Delta
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Target Version (PM intent) vs Fix Version (engineering commitment)
      </p>
    </div>

    <div v-if="loading" class="text-gray-500 dark:text-gray-400">Loading...</div>
    <div v-else-if="error" class="text-red-600 dark:text-red-400">{{ error }}</div>

    <template v-else-if="data">
      <!-- Metadata -->
      <div class="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Data fetched: {{ new Date(data.metadata.data_timestamp).toLocaleString() }}
        &middot;
        Report generated: {{ new Date(data.metadata.generated_at).toLocaleString() }}
      </div>

      <!-- Executive summary table -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Executive Summary</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/50">
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Release</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aligned</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">TV-Only</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">FV-Only</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mismatched</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Alignment</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="row in data.executive_summary"
                :key="row.release"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                :class="{ 'bg-blue-50/50 dark:bg-blue-900/10': row.release === selectedRelease }"
                @click="selectedRelease = row.release"
              >
                <td class="px-4 py-2 font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
                  {{ row.release }}
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="row.total" :jql="row.total_jql" label="Total features" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="row.aligned" :jql="row.aligned_jql" color="green" label="Aligned" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="row.tv_only" :jql="row.tv_only_jql" color="yellow" label="TV-only" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="row.fv_only" :jql="row.fv_only_jql" color="muted" label="FV-only" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount
                    :count="row.mismatched"
                    :items="data.releases[row.release]?.mismatched || []"
                    color="red"
                    label="Mismatched"
                    @drill-down="showDrillDown(`Mismatched — ${row.release}`, $event)"
                  />
                </td>
                <td class="px-4 py-2 text-right">
                  <span
                    class="font-semibold"
                    :class="{
                      'text-red-600 dark:text-red-400': row.alignment_pct < 50,
                      'text-yellow-600 dark:text-yellow-400': row.alignment_pct >= 50 && row.alignment_pct < 75,
                      'text-green-600 dark:text-green-400': row.alignment_pct >= 75,
                    }"
                  >
                    {{ row.alignment_pct }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Release selector tabs -->
      <div class="flex gap-2 mb-4">
        <button
          v-for="rel in data.metadata.releases"
          :key="rel"
          class="px-3 py-1.5 text-sm rounded-md transition-colors"
          :class="rel === selectedRelease
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'"
          @click="selectedRelease = rel"
        >
          {{ rel }}
        </button>
      </div>

      <!-- Category tables for selected release -->
      <template v-if="releaseData">
        <!-- TV-Only (collapsible) -->
        <details open class="bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-800 overflow-hidden mb-4">
          <summary class="px-4 py-3 cursor-pointer hover:bg-yellow-50 dark:hover:bg-yellow-900/10 flex items-center justify-between">
            <span class="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
              TV-Only — PM targeted, no ENG commitment ({{ releaseData.tv_only.length }})
            </span>
            <a
              v-if="releaseSummary"
              :href="releaseSummary.tv_only_jql"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.tv_only"
            :columns="['key', 'summary', 'status', 'color_status', 'component', 'assignee']"
          />
        </details>

        <!-- FV-Only (collapsible) -->
        <details class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
          <summary class="px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between">
            <span class="text-sm font-semibold text-gray-600 dark:text-gray-400">
              FV-Only — ENG committed, not PM-planned ({{ releaseData.fv_only.length }})
            </span>
            <a
              v-if="releaseSummary"
              :href="releaseSummary.fv_only_jql"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.fv_only"
            :columns="['key', 'summary', 'status', 'color_status', 'component', 'assignee']"
          />
        </details>

        <!-- Mismatched (collapsible) -->
        <details v-if="releaseData.mismatched.length" open class="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 overflow-hidden mb-4">
          <summary class="px-4 py-3 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10">
            <span class="text-sm font-semibold text-red-700 dark:text-red-400">
              Mismatched — TV and FV disagree ({{ releaseData.mismatched.length }})
            </span>
          </summary>
          <FeatureTable
            :features="releaseData.mismatched"
            :columns="['key', 'summary', 'target_version', 'fix_versions', 'component', 'assignee']"
          />
        </details>

        <!-- Aligned (collapsed by default) -->
        <details class="bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800 overflow-hidden mb-4">
          <summary class="px-4 py-3 cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/10">
            <span class="text-sm font-semibold text-green-700 dark:text-green-400">
              Aligned — TV == FV ({{ releaseData.aligned.length }})
            </span>
          </summary>
          <FeatureTable
            :features="releaseData.aligned"
            :columns="['key', 'summary', 'status', 'color_status', 'component']"
          />
        </details>
      </template>

      <!-- Component breakdown (collapsible) -->
      <details v-if="data.component_breakdown.length" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
        <summary class="px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
          <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">Component Breakdown</span>
        </summary>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/50">
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aligned</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">TV-Only</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Mismatched</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Alignment</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="comp in data.component_breakdown"
                :key="comp.component"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td class="px-4 py-2 text-gray-900 dark:text-gray-100">{{ comp.component }}</td>
                <td class="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">{{ comp.team }}</td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="comp.total" :jql="comp.total_jql" label="Total" />
                </td>
                <td class="px-4 py-2 text-right text-green-600 dark:text-green-400">{{ comp.aligned }}</td>
                <td class="px-4 py-2 text-right text-yellow-600 dark:text-yellow-400">{{ comp.tv_only }}</td>
                <td class="px-4 py-2 text-right text-red-600 dark:text-red-400">{{ comp.mismatched }}</td>
                <td class="px-4 py-2 text-right">
                  <span
                    class="font-semibold"
                    :class="{
                      'text-red-600 dark:text-red-400': comp.alignment_pct < 50,
                      'text-yellow-600 dark:text-yellow-400': comp.alignment_pct >= 50 && comp.alignment_pct < 75,
                      'text-green-600 dark:text-green-400': comp.alignment_pct >= 75,
                    }"
                  >
                    {{ comp.alignment_pct }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>

    <!-- Drill-down modal -->
    <div
      v-if="drillDown.visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="closeDrillDown"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ drillDown.title }}</h3>
          <button
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            @click="closeDrillDown"
          >
            &times;
          </button>
        </div>
        <div class="overflow-auto flex-1 p-4">
          <FeatureTable
            :features="drillDown.features"
            :columns="['key', 'summary', 'status', 'color_status', 'component', 'assignee']"
          />
        </div>
      </div>
    </div>
  </div>
</template>
