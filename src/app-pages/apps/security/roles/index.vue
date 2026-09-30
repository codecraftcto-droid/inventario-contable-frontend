<script setup>
import PermissionMatrix from '@/components/security/PermissionMatrix.vue'
import { $api } from '@/utils/api'
import { confirmDeleteAlert, showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { extractApiMessage, extractValidationErrors } from '@/utils/security'

definePage({ meta: { action: 'VER', subject: 'SEG_ROL' } })

// Los roles son pocos: se cargan completos y se filtran en pantalla.
const roles = ref([])
const loading = ref(false)
const search = ref('')

const load = async () => {
  loading.value = true
  try {
    roles.value = (await $api('/security/roles')).data
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

const headers = [
  { title: 'Rol', key: 'name' },
  { title: 'Usuarios', key: 'users_count', align: 'center' },
  { title: 'Permisos', key: 'permissions_count', align: 'center' },
  { title: 'Estado', key: 'is_active' },
  { title: '', key: 'actions', sortable: false, align: 'end' },
]

// --- Alta / edición ---
const formDialog = ref(false)
const saving = ref(false)
const form = ref({})
const errors = ref({})

const openForm = (role = null) => {
  form.value = role ? { ...role } : { id: null, name: '', description: '', is_active: true }
  errors.value = {}
  formDialog.value = true
}

const save = async () => {
  saving.value = true
  errors.value = {}

  try {
    const { id, name, description, is_active: isActive } = form.value
    const response = await $api(id ? `/security/roles/${id}` : '/security/roles', {
      method: id ? 'PUT' : 'POST',
      body: { name, description, is_active: isActive },
    })

    showSuccessAlert(response.message)
    formDialog.value = false
    await load()

    // Rol nuevo: se pasa directo a asignarle permisos.
    if (!id)
      openPermissions(response.data)
  }
  catch (error) {
    errors.value = extractValidationErrors(error)
    if (!Object.keys(errors.value).length)
      showErrorAlert(extractApiMessage(error))
  }
  finally {
    saving.value = false
  }
}

const remove = async role => {
  const { isConfirmed } = await confirmDeleteAlert(`Se eliminará el rol ${role.name}.`)
  if (!isConfirmed)
    return

  try {
    const response = await $api(`/security/roles/${role.id}`, { method: 'DELETE' })

    showSuccessAlert(response.message)
    load()
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}

// --- Matriz de permisos ---
const matrixDialog = ref(false)
const matrixLoading = ref(false)
const savingMatrix = ref(false)
const matrix = ref({ role: null, actions: [], modules: [] })
const granted = ref([])

const collectGranted = nodes => nodes.flatMap(node => [
  ...Object.values(node.permissions ?? {}).filter(cell => cell.granted).map(cell => cell.permission_id),
  ...collectGranted(node.children ?? []),
])

const openPermissions = async role => {
  matrixDialog.value = true
  matrixLoading.value = true
  matrix.value = { role, actions: [], modules: [] }

  try {
    const response = await $api(`/security/roles/${role.id}/permissions`)

    matrix.value = response.data
    granted.value = collectGranted(response.data.modules)
  }
  catch (error) {
    matrixDialog.value = false
    showErrorAlert(extractApiMessage(error))
  }
  finally {
    matrixLoading.value = false
  }
}

// ADMIN siempre conserva todos los permisos (lo fuerza el backend).
const matrixReadonly = computed(() => !can('EDITAR', 'SEG_ROL') || matrix.value.role?.name === 'ADMIN')

const savePermissions = async () => {
  savingMatrix.value = true
  try {
    const response = await $api(`/security/roles/${matrix.value.role.id}/permissions`, {
      method: 'PUT',
      body: { permission_ids: granted.value },
    })

    showSuccessAlert(response.message)
    matrixDialog.value = false
    load()
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
  finally {
    savingMatrix.value = false
  }
}

const ability = useAbility()
const can = (action, subject) => ability.can(action, subject)
</script>

<template>
  <VCard>
    <VCardText>
      <div class="d-flex flex-wrap align-center gap-4 mb-6">
        <div class="me-auto">
          <h4 class="text-h4">
            Roles
          </h4>
          <div class="text-body-2 text-medium-emphasis">
            Cada rol agrupa permisos (módulo + acción). A un usuario se le asignan uno o más roles.
          </div>
        </div>
        <VBtn v-if="$can('CREAR', 'SEG_ROL')" prepend-icon="tabler-plus" @click="openForm()">
          Nuevo rol
        </VBtn>
      </div>

      <VRow>
        <VCol cols="12" sm="8" md="6">
          <AppTextField v-model="search" placeholder="Buscar rol" prepend-inner-icon="tabler-search" clearable />
        </VCol>
      </VRow>
    </VCardText>

    <VDivider />

    <VDataTable :headers="headers" :items="roles" :search="search ?? ''" :loading="loading" :items-per-page="25" no-data-text="No hay roles.">
      <template #item.name="{ item }">
        <div class="py-2">
          <div class="d-flex align-center gap-2 font-weight-medium text-high-emphasis">
            {{ item.name }}
            <VChip v-if="item.is_system" size="x-small" label color="primary">
              Sistema
            </VChip>
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ item.description || 'Sin descripción' }}
          </div>
        </div>
      </template>
      <template #item.is_active="{ item }">
        <VChip :color="item.is_active ? 'success' : 'secondary'" size="small" label>
          {{ item.is_active ? 'Activo' : 'Inactivo' }}
        </VChip>
      </template>
      <template #item.actions="{ item }">
        <IconBtn @click="openPermissions(item)">
          <VIcon icon="tabler-shield-check" />
          <VTooltip activator="parent">
            {{ $can('EDITAR', 'SEG_ROL') && item.name !== 'ADMIN' ? 'Asignar permisos' : 'Ver permisos' }}
          </VTooltip>
        </IconBtn>
        <IconBtn v-if="$can('EDITAR', 'SEG_ROL')" @click="openForm(item)">
          <VIcon icon="tabler-pencil" />
          <VTooltip activator="parent">
            Editar
          </VTooltip>
        </IconBtn>
        <IconBtn v-if="$can('ELIMINAR', 'SEG_ROL') && !item.is_system" @click="remove(item)">
          <VIcon icon="tabler-trash" />
          <VTooltip activator="parent">
            Eliminar
          </VTooltip>
        </IconBtn>
      </template>
    </VDataTable>
  </VCard>

  <!-- Alta / edición -->
  <VDialog v-model="formDialog" max-width="560" persistent>
    <DialogCloseBtn @click="formDialog = false" />
    <VCard :title="form.id ? 'Editar rol' : 'Nuevo rol'">
      <VCardText>
        <VForm @submit.prevent="save">
          <VRow>
            <VCol cols="12" md="7">
              <AppTextField
                v-model="form.name"
                label="Nombre *"
                placeholder="Ej. SUPERVISOR"
                :disabled="form.is_system"
                :error-messages="errors.name"
                @update:model-value="value => form.name = value?.toUpperCase()"
              />
            </VCol>
            <VCol cols="12" md="5">
              <AppSelect
                v-model="form.is_active"
                label="Estado"
                :items="[{ title: 'Activo', value: true }, { title: 'Inactivo', value: false }]"
                :disabled="form.is_system"
                :error-messages="errors.is_active"
              />
            </VCol>
            <VCol cols="12">
              <AppTextarea v-model="form.description" label="Descripción" rows="2" auto-grow :error-messages="errors.description" />
            </VCol>
          </VRow>
          <div class="d-flex justify-end gap-3 mt-6">
            <VBtn variant="tonal" color="secondary" @click="formDialog = false">
              Cancelar
            </VBtn>
            <VBtn type="submit" :loading="saving">
              {{ form.id ? 'Guardar' : 'Guardar y asignar permisos' }}
            </VBtn>
          </div>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>

  <!-- Matriz de permisos -->
  <VDialog v-model="matrixDialog" max-width="1200" scrollable>
    <DialogCloseBtn @click="matrixDialog = false" />
    <VCard>
      <VCardItem>
        <VCardTitle>Permisos del rol {{ matrix.role?.name }}</VCardTitle>
        <VCardSubtitle>
          {{ granted.length }} permiso(s) marcados · Filas = módulos y opciones, columnas = acciones
        </VCardSubtitle>
      </VCardItem>
      <VCardText class="pa-0 matrix-body">
        <VAlert v-if="matrix.role?.name === 'ADMIN'" type="info" variant="tonal" class="ma-4">
          El rol ADMIN siempre tiene todos los permisos.
        </VAlert>
        <div v-if="matrixLoading" class="d-flex justify-center pa-12">
          <VProgressCircular indeterminate color="primary" />
        </div>
        <PermissionMatrix v-else v-model="granted" :actions="matrix.actions" :modules="matrix.modules" :readonly="matrixReadonly" />
      </VCardText>
      <VCardActions class="justify-end pa-4">
        <VBtn variant="tonal" color="secondary" @click="matrixDialog = false">
          {{ matrixReadonly ? 'Cerrar' : 'Cancelar' }}
        </VBtn>
        <VBtn v-if="!matrixReadonly" :loading="savingMatrix" @click="savePermissions">
          Guardar permisos
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.matrix-body {
  max-block-size: 65vh;
}
</style>
