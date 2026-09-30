<script setup>
import { $api } from '@/utils/api'
import { confirmAlert, showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { formatDateTime } from '@/utils/constants'
import { extractApiMessage, extractValidationErrors } from '@/utils/security'

/**
 * Opción "Asignar inventariadores": qué personal interno trabaja en el inventario.
 * El personal sin el permiso "Ver todos" solo ve (en la web y en la app) lo que tiene asignado.
 */
const props = defineProps({
  inventory: { type: Object, default: null },
})

const emit = defineEmits(['updated'])
const isOpen = defineModel({ type: Boolean, default: false })

const ability = useAbility()
const isClosed = computed(() => props.inventory?.status === 'CERRADO')
const canEdit = computed(() => !isClosed.value && ability.can('EDITAR', 'INV_ASIG'))
const baseUrl = computed(() => `/inventories/${props.inventory?.id}/assignees`)

// --- Asignados ---
const assignees = ref([])
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    assignees.value = (await $api(baseUrl.value)).data
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
  finally {
    loading.value = false
  }
}

// --- Buscar personal (en el servidor) ---
const selected = ref([])
const search = ref('')
const debouncedSearch = refDebounced(search, 350)
const candidates = ref([])
const searching = ref(false)
const errors = ref({})
const saving = ref(false)

const fetchCandidates = async () => {
  if (!canEdit.value)
    return
  searching.value = true
  try {
    const { data } = await $api(`${baseUrl.value}/candidates`, { query: { search: debouncedSearch.value || undefined } })

    // Se conservan en la lista los ya elegidos para que el chip no pierda su nombre.
    const chosen = candidates.value.filter(user => selected.value.includes(user.id))

    candidates.value = [...chosen, ...data.filter(user => !chosen.some(item => item.id === user.id))]
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
  finally {
    searching.value = false
  }
}

watch(debouncedSearch, fetchCandidates)

const candidateItems = computed(() => candidates.value.map(user => ({
  value: user.id,
  title: user.full_name,
  subtitle: [user.document_number, user.roles.join(', ')].filter(Boolean).join(' · '),
  props: { disabled: user.assigned },
  assigned: user.assigned,
})))

const assign = async () => {
  if (!selected.value.length)
    return
  saving.value = true
  errors.value = {}

  try {
    const response = await $api(baseUrl.value, { method: 'POST', body: { user_ids: selected.value } })

    showSuccessAlert(response.message)
    selected.value = []
    search.value = ''
    await Promise.all([load(), fetchCandidates()])
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

const unassign = async user => {
  const { isConfirmed } = await confirmAlert({
    title: `¿Quitar a ${user.full_name}?`,
    text: 'Dejará de ver este inventario en la web y en la app. Si tiene registros sin enviar en su celular, quedarán como rechazados.',
    confirmButtonText: 'Sí, quitar',
  })
  if (!isConfirmed)
    return

  try {
    const response = await $api(`${baseUrl.value}/${user.id}`, { method: 'DELETE' })

    showSuccessAlert(response.message)
    await Promise.all([load(), fetchCandidates()])
    emit('updated')
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}

const initials = name => name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()

watch([isOpen, () => props.inventory?.id], ([open]) => {
  if (!open)
    return

  selected.value = []
  search.value = ''
  errors.value = {}
  candidates.value = []
  load()
  fetchCandidates()
})
</script>

<template>
  <VDialog v-model="isOpen" max-width="760" scrollable>
    <DialogCloseBtn @click="isOpen = false" />
    <VCard v-if="inventory">
      <VCardItem>
        <VCardTitle>Asignar inventariadores</VCardTitle>
        <VCardSubtitle>{{ inventory.code }} · {{ inventory.name }} · {{ inventory.company?.name }}</VCardSubtitle>
      </VCardItem>

      <VCardText>
        <VAlert type="info" variant="tonal" density="compact" class="mb-4">
          Solo el personal asignado verá este inventario en la app y en la web. Administradores y contables ven todos sin necesidad de asignarse.
        </VAlert>
        <VAlert v-if="isClosed" type="warning" variant="tonal" density="compact" class="mb-4">
          El inventario está cerrado: ya no se pueden cambiar las asignaciones.
        </VAlert>

        <div v-if="canEdit" class="d-flex flex-wrap flex-md-nowrap align-start gap-3 mb-6">
          <AppAutocomplete
            v-model="selected"
            v-model:search="search"
            :items="candidateItems"
            :loading="searching"
            placeholder="Busca por nombre, documento o correo"
            prepend-inner-icon="tabler-search"
            multiple
            chips
            closable-chips
            no-filter
            hide-selected
            :error-messages="errors.user_ids"
            no-data-text="No hay personal con permiso para escanear que coincida."
            class="flex-grow-1"
          >
            <template #item="{ props: itemProps, item }">
              <VListItem v-bind="itemProps" :subtitle="item.raw.subtitle">
                <template #append>
                  <VChip v-if="item.raw.assigned" size="x-small" label color="success">
                    Ya asignado
                  </VChip>
                </template>
              </VListItem>
            </template>
          </AppAutocomplete>
          <VBtn :loading="saving" :disabled="!selected.length" prepend-icon="tabler-user-plus" @click="assign">
            Asignar
          </VBtn>
        </div>

        <div class="d-flex align-center justify-space-between mb-2">
          <span class="font-weight-medium">Personal asignado</span>
          <VChip size="small" label>
            {{ assignees.length }}
          </VChip>
        </div>

        <VProgressLinear v-if="loading" indeterminate color="primary" class="mb-2" />

        <VList v-if="assignees.length" border rounded class="py-0">
          <template v-for="(user, index) in assignees" :key="user.id">
            <VDivider v-if="index" />
            <VListItem class="py-3">
              <template #prepend>
                <VAvatar color="primary" variant="tonal" size="38">
                  <span class="text-sm font-weight-medium">{{ initials(user.full_name) }}</span>
                </VAvatar>
              </template>
              <VListItemTitle class="font-weight-medium">
                {{ user.full_name }}
                <VChip v-for="role in user.roles" :key="role" size="x-small" label class="ms-1">
                  {{ role }}
                </VChip>
              </VListItemTitle>
              <VListItemSubtitle>
                {{ user.document_number }}<template v-if="user.email">
                  · {{ user.email }}
                </template>
              </VListItemSubtitle>
              <div class="text-caption text-disabled mt-1">
                Asignado {{ formatDateTime(user.assigned_at) }}<template v-if="user.assigned_by">
                  por {{ user.assigned_by }}
                </template>
              </div>
              <template v-if="canEdit" #append>
                <IconBtn @click="unassign(user)">
                  <VIcon icon="tabler-user-minus" size="20" />
                  <VTooltip activator="parent">
                    Quitar
                  </VTooltip>
                </IconBtn>
              </template>
            </VListItem>
          </template>
        </VList>
        <div v-else-if="!loading" class="text-center py-8 border rounded">
          <VIcon icon="tabler-users" size="36" class="text-disabled mb-2" />
          <div>Aún no hay inventariadores asignados.</div>
          <div class="text-body-2 text-medium-emphasis">
            Busca al personal arriba y pulsa "Asignar".
          </div>
        </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>
