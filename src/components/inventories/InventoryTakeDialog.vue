<script setup>
import { lifecycleActionsFor, useInventoryLifecycle } from '@/composables/useInventoryLifecycle'
import { $api, downloadFile } from '@/utils/api'
import { confirmDeleteAlert, showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { RECONCILIATION_STATUSES, SCAN_CONDITIONS, SCAN_OUTCOMES, formatDateTime, formatMoney, formatQuantity, formatShortDateTime, inventoryStatus, reconciliationStatus, scanCondition, scanOutcome } from '@/utils/constants'
import { extractApiMessage } from '@/utils/security'

/**
 * Opción "Toma de inventario" de un inventario:
 *  - Avance en vivo (se actualiza solo mientras los inventariadores leen con la app).
 *  - Registro desde la web con los datos del APK (cantidad, estado, ubicación, pocket,
 *    detalle, observaciones): escribiendo el código o con una lectora USB (Enter = registrar).
 *  - Conciliación en vivo contra la base (conciliado, faltante, sobrante, diferencia + / -).
 *  - Registros (con sus fotos) y conciliación paginados en el servidor, anular registros y Excel.
 */
const props = defineProps({
  inventory: { type: Object, default: null },
})

const emit = defineEmits(['updated'])
const isOpen = defineModel({ type: Boolean, default: false })

const ability = useAbility()
// Estado vivo del inventario (cambia con los botones Iniciar / Pausar / Reanudar / Finalizar).
const status = ref(null)
const isClosed = computed(() => status.value === 'CERRADO')
const canScan = computed(() => status.value === 'EN_PROCESO' && ability.can('ESCANEAR', 'INV_TOMA'))

const { running, run: runLifecycle } = useInventoryLifecycle(updated => {
  status.value = updated.status
  refreshAll()
  emit('updated')
})
const canDelete = computed(() => !isClosed.value && ability.can('ELIMINAR', 'INV_TOMA'))
const takeUrl = computed(() => `/inventories/${props.inventory?.id}/take`)

// --- Avance ---
const summary = ref(null)

const loadSummary = async () => {
  try {
    summary.value = (await $api(`${takeUrl.value}/summary`)).data
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}

// --- Listados ---
const tab = ref('scans')
const scanFilters = reactive({ outcome: null, condition: null, site_id: null, pocket_id: null })
const scansTable = useServerTable(() => `${takeUrl.value}/scans`, { filters: scanFilters, itemsPerPage: 10 })
const reconciliationFilters = reactive({ status: null })
const reconciliationTable = useServerTable(() => `${takeUrl.value}/reconciliation`, { filters: reconciliationFilters, itemsPerPage: 10 })

const scanHeaders = computed(() => [
  { title: 'Código', key: 'code' },
  { title: 'Producto', key: 'description', sortable: false },
  { title: 'Cantidad', key: 'quantity', align: 'end' },
  { title: 'Estado', key: 'condition' },
  { title: 'Ubicación', key: 'location' },
  { title: 'Pocket', key: 'pocket' },
  { title: 'Fotos', key: 'photos', sortable: false, align: 'center' },
  { title: 'Registrado por', key: 'user', sortable: false },
  { title: 'Fecha', key: 'scanned_at' },
  ...(canDelete.value ? [{ title: '', key: 'actions', sortable: false, align: 'end' }] : []),
])

const reconciliationHeaders = [
  { title: 'Código', key: 'code' },
  { title: 'Producto', key: 'name' },
  { title: 'Base', key: 'expected', align: 'end' },
  { title: 'Registrado', key: 'counted', align: 'end' },
  { title: 'Diferencia', key: 'difference', align: 'end' },
  { title: 'Valor', key: 'value', align: 'end' },
  { title: 'Estado', key: 'status' },
]

const reloadActiveTab = () => (tab.value === 'scans' ? scansTable : reconciliationTable).reload()

// Filtro por estado desde las tarjetas del resumen
const showStatus = status => {
  reconciliationFilters.status = status
  tab.value = 'reconciliation'
}

const refreshAll = () => {
  loadSummary()
  reloadActiveTab()
}

watch(tab, reloadActiveTab)

// --- Sedes (ubicaciones) de la empresa ---
const sites = ref([])

// Pockets del inventario (para registrar y filtrar)
const pockets = ref([])

const loadPockets = async () => {
  try {
    pockets.value = (await $api(`/inventories/${props.inventory.id}/pockets/mine`)).data.map(pocket => ({ value: pocket.id, title: pocket.code, subtitle: pocket.site }))
  }
  catch {
    pockets.value = []
  }
}

const loadSites = async () => {
  try {
    sites.value = (await $api(`/inventories/${props.inventory.id}/sites`)).data.map(site => ({ value: site.id, title: site.name }))
  }
  catch {
    sites.value = []
  }
}

// --- Registro desde la web ---
// Ubicación, pocket y estado se mantienen entre registros (como los campos fijados del APK).
const emptyRecord = () => ({ quantity: 1, condition: 'BUENO', site_id: null, location: '', pocket: '', pocket_id: null, detail: '', observations: '' })
const code = ref('')
const record = reactive(emptyRecord())
const recordErrors = ref({})
const codeInput = ref()
const lastResult = ref(null)
const sending = ref(0)

// crypto.randomUUID solo existe en contextos seguros (https / localhost).
const newUuid = () => globalThis.crypto?.randomUUID?.()
  ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.random() * 16 | 0

    return (char === 'x' ? random : (random & 0x3 | 0x8)).toString(16)
  })

