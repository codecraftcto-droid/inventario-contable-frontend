<script setup>
import { $api } from '@/utils/api'
import { confirmAlert, showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { formatDateTime } from '@/utils/constants'
import { extractApiMessage } from '@/utils/security'

definePage({ meta: { action: 'VER', subject: 'SEG_SES' } })

const tab = ref('sessions')

const PLATFORMS = [{ title: 'Web', value: 'WEB' }, { title: 'Móvil', value: 'MOVIL' }]
const EVENTS = [
  { value: 'LOGIN_OK', title: 'Inicio de sesión', color: 'success', icon: 'tabler-login' },
  { value: 'LOGIN_FALLIDO', title: 'Intento fallido', color: 'warning', icon: 'tabler-alert-triangle' },
  { value: 'BLOQUEO', title: 'Bloqueo', color: 'error', icon: 'tabler-lock' },
  { value: 'LOGOUT', title: 'Cierre de sesión', color: 'secondary', icon: 'tabler-logout' },
  { value: 'CAMBIO_CLAVE', title: 'Cambio de contraseña', color: 'info', icon: 'tabler-key' },
]
const eventOf = value => EVENTS.find(event => event.value === value) ?? { title: value, color: 'secondary', icon: 'tabler-point' }

const REVOKE_REASONS = {
  LOGOUT: 'Cerró sesión',
  ADMIN: 'Cerrada por administrador',
  DISPOSITIVO: 'Dispositivo desconectado',
  CAMBIO_CLAVE: 'Cambio de contraseña',
  RESETEO_CLAVE: 'Contraseña reseteada',
  NUEVO_LOGIN: 'Nuevo ingreso en el equipo',
  USUARIO_DESACTIVADO: 'Usuario desactivado',
  REFRESH_INVALIDO: 'Uso sospechoso del token',
}

// ============================ Sesiones ============================
const sessionFilters = reactive({ status: 'active', platform: null })
const sessions = useServerTable('/security/sessions', { filters: sessionFilters })

const sessionHeaders = [
  { title: 'Usuario', key: 'user', sortable: false },
  { title: 'Dispositivo', key: 'device_name', sortable: false },
  { title: 'IP', key: 'ip_address', sortable: false },
  { title: 'Último uso', key: 'last_used_at', sortable: false },
  { title: 'Vence', key: 'expires_at', sortable: false },
  { title: 'Estado', key: 'is_active', sortable: false },
  { title: '', key: 'actions', sortable: false, align: 'end' },
]

const revoke = async session => {
  const { isConfirmed } = await confirmAlert({
    title: '¿Cerrar esta sesión?',
    text: `${session.user?.full_name} deberá volver a iniciar sesión en ${session.device_name || 'ese dispositivo'}. El corte es inmediato.`,
    confirmButtonText: 'Sí, cerrar sesión',
  })
  if (!isConfirmed)
    return

  try {
    const response = await $api(`/security/sessions/${session.id}`, { method: 'DELETE' })

    showSuccessAlert(response.message)
    sessions.reload()
  }
  catch (error) {
    showErrorAlert(extractApiMessage(error))
  }
}

// ========================= Log de accesos =========================
const logFilters = reactive({ event: null, platform: null, date_from: null, date_to: null })
const logs = useServerTable('/security/access-logs', { filters: logFilters, itemsPerPage: 25 })

const logHeaders = [
  { title: 'Fecha', key: 'created_at', sortable: false },
  { title: 'Evento', key: 'event', sortable: false },
  { title: 'Usuario', key: 'user', sortable: false },
  { title: 'Plataforma', key: 'platform', sortable: false },
  { title: 'IP', key: 'ip_address', sortable: false },
  { title: 'Detalle', key: 'detail', sortable: false },
]
</script>

<template>
  <VCard>
    <VCardText class="pb-0">
      <div class="mb-4">
        <h4 class="text-h4">
          Sesiones y accesos
        </h4>
        <div class="text-body-2 text-medium-emphasis">
          Sesiones abiertas por dispositivo (web y app) y bitácora de ingresos.
        </div>
      </div>
      <VTabs v-model="tab">
        <VTab value="sessions" prepend-icon="tabler-devices">
          Sesiones
        </VTab>
        <VTab value="logs" prepend-icon="tabler-history">
          Log de accesos
        </VTab>
      </VTabs>
    </VCardText>

    <VDivider />

    <VWindow v-model="tab">
      <!-- Sesiones -->
      <VWindowItem value="sessions">
        <VCardText>
          <VRow>
            <VCol cols="12" md="6">
              <AppTextField v-model="sessions.search.value" placeholder="Buscar por usuario, dispositivo o IP" prepend-inner-icon="tabler-search" clearable />
            </VCol>
            <VCol cols="12" sm="6" md="3">
              <AppSelect v-model="sessionFilters.platform" :items="PLATFORMS" placeholder="Plataforma" clearable />
            </VCol>
            <VCol cols="12" sm="6" md="3">
              <AppSelect v-model="sessionFilters.status" :items="[{ title: 'Solo activas', value: 'active' }, { title: 'Todas', value: 'all' }]" />
            </VCol>
          </VRow>
        </VCardText>

        <VDataTableServer v-model:options="sessions.options.value" v-bind="sessions.tableProps.value" :headers="sessionHeaders" no-data-text="No hay sesiones.">
          <template #item.user="{ item }">
            <div class="font-weight-medium text-high-emphasis">
              {{ item.user?.full_name }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ item.user?.username }}<span v-if="item.user?.company"> · {{ item.user.company }}</span>
            </div>
          </template>
          <template #item.device_name="{ item }">
            <div class="d-flex align-center gap-2">
              <VIcon :icon="item.platform === 'MOVIL' ? 'tabler-device-mobile' : 'tabler-device-desktop'" size="20" />
              <div>
                <div>{{ item.device_name || 'Desconocido' }}</div>
                <div v-if="item.device_id" class="text-caption text-disabled">
                  {{ item.device_id }}
                </div>
              </div>
            </div>
          </template>
          <template #item.last_used_at="{ item }">
            {{ formatDateTime(item.last_used_at) }}
          </template>
          <template #item.expires_at="{ item }">
            {{ formatDateTime(item.expires_at) }}
          </template>
          <template #item.is_active="{ item }">
            <div class="d-flex flex-wrap gap-1">
              <VChip :color="item.is_active ? 'success' : 'secondary'" size="small" label>
                {{ item.is_active ? 'Activa' : (item.revoked_at ? 'Cerrada' : 'Vencida') }}
              </VChip>
              <VChip v-if="item.is_current" color="primary" size="small" label>
                Esta sesión
              </VChip>
            </div>
            <div v-if="item.revoke_reason" class="text-caption text-medium-emphasis">
              {{ REVOKE_REASONS[item.revoke_reason] ?? item.revoke_reason }}{{ item.revoked_by ? ` · ${item.revoked_by}` : '' }}
            </div>
          </template>
          <template #item.actions="{ item }">
            <IconBtn v-if="item.is_active && !item.is_current && $can('ELIMINAR', 'SEG_SES')" @click="revoke(item)">
              <VIcon icon="tabler-plug-connected-x" />
              <VTooltip activator="parent">
                Cerrar sesión
              </VTooltip>
            </IconBtn>
          </template>
        </VDataTableServer>
      </VWindowItem>

      <!-- Log de accesos -->
      <VWindowItem value="logs">
        <VCardText>
          <VRow>
            <VCol cols="12" md="4">
              <AppTextField v-model="logs.search.value" placeholder="Buscar por usuario digitado o IP" prepend-inner-icon="tabler-search" clearable />
            </VCol>
            <VCol cols="12" sm="6" md="2">
              <AppSelect v-model="logFilters.event" :items="EVENTS" placeholder="Evento" clearable />
            </VCol>
            <VCol cols="12" sm="6" md="2">
              <AppSelect v-model="logFilters.platform" :items="PLATFORMS" placeholder="Plataforma" clearable />
            </VCol>
            <VCol cols="12" sm="6" md="2">
              <AppDateTimePicker v-model="logFilters.date_from" placeholder="Desde" clearable />
            </VCol>
            <VCol cols="12" sm="6" md="2">
              <AppDateTimePicker v-model="logFilters.date_to" placeholder="Hasta" clearable />
            </VCol>
          </VRow>
        </VCardText>

        <VDataTableServer v-model:options="logs.options.value" v-bind="logs.tableProps.value" :headers="logHeaders" density="compact" no-data-text="Sin registros.">
          <template #item.created_at="{ item }">
            {{ formatDateTime(item.created_at) }}
          </template>
          <template #item.event="{ item }">
            <VChip :color="eventOf(item.event).color" size="small" label :prepend-icon="eventOf(item.event).icon">
              {{ eventOf(item.event).title }}
            </VChip>
          </template>
          <template #item.user="{ item }">
            <span v-if="item.user">{{ item.user.full_name }}</span>
            <span v-else class="text-medium-emphasis">{{ item.login }}</span>
          </template>
          <template #item.platform="{ item }">
            {{ item.platform === 'MOVIL' ? 'Móvil' : item.platform === 'WEB' ? 'Web' : '—' }}
          </template>
          <template #item.detail="{ item }">
            <span class="text-medium-emphasis">{{ item.detail || '—' }}</span>
          </template>
        </VDataTableServer>
      </VWindowItem>
    </VWindow>
  </VCard>
</template>
