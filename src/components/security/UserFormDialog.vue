<script setup>
import { $api } from '@/utils/api'
import { showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { extractApiMessage, extractValidationErrors } from '@/utils/security'

/**
 * Alta / edición de usuario. Si se elige una empresa es un usuario cliente (solo ve su
 * empresa); si no, es personal interno. La contraseña solo se pide al crear: si se deja
 * vacía se genera una temporal.
 */
const props = defineProps({
  user: { type: Object, default: null },
  roles: { type: Array, default: () => [] },
})

const emit = defineEmits(['saved'])
const isOpen = defineModel({ type: Boolean, default: false })

const emptyForm = () => ({
  kind: 'INTERNO',
  company_id: null,
  document_number: '',
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  role_ids: [],
  is_active: true,
  password: '',
})

const form = ref(emptyForm())
const errors = ref({})
const saving = ref(false)
const showPassword = ref(false)
const isEdit = computed(() => !!props.user?.id)

const companies = useCompanySearch()

const roleItems = computed(() => props.roles
  .filter(role => role.is_active || form.value.role_ids.includes(role.id))
  .map(role => ({ title: role.name, value: role.id, subtitle: role.description })))

watch(isOpen, open => {
  if (!open)
    return

  errors.value = {}
  showPassword.value = false

  if (props.user) {
    form.value = {
      ...emptyForm(),
      ...props.user,
      kind: props.user.company ? 'CLIENTE' : 'INTERNO',
      company_id: props.user.company?.id ?? null,
      role_ids: props.user.roles.map(role => role.id),
      password: '',
    }
    companies.ensure(props.user.company)
  }
  else {
    form.value = emptyForm()
  }

  companies.fetch('')
})

// Sugerir usuario a partir del correo al crear.
watch(() => form.value.email, email => {
  if (!isEdit.value && email?.includes('@') && !form.value.username)
    form.value.username = email.split('@')[0].replace(/[^\w-]/g, '').slice(0, 50)
})

const save = async () => {
  saving.value = true
  errors.value = {}

  const { kind, company_id: companyId, password, document_number, username, first_name, last_name, email, phone, role_ids, is_active } = form.value

  const body = {
    company_id: kind === 'CLIENTE' ? companyId : null,
    document_number,
    username,
    first_name,
    last_name,
    email,
    phone,
    role_ids,
    is_active,
    ...(!isEdit.value && password ? { password } : {}),
  }

  // Sin empresa elegida en modo cliente: el backend lo aceptaría como interno, se avisa aquí.
  if (kind === 'CLIENTE' && !companyId) {
    errors.value = { company_id: 'Selecciona la empresa del usuario.' }
    saving.value = false

    return
  }

  try {
    const response = await $api(isEdit.value ? `/security/users/${props.user.id}` : '/security/users', {
      method: isEdit.value ? 'PUT' : 'POST',
      body,
    })

    showSuccessAlert(response.message)
    isOpen.value = false
    emit('saved', response.data)
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
</script>

<template>
  <VDialog v-model="isOpen" max-width="760" persistent scrollable>
    <DialogCloseBtn @click="isOpen = false" />
    <VCard :title="isEdit ? 'Editar usuario' : 'Nuevo usuario'">
      <VCardText>
        <VForm @submit.prevent="save">
          <!-- Tipo -->
          <div class="text-overline mb-2">
            Tipo de usuario
          </div>
          <VRow>
            <VCol cols="12">
              <VBtnToggle v-model="form.kind" mandatory divided color="primary" variant="outlined" class="w-100 user-kind-toggle">
                <VBtn value="INTERNO" class="flex-grow-1" prepend-icon="tabler-user-shield" :disabled="user?.is_root_admin">
                  Personal interno
                </VBtn>
                <VBtn value="CLIENTE" class="flex-grow-1" prepend-icon="tabler-building-skyscraper" :disabled="user?.is_root_admin">
                  Usuario de empresa
                </VBtn>
              </VBtnToggle>
              <div class="text-caption text-medium-emphasis mt-2">
                {{ form.kind === 'CLIENTE'
                  ? 'Solo verá la información de su empresa y no puede tener permisos de administración.'
                  : 'Personal de R&R: ve la información de todas las empresas.' }}
              </div>
            </VCol>
            <VCol v-if="form.kind === 'CLIENTE'" cols="12">
              <AppAutocomplete
                v-model="form.company_id"
                v-model:search="companies.search.value"
                label="Empresa *"
                placeholder="Busca por código o razón social"
                :items="companies.items.value"
                :loading="companies.loading.value"
                no-filter
                :error-messages="errors.company_id"
              />
            </VCol>
          </VRow>

          <!-- Datos personales -->
          <div class="text-overline mt-6 mb-2">
            Datos del usuario
          </div>
          <VRow>
            <VCol cols="12" md="6">
              <AppTextField v-model="form.document_number" label="Número de documento *" placeholder="DNI, CE o pasaporte" :error-messages="errors.document_number" />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="form.phone" label="Teléfono" placeholder="999 999 999" :error-messages="errors.phone" />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="form.first_name" label="Nombres *" :error-messages="errors.first_name" />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="form.last_name" label="Apellidos" :error-messages="errors.last_name" />
            </VCol>
          </VRow>

          <!-- Acceso -->
          <div class="text-overline mt-6 mb-2">
            Acceso al sistema
          </div>
          <VRow>
            <VCol cols="12" md="6">
              <AppTextField v-model="form.email" label="Correo *" type="email" placeholder="usuario@empresa.com" :error-messages="errors.email" />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="form.username" label="Usuario *" placeholder="jperez" :error-messages="errors.username" />
            </VCol>
            <VCol v-if="!isEdit" cols="12" md="6">
              <AppTextField
                v-model="form.password"
                label="Contraseña"
                placeholder="Vacío = se genera una temporal"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                :append-inner-icon="showPassword ? 'tabler-eye-off' : 'tabler-eye'"
                :error-messages="errors.password"
                @click:append-inner="showPassword = !showPassword"
              />
            </VCol>
            <VCol cols="12" :md="isEdit ? 12 : 6">
              <AppSelect
                v-model="form.role_ids"
                label="Roles"
                placeholder="Selecciona uno o más roles"
                :items="roleItems"
                multiple
                chips
                closable-chips
                :error-messages="errors.role_ids"
              />
            </VCol>
            <VCol cols="12">
              <VSwitch v-model="form.is_active" label="Usuario activo" hide-details :disabled="user?.is_root_admin" />
            </VCol>
          </VRow>

          <div class="d-flex justify-end gap-3 mt-6">
            <VBtn variant="tonal" color="secondary" @click="isOpen = false">
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

<style scoped>
.user-kind-toggle {
  block-size: 44px;
}
</style>
