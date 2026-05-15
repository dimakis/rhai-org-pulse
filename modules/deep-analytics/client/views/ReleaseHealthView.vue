<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { apiRequest } from '@shared/client'
import ClickableCount from '../components/ClickableCount.vue'
import FeatureTable from '../components/FeatureTable.vue'

const nav = inject('moduleNav')
const data = ref(null)
const loading = ref(true)
const error = ref(null)
const activeSection = ref('summary')

const drillDown = ref({ visible: false, title: '', features: [] })

onMounted(async () => {
  try {
    data.value = await apiRequest('/modules/deep-analytics/release-health')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

const sections = [
  { id: 'summary', label: 'Summary' },
  { id: 'color', label: 'Color Status' },
  { id: 'hygiene', label: 'Hygiene' },
  { id: 'drift', label: 'TV Drift' },
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'components', label: 'Components' },
  { id: 'actions', label: 'Actions' },
  { id: 'features', label: 'All Features' },
]

const dangerComponents = computed(() => {
  if (!data.value) return []
  return data.value.component_load.components.filter(
    c => c.danger_pct > data.value.component_load.danger_threshold_pct
  )
})

function showDrillDown(title, features) {
  drillDown.value = { visible: true, title, features }
}

function closeDrillDown() {
  drillDown.value = { visible: false, title: '', features: [] }
}

/**
 * Parse markdown-style links into segments for safe rendering.
 * Returns array of { type: 'text'|'link', text, href? } objects.
 */
function parseActionLinks(text) {
  if (!text) return []
  const parts = []
  const re = /\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let match
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: 'text', text: text.slice(last, match.index) })
    }
    const href = match[2]
    if (/^https?:\/\//i.test(href)) {
      parts.push({ type: 'link', text: match[1], href })
    } else {
      parts.push({ type: 'text', text: match[0] })
    }
    last = re.lastIndex
  }
  if (last < text.length) {
    parts.push({ type: 'text', text: text.slice(last) })
  }
  return parts
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
        Release Health
      </h1>
    </div>

    <div v-if="loading" class="text-gray-500 dark:text-gray-400">Loading...</div>
    <div v-else-if="error" class="text-red-600 dark:text-red-400">{{ error }}</div>

    <template v-else-if="data">
      <!-- Metadata -->
      <div class="text-xs text-gray-400 dark:text-gray-500 mb-2">
        Release: <span class="font-mono font-medium text-gray-600 dark:text-gray-300">{{ data.metadata.target_version }}</span>
        &middot;
        Data: {{ new Date(data.metadata.data_timestamp).toLocaleDateString() }}
        &middot;
        Generated: {{ new Date(data.metadata.generated_at).toLocaleString() }}
      </div>

      <!-- Section tabs -->
      <div class="flex gap-1 mb-6 overflow-x-auto pb-1">
        <button
          v-for="sec in sections"
          :key="sec.id"
          class="px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap"
          :class="sec.id === activeSection
            ? 'bg-purple-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
          @click="activeSection = sec.id"
        >
          {{ sec.label }}
        </button>
      </div>

      <!-- SUMMARY -->
      <div v-show="activeSection === 'summary'" class="space-y-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <!-- Open features -->
          <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Open Features</div>
            <div class="text-2xl font-bold">
              <ClickableCount :count="data.executive_summary.total_open" :jql="data.executive_summary.total_open_jql" />
            </div>
          </div>
          <!-- Shipped -->
          <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Shipped</div>
            <div class="text-2xl font-bold">
              <ClickableCount :count="data.executive_summary.total_shipped" :jql="data.executive_summary.total_shipped_jql" color="green" />
            </div>
          </div>
          <!-- Missing summary -->
          <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Missing Status Summary</div>
            <div class="text-2xl font-bold">
              <ClickableCount :count="data.executive_summary.missing_status_summary.count" :jql="data.executive_summary.missing_status_summary.jql" color="yellow" />
            </div>
          </div>
          <!-- Stale -->
          <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Stale (14+ days)</div>
            <div class="text-2xl font-bold">
              <ClickableCount :count="data.executive_summary.stale_14d.count" :jql="data.executive_summary.stale_14d.jql" color="red" />
            </div>
          </div>
        </div>

        <!-- Color distribution -->
        <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Color Distribution</h3>
          <div class="flex gap-6 flex-wrap">
            <div v-for="(val, color) in data.executive_summary.color_distribution" :key="color" class="flex items-center gap-2">
              <span
                class="w-3 h-3 rounded-full"
                :class="{
                  'bg-red-500': color === 'red',
                  'bg-yellow-500': color === 'yellow',
                  'bg-green-500': color === 'green',
                  'bg-gray-400': color === 'not_set',
                }"
              ></span>
              <span class="text-sm text-gray-700 dark:text-gray-300 capitalize">{{ color === 'not_set' ? 'Not Set' : color }}:</span>
              <ClickableCount :count="val.count" :jql="val.jql" :color="color === 'not_set' ? 'muted' : color" />
            </div>
          </div>
          <!-- Stacked bar -->
          <div class="mt-3 flex h-4 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
            <div
              v-for="(val, color) in data.executive_summary.color_distribution"
              :key="'bar-' + color"
              :style="{ width: (data.executive_summary.total_open ? (val.count / data.executive_summary.total_open * 100) : 0) + '%' }"
              :class="{
                'bg-red-500': color === 'red',
                'bg-yellow-400': color === 'yellow',
                'bg-green-500': color === 'green',
                'bg-gray-400': color === 'not_set',
              }"
            ></div>
          </div>
        </div>

        <!-- Outcome coverage -->
        <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Outcome Coverage</h3>
          <div class="flex gap-6">
            <div>
              <span class="text-sm text-gray-500 dark:text-gray-400">With parent Outcome:</span>
              <ClickableCount
                :count="data.executive_summary.outcome_coverage.with_outcome"
                :jql="data.executive_summary.outcome_coverage.with_outcome_jql"
                class="ml-2"
              />
            </div>
            <div>
              <span class="text-sm text-gray-500 dark:text-gray-400">Orphans:</span>
              <ClickableCount
                :count="data.executive_summary.outcome_coverage.total - data.executive_summary.outcome_coverage.with_outcome"
                :jql="data.executive_summary.outcome_coverage.orphans_jql"
                color="yellow"
                class="ml-2"
              />
            </div>
          </div>
        </div>

        <!-- Census: by status -->
        <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">By Status</h3>
          <div class="flex gap-4 flex-wrap">
            <div v-for="s in data.census.by_status" :key="s.status" class="flex items-center gap-1.5">
              <span class="text-sm text-gray-600 dark:text-gray-400">{{ s.status }}:</span>
              <ClickableCount :count="s.count" :jql="s.jql" />
            </div>
          </div>
        </div>
      </div>

      <!-- COLOR STATUS -->
      <div v-show="activeSection === 'color'" class="space-y-4">
        <div v-if="data.color_status.red_features.length">
          <FeatureTable
            :features="data.color_status.red_features"
            :columns="['key', 'summary', 'status', 'assignee', 'days_since_update', 'parent_key']"
            title="Red Features"
          />
        </div>
        <div v-if="data.color_status.yellow_features.length">
          <FeatureTable
            :features="data.color_status.yellow_features"
            :columns="['key', 'summary', 'status', 'assignee', 'days_since_update', 'parent_key']"
            title="Yellow Features"
          />
        </div>
        <p v-if="!data.color_status.red_features.length && !data.color_status.yellow_features.length"
           class="text-sm text-gray-500 dark:text-gray-400">
          No red or yellow features. Clean!
        </p>
      </div>

      <!-- HYGIENE -->
      <div v-show="activeSection === 'hygiene'" class="space-y-4">
        <!-- Summary counts -->
        <div class="grid grid-cols-3 gap-4">
          <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center">
            <div class="text-xs text-gray-500 mb-1">Missing Summary</div>
            <div class="text-xl font-bold">
              <ClickableCount
                :count="data.hygiene_gaps.missing_summary.length"
                :jql="data.hygiene_gaps.missing_summary_jql"
                color="yellow"
                label="Missing summary"
                @drill-down="showDrillDown('Missing Status Summary', data.hygiene_gaps.missing_summary)"
              />
            </div>
          </div>
          <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center">
            <div class="text-xs text-gray-500 mb-1">Stale (14+ days)</div>
            <div class="text-xl font-bold">
              <ClickableCount
                :count="data.hygiene_gaps.stale_features.length"
                :jql="data.hygiene_gaps.stale_jql"
                color="yellow"
                label="Stale"
              />
            </div>
          </div>
          <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center">
            <div class="text-xs text-gray-500 mb-1">Ghost (30+ days)</div>
            <div class="text-xl font-bold">
              <ClickableCount
                :count="data.hygiene_gaps.ghost_features.length"
                :jql="data.hygiene_gaps.ghost_jql"
                color="red"
                label="Ghost features"
              />
            </div>
          </div>
        </div>

        <FeatureTable
          v-if="data.hygiene_gaps.stale_features.length"
          :features="data.hygiene_gaps.stale_features"
          :columns="['key', 'summary', 'status', 'assignee', 'days_since_update']"
          title="Stale Features (14+ days)"
        />

        <FeatureTable
          v-if="data.hygiene_gaps.ghost_features.length"
          :features="data.hygiene_gaps.ghost_features"
          :columns="['key', 'summary', 'status', 'assignee', 'days_since_update']"
          title="Ghost Features (30+ days, inactive)"
        />
      </div>

      <!-- TV DRIFT -->
      <div v-show="activeSection === 'drift'" class="space-y-4">
        <div class="grid grid-cols-3 gap-4">
          <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center">
            <div class="text-xs text-gray-500 mb-1">Features with Drift</div>
            <div class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ data.tv_drift.total_with_drift }}</div>
          </div>
          <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center">
            <div class="text-xs text-gray-500 mb-1">Total Hops</div>
            <div class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ data.tv_drift.total_hops }}</div>
          </div>
          <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center">
            <div class="text-xs text-gray-500 mb-1">Serial Slippers (3+)</div>
            <div class="text-xl font-bold">
              <ClickableCount
                :count="data.tv_drift.serial_slippers.length"
                :items="data.tv_drift.serial_slippers"
                color="red"
                @drill-down="showDrillDown('Serial Slippers', $event)"
              />
            </div>
          </div>
        </div>

        <FeatureTable
          v-if="data.tv_drift.serial_slippers.length"
          :features="data.tv_drift.serial_slippers"
          :columns="['key', 'summary', 'hops', 'hop_path', 'status', 'assignee']"
          title="Serial Slippers (3+ hops)"
        />

        <details v-if="data.tv_drift.other_drift.length" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <summary class="px-4 py-3 cursor-pointer text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50">
            Other Drift ({{ data.tv_drift.other_drift.length }} features)
          </summary>
          <FeatureTable
            :features="data.tv_drift.other_drift"
            :columns="['key', 'summary', 'hops', 'hop_path', 'status', 'assignee']"
          />
        </details>
      </div>

      <!-- OUTCOMES -->
      <div v-show="activeSection === 'outcomes'" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center">
            <div class="text-xs text-gray-500 mb-1">With Outcome</div>
            <div class="text-xl font-bold">
              <ClickableCount :count="data.outcome_alignment.with_outcome" :jql="data.outcome_alignment.with_outcome_jql" color="green" />
            </div>
          </div>
          <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center">
            <div class="text-xs text-gray-500 mb-1">Orphans (no Outcome)</div>
            <div class="text-xl font-bold">
              <ClickableCount :count="data.outcome_alignment.orphans" :jql="data.outcome_alignment.orphans_jql" color="yellow" />
            </div>
          </div>
        </div>

        <!-- Outcome progress table -->
        <div v-if="data.outcome_alignment.outcomes.length" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Outcome Progress</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="bg-gray-50 dark:bg-gray-800/50">
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Done</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">R</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Y</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">G</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Color Risk</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stale Risk</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="oc in data.outcome_alignment.outcomes" :key="oc.key" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td class="px-3 py-2">
                    <a :href="oc.url" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs">
                      {{ oc.key }}
                    </a>
                    <span class="text-xs text-gray-500 dark:text-gray-400 ml-1 max-w-xs truncate inline-block align-middle" :title="oc.summary">
                      {{ oc.summary.slice(0, 50) }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ oc.outcome_status }}</td>
                  <td class="px-3 py-2 text-right font-medium">{{ oc.total }}</td>
                  <td class="px-3 py-2 text-right text-green-600 dark:text-green-400">{{ oc.completed }}</td>
                  <td class="px-3 py-2 text-right font-semibold"
                      :class="oc.completion_pct >= 75 ? 'text-green-600 dark:text-green-400' : oc.completion_pct >= 50 ? 'text-yellow-600' : 'text-red-600'">
                    {{ oc.completion_pct }}%
                  </td>
                  <td class="px-3 py-2 text-right text-red-600 dark:text-red-400">{{ oc.red || '' }}</td>
                  <td class="px-3 py-2 text-right text-yellow-600 dark:text-yellow-400">{{ oc.yellow || '' }}</td>
                  <td class="px-3 py-2 text-right text-green-600 dark:text-green-400">{{ oc.green || '' }}</td>
                  <td class="px-3 py-2 text-right font-semibold"
                      :class="oc.color_risk_pct > 50 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'">
                    {{ oc.color_risk_pct }}%
                  </td>
                  <td class="px-3 py-2 text-right font-semibold"
                      :class="oc.stale_risk_pct > 50 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'">
                    {{ oc.stale_risk_pct }}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Orphan features -->
        <details v-if="data.outcome_alignment.orphan_features.length" class="bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <summary class="px-4 py-3 cursor-pointer text-sm font-semibold text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/10">
            Orphan Features — no parent Outcome ({{ data.outcome_alignment.orphan_features.length }})
          </summary>
          <FeatureTable
            :features="data.outcome_alignment.orphan_features"
            :columns="['key', 'summary', 'status', 'color_status', 'assignee']"
          />
        </details>
      </div>

      <!-- COMPONENTS -->
      <div v-show="activeSection === 'components'" class="space-y-4">
        <div v-if="dangerComponents.length" class="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 overflow-hidden mb-4">
          <div class="px-4 py-3 border-b border-red-200 dark:border-red-800">
            <h3 class="text-sm font-semibold text-red-700 dark:text-red-400">
              Danger Components (&gt;30% Red/Yellow/Stale) — {{ dangerComponents.length }}
            </h3>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="bg-gray-50 dark:bg-gray-800/50">
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Features</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Red</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Yellow</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stale</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Danger %</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teams</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="c in dangerComponents" :key="c.component" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td class="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{{ c.component }}</td>
                  <td class="px-3 py-2 text-right">
                    <ClickableCount :count="c.features" :jql="c.features_jql" />
                  </td>
                  <td class="px-3 py-2 text-right text-red-600 dark:text-red-400 font-medium">{{ c.red }}</td>
                  <td class="px-3 py-2 text-right text-yellow-600 dark:text-yellow-400 font-medium">{{ c.yellow }}</td>
                  <td class="px-3 py-2 text-right text-orange-600 dark:text-orange-400">{{ c.stale_14d }}</td>
                  <td class="px-3 py-2 text-right text-red-600 dark:text-red-400 font-bold">{{ c.danger_pct }}%</td>
                  <td class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{{ c.teams }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- All components -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">All Components</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="bg-gray-50 dark:bg-gray-800/50">
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Features</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Red</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Yellow</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stale</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">No Summary</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Drifted</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Danger %</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teams</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="c in data.component_load.components" :key="c.component" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td class="px-3 py-2 text-gray-900 dark:text-gray-100">{{ c.component }}</td>
                  <td class="px-3 py-2 text-right">
                    <ClickableCount :count="c.features" :jql="c.features_jql" />
                  </td>
                  <td class="px-3 py-2 text-right" :class="c.red > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-400'">{{ c.red }}</td>
                  <td class="px-3 py-2 text-right" :class="c.yellow > 0 ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 'text-gray-400'">{{ c.yellow }}</td>
                  <td class="px-3 py-2 text-right" :class="c.stale_14d > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'">{{ c.stale_14d }}</td>
                  <td class="px-3 py-2 text-right" :class="c.no_summary > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'">{{ c.no_summary }}</td>
                  <td class="px-3 py-2 text-right text-gray-500">{{ c.drifted }}</td>
                  <td class="px-3 py-2 text-right"
                      :class="c.danger_pct > 30 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-500'">
                    {{ c.danger_pct }}%
                  </td>
                  <td class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">{{ c.teams }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ACTIONS -->
      <div v-show="activeSection === 'actions'" class="space-y-4">
        <div v-if="data.action_items.length" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Action Items ({{ data.action_items.length }})
            </h3>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="bg-gray-50 dark:bg-gray-800/50">
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">Priority</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assignee</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Detail</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="(item, idx) in data.action_items" :key="idx" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td class="px-3 py-2">
                    <span
                      class="inline-flex px-2 py-0.5 text-xs font-bold rounded"
                      :class="{
                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300': item.priority === 'P1',
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300': item.priority === 'P2',
                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300': item.priority === 'P3',
                      }"
                    >
                      {{ item.priority }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-gray-900 dark:text-gray-100 text-xs">
                    <template v-for="(seg, si) in parseActionLinks(item.action)" :key="si">
                      <a v-if="seg.type === 'link'" :href="seg.href" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">{{ seg.text }}</a>
                      <span v-else>{{ seg.text }}</span>
                    </template>
                  </td>
                  <td class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{{ item.assignee }}</td>
                  <td class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">{{ item.detail }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">No action items — release is clean!</p>
      </div>

      <!-- ALL FEATURES -->
      <div v-show="activeSection === 'features'">
        <FeatureTable
          :features="data.features"
          :columns="['key', 'summary', 'status', 'color_status', 'assignee', 'has_status_summary', 'days_since_update', 'parent_key']"
          :title="`All Features in ${data.metadata.target_version}`"
        />
      </div>
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
          <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" @click="closeDrillDown">&times;</button>
        </div>
        <div class="overflow-auto flex-1 p-4">
          <FeatureTable
            :features="drillDown.features"
            :columns="['key', 'summary', 'status', 'assignee']"
          />
        </div>
      </div>
    </div>
  </div>
</template>