const register = async () => {
  const value = code.value.trim()
  if (!value)
    return

  const errors = {}
  if (!(Number(record.quantity) > 0))
    errors.quantity = 'Mayor a 0'
  if (sites.value.length ? !record.site_id : !record.location.trim())
    errors.location = 'Obligatorio'
  recordErrors.value = errors
  if (Object.keys(errors).length)
    return

  const site = sites.value.find(item => item.value === record.site_id)
  const now = new Date().toISOString()

  // Se limpia al instante: con lectora USB puede llegar el siguiente código enseguida.
  code.value = ''
  sending.value++

  try {
    const response = await $api(`/inventories/${props.inventory.id}/scans/batch`, {
      method: 'POST',
      body: {
        scans: [{
          uuid: newUuid(),
          code: value,
          scanned_at: now,
          updated_at: now,
          quantity: Number(record.quantity),
          condition: record.condition,
          site_id: site?.value ?? null,
          pocket_id: record.pocket_id ?? null,
          location: site?.title ?? (record.location.trim() || null),
          pocket: record.pocket.trim() || null,
          detail: record.detail.trim() || null,
          observations: record.observations.trim() || null,
        }],
      },
    })

    lastResult.value = { code: value.toUpperCase(), outcome: response.data.accepted[0].outcome, quantity: record.quantity, location: site?.title ?? record.location }
    record.detail = ''
    record.quantity = 1
    refreshAll()
    emit('updated')
  }
  catch (error) {
    lastResult.value = { code: value.toUpperCase(), error: extractApiMessage(error) }
  }
  finally {
    sending.value--
    nextTick(() => codeInput.value?.focus())
  }
}

const resultMessage = computed(() => {
  const result = lastResult.value
  if (!result)
    return null
  if (result.error)
    return { type: 'error', title: result.code, text: result.error }

  const detail = `${formatQuantity(result.quantity)} en ${result.location}`

  return result.outcome === 'SURPLUS'
    ? { type: 'warning', title: `Sobrante registrado: ${result.code}`, text: `${detail}. No está en la base contable: revisa la etiqueta o repórtalo al contador.` }
    : { type: 'success', title: `Registrado: ${result.code}`, text: `${detail}. Si el producto ya estaba registrado, las cantidades se suman.` }
})

// --- Fotos de un registro (se piden con la sesión: no son públicas) ---
const photoViewer = reactive({ open: false, title: '', urls: [], loading: false })

