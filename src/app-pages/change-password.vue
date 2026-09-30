<script setup>
import { applySession, clearAuthState } from '@/utils/auth'
import { getDashboardPath, getLoginPath } from '@/utils/auth-context'
import { $api } from '@/utils/api'
import { extractApiMessage, extractValidationErrors } from '@/utils/security'

definePage({ meta: { layout: 'blank' } })

const userData = useCookie('userData')
const router = useRouter()

const form = reactive({ current_password: '', password: '', password_confirmation: '' })
const visible = ref(false)
const loading = ref(false)
const message = ref('')
const errors = ref({})

// Mismas reglas que valida el backend: mínimo 8, mayúsculas, minúsculas y números.
const rules = computed(() => [
  { ok: form.password.length >= 8, text: 'Al menos 8 caracteres' },
  { ok: /[A-Z]/.test(form.password) && /[a-z]/.test(form.password), text: 'Mayúsculas y minúsculas' },
  { ok: /\d/.test(form.password), text: 'Al menos un número' },
  { ok: form.password !== '' && form.password === form.password_confirmation, text: 'Las contraseñas coinciden' },
])

const mustChange = computed(() => userData.value?.must_change_password === true)

const submit = async () => {
  loading.value = true
  message.value = ''
  errors.value = {}

  try {
    const response = await $api('/security/auth/change-password', { method: 'POST', body: form })

    applySession(response.data)
    sessionStorage.setItem('pendingWelcomeAlert', response.data.user.full_name)
    await router.replace(getDashboardPath())
  }
  catch (error) {
    errors.value = extractValidationErrors(error)
    message.value = extractApiMessage(error, 'No se pudo cambiar la contraseña.')
  }
  finally {
    loading.value = false
  }
}

const logout = async () => {
  try {
    await $api('/security/auth/logout', { method: 'POST' })
  }
  catch {
    // La sesión puede haber expirado: igual se limpia localmente.
  }
  clearAuthState(false)
  await router.replace(getLoginPath())
}
</script>

<template>
  <div class="d-flex align-center justify-center pa-4 change-password-page">
    <VCard max-width="480" width="100%" class="pa-2">
      <VCardText class="text-center pb-0">
        <img src="/rr-consulting-logo.png" alt="R&R Consulting" class="change-password-logo">
      </VCardText>

      <VCardText>
        <h4 class="text-h4 mb-1">
          Cambia tu contraseña
        </h4>
        <p class="mb-0">
          {{ mustChange ? 'Por seguridad, define una nueva contraseña antes de continuar.' : 'Define una nueva contraseña para tu cuenta.' }}
        </p>
      </VCardText>

      <VCardText v-if="message">
        <VAlert type="error" variant="tonal">
          {{ message }}
        </VAlert>
      </VCardText>

      <VCardText>
        <VForm @submit.prevent="submit">
          <VRow>
            <VCol cols="12">
              <AppTextField
                v-model="form.current_password"
                label="Contraseña actual"
                :type="visible ? 'text' : 'password'"
                autocomplete="current-password"
                :error-messages="errors.current_password"
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="form.password"
                label="Nueva contraseña"
                :type="visible ? 'text' : 'password'"
                autocomplete="new-password"
                :error-messages="errors.password"
                :append-inner-icon="visible ? 'tabler-eye-off' : 'tabler-eye'"
                @click:append-inner="visible = !visible"
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="form.password_confirmation"
                label="Confirmar nueva contraseña"
                :type="visible ? 'text' : 'password'"
                autocomplete="new-password"
              />
            </VCol>
            <VCol cols="12">
              <div v-for="rule in rules" :key="rule.text" class="d-flex align-center gap-2 text-body-2 mb-1">
                <VIcon :icon="rule.ok ? 'tabler-circle-check-filled' : 'tabler-circle'" :color="rule.ok ? 'success' : 'secondary'" size="18" />
                {{ rule.text }}
              </div>
            </VCol>
            <VCol cols="12">
              <VBtn block type="submit" :loading="loading" :disabled="!rules.every(rule => rule.ok)">
                Guardar contraseña
              </VBtn>
              <VBtn block variant="text" color="secondary" class="mt-2" @click="logout">
                Cerrar sesión
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </div>
</template>

<style scoped>
.change-password-page {
  min-block-size: 100vh;
  background: rgb(var(--v-theme-background));
}

.change-password-logo {
  inline-size: 140px;
}
</style>
