<script setup>
/**
 * Muestra UNA sola vez la contraseña temporal generada (alta o reseteo) para entregarla al usuario.
 */
const props = defineProps({
  password: { type: String, default: '' },
  user: { type: Object, default: null },
})

const isOpen = defineModel({ type: Boolean, default: false })
const copied = ref(false)

const copy = async () => {
  await navigator.clipboard.writeText(props.password)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <VDialog v-model="isOpen" max-width="480" persistent>
    <VCard>
      <VCardText class="text-center pt-8">
        <VAvatar color="success" variant="tonal" size="64" class="mb-4">
          <VIcon icon="tabler-key" size="34" />
        </VAvatar>
        <h5 class="text-h5 mb-2">
          Contraseña temporal
        </h5>
        <p class="text-body-2 text-medium-emphasis mb-6">
          Entrégala a <strong>{{ user?.full_name }}</strong>. Deberá cambiarla en su primer ingreso.
          Por seguridad no se volverá a mostrar.
        </p>

        <div class="d-flex align-center justify-center gap-2 temporary-password pa-3 rounded">
          <code class="text-h5">{{ password }}</code>
          <IconBtn @click="copy">
            <VIcon :icon="copied ? 'tabler-check' : 'tabler-copy'" :color="copied ? 'success' : undefined" />
            <VTooltip activator="parent">
              {{ copied ? 'Copiada' : 'Copiar' }}
            </VTooltip>
          </IconBtn>
        </div>

        <div class="text-body-2 mt-4">
          Ingresa con su documento <strong>{{ user?.document_number }}</strong> o su correo <strong>{{ user?.email }}</strong>.
        </div>
      </VCardText>
      <VCardActions class="justify-center pb-6">
        <VBtn @click="isOpen = false">
          Entendido
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.temporary-password {
  background: rgba(var(--v-theme-on-surface), 0.05);
}
</style>
