<script setup>
import { LIFECYCLE_ACTIONS, lifecycleActionsFor } from '@/composables/useInventoryLifecycle'
import AccountingBaseDialog from '@/components/inventories/AccountingBaseDialog.vue'
import InventoryAssigneesDialog from '@/components/inventories/InventoryAssigneesDialog.vue'
import InventoryPocketsDialog from '@/components/inventories/InventoryPocketsDialog.vue'
import InventoryTakeDialog from '@/components/inventories/InventoryTakeDialog.vue'
import { $api } from '@/utils/api'
import { confirmDeleteAlert, showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { INVENTORY_STATUSES, formatDate, inventoryStatus } from '@/utils/constants'
import { extractApiMessage, extractValidationErrors } from '@/utils/security'

definePage({ meta: { action: 'VER', subject: 'INV' } })

const userData = useCookie('userData')
const isCompanyUser = computed(() => userData.value?.user_type === 'CLIENTE')

// El filtro por empresa consulta /companies: solo para quien puede listar empresas
// (un inventariador ve pocos inventarios, los asignados, y no lo necesita).
const ability = useAbility()
const canFilterCompany = computed(() => !isCompanyUser.value && (ability.can('VER', 'EMP') || ability.can('CREAR', 'INV')))

const filters = reactive({ company_id: null, status: null })
const { options, search, tableProps, reload } = useServerTable('/inventories', { filters })

const headers = computed(() => [
  { title: 'Código', key: 'code' },
  { title: 'Inventario', key: 'name' },
  ...(isCompanyUser.value ? [] : [{ title: 'Empresa', key: 'company', sortable: false }]),
  { title: 'Periodo', key: 'start_date' },
  { title: 'Base contable', key: 'assets_count', align: 'center', sortable: false },
  { title: 'Avance de toma', key: 'progress', sortable: false, width: 170 },
  { title: 'Estado', key: 'status' },
  { title: 'Opciones', key: 'actions', sortable: false, align: 'end' },
])

// Empresas: búsqueda en el servidor (filtro del listado y formulario).
const filterCompanies = useCompanySearch({ onlyActive: false })
const formCompanies = useCompanySearch()

// --- Crear / editar ---
const emptyForm = () => ({ id: null, company_id: null, code: '', name: '', description: '', start_date: null, end_date: null })
const dialog = ref(false)
const saving = ref(false)
const form = ref(emptyForm())
const errors = ref({})

const openCreate = () => {
  form.value = { ...emptyForm(), company_id: isCompanyUser.value ? userData.value.company?.id : null }
  errors.value = {}
  if (isCompanyUser.value)
    formCompanies.ensure(userData.value.company)
  else
    formCompanies.fetch('')
  dialog.value = true
}

const openEdit = inventory => {
  form.value = { ...emptyForm(), ...inventory, company_id: inventory.company?.id }
  formCompanies.ensure(inventory.company)
  errors.value = {}
  dialog.value = true
}

const save = async () => {
  saving.value = true
  errors.value = {}

  try {
    const { id, company_id: companyId, code, name, description, start_date: startDate, end_date: endDate } = form.value
    const body = { code, name, description, start_date: startDate, end_date: endDate, ...(id ? {} : { company_id: companyId }) }
    const response = await $api(id ? `/inventories/${id}` : '/inventories', { method: id ? 'PUT' : 'POST', body })

    showSuccessAlert(response.message)
    dialog.value = false
    reload()
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

// --- Botones del inventario: iniciar, pausar, reanudar, finalizar ---
const { running, run: runLifecycle } = useInventoryLifecycle(() => reload())

const remove = async inventory => {
  const { isConfirmed } = await confirmDeleteAlert(`Se eliminará el inventario ${inventory.code} con toda su base contable.`)
  if (!isConfirmed)
    return

  try {
    const response = await $api(`/inventories/${inventory.id}`, { method: 'DELETE' })

    showSuccessAlert(response.message)
    reload()
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}

// --- Opciones de cada inventario ---
const selected = ref(null)
const baseDialog = ref(false)

const openAccountingBase = inventory => {
  selected.value = inventory
  baseDialog.value = true
}

const takeDialog = ref(false)
const assigneesDialog = ref(false)
const pocketsDialog = ref(false)

const openPockets = inventory => {
  selected.value = inventory
  pocketsDialog.value = true
}

const openAssignees = inventory => {
  selected.value = inventory
  assigneesDialog.value = true
}

const openTake = inventory => {
  selected.value = inventory
  takeDialog.value = true
}

onMounted(() => {
  if (canFilterCompany.value)
    filterCompanies.fetch('')
})
</script>

<template>
  <VCard>
    <VCardText>
      <div class="d-flex flex-wrap align-center gap-4 mb-6">
        <div class="me-auto">
          <h4 class="text-h4">
            Inventarios
          </h4>
          <div class="text-body-2 text-medium-emphasis">
            <template v-if="isCompanyUser">
              Inventarios de {{ userData.company?.name }}
            </template>
            <template v-else-if="$can('VER_TODOS', 'INV')">
              Inventarios de todas las empresas
            </template>
            <template v-else>
              Inventarios asignados a ti
            </template>
          </div>
        </div>
        <VBtn v-if="$can('CREAR', 'INV')" prepend-icon="tabler-plus" @click="openCreate">
          Nuevo inventario
        </VBtn>
      </div>

      <VRow>
        <VCol cols="12" sm="6" :md="canFilterCompany ? 5 : 8">
          <AppTextField v-model="search" placeholder="Buscar por código o nombre" prepend-inner-icon="tabler-search" clearable />
        </VCol>
        <VCol v-if="canFilterCompany" cols="12" sm="6" md="4">
          <AppAutocomplete
            v-model="filters.company_id"
            v-model:search="filterCompanies.search.value"
            :items="filterCompanies.items.value"
            :loading="filterCompanies.loading.value"
            placeholder="Empresa"
            no-filter
            clearable
          />
        </VCol>
        <VCol cols="12" sm="6" md="3" :offset-md="canFilterCompany ? 0 : 1">
          <AppSelect v-model="filters.status" :items="INVENTORY_STATUSES" placeholder="Estado" clearable />
        </VCol>
      </VRow>
    </VCardText>

    <VDivider />

    <VDataTableServer v-model:options="options" v-bind="tableProps" :headers="headers" no-data-text="No hay inventarios registrados.">
      <template #item.code="{ item }">
        <span class="text-no-wrap font-weight-medium">{{ item.code }}</span>
      </template>
      <template #item.name="{ item }">
        <div class="font-weight-medium">
          {{ item.name }}
        </div>
        <div v-if="item.description" class="text-caption text-medium-emphasis">
          {{ item.description }}
        </div>
      </template>
      <template #item.company="{ item }">
        {{ item.company?.name }}
      </template>
      <template #item.start_date="{ item }">
        {{ formatDate(item.start_date) }}<span v-if="item.end_date"> – {{ formatDate(item.end_date) }}</span>
      </template>
      <template #item.assets_count="{ item }">
        <VChip size="small" label :color="item.assets_count ? 'primary' : 'secondary'" variant="tonal">
          {{ item.assets_count }} activo(s)
        </VChip>
      </template>
      <template #item.progress="{ item }">
        <template v-if="item.assets_count">
          <div class="d-flex justify-space-between text-caption">
            <span>{{ item.found_count }} / {{ item.assets_count }}</span>
            <span class="font-weight-medium">{{ Math.round(item.found_count * 100 / item.assets_count) }} %</span>
          </div>
          <VProgressLinear :model-value="item.found_count * 100 / item.assets_count" color="success" height="6" rounded />
          <div v-if="item.surplus_count" class="text-caption text-warning">
            {{ item.surplus_count }} sobrante(s)
          </div>
        </template>
        <span v-else class="text-disabled">—</span>
      </template>
      <template #item.status="{ item }">
        <VChip :color="inventoryStatus(item.status).color" size="small" label>
          {{ inventoryStatus(item.status).title }}
        </VChip>
      </template>
      <template #item.actions="{ item }">
        <div class="d-flex justify-end flex-nowrap align-center">
          <!-- Iniciar / Pausar / Reanudar (Finalizar va en el menú ⋮) -->
          <template v-if="$can('APROBAR', 'INV')">
            <IconBtn
              v-for="action in lifecycleActionsFor(item).filter(candidate => candidate.key !== 'close')"
              :key="action.key"
              :color="action.color"
              :loading="running === action.key"
              @click="runLifecycle(item, action)"
            >
              <VIcon :icon="action.icon" />
              <VTooltip activator="parent">
                {{ action.title }} inventario
              </VTooltip>
            </IconBtn>
          </template>
          <IconBtn v-if="$can('VER', 'INV_BASE')" @click="openAccountingBase(item)">
            <VIcon icon="tabler-database-import" />
            <VTooltip activator="parent">
              Base contable
            </VTooltip>
          </IconBtn>
          <IconBtn v-if="$can('VER', 'INV_TOMA')" @click="openTake(item)">
            <VIcon icon="tabler-barcode" />
            <VTooltip activator="parent">
              Toma de inventario
            </VTooltip>
          </IconBtn>

          <IconBtn v-if="$can('VER', 'INV_POCK')" @click="openPockets(item)">
            <VBadge :model-value="item.pockets_count > 0" :content="item.pockets_count" color="primary" offset-x="-2" offset-y="-2">
              <VIcon icon="tabler-layout-grid" />
            </VBadge>
            <VTooltip activator="parent">
              Pockets
            </VTooltip>
          </IconBtn>
          <IconBtn v-if="$can('VER', 'INV_ASIG')" @click="openAssignees(item)">
            <VBadge :model-value="item.assignees_count > 0" :content="item.assignees_count" color="primary" offset-x="-2" offset-y="-2">
              <VIcon icon="tabler-user-check" />
            </VBadge>
            <VTooltip activator="parent">
              Asignar inventariadores
            </VTooltip>
          </IconBtn>
          <VMenu v-if="item.status !== 'CERRADO' && ($can('EDITAR', 'INV') || $can('APROBAR', 'INV') || $can('ELIMINAR', 'INV'))">
            <template #activator="{ props: menuProps }">
              <IconBtn v-bind="menuProps">
                <VIcon icon="tabler-dots-vertical" />
              </IconBtn>
            </template>
            <VList density="compact">
              <VListItem v-if="$can('EDITAR', 'INV')" prepend-icon="tabler-pencil" title="Editar" @click="openEdit(item)" />
              <VListItem v-if="$can('APROBAR', 'INV')" prepend-icon="tabler-flag-check" title="Finalizar inventario" base-color="error" @click="runLifecycle(item, LIFECYCLE_ACTIONS.find(action => action.key === 'close'))" />
              <VListItem v-if="$can('ELIMINAR', 'INV')" prepend-icon="tabler-trash" title="Eliminar" base-color="error" @click="remove(item)" />
            </VList>
          </VMenu>
        </div>
      </template>
    </VDataTableServer>
  </VCard>

  <AccountingBaseDialog v-model="baseDialog" :inventory="selected" @updated="reload" />
  <InventoryTakeDialog v-model="takeDialog" :inventory="selected" @updated="reload" />
  <InventoryAssigneesDialog v-model="assigneesDialog" :inventory="selected" @updated="reload" />
  <InventoryPocketsDialog v-model="pocketsDialog" :inventory="selected" @updated="reload" />

  <VDialog v-model="dialog" max-width="680" persistent>
    <DialogCloseBtn @click="dialog = false" />
    <VCard :title="form.id ? 'Editar inventario' : 'Nuevo inventario'">
      <VCardText>
        <VForm @submit.prevent="save">
          <VRow>
            <VCol cols="12">
              <AppAutocomplete
                v-model="form.company_id"
                v-model:search="formCompanies.search.value"
                label="Empresa *"
                placeholder="Busca por código o razón social"
                :items="formCompanies.items.value"
                :loading="formCompanies.loading.value"
                :disabled="!!form.id || isCompanyUser"
                no-filter
                :error-messages="errors.company_id"
              />
            </VCol>
            <VCol cols="12" md="4">
              <AppTextField v-model="form.code" label="Código *" placeholder="Ej. INV-2026-01" :error-messages="errors.code" />
            </VCol>
            <VCol cols="12" md="8">
              <AppTextField v-model="form.name" label="Nombre *" placeholder="Ej. Inventario anual 2026" :error-messages="errors.name" />
            </VCol>
            <VCol cols="12">
              <AppTextField v-model="form.description" label="Descripción" :error-messages="errors.description" />
            </VCol>
            <VCol cols="12" md="6">
              <AppDateTimePicker v-model="form.start_date" label="Fecha de inicio" placeholder="Selecciona una fecha" :error-messages="errors.start_date" />
            </VCol>
            <VCol cols="12" md="6">
              <AppDateTimePicker v-model="form.end_date" label="Fecha de fin" placeholder="Selecciona una fecha" :error-messages="errors.end_date" />
            </VCol>
          </VRow>
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
