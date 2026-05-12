<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Post-Release Defects</h1>
      <button
        @click="handleRefresh"
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Refresh Data
      </button>
    </div>

    <div class="flex gap-4 mb-6">
      <ComponentFilter
        v-model="selectedComponent"
        :components="allComponents"
      />
      <VersionSelector
        v-model="selectedVersions"
        :versions="versions"
        :max-selections="6"
      />
    </div>

    <div v-if="selectedVersions.length > 0" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">Cumulative Bug Count vs Days Since Release</h2>
      <div class="h-96">
        <CumulativeBugChart
          :labels="chartData.labels"
          :datasets="chartData.datasets"
        />
      </div>
    </div>

    <div v-else class="text-center py-12 text-gray-500">
      <p>Select versions to view cumulative bug trends</p>
    </div>

    <div v-if="selectedVersions.length > 0" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold mb-4">Summary Statistics</h2>
      <table class="w-full">
        <thead>
          <tr class="border-b">
            <th class="text-left py-2">Version</th>
            <th class="text-right py-2">Total Bugs</th>
            <th class="text-right py-2">Days Tracked</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(dataset, i) in chartData.datasets" :key="i" class="border-b">
            <td class="py-2">{{ dataset.label }}</td>
            <td class="text-right">{{ dataset.data[dataset.data.length - 1] }}</td>
            <td class="text-right">{{ chartData.labels.length - 1 }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import VersionSelector from '../components/VersionSelector.vue';
import ComponentFilter from '../components/ComponentFilter.vue';
import CumulativeBugChart from '../components/CumulativeBugChart.vue';
import { getVersions, getBugData, getComponents, refreshData } from '../services/api';

const versions = ref([]);
const allComponents = ref([]);
const selectedVersions = ref([]);
const selectedComponent = ref(null);
const chartData = ref({ labels: [], datasets: [] });

onMounted(async () => {
  // Load all components with bug counts
  allComponents.value = await getComponents();

  // Load all versions (no component filter initially)
  versions.value = await getVersions();

  // Auto-select first 3 versions with bugs (backend sorts by bug count descending)
  const versionsWithBugs = versions.value.filter(v => v.bugCount > 0);
  if (versionsWithBugs.length > 0) {
    selectedVersions.value = versionsWithBugs.slice(0, 3).map(v => v.name);
  }
});

// Watch component filter - refetch versions when component changes
watch(selectedComponent, async () => {
  // Refetch versions filtered by component (or all if null)
  versions.value = await getVersions(selectedComponent.value);

  // Auto-select first 3 versions with bugs after component filter change
  const versionsWithBugs = versions.value.filter(v => v.bugCount > 0);
  if (versionsWithBugs.length > 0) {
    selectedVersions.value = versionsWithBugs.slice(0, 3).map(v => v.name);
  } else {
    selectedVersions.value = [];
  }
});

// Watch versions/component for chart data updates
watch([selectedVersions, selectedComponent], async () => {
  if (selectedVersions.value.length > 0) {
    const response = await getBugData(selectedVersions.value, selectedComponent.value);
    chartData.value = { labels: response.labels, datasets: response.datasets };
  } else {
    chartData.value = { labels: [], datasets: [] };
  }
}, { deep: true });

async function handleRefresh() {
  await refreshData();

  // Reload components with fresh bug counts
  allComponents.value = await getComponents();

  // Reload versions filtered by current component (if any)
  versions.value = await getVersions(selectedComponent.value);

  // Refetch chart data if versions are selected
  if (selectedVersions.value.length > 0) {
    const response = await getBugData(selectedVersions.value, selectedComponent.value);
    chartData.value = { labels: response.labels, datasets: response.datasets };
  }
}
</script>
