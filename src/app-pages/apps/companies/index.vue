<script setup>
import CompanySitesDialog from '@/components/companies/CompanySitesDialog.vue'
import { $api } from '@/utils/api'
import { confirmDeleteAlert, showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { extractApiMessage, extractValidationErrors } from '@/utils/security'

definePage({ meta: { action: 'VER', subject: 'EMP' } })

const ability = useAbility()

const filters = reactive({ is_active: null })
const { options, search, tableProps, reload } = useServerTable('/companies', { filters })

const headers = [
  { title: 'Código', key: 'code' },
  { title: 'Razón social', key: 'name' },
  { title: 'Documento', key: 'document_number' },
  { title: 'Usuarios (activos / contrato)', key: 'max_users', align: 'center' },
  { title: 'Sedes', key: 'sites_count', align: 'center', sortable: false },
  { title: 'Inventarios', key: 'inventories_count', align: 'center', sortable: false },
  { title: 'Estado', key: 'is_active' },
  { title: '', key: 'actions', sortable: false, align: 'end' },
]

const emptyForm = () => ({ id: null, code: '', name: '', document_type: 'RUC', document_number: '', email: '', phone: '', address: '', max_users: null, is_active: true })

const dialog = ref(false)
const saving = ref(false)
const form = ref(emptyForm())
const errors = ref({})

const openCreate = () => {
  form.value = emptyForm()
  errors.value = {}
  dialog.value = true
}

const openEdit = company => {
  form.value = { ...emptyForm(), ...company }
  errors.value = {}
  dialog.value = true
}

const save = async () => {
  saving.value = true
  errors.value = {}

  try {
    const { id, ...body } = form.value
    const response = await $api(id ? `/companies/${id}` : '/companies', { method: id ? 'PUT' : 'POST', body })

    dialog.value = false
    reload()

    // Empresa nueva: se pasa directo a registrar sus sedes.
    if (!id && ability.can('VER', 'EMP_SEDE')) {
      showSuccessAlert(`${response.message} Ahora registra sus sedes.`)
      openSites(response.data)
    }
    else {
      showSuccessAlert(response.message)
    }
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

// --- Opción "Sedes" ---
const selected = ref(null)
const sitesDialog = ref(false)

const openSites = company => {
  selected.value = company
  sitesDialog.value = true
}

const remove = async company => {
  const { isConfirmed } = await confirmDeleteAlert(`Se eliminará la empresa ${company.name}.`)
  if (!isConfirmed)
    return

  try {
    const response = await $api(`/companies/${company.id}`, { method: 'DELETE' })

    showSuccessAlert(response.message)
    reload()
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}
</script>

<template>
  <VCard>
    <VCardText>
      <div class="d-flex flex-wrap align-center gap-4 mb-6">
        <div class="me-auto">
          <h4 class="text-h4">
            Empresas
          </h4>
          <div class="text-body-2 text-medium-emphasis">
            Empresas cliente y usuarios permitidos por contrato.
          </div>
        </div>
        <VBtn v-if="$can('CREAR', 'EMP')" prepend-icon="tabler-plus" @click="openCreate">
          Nueva empresa
        </VBtn>
      </div>

      <VRow>
        <VCol cols="12" sm="8" md="6">
          <AppTextField v-model="search" placeholder="Buscar por código, razón social o documento" prepend-inner-icon="tabler-search" clearable />
        </VCol>
        <VCol cols="12" sm="4" md="3">
          <AppSelect v-model="filters.is_active" :items="[{ title: 'Activas', value: 1 }, { title: 'Inactivas', value: 0 }]" placeholder="Estado" clearable />
        </VCol>
      </VRow>
    </VCardText>

    <VDivider />

    <VDataTableServer v-model:options="options" v-bind="tableProps" :headers="headers" no-data-text="No hay empresas registradas.">
      <template #item.name="{ item }">
        <div class="font-weight-medium">
          {{ item.name }}
        </div>
        <div class="text-caption text-medium-emphasis">
          {{ item.email ?? '' }}
        </div>
      </template>
      <template #item.document_number="{ item }">
        {{ item.document_type }} {{ item.document_number ?? '—' }}
      </template>
      <template #item.max_users="{ item }">
        <VChip :color="item.can_add_user ? 'secondary' : 'warning'" size="small" label>
          {{ item.active_users_count }} / {{ item.max_users ?? '∞' }}
        </VChip>
      </template>
      <template #item.sites_count="{ item }">
        <VChip size="small" label :color="item.sites_count ? 'primary' : 'secondary'" variant="tonal">
          {{ item.sites_count }}
        </VChip>
      </template>
      <template #item.is_active="{ item }">
        <VChip :color="item.is_active ? 'success' : 'secondary'" size="small" label>
          {{ item.is_active ? 'Activa' : 'Inactiva' }}
        </VChip>
      </template>
      <template #item.actions="{ item }">
        <div class="d-flex justify-end flex-nowrap">
          <IconBtn v-if="$can('VER', 'EMP_SEDE')" @click="openSites(item)">
            <VIcon icon="tabler-map-pin" />
            <VTooltip activator="parent">
              Sedes
            </VTooltip>
          </IconBtn>
          <IconBtn v-if="$can('EDITAR', 'EMP')" @click="openEdit(item)">
            <VIcon icon="tabler-pencil" />
            <VTooltip activator="parent">
              Editar
            </VTooltip>
          </IconBtn>
          <IconBtn v-if="$can('ELIMINAR', 'EMP')" @click="remove(item)">
            <VIcon icon="tabler-trash" />
            <VTooltip activator="parent">
              Eliminar
            </VTooltip>
          </IconBtn>
        </div>
      </template>
    </VDataTableServer>
  </VCard>

  <CompanySitesDialog v-model="sitesDialog" :company="selected" @updated="reload" />

  <VDialog v-model="dialog" max-width="720" persistent>
    <DialogCloseBtn @click="dialog = false" />
    <VCard :title="form.id ? 'Editar empresa' : 'Nueva empresa'">
      <VCardText>
        <VForm @submit.prevent="save">
          <VRow>
            <VCol cols="12" md="4">
              <AppTextField v-model="form.code" label="Código *" :error-messages="errors.code" />
            </VCol>
            <VCol cols="12" md="8">
              <AppTextField v-model="form.name" label="Razón social *" :error-messages="errors.name" />
            </VCol>
            <VCol cols="12" md="4">
              <AppSelect v-model="form.document_type" label="Tipo de documento" :items="['RUC', 'DNI', 'CE', 'OTRO']" :error-messages="errors.document_type" />
            </VCol>
            <VCol cols="12" md="8">
              <AppTextField v-model="form.document_number" label="Número de documento" :error-messages="errors.document_number" />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="form.email" label="Correo" type="email" :error-messages="errors.email" />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="form.phone" label="Teléfono" :error-messages="errors.phone" />
            </VCol>
            <VCol cols="12">
              <AppTextField v-model="form.address" label="Dirección" :error-messages="errors.address" />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField
                v-model.number="form.max_users"
                label="Usuarios permitidos por contrato"
                type="number"
                min="1"
                placeholder="Vacío = sin límite"
                :error-messages="errors.max_users"
              />
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
