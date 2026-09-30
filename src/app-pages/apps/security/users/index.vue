<script setup>
import TemporaryPasswordDialog from '@/components/security/TemporaryPasswordDialog.vue'
import UserFormDialog from '@/components/security/UserFormDialog.vue'
import { $api } from '@/utils/api'
import { confirmAlert, confirmDeleteAlert, showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { formatDateTime } from '@/utils/constants'
import { extractApiMessage } from '@/utils/security'

definePage({ meta: { action: 'VER', subject: 'SEG_USU' } })

const currentUser = useCookie('userData')

const filters = reactive({ user_type: null, company_id: null, role_id: null, is_active: null })
const { options, search, tableProps, reload } = useServerTable('/security/users', { filters })

const headers = [
  { title: 'Usuario', key: 'first_name' },
  { title: 'Documento', key: 'document_number' },
  { title: 'Empresa', key: 'company', sortable: false },
  { title: 'Roles', key: 'roles', sortable: false },
  { title: 'Estado', key: 'is_active' },
  { title: 'Último acceso', key: 'last_login_at' },
  { title: '', key: 'actions', sortable: false, align: 'end', width: 56 },
]

// Catálogos para filtros y formulario
const roles = ref([])
const companies = useCompanySearch({ onlyActive: false })

onMounted(async () => {
  companies.fetch('')
  try {
    roles.value = (await $api('/security/roles')).data
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
})

const roleOptions = computed(() => roles.value.map(role => ({ title: role.name, value: role.id })))

const initials = user => [user.first_name, user.last_name].map(part => part?.trim()?.[0]).filter(Boolean).join('').toUpperCase()

// --- Alta / edición ---
const formDialog = ref(false)
const editing = ref(null)
const passwordDialog = ref(false)
const temporary = ref({ password: '', user: null })

const openCreate = () => {
  editing.value = null
  formDialog.value = true
}

const openEdit = user => {
  editing.value = user
  formDialog.value = true
}

const onSaved = user => {
  reload()
  if (user.temporary_password) {
    temporary.value = { password: user.temporary_password, user }
    passwordDialog.value = true
  }
}

// --- Acciones ---
const run = async (request, { reloadTable = true } = {}) => {
  try {
    const response = await request()

    showSuccessAlert(response.message)
    if (reloadTable)
      reload()

    return response
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}

const toggleActive = async user => {
  const activating = !user.is_active
  const { isConfirmed } = await confirmAlert({
    title: activating ? `¿Activar a ${user.full_name}?` : `¿Desactivar a ${user.full_name}?`,
    text: activating ? 'Podrá volver a ingresar al sistema.' : 'Se cerrarán todas sus sesiones abiertas (web y app).',
    confirmButtonText: activating ? 'Sí, activar' : 'Sí, desactivar',
  })

  if (isConfirmed)
    await run(() => $api(`/security/users/${user.id}/status`, { method: 'PATCH', body: { is_active: activating } }))
}

const unlock = user => run(() => $api(`/security/users/${user.id}/unlock`, { method: 'POST' }))

const resetPassword = async user => {
  const { isConfirmed } = await confirmAlert({
    title: `¿Resetear la contraseña de ${user.full_name}?`,
    text: 'Se generará una contraseña temporal y se cerrarán todas sus sesiones.',
    confirmButtonText: 'Sí, resetear',
  })
  if (!isConfirmed)
    return

  const response = await run(() => $api(`/security/users/${user.id}/reset-password`, { method: 'POST' }))
  if (response) {
    temporary.value = { password: response.data.temporary_password, user }
    passwordDialog.value = true
  }
}

const revokeSessions = async user => {
  const { isConfirmed } = await confirmAlert({
    title: `¿Cerrar las sesiones de ${user.full_name}?`,
    text: 'Se cerrará su acceso en todos sus dispositivos (web y app). Podrá volver a ingresar con su contraseña.',
    confirmButtonText: 'Sí, cerrar sesiones',
  })

  if (isConfirmed)
    await run(() => $api(`/security/users/${user.id}/sessions/revoke`, { method: 'POST' }))
}

const remove = async user => {
  const { isConfirmed } = await confirmDeleteAlert(`Se eliminará el usuario ${user.full_name}. Si solo quieres quitarle el acceso, desactívalo.`)
  if (isConfirmed)
    await run(() => $api(`/security/users/${user.id}`, { method: 'DELETE' }))
}

const isSelf = user => user.id === currentUser.value?.id
</script>

<template>
  <VCard>
    <VCardText>
      <div class="d-flex flex-wrap align-center gap-4 mb-6">
        <div class="me-auto">
          <h4 class="text-h4">
            Usuarios
          </h4>
          <div class="text-body-2 text-medium-emphasis">
            Personal interno y usuarios de las empresas cliente.
          </div>
        </div>
        <VBtn v-if="$can('CREAR', 'SEG_USU')" prepend-icon="tabler-plus" @click="openCreate">
          Nuevo usuario
        </VBtn>
      </div>

      <!-- Filtros: misma altura y ancho uniforme -->
      <VRow>
        <VCol cols="12" sm="6" md="4">
          <AppTextField v-model="search" placeholder="Buscar por nombre, documento o correo" prepend-inner-icon="tabler-search" clearable />
        </VCol>
        <VCol cols="12" sm="6" md="2">
          <AppSelect
            v-model="filters.user_type"
            :items="[{ title: 'Personal interno', value: 'INTERNO' }, { title: 'Usuario de empresa', value: 'CLIENTE' }]"
            placeholder="Tipo"
            clearable
          />
        </VCol>
        <VCol cols="12" sm="6" md="2">
          <AppAutocomplete
            v-model="filters.company_id"
            v-model:search="companies.search.value"
            :items="companies.items.value"
            :loading="companies.loading.value"
            placeholder="Empresa"
            no-filter
            clearable
          />
        </VCol>
        <VCol cols="12" sm="6" md="2">
          <AppSelect v-model="filters.role_id" :items="roleOptions" placeholder="Rol" clearable />
        </VCol>
        <VCol cols="12" sm="6" md="2">
          <AppSelect v-model="filters.is_active" :items="[{ title: 'Activos', value: 1 }, { title: 'Inactivos', value: 0 }]" placeholder="Estado" clearable />
        </VCol>
      </VRow>
    </VCardText>

    <VDivider />

    <VDataTableServer v-model:options="options" v-bind="tableProps" :headers="headers" no-data-text="No se encontraron usuarios.">
      <template #item.first_name="{ item }">
        <div class="d-flex align-center gap-3 py-2">
          <VAvatar size="36" :color="item.is_active ? 'primary' : 'secondary'" variant="tonal">
            <span class="text-sm">{{ initials(item) }}</span>
          </VAvatar>
          <div>
            <div class="font-weight-medium text-high-emphasis">
              {{ item.full_name }}
              <VChip v-if="item.is_root_admin" size="x-small" color="primary" label class="ms-1">
                Superusuario
              </VChip>
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ item.username }} · {{ item.email }}
            </div>
          </div>
        </div>
      </template>

      <template #item.company="{ item }">
        <span v-if="item.company">{{ item.company.name }}</span>
        <VChip v-else size="small" variant="tonal" color="secondary" label>
          Personal interno
        </VChip>
      </template>

      <template #item.roles="{ item }">
        <div class="d-flex flex-wrap gap-1">
          <VChip v-for="role in item.roles" :key="role.id" size="small" variant="tonal" color="primary" label>
            {{ role.name }}
          </VChip>
          <span v-if="!item.roles.length" class="text-disabled">Sin roles</span>
        </div>
      </template>

      <template #item.is_active="{ item }">
        <div class="d-flex flex-wrap gap-1">
          <VChip :color="item.is_active ? 'success' : 'secondary'" size="small" label>
            {{ item.is_active ? 'Activo' : 'Inactivo' }}
          </VChip>
          <VChip v-if="item.is_locked" color="error" size="small" label prepend-icon="tabler-lock">
            Bloqueado
          </VChip>
          <VChip v-if="item.must_change_password" color="warning" size="small" label>
            Cambio de clave pendiente
          </VChip>
        </div>
      </template>

      <template #item.last_login_at="{ item }">
        <div>{{ formatDateTime(item.last_login_at) }}</div>
        <div v-if="item.active_sessions_count" class="text-caption text-medium-emphasis">
          {{ item.active_sessions_count }} sesión(es) activa(s)
        </div>
      </template>

      <template #item.actions="{ item }">
        <VMenu location="bottom end">
          <template #activator="{ props: menuProps }">
            <IconBtn v-bind="menuProps">
              <VIcon icon="tabler-dots-vertical" />
            </IconBtn>
          </template>
          <VList density="compact" min-width="220">
            <VListItem v-if="$can('EDITAR', 'SEG_USU')" prepend-icon="tabler-pencil" title="Editar" @click="openEdit(item)" />
            <VListItem
              v-if="$can('EDITAR', 'SEG_USU') && !item.is_root_admin && !isSelf(item)"
              :prepend-icon="item.is_active ? 'tabler-user-off' : 'tabler-user-check'"
              :title="item.is_active ? 'Desactivar' : 'Activar'"
              @click="toggleActive(item)"
            />
            <VListItem v-if="$can('EDITAR', 'SEG_USU') && item.is_locked" prepend-icon="tabler-lock-open" title="Desbloquear" @click="unlock(item)" />
            <VListItem v-if="$can('EDITAR', 'SEG_USU')" prepend-icon="tabler-key" title="Resetear contraseña" @click="resetPassword(item)" />
            <VListItem
              v-if="$can('ELIMINAR', 'SEG_SES') && item.active_sessions_count && !isSelf(item)"
              prepend-icon="tabler-device-mobile-off"
              title="Cerrar sesiones"
              @click="revokeSessions(item)"
            />
            <template v-if="$can('ELIMINAR', 'SEG_USU') && !item.is_root_admin && !isSelf(item)">
              <VDivider class="my-1" />
              <VListItem prepend-icon="tabler-trash" title="Eliminar" base-color="error" @click="remove(item)" />
            </template>
          </VList>
        </VMenu>
      </template>
    </VDataTableServer>
  </VCard>

  <UserFormDialog v-model="formDialog" :user="editing" :roles="roles" @saved="onSaved" />
  <TemporaryPasswordDialog v-model="passwordDialog" :password="temporary.password" :user="temporary.user" />
</template>