const openPhotos = async scan => {
  Object.assign(photoViewer, { open: true, title: `${scan.code} · ${scan.description ?? ''}`, urls: [], loading: true })
  try {
    const blobs = await Promise.all(scan.photos.map(photo => $api(photo.url, { responseType: 'blob' })))

    photoViewer.urls = blobs.map(blob => URL.createObjectURL(blob))
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
  finally {
    photoViewer.loading = false
  }
}

watch(() => photoViewer.open, open => {
  if (!open) {
    photoViewer.urls.forEach(url => URL.revokeObjectURL(url))
    photoViewer.urls = []
  }
})

// --- Anular registro ---
const removeScan = async scan => {
  const { isConfirmed } = await confirmDeleteAlert(
    `Se anulará el registro de ${scan.code} (${formatQuantity(scan.quantity)} en ${scan.location ?? 'sin ubicación'})${scan.photos.length ? ' y sus fotos' : ''}.`,
  )
  if (!isConfirmed)
    return

  try {
    const response = await $api(`${takeUrl.value}/scans/${scan.id}`, { method: 'DELETE' })

    showSuccessAlert(response.message)
    refreshAll()
    emit('updated')
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}

// --- Excel ---
const exporting = ref(false)

const exportResult = async () => {
  exporting.value = true
  try {
    await downloadFile(`${takeUrl.value}/export`, `toma-${props.inventory.code}.xlsx`)
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
  finally {
    exporting.value = false
  }
}

// --- Apertura y actualización en vivo ---
let timer = null

const stopTimer = () => {
  clearInterval(timer)
  timer = null
}

watch([isOpen, () => props.inventory?.id], ([open]) => {
  stopTimer()
  if (!open)
    return

  summary.value = null
  status.value = props.inventory?.status ?? null
  lastResult.value = null
  code.value = ''
  tab.value = 'scans'
  scanFilters.outcome = null
  scanFilters.condition = null
  scanFilters.site_id = null
  scansTable.search.value = ''
  reconciliationFilters.status = null
  reconciliationTable.search.value = ''
  for (const table of [scansTable, reconciliationTable]) {
    if (table.options.value.page !== 1)
      table.options.value = { ...table.options.value, page: 1 }
  }
  refreshAll()
  loadSites()
  loadPockets()

  // Tiempo real: cada 5 s trae lo que van registrando los celulares (solo con el modal abierto y la
  // pestaña visible). Las consultas son agregadas y paginadas, así que el costo es bajo.
  if (!isClosed.value)
    timer = setInterval(() => document.visibilityState === 'visible' && refreshAll(), 5000)
})

onBeforeUnmount(stopTimer)

const stats = computed(() => {
  const counts = summary.value?.reconciliation?.statuses ?? {}

  return RECONCILIATION_STATUSES.map(status => ({ ...status, count: counts[status.value] ?? 0 }))
})
</script>

<template>
  <VDialog v-model="isOpen" max-width="1200" scrollable>
    <DialogCloseBtn @click="isOpen = false" />
    <VCard v-if="inventory">
      <VCardItem>
        <VCardTitle>Toma de inventario</VCardTitle>
        <VCardSubtitle>{{ inventory.code }} · {{ inventory.name }} · {{ inventory.company?.name }}</VCardSubtitle>
        <template #append>
          <div class="d-flex align-center gap-2 me-6">
            <VChip :color="inventoryStatus(status).color" label>
              {{ inventoryStatus(status).title }}
            </VChip>
            <template v-if="$can('APROBAR', 'INV')">
              <VBtn
                v-for="action in lifecycleActionsFor({ status })"
                :key="action.key"
                :color="action.color"
                :variant="action.key === 'close' ? 'tonal' : 'flat'"
                :prepend-icon="action.icon"
                :loading="running === action.key"
                @click="runLifecycle({ ...inventory, status }, action)"
              >
                {{ action.title }}
              </VBtn>
            </template>
            <VBtn icon variant="tonal" color="secondary" size="small" @click="refreshAll">
              <VIcon icon="tabler-refresh" />
              <VTooltip activator="parent">
                Actualizar
              </VTooltip>
            </VBtn>
            <VBtn v-if="$can('EXPORTAR', 'INV_TOMA')" variant="tonal" prepend-icon="tabler-file-spreadsheet" :loading="exporting" @click="exportResult">
              Exportar resultado
            </VBtn>
          </div>
        </template>
      </VCardItem>

      <VCardText>
        <VAlert v-if="isClosed" type="info" variant="tonal" class="mb-4">
          El inventario está cerrado: la toma ya no admite registros ni cambios.
        </VAlert>
        <VAlert v-else-if="summary && !summary.total" type="warning" variant="tonal" class="mb-4">
          Este inventario aún no tiene base contable: todo lo que se registre quedará como sobrante.
        </VAlert>

        <!-- Conciliación en vivo: productos por estado (clic = ver ese estado) -->
        <div class="d-flex justify-space-between align-center mb-2">
          <span class="text-body-2 text-medium-emphasis">
            Conciliación contra la base contable<template v-if="summary">
              · {{ summary.total.toLocaleString('es-PE') }} producto(s) en la base · unidades: {{ formatQuantity(summary.reconciliation.counted_units) }} registradas de {{ formatQuantity(summary.reconciliation.expected_units) }} según la base
            </template>
          </span>
        </div>
        <VRow dense>
          <VCol v-for="stat in stats" :key="stat.value" cols="6" sm="4" md="">
            <VCard variant="outlined" class="h-100 stat-card" :class="{ 'stat-card--active': tab === 'reconciliation' && reconciliationFilters.status === stat.value }" @click="showStatus(stat.value)">
              <VCardText class="d-flex align-center gap-3 pa-3">
                <VAvatar :color="stat.color" variant="tonal" rounded size="38">
                  <VIcon :icon="stat.icon" size="22" />
                </VAvatar>
                <div>
                  <h5 class="text-h5">
                    <VSkeletonLoader v-if="!summary" type="text" width="40" />
                    <template v-else>
                      {{ stat.count.toLocaleString('es-PE') }}
                    </template>
                  </h5>
                  <div class="text-body-2 font-weight-medium">
                    {{ stat.title }}
                  </div>
                  <div class="text-caption text-disabled">
                    {{ stat.hint }}
                  </div>
                </div>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>

        <div v-if="summary" class="mt-4">
          <div class="d-flex justify-space-between text-body-2 mb-1">
            <span class="font-weight-medium">Avance {{ summary.progress }} %</span>
            <span class="text-medium-emphasis">
              {{ summary.scans.toLocaleString('es-PE') }} registro(s) · {{ formatQuantity(summary.units) }} unidad(es)
              <template v-if="summary.last_scan"> · última: {{ summary.last_scan.code }} por {{ summary.last_scan.user }}, {{ formatDateTime(summary.last_scan.scanned_at) }}</template>
            </span>
          </div>
          <VProgressLinear :model-value="summary.progress" color="success" height="10" rounded />
          <div v-if="summary.by_site?.length" class="d-flex flex-wrap align-center gap-2 mt-3">
            <span class="text-body-2 text-medium-emphasis">Por ubicación:</span>
            <VChip v-for="site in summary.by_site" :key="site.site" size="small" label prepend-icon="tabler-map-pin">
              {{ site.site }} · {{ site.records }} reg. · {{ formatQuantity(site.units) }} und.
            </VChip>
          </div>
          <div v-if="summary.readers.length" class="d-flex flex-wrap align-center gap-2 mt-3">
            <span class="text-body-2 text-medium-emphasis">Inventariadores:</span>
            <VChip v-for="reader in summary.readers" :key="reader.user" size="small" label prepend-icon="tabler-user">
              {{ reader.user }} · {{ reader.total }}
            </VChip>
          </div>
        </div>

        <VAlert v-if="status === 'PENDIENTE'" type="warning" variant="tonal" class="mt-6" prepend-icon="tabler-player-play">
          El inventario aún no se inició: los teléfonos no pueden registrar. Prepara la base contable, los pockets y los inventariadores, y pulsa <strong>Iniciar</strong>.
        </VAlert>
        <VAlert v-else-if="status === 'PAUSADO'" type="info" variant="tonal" class="mt-6" prepend-icon="tabler-player-pause">
          Inventario en pausa: no se aceptan registros. Lo que se registre sin señal queda en los teléfonos y se envía al <strong>Reanudar</strong>.
        </VAlert>

        <!-- Registro desde la web (teclado o lectora USB) -->
        <VCard v-if="canScan" variant="tonal" color="primary" class="mt-6">
          <VCardText>
            <div class="font-weight-medium text-high-emphasis mb-3">
              Registrar
              <span class="text-body-2 text-medium-emphasis">— escribe el código o usa una lectora de código de barras / QR (Enter registra). Ubicación, pocket y estado se mantienen para el siguiente.</span>
            </div>
            <VRow>
              <VCol cols="12" md="4">
                <AppTextField
                  ref="codeInput"
                  v-model="code"
                  placeholder="Código producto *"
                  prepend-inner-icon="tabler-barcode"
                  autofocus
                  autocomplete="off"
                  @keydown.enter.prevent="register"
                />
              </VCol>
              <VCol cols="6" md="2">
                <AppTextField v-model="record.quantity" type="number" min="0" step="any" placeholder="Cantidad *" prepend-inner-icon="tabler-hash" :error-messages="recordErrors.quantity" />
              </VCol>
              <VCol cols="6" md="3">
                <AppSelect v-model="record.condition" :items="SCAN_CONDITIONS" placeholder="Estado *" />
              </VCol>
              <VCol cols="12" md="3">
                <AppSelect v-if="sites.length" v-model="record.site_id" :items="sites" placeholder="Ubicación (sede) *" prepend-inner-icon="tabler-map-pin" :error-messages="recordErrors.location" />
                <AppTextField v-else v-model="record.location" placeholder="Ubicación *" prepend-inner-icon="tabler-map-pin" :error-messages="recordErrors.location" />
              </VCol>
              <VCol cols="12" md="2">
                <AppSelect v-if="pockets.length" v-model="record.pocket_id" :items="pockets" placeholder="Pocket" clearable />
                <AppTextField v-else v-model="record.pocket" placeholder="Pocket" />
              </VCol>
              <VCol cols="12" md="4">
                <AppTextField v-model="record.detail" placeholder="Detalle del bien" />
              </VCol>
              <VCol cols="12" md="4">
                <AppTextField v-model="record.observations" placeholder="Observaciones" />
              </VCol>
              <VCol cols="12" md="2">
                <VBtn block :loading="sending > 0" :disabled="!code.trim()" @click="register">
                  Registrar
                </VBtn>
              </VCol>
            </VRow>
            <VAlert v-if="resultMessage" :type="resultMessage.type" variant="elevated" density="compact" class="mt-3">
              <strong>{{ resultMessage.title }}</strong> — {{ resultMessage.text }}
            </VAlert>
          </VCardText>
        </VCard>

        <!-- Listados -->
        <VTabs v-model="tab" class="mt-6">
          <VTab value="scans" prepend-icon="tabler-list-check">
            Registros
          </VTab>
          <VTab value="reconciliation" prepend-icon="tabler-scale">
            Conciliación
          </VTab>
        </VTabs>
        <VDivider />

        <VWindow v-model="tab" class="mt-4">
          <VWindowItem value="scans">
            <VRow class="mb-2">
              <VCol cols="12" md="3">
                <AppTextField v-model="scansTable.search.value" placeholder="Buscar código, pocket o ubicación" prepend-inner-icon="tabler-search" clearable />
              </VCol>
              <VCol cols="12" sm="4" md="2">
                <AppSelect v-model="scanFilters.site_id" :items="sites" placeholder="Ubicación" clearable :disabled="!sites.length" />
              </VCol>
              <VCol cols="12" sm="4" md="2">
                <AppSelect v-model="scanFilters.pocket_id" :items="pockets" placeholder="Pocket" clearable :disabled="!pockets.length" />
              </VCol>
              <VCol cols="6" sm="4" md="2">
                <AppSelect v-model="scanFilters.condition" :items="SCAN_CONDITIONS" placeholder="Estado" clearable />
              </VCol>
              <VCol cols="6" sm="4" md="3">
                <AppSelect v-model="scanFilters.outcome" :items="SCAN_OUTCOMES" placeholder="Resultado" clearable />
              </VCol>
            </VRow>
            <VDataTableServer
              v-model:options="scansTable.options.value"
              v-bind="scansTable.tableProps.value"
              :headers="scanHeaders"
              density="compact"
              no-data-text="Aún no hay registros."
            >
              <template #item.code="{ item }">
                <span class="font-weight-medium text-no-wrap">{{ item.code }}</span>
              </template>
              <template #item.description="{ item }">
                <div class="py-1">
                  <span v-if="item.description">{{ item.description }}</span>
                  <VChip v-else-if="item.outcome === 'SURPLUS'" :color="scanOutcome(item.outcome).color" size="x-small" label>
                    Sobrante: no está en la base
                  </VChip>
                  <span v-else class="text-disabled">Producto sin nombre</span>
                  <div v-if="item.detail" class="text-caption text-medium-emphasis">
                    {{ item.detail }}
                  </div>
                  <div v-if="item.observations" class="text-caption text-medium-emphasis">
                    <VIcon icon="tabler-message" size="12" /> {{ item.observations }}
                  </div>
                </div>
              </template>
              <template #item.quantity="{ item }">
                <span class="font-weight-medium text-no-wrap">{{ formatQuantity(item.quantity) }} {{ item.unit ?? '' }}</span>
              </template>
              <template #item.condition="{ item }">
                <VChip v-if="scanCondition(item.condition)" :color="scanCondition(item.condition).color" size="small" label>
                  {{ scanCondition(item.condition).title }}
                </VChip>
                <span v-else class="text-disabled">—</span>
              </template>
              <template #item.location="{ item }">
                {{ item.location || '—' }}
              </template>
              <template #item.pocket="{ item }">
                {{ item.pocket || '—' }}
              </template>
              <template #item.photos="{ item }">
                <VBtn v-if="item.photos.length" size="small" variant="tonal" color="secondary" prepend-icon="tabler-photo" @click="openPhotos(item)">
                  {{ item.photos.length }}
                </VBtn>
                <span v-else class="text-disabled">—</span>
              </template>
              <template #item.scanned_at="{ item }">
                <span class="text-no-wrap">{{ formatShortDateTime(item.scanned_at) }}</span>
              </template>
              <template #item.user="{ item }">
                <span class="text-no-wrap">{{ item.user }}</span>
              </template>
              <template #item.actions="{ item }">
                <IconBtn @click="removeScan(item)">
                  <VIcon icon="tabler-trash" size="20" />
                  <VTooltip activator="parent">
                    Anular registro
                  </VTooltip>
                </IconBtn>
              </template>
            </VDataTableServer>
          </VWindowItem>

          <VWindowItem value="reconciliation">
            <div class="d-flex flex-wrap align-center gap-2 mb-4">
              <AppTextField v-model="reconciliationTable.search.value" placeholder="Buscar código o nombre" prepend-inner-icon="tabler-search" clearable style="max-inline-size: 300px;" />
              <VChip :color="reconciliationFilters.status === null ? 'primary' : undefined" :variant="reconciliationFilters.status === null ? 'flat' : 'tonal'" label @click="reconciliationFilters.status = null">
                Todos
              </VChip>
              <VChip
                v-for="status in RECONCILIATION_STATUSES"
                :key="status.value"
                :color="status.color"
                :variant="reconciliationFilters.status === status.value ? 'flat' : 'tonal'"
                :prepend-icon="status.icon"
                label
                @click="reconciliationFilters.status = status.value"
              >
                {{ status.title }}<template v-if="summary">
                  &nbsp;({{ summary.reconciliation.statuses[status.value] }})
                </template>
              </VChip>
            </div>
            <VDataTableServer
              v-model:options="reconciliationTable.options.value"
              v-bind="reconciliationTable.tableProps.value"
              :headers="reconciliationHeaders"
              density="compact"
              :no-data-text="reconciliationFilters.status ? 'No hay productos en este estado.' : 'No hay base contable ni registros.'"
            >
              <template #item.code="{ item }">
                <span class="font-weight-medium text-no-wrap">{{ item.code }}</span>
              </template>
              <template #item.name="{ item }">
                <span v-if="item.name">{{ item.name }}</span>
                <span v-else-if="item.status === 'SOBRANTE'" class="text-disabled">No está en la base contable</span>
                <span v-else class="text-disabled">—</span>
              </template>
              <template #item.expected="{ item }">
                <span class="text-no-wrap">{{ formatQuantity(item.expected) }} {{ item.unit ?? '' }}</span>
              </template>
              <template #item.counted="{ item }">
                <span class="text-no-wrap font-weight-medium">{{ formatQuantity(item.counted) }}</span>
                <div class="text-caption text-disabled">
                  {{ item.records }} registro(s)
                </div>
              </template>
              <template #item.difference="{ item }">
                <span class="font-weight-medium text-no-wrap" :class="item.difference > 0 ? 'text-info' : item.difference < 0 ? 'text-error' : 'text-success'">
                  {{ item.difference > 0 ? '+' : '' }}{{ formatQuantity(item.difference) }}
                </span>
              </template>
              <template #item.value="{ item }">
                {{ item.value !== null ? formatMoney(item.value) : '—' }}
              </template>
              <template #item.status="{ item }">
                <VChip :color="reconciliationStatus(item.status).color" :prepend-icon="reconciliationStatus(item.status).icon" size="small" label>
                  {{ reconciliationStatus(item.status).title }}
                </VChip>
              </template>
            </VDataTableServer>
          </VWindowItem>
        </VWindow>
      </VCardText>
    </VCard>
  </VDialog>

  <!-- Fotos del registro -->
  <VDialog v-model="photoViewer.open" max-width="900">
    <DialogCloseBtn @click="photoViewer.open = false" />
    <VCard :title="photoViewer.title" subtitle="Fotos tomadas en campo">
      <VCardText>
        <div v-if="photoViewer.loading" class="text-center py-8">
          <VProgressCircular indeterminate color="primary" />
        </div>
        <VRow v-else>
          <VCol v-for="url in photoViewer.urls" :key="url" cols="12" md="4">
            <a :href="url" target="_blank" rel="noopener">
              <VImg :src="url" aspect-ratio="1" cover class="rounded" />
            </a>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.stat-card {
  cursor: pointer;
  transition: border-color 0.15s;
}

.stat-card--active {
  border-color: rgb(var(--v-theme-primary));
  border-width: 2px;
}
</style>
