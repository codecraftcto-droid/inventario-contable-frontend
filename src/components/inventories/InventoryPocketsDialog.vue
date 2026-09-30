<script setup>
import { $api } from '@/utils/api'
import { confirmAlert, confirmDeleteAlert, showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { POCKET_STATUSES, formatQuantity, formatShortDateTime, pocketStatus } from '@/utils/constants'
import { extractApiMessage, extractValidationErrors } from '@/utils/security'

/**
 * Opción "Pockets" de un inventario: zonas / tandas de conteo (opcionalmente dentro de una sede)
 * asignadas a uno o varios inventariadores. En el teléfono cada uno solo ve y usa sus pockets.
 */
const props = defineProps({
  inventory: { type: Object, default: null },
})

const emit = defineEmits(['updated'])
const isOpen = defineModel({ type: Boolean, default: false })

const isClosed = computed(() => props.inventory?.status === 'CERRADO')
const baseUrl = computed(() => `/inventories/${props.inventory?.id}/pockets`)
const filters = reactive({ status: null })
const { options, search, tableProps, reload, total } = useServerTable(baseUrl, { filters, itemsPerPage: 10 })

const headers = [
  { title: 'Pocket', key: 'code' },
  { title: 'Sede', key: 'site', sortable: false },
  { title: 'Inventariadores', key: 'users', sortable: false },
  { title: 'Registros', key: 'records', align: 'end', sortable: false },
  { title: 'Unidades', key: 'units', align: 'end', sortable: false },
  { title: 'Estado', key: 'status' },
  { title: '', key: 'actions', sortable: false, align: 'end' },
]

// --- Sedes de la empresa ---
const sites = ref([])

const loadSites = async () => {
  try {
    sites.value = (await $api(`/inventories/${props.inventory.id}/sites`)).data.map(site => ({ value: site.id, title: site.name }))
  }
  catch {
    sites.value = []
  }
}

// --- Personal asignable (búsqueda en el servidor) ---
const userSearch = ref('')
const debouncedUserSearch = refDebounced(userSearch, 350)
const candidates = ref([])

const fetchCandidates = async () => {
  try {
    const { data } = await $api(`${baseUrl.value}/candidates`, { query: { search: debouncedUserSearch.value || undefined } })
    const chosen = candidates.value.filter(user => form.value.user_ids?.includes(user.id))

    candidates.value = [...chosen, ...data.filter(user => !chosen.some(item => item.id === user.id))]
  }
  catch {
    // Sin permiso para asignar: la lista queda vacía.
  }
}

watch(debouncedUserSearch, fetchCandidates)

const candidateItems = computed(() => candidates.value.map(user => ({ value: user.id, title: user.full_name, subtitle: user.document_number })))

// --- Crear / editar ---
const formDialog = ref(false)
const form = ref({})
const errors = ref({})
const saving = ref(false)

const openForm = pocket => {
  form.value = pocket
    ? { id: pocket.id, code: pocket.code, name: pocket.name ?? '', site_id: pocket.site?.id ?? null, user_ids: pocket.users.map(user => user.id) }
    : { id: null, code: '', name: '', site_id: null, user_ids: [] }
  candidates.value = pocket ? pocket.users.map(user => ({ id: user.id, full_name: user.full_name })) : []
  errors.value = {}
  formDialog.value = true
  fetchCandidates()
}

const save = async () => {
  saving.value = true
  errors.value = {}
  try {
    const { id, ...body } = form.value
    const response = await $api(id ? `${baseUrl.value}/${id}` : baseUrl.value, { method: id ? 'PUT' : 'POST', body })

    showSuccessAlert(response.message)
    formDialog.value = false
    reload()
    emit('updated')
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

// --- Crear varios (P-01 … P-20) ---
const bulkDialog = ref(false)
const bulk = ref({ prefix: 'P-', from: 1, to: 10, digits: 2, site_id: null })
const bulkErrors = ref({})

const bulkPreview = computed(() => {
  const { prefix, from, to, digits } = bulk.value
  const pad = n => `${prefix ?? ''}${String(n).padStart(Number(digits) || 2, '0')}`.toUpperCase()

  return Number(to) >= Number(from) ? `${pad(from)} … ${pad(to)} (${Number(to) - Number(from) + 1})` : '—'
})

const saveBulk = async () => {
  saving.value = true
  bulkErrors.value = {}
  try {
    const response = await $api(`${baseUrl.value}/bulk`, { method: 'POST', body: bulk.value })

    showSuccessAlert(response.message)
    bulkDialog.value = false
    reload()
    emit('updated')
  }
  catch (error) {
    bulkErrors.value = extractValidationErrors(error)
    if (!Object.keys(bulkErrors.value).length)
      showErrorAlert(extractApiMessage(error))
  }
  finally {
    saving.value = false
  }
}

// --- Reabrir / eliminar ---
const reopen = async pocket => {
  const { isConfirmed } = await confirmAlert({ title: `¿Reabrir el pocket ${pocket.code}?`, text: 'Sus inventariadores podrán volver a registrar en él (p. ej. para recontar).', confirmButtonText: 'Sí, reabrir' })
  if (!isConfirmed)
    return
  try {
    showSuccessAlert((await $api(`${baseUrl.value}/${pocket.id}/reopen`, { method: 'POST' })).message)
    reload()
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}

const remove = async pocket => {
  const { isConfirmed } = await confirmDeleteAlert(`Se eliminará el pocket ${pocket.code}.`)
  if (!isConfirmed)
    return
  try {
    showSuccessAlert((await $api(`${baseUrl.value}/${pocket.id}`, { method: 'DELETE' })).message)
    reload()
    emit('updated')
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}

watch([isOpen, () => props.inventory?.id], ([open]) => {
  if (!open)
    return
  search.value = ''
  filters.status = null
  if (options.value.page !== 1)
    options.value = { ...options.value, page: 1 }
  reload()
  loadSites()
})
</script>

<template>
  <VDialog v-model="isOpen" max-width="1100" scrollable>
    <DialogCloseBtn @click="isOpen = false" />
    <VCard v-if="inventory">
      <VCardItem>
        <VCardTitle>Pockets</VCardTitle>
        <VCardSubtitle>{{ inventory.code }} · {{ inventory.name }} · {{ inventory.company?.name }}</VCardSubtitle>
      </VCardItem>

      <VCardText>
        <VAlert type="info" variant="tonal" density="compact" class="mb-4">
          Cada pocket es una zona o tanda de conteo. En el teléfono, cada inventariador solo ve y registra en los pockets que tiene asignados (asignarlo aquí también lo asigna al inventario).
        </VAlert>

        <div class="d-flex flex-wrap align-center gap-3 mb-4">
          <AppTextField v-model="search" placeholder="Buscar pocket" prepend-inner-icon="tabler-search" clearable style="max-inline-size: 240px;" />
          <AppSelect v-model="filters.status" :items="POCKET_STATUSES" placeholder="Estado" clearable style="max-inline-size: 180px;" />
          <VSpacer />
          <template v-if="!isClosed">
            <VBtn v-if="$can('CREAR', 'INV_POCK')" variant="tonal" prepend-icon="tabler-copy-plus" @click="bulkDialog = true">
              Crear varios
            </VBtn>
            <VBtn v-if="$can('CREAR', 'INV_POCK')" prepend-icon="tabler-plus" @click="openForm()">
              Nuevo pocket
            </VBtn>
          </template>
        </div>

        <VDataTableServer v-model:options="options" v-bind="tableProps" :headers="headers" density="compact">
          <template #no-data>
            <div class="py-6 text-center">
              <VIcon icon="tabler-layout-grid" size="36" class="text-disabled mb-2" />
              <div>Este inventario no tiene pockets.</div>
              <div class="text-body-2 text-medium-emphasis">
                Sin pockets, en el teléfono el pocket se escribe libremente.
              </div>
            </div>
          </template>
          <template #item.code="{ item }">
            <span class="font-weight-medium text-no-wrap">{{ item.code }}</span>
            <div v-if="item.name" class="text-caption text-medium-emphasis">
              {{ item.name }}
            </div>
          </template>
          <template #item.site="{ item }">
            {{ item.site?.name ?? '—' }}
          </template>
          <template #item.users="{ item }">
            <div class="d-flex flex-wrap gap-1 py-1">
              <VChip v-for="user in item.users" :key="user.id" size="x-small" label prepend-icon="tabler-user">
                {{ user.full_name }}
              </VChip>
              <span v-if="!item.users.length" class="text-warning text-caption">Sin asignar</span>
            </div>
          </template>
          <template #item.records="{ item }">
            {{ item.records }}
            <div v-if="item.last_scan_at" class="text-caption text-disabled text-no-wrap">
              {{ formatShortDateTime(item.last_scan_at) }}
            </div>
          </template>
          <template #item.units="{ item }">
            {{ formatQuantity(item.units) }}
          </template>
          <template #item.status="{ item }">
            <VChip :color="pocketStatus(item.status).color" size="small" label>
              {{ pocketStatus(item.status).title }}
            </VChip>
          </template>
          <template #item.actions="{ item }">
            <div v-if="!isClosed" class="d-flex justify-end flex-nowrap">
              <IconBtn v-if="$can('EDITAR', 'INV_POCK')" @click="openForm(item)">
                <VIcon icon="tabler-pencil" size="20" />
                <VTooltip activator="parent">
                  Editar y asignar
                </VTooltip>
              </IconBtn>
              <IconBtn v-if="item.status === 'TERMINADO' && $can('EDITAR', 'INV_POCK')" @click="reopen(item)">
                <VIcon icon="tabler-rotate-clockwise" size="20" />
                <VTooltip activator="parent">
                  Reabrir
                </VTooltip>
              </IconBtn>
              <IconBtn v-if="!item.records && $can('ELIMINAR', 'INV_POCK')" @click="remove(item)">
                <VIcon icon="tabler-trash" size="20" />
                <VTooltip activator="parent">
                  Eliminar
                </VTooltip>
              </IconBtn>
            </div>
          </template>
        </VDataTableServer>
        <div v-if="total" class="text-caption text-medium-emphasis mt-2">
          {{ total }} pocket(s).
        </div>
      </VCardText>
    </VCard>
  </VDialog>

  <!-- Nuevo / editar pocket -->
  <VDialog v-model="formDialog" max-width="620" persistent>
    <DialogCloseBtn @click="formDialog = false" />
    <VCard :title="form.id ? 'Editar pocket' : 'Nuevo pocket'" :subtitle="inventory?.code">
      <VCardText>
        <VForm @submit.prevent="save">
          <VRow>
            <VCol cols="12" md="4">
              <AppTextField v-model="form.code" label="Código *" placeholder="Ej. P-01" :error-messages="errors.code" />
            </VCol>
            <VCol cols="12" md="8">
              <AppTextField v-model="form.name" label="Nombre" placeholder="Ej. Rack A · almacén 2" :error-messages="errors.name" />
            </VCol>
            <VCol cols="12">
              <AppSelect v-model="form.site_id" label="Sede" :items="sites" placeholder="Opcional" clearable :error-messages="errors.site_id" />
            </VCol>
            <VCol cols="12">
              <AppAutocomplete
                v-model="form.user_ids"
                v-model:search="userSearch"
                label="Inventariadores"
                placeholder="Busca por nombre o documento"
                :items="candidateItems"
                multiple
                chips
                closable-chips
                no-filter
                :error-messages="errors.user_ids"
              />
            </VCol>
          </VRow>
          <div class="d-flex justify-end gap-3 mt-6">
            <VBtn variant="tonal" color="secondary" @click="formDialog = false">
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

  <!-- Crear varios -->
  <VDialog v-model="bulkDialog" max-width="560" persistent>
    <DialogCloseBtn @click="bulkDialog = false" />
    <VCard title="Crear varios pockets" subtitle="Luego asigna los inventariadores editando cada uno.">
      <VCardText>
        <VRow>
          <VCol cols="12" md="4">
            <AppTextField v-model="bulk.prefix" label="Prefijo" placeholder="P-" />
          </VCol>
          <VCol cols="4" md="3">
            <AppTextField v-model.number="bulk.from" label="Desde *" type="number" min="0" :error-messages="bulkErrors.from" />
          </VCol>
          <VCol cols="4" md="3">
            <AppTextField v-model.number="bulk.to" label="Hasta *" type="number" min="0" :error-messages="bulkErrors.to" />
          </VCol>
          <VCol cols="4" md="2">
            <AppTextField v-model.number="bulk.digits" label="Dígitos" type="number" min="1" max="6" />
          </VCol>
          <VCol cols="12">
            <AppSelect v-model="bulk.site_id" label="Sede" :items="sites" placeholder="Opcional" clearable />
          </VCol>
        </VRow>
        <div class="text-body-2 mt-2">
          Se crearán: <strong>{{ bulkPreview }}</strong>. Los que ya existen se omiten.
        </div>
        <div class="d-flex justify-end gap-3 mt-6">
          <VBtn variant="tonal" color="secondary" @click="bulkDialog = false">
            Cancelar
          </VBtn>
          <VBtn :loading="saving" @click="saveBulk">
            Crear
          </VBtn>
        </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>
