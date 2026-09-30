<script setup>
import { VForm } from 'vuetify/components/VForm'
import { useGenerateImageVariant } from '@core/composable/useGenerateImageVariant'
import authInventoryIllustration from '@images/pages/inventory-login-banner-brand.png'
import authV2MaskDark from '@images/pages/misc-mask-dark.png'
import authV2MaskLight from '@images/pages/misc-mask-light.png'
import { VNodeRenderer } from '@layouts/components/VNodeRenderer'
import { themeConfig } from '@themeConfig'
import { applySession, clearAuthState } from '@/utils/auth'
import { getChangePasswordPath, getDashboardPath } from '@/utils/auth-context'
import { $api } from '@/utils/api'
import { extractApiMessage, extractValidationErrors } from '@/utils/security'

const route = useRoute()
const authThemeMask = useGenerateImageVariant(authV2MaskLight, authV2MaskDark)

const refVForm = ref()
const isPasswordVisible = ref(false)
const isLoading = ref(false)
const message = ref('')
const errors = ref({})

const credentials = ref({
  login: '',
  password: '',
})

const currentYear = new Date().getFullYear()

const pageTitle = 'Acceso al panel'
const pageDescription = 'Ingresa con tu número de documento o correo para administrar empresas, inventarios y seguridad.'

const login = async () => {
  isLoading.value = true
  message.value = ''
  errors.value = {}
  clearAuthState(false)

  try {
    const response = await $api('/security/auth/login', {
      method: 'POST',
      body: { ...credentials.value, platform: 'WEB' },
    })

    applySession(response.data)

    // Primer ingreso o clave reseteada: primero debe cambiarla.
    if (response.data.user.must_change_password) {
      window.location.assign(getChangePasswordPath())

      return
    }

    sessionStorage.setItem('pendingWelcomeAlert', response.data.user.full_name)
    window.location.assign(typeof route.query.to === 'string' ? route.query.to : getDashboardPath())
  }
  catch (error) {
    errors.value = extractValidationErrors(error)
    message.value = extractApiMessage(error)
  }
  finally {
    isLoading.value = false
  }
}

const onSubmit = () => {
  refVForm.value?.validate().then(({ valid }) => {
    if (valid)
      login()
  })
}
</script>

<template>
  <RouterLink to="/">
    <div class="auth-logo d-flex align-center gap-x-3">
      <VNodeRenderer :nodes="themeConfig.app.logo" />
      <h1 class="auth-title">
        {{ themeConfig.app.title }}
      </h1>
    </div>
  </RouterLink>

  <VRow no-gutters class="auth-wrapper bg-surface">
    <VCol md="8" class="d-none d-md-flex">
      <div class="position-relative bg-background w-100 me-0">
        <div class="d-flex align-center justify-center w-100 h-100" style="padding-inline: 6.25rem;">
          <VImg
            max-width="760"
            :src="authInventoryIllustration"
            alt="Inventariadores registrando activos etiquetados"
            class="auth-illustration mt-16 mb-2 rounded-xl"
          />
        </div>

        <img class="auth-footer-mask" :src="authThemeMask" alt="auth-footer-mask" height="280" width="100">
      </div>
    </VCol>

    <VCol cols="12" md="4" class="auth-card-v2 login-card-column d-flex align-center justify-center">
      <div class="login-panel">
        <VCard flat :max-width="500" class="mt-12 mt-sm-0 pa-4">
          <VCardText class="pb-2">
            <div class="login-brand-mark">
              <VNodeRenderer :nodes="themeConfig.app.logo" class="login-brand-mark__logo" />

              <div>
                <div class="login-brand-mark__name">
                  {{ themeConfig.app.title }}
                </div>
                <div class="login-brand-mark__caption">
                  Control físico y contable de activos por empresa
                </div>
              </div>
            </div>
          </VCardText>

          <VCardText>
            <h4 class="text-h4 mb-1">
              {{ pageTitle }}
            </h4>
            <p class="mb-0">
              {{ pageDescription }}
            </p>
          </VCardText>

          <VCardText v-if="message">
            <VAlert type="error" variant="tonal">
              {{ message }}
            </VAlert>
          </VCardText>

          <VCardText>
            <VForm ref="refVForm" @submit.prevent="onSubmit">
              <VRow>
                <VCol cols="12">
                  <AppTextField
                    v-model="credentials.login"
                    label="Número de documento o correo"
                    placeholder="Ej. 45678912 o usuario@empresa.com"
                    autocomplete="username"
                    autofocus
                    :rules="[requiredValidator]"
                    :error-messages="errors.login"
                  />
                </VCol>

                <VCol cols="12">
                  <AppTextField
                    v-model="credentials.password"
                    label="Contraseña"
                    placeholder="Ingresa tu contraseña"
                    :rules="[requiredValidator]"
                    :type="isPasswordVisible ? 'text' : 'password'"
                    autocomplete="current-password"
                    :error-messages="errors.password"
                    :append-inner-icon="isPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'"
                    @click:append-inner="isPasswordVisible = !isPasswordVisible"
                  />

                  <div class="my-4" />
                </VCol>

                <VCol cols="12">
                  <VBtn block type="submit" :loading="isLoading">
                    Ingresar
                  </VBtn>
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
        </VCard>
      </div>

      <footer class="login-footer">
        <span>© {{ currentYear }} R&R Consulting</span>
        <span class="login-footer__dot" aria-hidden="true" />
        <span>{{ themeConfig.app.title }}</span>
      </footer>
    </VCol>
  </VRow>
</template>

<style lang="scss">
@use "@core-scss/template/pages/page-auth";

.login-panel {
  display: flex;
  flex-direction: column;
  inline-size: min(100%, 500px);
}

.login-card-column {
  position: relative;
  min-block-size: 100dvh;
  padding-block: 4rem;
}

.login-brand-mark {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.login-brand-mark__logo {
  display: flex;
  flex: 0 0 8.75rem;
  align-items: center;
  justify-content: center;
  block-size: 5.75rem;
  inline-size: 8.75rem;
}

.login-brand-mark__logo :deep(svg) {
  block-size: 46px;
  inline-size: 46px;
}

.login-brand-mark__logo :deep(.company-app-logo) {
  block-size: 5.75rem !important;
  inline-size: 8.75rem !important;
  object-fit: fill !important;
}

.login-brand-mark__name {
  color: rgb(var(--v-theme-primary));
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.1;
}

.login-brand-mark__caption {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.35;
  margin-block-start: 0.18rem;
}

.login-footer {
  position: absolute;
  inset-block-end: 1.4rem;
  inset-inline: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.82rem;
  gap: 0.55rem;
  letter-spacing: 0;
  line-height: 1.4;
  text-align: center;
}

.login-footer__dot {
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), 0.34);
  block-size: 4px;
  inline-size: 4px;
}

@media (max-width: 449px) {
  .login-footer {
    flex-direction: column;
    gap: 0.2rem;
  }

  .login-footer__dot {
    display: none;
  }
}
</style>
