<script setup>
import { $api, downloadFile } from '@/utils/api'
import { confirmDeleteAlert, showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { formatMoney, formatQuantity } from '@/utils/constants'
import { extractApiMessage, extractValidationErrors } from '@/utils/security'

/**
 * Opción "Base contable" de un inventario:
 *  1. Descargar el formato Excel.
 *  2. Subirlo con la data (se procesa en bloques en el servidor).
 *  3. Ver / buscar / corregir la tabla cargada (paginada en el servidor).
 */
const props = defineProps({
  inventory: { type: Object, default: null },
})

const emit = defineEmits(['updated'])
const isOpen = defineModel({ type: Boolean, default: false })

const isClosed = computed(() => props.inventory?.status === 'CERRADO')
const baseUrl = computed(() => `/inventories/${props.inventory?.id}/accounting-base`)

const { options, search, tableProps, reload, total } = useServerTable(baseUrl, { itemsPerPage: 10 })

const headers = [
  { title: 'Código producto', key: 'codigo' },
  { title: 'Nombre producto', key: 'nombre' },
  { title: 'Unidad medida', key: 'unidad_medida' },
  { title: 'Cantidad', key: 'cantidad', align: 'end' },
  { title: 'Valor', key: 'valor', align: 'end' },
  { title: '', key: 'actions', sortable: false, align: 'end' },
]

// --- Descargar formato / exportar ---
const downloading = ref(false)

const downloadTemplate = async () => {
  downloading.value = true
  try {
    await downloadFile('/inventories/accounting-base-template', 'plantilla-base-contable.xlsx')
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
  finally {
    downloading.value = false
  }
}

const exportBase = async () => {
  try {
    await downloadFile(`${baseUrl.value}/export`, `base-contable-${props.inventory.code}.xlsx`)
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}

// --- Subir Excel ---
const file = ref(null)
const uploading = ref(false)
const importResult = ref(null)

const upload = async () => {
  const selected = Array.isArray(file.value) ? file.value[0] : file.value
  if (!selected)
    return

  const body = new FormData()

  body.append('file', selected)
  uploading.value = true
  importResult.value = null

  try {
    const response = await $api(`${baseUrl.value}/import`, { method: 'POST', body })

    importResult.value = response.data
    file.value = null
    reload()
    emit('updated')
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
  finally {
    uploading.value = false
  }
}

// --- Registro manual / edición ---
const rowDialog = ref(false)
const rowForm = ref({})
const rowErrors = ref({})
const savingRow = ref(false)

const openRow = (row = null) => {
  rowForm.value = row ? { ...row } : { id: null, codigo: '', nombre: '', unidad_medida: '', cantidad: null, valor: null }
  rowErrors.value = {}
  rowDialog.value = true
}

const saveRow = async () => {
  savingRow.value = true
  rowErrors.value = {}

  try {
    const { id, codigo, nombre, unidad_medida: unidadMedida, cantidad, valor } = rowForm.value
    const response = await $api(id ? `${baseUrl.value}/${id}` : baseUrl.value, { method: id ? 'PUT' : 'POST', body: { codigo, nombre, unidad_medida: unidadMedida, cantidad: cantidad === '' ? null : cantidad, valor: valor === '' ? null : valor } })

    showSuccessAlert(response.message)
    rowDialog.value = false
    reload()
    emit('updated')
  }
  catch (error) {
    rowErrors.value = extractValidationErrors(error)
    if (!Object.keys(rowErrors.value).length)
      showErrorAlert(extractApiMessage(error))
  }
  finally {
    savingRow.value = false
  }
}

const removeRow = async row => {
  const { isConfirmed } = await confirmDeleteAlert(`Se eliminará el producto ${row.codigo}.`)
  if (!isConfirmed)
    return

  try {
    await $api(`${baseUrl.value}/${row.id}`, { method: 'DELETE' })
    reload()
    emit('updated')
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}

// Al abrir (o cambiar de inventario) se recarga desde la primera página.
watch([isOpen, () => props.inventory?.id], ([open]) => {
  if (!open)
    return

  importResult.value = null
  file.value = null
  search.value = ''
  options.value = { ...options.value, page: 1 }
  reload()
})
</script>

<template>
  <VDialog v-model="isOpen" max-width="1100" scrollable>
    <DialogCloseBtn @click="isOpen = false" />
    <VCard v-if="inventory">
      <VCardItem>
        <VCardTitle>Base contable</VCardTitle>
        <VCardSubtitle>{{ inventory.code }} · {{ inventory.name }} · {{ inventory.company?.name }}</VCardSubtitle>
      </VCardItem>

      <VCardText>
        <VAlert v-if="isClosed" type="info" variant="tonal" class="mb-4">
          El inventario está cerrado: la base contable ya no se puede modificar.
        </VAlert>

        <!-- Paso 1 y 2: formato y carga -->
        <VRow v-if="!isClosed && $can('IMPORTAR', 'INV_BASE')" class="mb-2">
          <VCol cols="12" md="4">
            <VCard variant="outlined" class="h-100">
              <VCardText>
                <div class="d-flex align-center gap-2 mb-2">
                  <VAvatar color="primary" variant="tonal" size="28">
                    1
                  </VAvatar>
                  <span class="font-weight-medium">Descarga el formato</span>
                </div>
                <p class="text-body-2 text-medium-emphasis">
                  Llénalo sin cambiar los encabezados: <strong>CODIGO PRODUCTO</strong> (obligatorio y único), NOMBRE PRODUCTO, UNIDAD MEDIDA, <strong>CANTIDAD</strong> (contra la que se concilia la toma; vacía = 1) y VALOR.
                </p>
                <VBtn block variant="tonal" prepend-icon="tabler-file-download" :loading="downloading" @click="downloadTemplate">
                  Descargar formato Excel
                </VBtn>
              </VCardText>
            </VCard>
          </VCol>
          <VCol cols="12" md="8">
            <VCard variant="outlined" class="h-100">
              <VCardText>
                <div class="d-flex align-center gap-2 mb-2">
                  <VAvatar color="primary" variant="tonal" size="28">
                    2
                  </VAvatar>
                  <span class="font-weight-medium">Sube el archivo con la data</span>
                </div>
                <p class="text-body-2 text-medium-emphasis">
                  Puedes subirlo las veces que necesites: los códigos que ya existen se actualizan y los nuevos se crean. Los que no vengan en el archivo se conservan.
                </p>
                <div class="d-flex gap-3 align-start">
                  <VFileInput
                    v-model="file"
                    accept=".xlsx,.xls,.csv"
                    label="Archivo Excel"
                    prepend-icon=""
                    prepend-inner-icon="tabler-paperclip"
                    density="compact"
                    hide-details
                  />
                  <VBtn prepend-icon="tabler-upload" :loading="uploading" :disabled="!file || (Array.isArray(file) && !file.length)" @click="upload">
                    Cargar
                  </VBtn>
                </div>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>

        <!-- Resultado de la carga -->
        <VAlert
          v-if="importResult"
          :type="importResult.failures_count ? 'warning' : 'success'"
          variant="tonal"
          class="mb-4"
          closable
          @click:close="importResult = null"
        >
          <div class="font-weight-medium">
            {{ importResult.created }} producto(s) nuevo(s) y {{ importResult.updated }} actualizado(s){{ importResult.failures_count ? `; ${importResult.failures_count} fila(s) con errores no se cargaron` : '' }}.
          </div>
          <div v-if="importResult.failures_count" class="mt-2 failures-list">
            <div v-for="failure in importResult.failures" :key="failure.row" class="text-body-2">
              <strong>Fila {{ failure.row }}:</strong> {{ failure.errors.join(' ') }}
            </div>
            <div v-if="importResult.failures_count > importResult.failures.length" class="text-caption mt-1">
              Se muestran los primeros {{ importResult.failures.length }} errores.
            </div>
          </div>
        </VAlert>

        <!-- Paso 3: tabla cargada -->
        <div class="d-flex flex-wrap align-center gap-3 mb-3">
          <div class="me-auto text-body-1 font-weight-medium">
            {{ total }} producto(s) en la base contable
          </div>
          <AppTextField v-model="search" placeholder="Buscar código o nombre" prepend-inner-icon="tabler-search" clearable style="max-inline-size: 280px;" />
          <VBtn v-if="$can('EXPORTAR', 'INV_BASE')" variant="tonal" color="secondary" prepend-icon="tabler-file-export" :disabled="!total" @click="exportBase">
            Exportar
          </VBtn>
          <VBtn v-if="!isClosed && $can('CREAR', 'INV_BASE')" variant="tonal" prepend-icon="tabler-plus" @click="openRow()">
            Agregar
          </VBtn>
        </div>

        <VDataTableServer
          v-if="isOpen"
          v-model:options="options"
          v-bind="tableProps"
          :headers="headers"
          density="compact"
          no-data-text="Aún no se ha cargado la base contable."
        >
          <template #item.codigo="{ item }">
            <span class="font-weight-medium text-no-wrap">{{ item.codigo }}</span>
          </template>
          <template #item.nombre="{ item }">
            <span v-if="item.nombre">{{ item.nombre }}</span>
            <span v-else class="text-disabled">—</span>
          </template>
          <template #item.unidad_medida="{ item }">
            {{ item.unidad_medida || '—' }}
          </template>
          <template #item.cantidad="{ item }">
            <span v-if="item.cantidad !== null">{{ formatQuantity(item.cantidad) }}</span>
            <span v-else class="text-disabled" title="Vacía: se concilia contra 1">1*</span>
          </template>
          <template #item.valor="{ item }">
            {{ item.valor !== null ? formatMoney(item.valor) : '—' }}
          </template>
          <template #item.actions="{ item }">
            <template v-if="!isClosed">
              <IconBtn v-if="$can('EDITAR', 'INV_BASE')" size="small" @click="openRow(item)">
                <VIcon icon="tabler-pencil" size="20" />
              </IconBtn>
              <IconBtn v-if="$can('ELIMINAR', 'INV_BASE')" size="small" @click="removeRow(item)">
                <VIcon icon="tabler-trash" size="20" />
              </IconBtn>
            </template>
          </template>
        </VDataTableServer>
      </VCardText>
    </VCard>
  </VDialog>

  <VDialog v-model="rowDialog" max-width="520" persistent>
    <DialogCloseBtn @click="rowDialog = false" />
    <VCard :title="rowForm.id ? 'Editar producto' : 'Agregar producto'">
      <VCardText>
        <VForm @submit.prevent="saveRow">
          <VRow>
            <VCol cols="12">
              <AppTextField v-model="rowForm.codigo" label="Código producto *" :error-messages="rowErrors.codigo" />
            </VCol>
            <VCol cols="12">
              <AppTextField v-model="rowForm.nombre" label="Nombre producto" :error-messages="rowErrors.nombre" />
            </VCol>
            <VCol cols="12">
              <AppTextField v-model="rowForm.unidad_medida" label="Unidad medida" placeholder="Ej. UND, CAJA, KG" :error-messages="rowErrors.unidad_medida" />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="rowForm.cantidad" label="Cantidad" type="number" min="0" step="any" placeholder="Vacía = 1" :error-messages="rowErrors.cantidad" />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="rowForm.valor" label="Valor" type="number" min="0" step="0.01" placeholder="Opcional" :error-messages="rowErrors.valor" />
            </VCol>
          </VRow>
          <div class="d-flex justify-end gap-3 mt-6">
            <VBtn variant="tonal" color="secondary" @click="rowDialog = false">
              Cancelar
            </VBtn>
            <VBtn type="submit" :loading="savingRow">
              Guardar
            </VBtn>
          </div>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.failures-list {
  max-block-size: 180px;
  overflow-y: auto;
}
</style>
