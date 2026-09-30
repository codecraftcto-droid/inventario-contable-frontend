<script setup>
import miscMaskDark from '@images/pages/misc-mask-dark.png'
import miscMaskLight from '@images/pages/misc-mask-light.png'
import pageNotFound from '@images/pages/404.png'
import { useGenerateImageVariant } from '@core/composable/useGenerateImageVariant'

definePage({
  meta: {
    layout: 'blank',
    public: true,
  },
})

const authThemeMask = useGenerateImageVariant(miscMaskLight, miscMaskDark)
</script>

<template>
  <div class="misc-wrapper">
    <ErrorHeader
      status-code="404"
      title="Pagina no encontrada"
      description="La ruta solicitada no existe dentro del panel administrativo."
    />

    <VBtn class="mb-11" to="/">
      Volver al inicio
    </VBtn>

    <div class="misc-avatar w-100 text-center">
      <VImg :src="pageNotFound" alt="404" :max-height="$vuetify.display.smAndDown ? 350 : 500" class="mx-auto" />
    </div>

    <img class="misc-footer-img d-none d-md-block" :src="authThemeMask" alt="mask" height="320">
  </div>
</template>

<style lang="scss">
@use "@core-scss/template/pages/misc.scss";
</style>
