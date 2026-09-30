<script setup>
import { $api } from '@/utils/api'
import { confirmAlert, confirmDeleteAlert, showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { extractApiMessage, extractValidationErrors } from '@/utils/security'

definePage({ meta: { action: 'VER', subject: 'SEG_PER' } })

const ability = useAbility()
const canEdit = computed(() => ability.can('EDITAR', 'SEG_PER'))
const tab = ref('matrix')

// ===================== Acciones habilitadas por módulo =====================
// Un permiso existe cuando la acción está habilitada en el módulo (MODULO:ACCION).
const matrix = ref({ actions: [], modules: [] })
const loadingMatrix = ref(false)
const savingModule = ref(null)

const loadMatrix = async () => {
  loadingMatrix.value = true
  try {
    matrix.value = (await $api('/core/permissions')).data
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
  finally {
    loadingMatrix.value = false
  }
}

const rows = computed(() => {
  const out = []
  const walk = (nodes, depth) => (nodes ?? []).forEach(node => {
    out.push({ node, depth })
    walk(node.children, depth + 1)
  })

  walk(matrix.value.modules, 0)

  return out
})

const isEnabled = (node, action) => !!node.permissions?.[action.code]

const toggleAction = async (node, action) => {
  const enabling = !isEnabled(node, action)

  if (!enabling) {
    const { isConfirmed } = await confirmAlert({
      title: `¿Quitar ${action.name} de ${node.name}?`,
      text: `Se eliminará el permiso ${node.code}:${action.code} y se quitará de todos los roles que lo tengan.`,
      confirmButtonText: 'Sí, quitar',
    })
    if (!isConfirmed)
      return
  }

  const actionIds = matrix.value.actions
    .filter(item => item.id === action.id ? enabling : isEnabled(node, item))
    .map(item => item.id)

  savingModule.value = node.id
  try {
    const response = await $api(`/core/modules/${node.id}/actions`, { method: 'PUT', body: { action_ids: actionIds } })

    matrix.value = response.data
    showSuccessAlert(`${node.code}:${action.code} ${enabling ? 'habilitado' : 'eliminado'}.`)
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
  finally {
    savingModule.value = null
  }
}

// ========================== Catálogo de acciones ==========================
const actions = ref([])
const loadingActions = ref(false)
const actionDialog = ref(false)
const savingAction = ref(false)
const actionForm = ref({})
const actionErrors = ref({})

const loadActions = async () => {
  loadingActions.value = true
  try {
    actions.value = (await $api('/core/actions')).data
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
  finally {
    loadingActions.value = false
  }
}

const openAction = (action = null) => {
  actionForm.value = action
    ? { ...action }
    : { id: null, code: '', name: '', description: '', icon: 'tabler-point', sort_order: (actions.value.at(-1)?.sort_order ?? 0) + 1, is_active: true }
  actionErrors.value = {}
  actionDialog.value = true
}

const saveAction = async () => {
  savingAction.value = true
  actionErrors.value = {}
  try {
    const { id, code, name, description, icon, sort_order: sortOrder, is_active: isActive } = actionForm.value
    const response = await $api(id ? `/core/actions/${id}` : '/core/actions', {
      method: id ? 'PUT' : 'POST',
      body: { code, name, description, icon, sort_order: sortOrder, is_active: isActive },
    })

    showSuccessAlert(response.message)
    actionDialog.value = false
    await Promise.all([loadActions(), loadMatrix()])
  }
  catch (error) {
    actionErrors.value = extractValidationErrors(error)
    if (!Object.keys(actionErrors.value).length)
      showErrorAlert(extractApiMessage(error))
  }
  finally {
    savingAction.value = false
  }
}

const removeAction = async action => {
  const { isConfirmed } = await confirmDeleteAlert(`Se eliminará la acción ${action.name} del catálogo.`)
  if (!isConfirmed)
    return

  try {
    const response = await $api(`/core/actions/${action.id}`, { method: 'DELETE' })

    showSuccessAlert(response.message)
    loadActions()
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}

const actionHeaders = [
  { title: 'Orden', key: 'sort_order', width: 80 },
  { title: 'Acción', key: 'name' },
  { title: 'Código', key: 'code' },
  { title: 'Módulos que la usan', key: 'permissions_count', align: 'center' },
  { title: 'Estado', key: 'is_active' },
  { title: '', key: 'actions', sortable: false, align: 'end' },
]

onMounted(() => Promise.all([loadMatrix(), loadActions()]))
</script>

<template>
  <VCard>
    <VCardText class="pb-0">
      <div class="mb-4">
        <h4 class="text-h4">
          Permisos
        </h4>
        <div class="text-body-2 text-medium-emphasis">
          Un permiso es la combinación de un módulo y una acción (ej. <code>INV_BASE:IMPORTAR</code>).
          Aquí se define qué acciones existen en cada módulo; a quién se le dan se define en Roles.
        </div>
      </div>

      <VTabs v-model="tab">
        <VTab value="matrix" prepend-icon="tabler-table">
          Acciones por módulo
        </VTab>
        <VTab value="catalog" prepend-icon="tabler-list-details">
          Catálogo de acciones
        </VTab>
      </VTabs>
    </VCardText>

    <VDivider />

    <VWindow v-model="tab">
      <!-- Acciones por módulo -->
      <VWindowItem value="matrix">
        <div v-if="loadingMatrix && !rows.length" class="d-flex justify-center pa-12">
          <VProgressCircular indeterminate color="primary" />
        </div>
        <VTable v-else class="text-no-wrap" density="compact">
          <thead>
            <tr>
              <th style="min-inline-size: 300px;">
                Módulo / opción
              </th>
              <th v-for="action in matrix.actions" :key="action.id" class="text-center">
                <div class="d-flex flex-column align-center gap-1 py-2">
                  <VIcon :icon="action.icon || 'tabler-point'" size="18" />
                  {{ action.name }}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="{ node, depth } in rows" :key="node.id">
              <td>
                <div class="d-flex align-center gap-2" :style="{ paddingInlineStart: `${depth * 24}px` }">
                  <VIcon :icon="node.icon || 'tabler-point'" size="20" />
                  <span :class="depth === 0 ? 'font-weight-medium text-high-emphasis' : ''">{{ node.name }}</span>
                  <span class="text-caption text-disabled">{{ node.code }}</span>
                  <VChip v-if="node.is_menu === false" size="x-small" label color="info" variant="tonal">
                    Opción
                  </VChip>
                  <VProgressCircular v-if="savingModule === node.id" indeterminate size="16" width="2" color="primary" />
                </div>
              </td>
              <td v-for="action in matrix.actions" :key="action.id" class="text-center">
                <VCheckboxBtn
                  class="d-inline-flex"
                  :model-value="isEnabled(node, action)"
                  :disabled="!canEdit || savingModule === node.id"
                  density="compact"
                  @update:model-value="toggleAction(node, action)"
                />
              </td>
            </tr>
          </tbody>
        </VTable>
      </VWindowItem>

      <!-- Catálogo de acciones -->
      <VWindowItem value="catalog">
        <VCardText v-if="$can('CREAR', 'SEG_PER')" class="d-flex justify-end">
          <VBtn prepend-icon="tabler-plus" @click="openAction()">
            Nueva acción
          </VBtn>
        </VCardText>
        <VDataTable :headers="actionHeaders" :items="actions" :loading="loadingActions" :items-per-page="-1" hide-default-footer no-data-text="No hay acciones.">
          <template #item.name="{ item }">
            <div class="d-flex align-center gap-3 py-2">
              <VAvatar size="32" color="primary" variant="tonal" rounded>
                <VIcon :icon="item.icon || 'tabler-point'" size="20" />
              </VAvatar>
              <div>
                <div class="font-weight-medium text-high-emphasis">
                  {{ item.name }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ item.description || '' }}
                </div>
              </div>
            </div>
          </template>
          <template #item.code="{ item }">
            <code>{{ item.code }}</code>
          </template>
          <template #item.is_active="{ item }">
            <VChip :color="item.is_active ? 'success' : 'secondary'" size="small" label>
              {{ item.is_active ? 'Activa' : 'Inactiva' }}
            </VChip>
          </template>
          <template #item.actions="{ item }">
            <IconBtn v-if="$can('EDITAR', 'SEG_PER')" @click="openAction(item)">
              <VIcon icon="tabler-pencil" />
            </IconBtn>
            <IconBtn v-if="$can('ELIMINAR', 'SEG_PER') && !item.permissions_count" @click="removeAction(item)">
              <VIcon icon="tabler-trash" />
            </IconBtn>
          </template>
        </VDataTable>
      </VWindowItem>
    </VWindow>
  </VCard>

  <VDialog v-model="actionDialog" max-width="600" persistent>
    <DialogCloseBtn @click="actionDialog = false" />
    <VCard :title="actionForm.id ? 'Editar acción' : 'Nueva acción'">
      <VCardText>
        <VForm @submit.prevent="saveAction">
          <VRow>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="actionForm.code"
                label="Código *"
                placeholder="Ej. ESCANEAR"
                :disabled="!!actionForm.id && actionForm.permissions_count > 0"
                :error-messages="actionErrors.code"
                @update:model-value="value => actionForm.code = value?.toUpperCase()"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="actionForm.name" label="Nombre *" placeholder="Ej. Escanear" :error-messages="actionErrors.name" />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="actionForm.icon" label="Ícono" placeholder="tabler-barcode" :error-messages="actionErrors.icon">
                <template #prepend-inner>
                  <VIcon :icon="actionForm.icon || 'tabler-point'" size="20" />
                </template>
              </AppTextField>
            </VCol>
            <VCol cols="12" md="3">
              <AppTextField v-model.number="actionForm.sort_order" label="Orden" type="number" min="0" :error-messages="actionErrors.sort_order" />
            </VCol>
            <VCol cols="12" md="3">
              <AppSelect v-model="actionForm.is_active" label="Estado" :items="[{ title: 'Activa', value: true }, { title: 'Inactiva', value: false }]" />
            </VCol>
            <VCol cols="12">
              <AppTextField v-model="actionForm.description" label="Descripción" :error-messages="actionErrors.description" />
            </VCol>
          </VRow>
          <div class="d-flex justify-end gap-3 mt-6">
            <VBtn variant="tonal" color="secondary" @click="actionDialog = false">
              Cancelar
            </VBtn>
            <VBtn type="submit" :loading="savingAction">
              Guardar
            </VBtn>
          </div>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
