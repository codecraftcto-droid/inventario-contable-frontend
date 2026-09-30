<script setup>
import { useTheme } from 'vuetify'
import ScrollToTop from '@core/components/ScrollToTop.vue'
import initCore from '@core/initCore'
import {
  initConfigStore,
  useConfigStore,
} from '@core/stores/config'
import { hexToRgb } from '@core/utils/colorConverter'

const { global } = useTheme()

// ℹ️ Sync current theme with initial loader theme
initCore()
initConfigStore()

const configStore = useConfigStore()
</script>

<template>
  <VLocaleProvider :rtl="configStore.isAppRTL">
    <!-- ℹ️ This is required to set the background color of active nav link based on currently active global theme's primary -->
    <VApp :style="`--v-global-theme-primary: ${hexToRgb(global.current.value.colors.primary)}`">
      <RouterView />
      <ScrollToTop />
    </VApp>
  </VLocaleProvider>
</template>

<style>
/* SweetAlert: identidad corporativa en modo claro y estados reconocibles. */
.swal2-popup {
  border-block-start: 4px solid #ffc000;
  border-radius: 0.875rem;
  background: #fff;
  color: #000;
}

.swal2-title,
.swal2-html-container {
  color: #000;
}

.swal2-confirm {
  background: #ffc000 !important;
  color: #000 !important;
  font-weight: 700 !important;
}

.swal2-confirm:hover {
  background: #ffff00 !important;
}

.swal2-cancel {
  background: #595959 !important;
  color: #fff !important;
}

.swal2-timer-progress-bar {
  background: #ffc000 !important;
}
</style>
