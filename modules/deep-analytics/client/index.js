import { defineAsyncComponent } from 'vue'

export const routes = {
  overview: defineAsyncComponent(() => import('./views/OverviewView.vue')),
  'tv-fv-delta': defineAsyncComponent(() => import('./views/TvFvDeltaView.vue')),
  'release-health': defineAsyncComponent(() => import('./views/ReleaseHealthView.vue')),
}
