<script setup>
import { buildVerticalNavItems } from '@/navigation/vertical'
import { applySession, sessionMenu } from '@/utils/auth'
import { $api } from '@/utils/api'
import { themeConfig } from '@themeConfig'
import Swal from 'sweetalert2'

// Components
import Footer from '@/layouts/components/Footer.vue'
import UserProfile from '@/layouts/components/UserProfile.vue'

// @layouts plugin
import { VerticalNavLayout } from '@layouts'

import { layoutConfig } from '@layouts'
import { useLayoutConfigStore } from '@layouts/stores/config'

const configStore = useLayoutConfigStore()
const navItems = computed(() => buildVerticalNavItems(sessionMenu.value))

const showPendingWelcomeAlert = () => {
  const name = sessionStorage.getItem('pendingWelcomeAlert')

  if (!name)
    return

  sessionStorage.removeItem('pendingWelcomeAlert')

  Swal.fire({
    icon: 'success',
    iconColor: '#FFC000',
    title: 'Bienvenido',
    text: name,
    timer: 3200,
    timerProgressBar: true,
    showConfirmButton: false,
  })
}

onMounted(async () => {
  showPendingWelcomeAlert()

  // Refresca permisos y menú (pudieron cambiar desde que inició sesión).
  try {
    const response = await $api('/security/auth/me')

    applySession(response.data)
  }
  catch (error) {
    console.error('No se pudo refrescar el acceso actual.', error)
  }
})
</script>

<template>
  <VerticalNavLayout :nav-items="navItems">
    <!-- 👉 navbar -->
    <template #navbar="{ toggleVerticalOverlayNavActive }">
      <div class="d-flex h-100 align-center">
        <IconBtn
          id="vertical-nav-toggle-btn"
          class="ms-n3 d-lg-none"
          @click="toggleVerticalOverlayNavActive(true)"
        >
          <VIcon
            size="26"
            icon="tabler-menu-2"
          />
        </IconBtn>

        <div class="header-action navbar-menu-action">
          <Component
            :is="layoutConfig.app.iconRenderer || 'div'"
            v-show="configStore.isVerticalNavCollapsed"
            class="d-none nav-unpin"
            :class="configStore.isVerticalNavCollapsed && 'd-lg-block'"
            v-bind="layoutConfig.icons.verticalNavUnPinned"
            @click="configStore.isVerticalNavCollapsed = !configStore.isVerticalNavCollapsed"
          />
          <Component
            :is="layoutConfig.app.iconRenderer || 'div'"
            v-show="!configStore.isVerticalNavCollapsed"
            class="d-none nav-pin"
            :class="!configStore.isVerticalNavCollapsed && 'd-lg-block'"
            v-bind="layoutConfig.icons.verticalNavPinned"
            @click="configStore.isVerticalNavCollapsed = !configStore.isVerticalNavCollapsed"
          />

        </div>

        <h1 class="navbar-app-title">
          {{ themeConfig.app.title }}
        </h1>

        <!-- <NavSearchBar class="ms-lg-n3" /> -->

        <VSpacer />

        <!-- <NavBarI18n
          v-if="themeConfig.app.i18n.enable && themeConfig.app.i18n.langConfig?.length"
          :languages="themeConfig.app.i18n.langConfig"
        /> -->
        <UserProfile />
      </div>
    </template>

    <!-- 👉 Pages -->
    <slot />

    <!-- 👉 Footer -->
    <template #footer>
      <Footer />
    </template>

    <!-- 👉 Customizer -->
    <!-- <TheCustomizer /> -->
  </VerticalNavLayout>
</template>

<style scoped>
.navbar-menu-action {
  display: flex;
  align-items: center;
  margin-inline: 0.25rem 0.75rem;
}

.navbar-app-title {
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}

@media (max-width: 599px) {
  .navbar-menu-action {
    display: none;
  }

  .navbar-app-title {
    margin-inline-start: 0.25rem;
    font-size: 1.1rem;
  }
}
</style>
