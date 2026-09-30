<script setup>
import { PerfectScrollbar } from 'vue3-perfect-scrollbar'
import { clearAuthState } from '@/utils/auth'
import { getChangePasswordPath, getLoginPath } from '@/utils/auth-context'
import { $api } from '@/utils/api'

const router = useRouter()
const userData = useCookie('userData')

const roleLabel = computed(() => (userData.value?.roles ?? []).join(', ') || 'Sin roles')
const companyLabel = computed(() => userData.value?.company?.name ?? 'Personal interno')
const userInitials = computed(() => {
  const initials = [userData.value?.first_name, userData.value?.last_name]
    .map(part => part?.trim()?.[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()

  return initials || '?'
})

const logout = async () => {
  try {
    await $api('/security/auth/logout', { method: 'POST' })
  }
  catch (error) {
    console.error(error)
  }

  clearAuthState(false)
  await router.push(getLoginPath())
}
</script>

<template>
  <VBadge v-if="userData" dot bordered location="bottom right" offset-x="1" offset-y="2" color="success">
    <VAvatar size="38" color="primary" variant="tonal" class="cursor-pointer">
      <span>{{ userInitials }}</span>

      <VMenu activator="parent" width="320" location="bottom end" offset="12px">
        <VList>
          <VListItem>
            <div class="d-flex gap-3 align-center">
              <VAvatar color="primary" variant="tonal">
                <span>{{ userInitials }}</span>
              </VAvatar>

              <div>
                <h6 class="text-h6 font-weight-medium">
                  {{ userData.full_name }}
                </h6>
                <div class="text-caption text-disabled">
                  {{ companyLabel }} · {{ roleLabel }}
                </div>
                <div class="text-caption text-disabled">
                  {{ userData.email }}
                </div>
              </div>
            </div>
          </VListItem>

          <VDivider class="my-2" />

          <PerfectScrollbar :options="{ wheelPropagation: false }">
            <VListItem :to="getChangePasswordPath()" prepend-icon="tabler-lock-password" title="Cambiar contraseña" />

            <div class="px-4 py-2">
              <VBtn block size="small" color="error" append-icon="tabler-logout" @click="logout">
                Cerrar sesión
              </VBtn>
            </div>
          </PerfectScrollbar>
        </VList>
      </VMenu>
    </VAvatar>
  </VBadge>
</template>
