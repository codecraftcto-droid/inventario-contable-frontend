<template>
  <div class="h-100 d-flex align-center justify-md-space-between justify-center">
    <span class="d-flex align-center text-medium-emphasis">
      © {{ new Date().getFullYear() }} R&R Consulting
    </span>

    <span class="d-md-flex align-center gap-x-2 text-medium-emphasis d-none">
      <span class="footer-dot" aria-hidden="true" />
      <span>Inventario Contable</span>
    </span>
  </div>
</template>

<style scoped>
.footer-dot {
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), 0.34);
  block-size: 4px;
  inline-size: 4px;
}
</style>
