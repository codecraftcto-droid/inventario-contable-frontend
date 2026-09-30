<script setup>
import { $api } from '@/utils/api'
import { confirmDeleteAlert, showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { extractApiMessage, extractValidationErrors } from '@/utils/security'

/**
 * Opción "Sedes" de una empresa: listado paginado en el servidor y registro de sus sedes.
 */
const props = defineProps({
  company: { type: Object, default: null },
})

const emit = defineEmits(['updated'])
const isOpen = defineModel({ type: Boolean, default: false })

const baseUrl = computed(() => `/companies/${props.company?.id}/sites`)
const filters = reactive({ is_active: null })
const { options, search, tableProps, reload, total } = useServerTable(baseUrl, { filters, itemsPerPage: 10 })

const ability = useAbility()

const headers = computed(() => [
  { title: 'Código', key: 'code' },
  { title: 'Sede', key: 'name' },
  { title: 'Dirección', key: 'address', sortable: false },
  { title: 'Estado', key: 'is_active' },
  ...(ability.can('EDITAR', 'EMP_SEDE') || ability.can('ELIMINAR', 'EMP_SEDE') ? [{ title: '', key: 'actions', sortable: false, align: 'end' }] : []),
])

// --- Registro / edición ---
const formDialog = ref(false)
const form = ref({})
const errors = ref({})
const saving = ref(false)

const openForm = (site = null) => {
  form.value = site ? { ...site } : { id: null, code: '', name: '', address: '', is_active: true }
  errors.value = {}
  formDialog.value = true
}

const save = async () => {
  saving.value = true
  errors.value = {}

  try {
    const { id, code, name, address, is_active: isActive } = form.value
    const response = await $api(id ? `${baseUrl.value}/${id}` : baseUrl.value, {
      method: id ? 'PUT' : 'POST',
      body: { code, name, address, is_active: isActive },
    })

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

const remove = async site => {
  const { isConfirmed } = await confirmDeleteAlert(`Se eliminará la sede ${site.name}.`)
  if (!isConfirmed)
    return

  try {
    const response = await $api(`${baseUrl.value}/${site.id}`, { method: 'DELETE' })

    showSuccessAlert(response.message)
    reload()
    emit('updated')
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}

// Al abrir (o cambiar de empresa) se recarga desde la primera página.
watch([isOpen, () => props.company?.id], ([open]) => {
  if (!open)
    return

  search.value = ''
  filters.is_active = null
  if (options.value.page !== 1)
    options.value = { ...options.value, page: 1 }
  reload()
})

defineExpose({ openForm })
</script>

<template>
  <VDialog v-model="isOpen" max-width="960" scrollable>
    <DialogCloseBtn @click="isOpen = false" />
    <VCard v-if="company">
      <VCardItem>
        <VCardTitle>Sedes</VCardTitle>
        <VCardSubtitle>{{ company.code }} · {{ company.name }}</VCardSubtitle>
      </VCardItem>

      <VCardText>
        <div class="d-flex flex-wrap align-center gap-4 mb-4">
          <AppTextField v-model="search" placeholder="Buscar código, nombre o dirección" prepend-inner-icon="tabler-search" clearable style="max-inline-size: 320px;" />
          <AppSelect v-model="filters.is_active" :items="[{ title: 'Activas', value: 1 }, { title: 'Inactivas', value: 0 }]" placeholder="Estado" clearable style="max-inline-size: 180px;" />
          <VSpacer />
          <VBtn v-if="$can('CREAR', 'EMP_SEDE')" prepend-icon="tabler-plus" @click="openForm()">
            Nueva sede
          </VBtn>
        </div>

        <VDataTableServer v-model:options="options" v-bind="tableProps" :headers="headers" density="compact">
          <template #no-data>
            <div class="py-6 text-center">
              <VIcon icon="tabler-map-pin-off" size="36" class="text-disabled mb-2" />
              <div>{{ search || filters.is_active !== null ? 'No hay sedes con ese filtro.' : 'Esta empresa aún no tiene sedes registradas.' }}</div>
              <VBtn v-if="!search && filters.is_active === null && $can('CREAR', 'EMP_SEDE')" variant="tonal" size="small" class="mt-3" prepend-icon="tabler-plus" @click="openForm()">
                Registrar la primera sede
              </VBtn>
            </div>
          </template>
          <template #item.code="{ item }">
            <span class="font-weight-medium text-no-wrap">{{ item.code }}</span>
          </template>
          <template #item.address="{ item }">
            {{ item.address || '—' }}
          </template>
          <template #item.is_active="{ item }">
            <VChip :color="item.is_active ? 'success' : 'secondary'" size="small" label>
              {{ item.is_active ? 'Activa' : 'Inactiva' }}
            </VChip>
          </template>
          <template #item.actions="{ item }">
            <IconBtn v-if="$can('EDITAR', 'EMP_SEDE')" @click="openForm(item)">
              <VIcon icon="tabler-pencil" size="20" />
              <VTooltip activator="parent">
                Editar
              </VTooltip>
            </IconBtn>
            <IconBtn v-if="$can('ELIMINAR', 'EMP_SEDE')" @click="remove(item)">
              <VIcon icon="tabler-trash" size="20" />
              <VTooltip activator="parent">
                Eliminar
              </VTooltip>
            </IconBtn>
          </template>
        </VDataTableServer>
        <div v-if="total" class="text-caption text-medium-emphasis mt-2">
          {{ total }} sede(s) registrada(s).
        </div>
      </VCardText>
    </VCard>
  </VDialog>

  <VDialog v-model="formDialog" max-width="600" persistent>
    <DialogCloseBtn @click="formDialog = false" />
    <VCard :title="form.id ? 'Editar sede' : 'Nueva sede'" :subtitle="company?.name">
      <VCardText>
        <VForm @submit.prevent="save">
          <VRow>
            <VCol cols="12" md="4">
              <AppTextField v-model="form.code" label="Código *" placeholder="Ej. SEDE-01" :error-messages="errors.code" />
            </VCol>
            <VCol cols="12" md="8">
              <AppTextField v-model="form.name" label="Nombre *" placeholder="Ej. Sede Central" :error-messages="errors.name" />
            </VCol>
            <VCol cols="12">
              <AppTextField v-model="form.address" label="Dirección" placeholder="Ej. Av. Arequipa 123, Lima" :error-messages="errors.address" />
            </VCol>
            <VCol cols="12" md="6">
              <AppSelect
                v-model="form.is_active"
                label="Estado"
                :items="[{ title: 'Activa', value: true }, { title: 'Inactiva', value: false }]"
                :error-messages="errors.is_active"
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
</template>
