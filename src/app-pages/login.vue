<script setup>
import AuthLoginPage from '@/components/auth/AuthLoginPage.vue'

definePage({
  meta: {
    layout: 'blank',
    unauthenticatedOnly: true,
  },
})
</script>

<template>
  <AuthLoginPage />
</template>
