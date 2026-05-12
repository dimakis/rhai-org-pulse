import { defineAsyncComponent } from 'vue';

export const routes = {
  'defects': defineAsyncComponent(() => import('./views/PostReleaseDefectsView.vue'))
};
