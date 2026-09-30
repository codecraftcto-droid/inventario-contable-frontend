<script setup>
import { $api } from '@/utils/api'
import { confirmDeleteAlert, showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { extractApiMessage, extractValidationErrors } from '@/utils/security'

definePage({ meta: { action: 'VER', subject: 'SEG_MOD' } })

const PLATFORMS = [
  { value: 'WEB', title: 'Web', color: 'primary' },
  { value: 'MOVIL', title: 'Móvil', color: 'info' },
  { value: 'AMBOS', title: 'Web y móvil', color: 'success' },
]
const platform = value => PLATFORMS.find(item => item.value === value) ?? { title: value, color: 'secondary' }

const tree = ref([])
const actions = ref([])
const loading = ref(false)
const collapsed = ref(new Set())

const load = async () => {
  loading.value = true
  try {
    const [modules, catalog] = await Promise.all([$api('/core/modules'), $api('/core/actions')])

    tree.value = modules.data
    actions.value = catalog.data.filter(action => action.is_active)
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

// Árbol aplanado respetando los nodos contraídos.
const rows = computed(() => {
  const out = []
  const walk = (nodes, depth) => (nodes ?? []).forEach(node => {
    out.push({ node, depth, hasChildren: !!node.children?.length })
    if (!collapsed.value.has(node.id))
      walk(node.children, depth + 1)
  })

  walk(tree.value, 0)

  return out
})

// Acciones del módulo en el orden del catálogo, con su ícono.
const actionsOf = node => actions.value.filter(action => node.actions.includes(action.code))

const toggle = node => {
  const next = new Set(collapsed.value)

  next.has(node.id) ? next.delete(node.id) : next.add(node.id)
  collapsed.value = next
}

// Opciones de "módulo padre": todos menos el propio módulo y sus descendientes (evita ciclos).
const parentOptions = computed(() => {
  const out = []
  const excluded = new Set()

  const markDescendants = node => {
    excluded.add(node.id)
    node.children?.forEach(markDescendants)
  }

  const findNode = (nodes, id) => nodes.reduce((found, node) => found ?? (node.id === id ? node : findNode(node.children ?? [], id)), null)

  if (form.value.id) {
    const self = findNode(tree.value, form.value.id)
    if (self)
      markDescendants(self)
  }

  const walk = (nodes, depth) => (nodes ?? []).forEach(node => {
    if (!excluded.has(node.id))
      out.push({ title: `${'— '.repeat(depth)}${node.name} (${node.code})`, value: node.id })
    walk(node.children, depth + 1)
  })

  walk(tree.value, 0)

  return out
})

// --- Formulario ---
const dialog = ref(false)
const saving = ref(false)
const form = ref({})
const errors = ref({})

const openForm = (node = null, parent = null) => {
  form.value = node
    ? { ...node, action_ids: actions.value.filter(action => node.actions.includes(action.code)).map(action => action.id) }
    : {
        id: null,
        parent_id: parent?.id ?? null,
        code: parent ? `${parent.code}_` : '',
        name: '',
        description: '',
        icon: 'tabler-point',
        path: '',
        sort_order: (parent?.children?.length ?? tree.value.length) + 1,
        platform: parent?.platform ?? 'WEB',
        is_menu: true,
        is_active: true,
        action_ids: actions.value.filter(action => action.code === 'VER').map(action => action.id),
      }
  errors.value = {}
  dialog.value = true
}

const save = async () => {
  saving.value = true
  errors.value = {}
  try {
    const { id, parent_id, code, name, description, icon, path, sort_order, platform: platformValue, is_menu, is_active, action_ids } = form.value
    const response = await $api(id ? `/core/modules/${id}` : '/core/modules', {
      method: id ? 'PUT' : 'POST',
      body: { parent_id, code, name, description, icon, path: path || null, sort_order, platform: platformValue, is_menu, is_active, action_ids },
    })

    showSuccessAlert(response.message)
    dialog.value = false
    load()
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

const remove = async node => {
  const { isConfirmed } = await confirmDeleteAlert(`Se eliminará el módulo ${node.name} y sus permisos (se quitarán de todos los roles).`)
  if (!isConfirmed)
    return

  try {
    const response = await $api(`/core/modules/${node.id}`, { method: 'DELETE' })

    showSuccessAlert(response.message)
    load()
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}
</script>

<template>
  <VCard>
    <VCardText>
      <div class="d-flex flex-wrap align-center gap-4">
        <div class="me-auto">
          <h4 class="text-h4">
            Módulos
          </h4>
          <div class="text-body-2 text-medium-emphasis">
            Estructura del sistema en árbol. Los módulos de tipo <strong>menú</strong> aparecen en el menú lateral;
            los de tipo <strong>opción</strong> son botones dentro de su módulo padre.
          </div>
        </div>
        <VBtn v-if="$can('CREAR', 'SEG_MOD')" prepend-icon="tabler-plus" @click="openForm()">
          Nuevo módulo
        </VBtn>
      </div>
    </VCardText>

    <VDivider />

    <div v-if="loading && !rows.length" class="d-flex justify-center pa-12">
      <VProgressCircular indeterminate color="primary" />
    </div>
    <VTable v-else class="text-no-wrap">
      <thead>
        <tr>
          <th>Módulo</th>
          <th>Plataforma</th>
          <th>Tipo</th>
          <th>Acciones</th>
          <th>Estado</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="{ node, depth, hasChildren } in rows" :key="node.id">
          <td>
            <div class="d-flex align-center gap-2" :style="{ paddingInlineStart: `${depth * 28}px` }">
              <IconBtn v-if="hasChildren" size="small" @click="toggle(node)">
                <VIcon :icon="collapsed.has(node.id) ? 'tabler-chevron-right' : 'tabler-chevron-down'" size="18" />
              </IconBtn>
              <span v-else style="inline-size: 30px;" />
              <VAvatar size="30" rounded color="primary" variant="tonal">
                <VIcon :icon="node.icon || 'tabler-point'" size="18" />
              </VAvatar>
              <div>
                <div :class="depth === 0 ? 'font-weight-medium text-high-emphasis' : ''">
                  {{ node.name }}
                  <VIcon v-if="node.is_locked" icon="tabler-lock" size="14" class="ms-1 text-disabled" />
                </div>
                <div class="text-caption text-disabled">
                  {{ node.code }} · {{ node.path || 'sin ruta' }} · orden {{ node.sort_order }}
                </div>
              </div>
            </div>
          </td>
          <td>
            <VChip size="small" label variant="tonal" :color="platform(node.platform).color">
              {{ platform(node.platform).title }}
            </VChip>
          </td>
          <td>
            <VChip size="small" label variant="tonal" :color="node.is_menu ? 'secondary' : 'info'">
              {{ node.is_menu ? 'Menú' : 'Opción' }}
            </VChip>
          </td>
          <td>
            <div class="d-flex align-center gap-1">
              <VAvatar v-for="action in actionsOf(node)" :key="action.code" size="26" rounded variant="tonal" color="secondary">
                <VIcon :icon="action.icon || 'tabler-point'" size="16" />
                <VTooltip activator="parent">
                  {{ action.name }} ({{ action.code }})
                </VTooltip>
              </VAvatar>
              <span v-if="!node.actions.length" class="text-disabled text-caption">Agrupador</span>
            </div>
          </td>
          <td>
            <VChip :color="node.is_active ? 'success' : 'secondary'" size="small" label>
              {{ node.is_active ? 'Activo' : 'Inactivo' }}
            </VChip>
          </td>
          <td class="text-end">
            <VMenu v-if="$can('CREAR', 'SEG_MOD') || $can('EDITAR', 'SEG_MOD') || $can('ELIMINAR', 'SEG_MOD')" location="bottom end">
              <template #activator="{ props: menuProps }">
                <IconBtn v-bind="menuProps">
                  <VIcon icon="tabler-dots-vertical" />
                </IconBtn>
              </template>
              <VList density="compact" min-width="200">
                <VListItem v-if="$can('CREAR', 'SEG_MOD')" prepend-icon="tabler-row-insert-bottom" title="Agregar submódulo" @click="openForm(null, node)" />
                <VListItem v-if="$can('EDITAR', 'SEG_MOD')" prepend-icon="tabler-pencil" title="Editar" @click="openForm(node)" />
                <VListItem
                  v-if="$can('ELIMINAR', 'SEG_MOD') && !node.is_locked && !hasChildren"
                  prepend-icon="tabler-trash"
                  title="Eliminar"
                  base-color="error"
                  @click="remove(node)"
                />
              </VList>
            </VMenu>
          </td>
        </tr>
      </tbody>
    </VTable>
  </VCard>

  <VDialog v-model="dialog" max-width="760" persistent scrollable>
    <DialogCloseBtn @click="dialog = false" />
    <VCard :title="form.id ? 'Editar módulo' : 'Nuevo módulo'">
      <VCardText>
        <VForm @submit.prevent="save">
          <VRow>
            <VCol cols="12">
              <AppSelect
                v-model="form.parent_id"
                label="Módulo padre"
                placeholder="Ninguno (módulo principal)"
                :items="parentOptions"
                clearable
                :error-messages="errors.parent_id"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="form.code"
                label="Código *"
                placeholder="Ej. INV_TOMA"
                :disabled="form.is_locked"
                :error-messages="errors.code"
                @update:model-value="value => form.code = value?.toUpperCase()"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="form.name" label="Nombre *" :error-messages="errors.name" />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="form.icon" label="Ícono (Tabler)" placeholder="tabler-box" :error-messages="errors.icon">
                <template #prepend-inner>
                  <VIcon :icon="form.icon || 'tabler-point'" size="20" />
                </template>
              </AppTextField>
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="form.path" label="Ruta" placeholder="/apps/... (vacío si agrupa o es opción)" :error-messages="errors.path" />
            </VCol>
            <VCol cols="12" md="4">
              <AppSelect v-model="form.platform" label="Plataforma *" :items="PLATFORMS" :error-messages="errors.platform" />
            </VCol>
            <VCol cols="12" md="4">
              <AppSelect
                v-model="form.is_menu"
                label="Tipo"
                :items="[{ title: 'Menú (va en el menú lateral)', value: true }, { title: 'Opción (botón en su módulo padre)', value: false }]"
                :error-messages="errors.is_menu"
              />
            </VCol>
            <VCol cols="12" md="2">
              <AppTextField v-model.number="form.sort_order" label="Orden" type="number" min="0" :error-messages="errors.sort_order" />
            </VCol>
            <VCol cols="12" md="2">
              <AppSelect
                v-model="form.is_active"
                label="Estado"
                :items="[{ title: 'Activo', value: true }, { title: 'Inactivo', value: false }]"
                :disabled="form.is_locked"
              />
            </VCol>
            <VCol cols="12">
              <AppTextField v-model="form.description" label="Descripción" :error-messages="errors.description" />
            </VCol>
            <VCol cols="12">
              <AppSelect
                v-model="form.action_ids"
                label="Acciones habilitadas (crean los permisos del módulo)"
                :items="actions.map(action => ({ title: `${action.name} (${action.code})`, value: action.id }))"
                multiple
                chips
                closable-chips
                placeholder="Sin acciones = módulo agrupador"
                :error-messages="errors.action_ids"
              />
            </VCol>
          </VRow>
          <VAlert v-if="form.is_locked" type="info" variant="tonal" class="mt-4">
            Módulo base del sistema: no se puede eliminar, desactivar ni cambiar su código.
          </VAlert>
          <div class="d-flex justify-end gap-3 mt-6">
            <VBtn variant="tonal" color="secondary" @click="dialog = false">
              Cancelar
            </VBtn>
            <VBtn type="submit" :loading="saving">
              Guardar
            </VBtn>
          </div>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
