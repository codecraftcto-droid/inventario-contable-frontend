<script setup>
import { useTheme } from 'vuetify'
import { hexToRgb } from '@core/utils/colorConverter'
import { $api } from '@/utils/api'
import {
  formatDate,
  formatDateTime,
  formatQuantity,
  inventoryStatus,
  POCKET_STATUSES,
  reconciliationStatus,
  RECONCILIATION_STATUSES,
  scanCondition,
} from '@/utils/constants'
import { extractApiMessage } from '@/utils/security'

definePage({ meta: { action: 'VER', subject: 'DASH' } })

/**
 * Dashboard del inicio, siempre de UN inventario.
 * - Personal interno: combo de empresas y luego sus inventarios.
 * - Usuario de una empresa: combo con los inventarios de su empresa.
 * Por defecto el servidor elige la empresa y el inventario más recientes.
 * Mientras la toma está en proceso se actualiza sola cada 20 s.
 */
const REFRESH_MS = 20000

const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const updatedAt = ref(null)

const kpis = ref([])
const companies = ref([])
const inventories = ref([])
const companyId = ref(null)
const inventoryId = ref(null)
const inventory = ref(null)
const stats = ref(null)

const isInternal = ref(false)

const load = async ({ silent = false } = {}) => {
  silent ? (refreshing.value = true) : (loading.value = true)
  try {
    const { data } = await $api('/dashboard', {
      query: { company_id: companyId.value || undefined, inventory_id: inventoryId.value || undefined },
    })

    kpis.value = data.kpis
    isInternal.value = data.filters.is_internal
    companies.value = data.filters.companies
    inventories.value = data.filters.inventories
    companyId.value = data.filters.company_id
    inventoryId.value = data.filters.inventory_id
    inventory.value = data.inventory
    stats.value = data.stats
    updatedAt.value = new Date()
    error.value = ''
  }
  catch (err) {
    error.value = extractApiMessage(err)
  }
  finally {
    loading.value = false
    refreshing.value = false
  }
}

// Al cambiar de empresa se muestra su inventario más reciente.
const selectCompany = value => {
  companyId.value = value
  inventoryId.value = null
  load()
}

const selectInventory = value => {
  inventoryId.value = value
  load()
}

// --- Actualización automática (solo con la toma en curso y la pestaña visible) ---
const visibility = useDocumentVisibility()
const live = computed(() => inventory.value?.status === 'EN_PROCESO')

useIntervalFn(() => {
  if (live.value && visibility.value === 'visible' && !loading.value && !refreshing.value)
    load({ silent: true })
}, REFRESH_MS)

onMounted(load)

// ------------------------------------------------------------------ Formato
const inventoryItems = computed(() => inventories.value.map(item => ({
  value: item.id,
  title: `${item.code} · ${item.name}`,
  status: item.status,
  created_at: item.created_at,
})))

const companyItems = computed(() => companies.value.map(item => ({ value: item.id, title: item.name })))
const percent = value => `${Number(value ?? 0).toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`
const shortDay = value => {
  const [, month, day] = value.split('-')

  return `${day}/${month}`
}

const globalIcons = {
  companies: 'tabler-building-skyscraper',
  client_users: 'tabler-users',
  inventories_pendiente: 'tabler-clock',
  inventories_en_proceso: 'tabler-player-play',
  inventories_pausado: 'tabler-player-pause',
  inventories_cerrado: 'tabler-flag-check',
}

const summaryCards = computed(() => {
  const s = stats.value

  return [
    { title: 'Productos en la base', value: formatQuantity(s.base.products), hint: `${formatQuantity(s.base.units)} unidades`, icon: 'tabler-database', color: 'primary' },
    { title: 'Productos encontrados', value: formatQuantity(s.found_products), hint: `${percent(s.progress)} de la base`, icon: 'tabler-circle-check', color: 'success' },
    { title: 'Registros', value: formatQuantity(s.records), hint: s.last_scan_at ? `Último: ${formatDateTime(s.last_scan_at)}` : 'Sin registros aún', icon: 'tabler-barcode', color: 'info' },
    { title: 'Unidades contadas', value: formatQuantity(s.units), hint: `de ${formatQuantity(s.base.units)} en la base`, icon: 'tabler-stack-2', color: 'warning' },
    { title: 'Inventariadores', value: formatQuantity(s.assignees), hint: `${s.by_user.length} con registros`, icon: 'tabler-users', color: 'secondary' },
    { title: 'Pockets', value: formatQuantity(s.pockets.total), hint: `${s.pockets.statuses.TERMINADO} terminado(s)`, icon: 'tabler-layout-grid', color: 'error' },
  ]
})

// ------------------------------------------------------------------ Gráficos
const vuetifyTheme = useTheme()

// En el tema claro "info" es gris (marca); en los gráficos se usan tonos que se distingan.
const CHART_COLORS = { info: '#3BA3C7', secondary: '#A8AAAE' }

const theme = computed(() => {
  const { colors, variables } = vuetifyTheme.current.value
  const onSurface = hexToRgb(colors['on-surface'])

  return {
    color: name => CHART_COLORS[name] ?? colors[name] ?? CHART_COLORS.secondary,
    text: `rgba(${onSurface},${variables['medium-emphasis-opacity']})`,
    strong: `rgba(${onSurface},${variables['high-emphasis-opacity']})`,
    border: `rgba(${hexToRgb(String(variables['border-color']))},${variables['border-opacity']})`,
    track: `rgba(${onSurface},0.08)`,
  }
})

const baseOptions = computed(() => ({
  chart: { parentHeightOffset: 0, toolbar: { show: false }, fontFamily: 'inherit', foreColor: theme.value.text },
  grid: { borderColor: theme.value.border, strokeDashArray: 6, padding: { top: -10 } },
  legend: { labels: { colors: theme.value.text }, markers: { offsetX: -3 }, itemMargin: { horizontal: 10 } },
  dataLabels: { enabled: false },
  tooltip: { theme: vuetifyTheme.current.value.dark ? 'dark' : 'light' },
  noData: { text: 'Sin datos todavía', style: { color: theme.value.text } },
}))

const donutOptions = (labels, colors, totalLabel, formatter = formatQuantity) => ({
  ...baseOptions.value,
  labels,
  colors,
  stroke: { width: 0 },
  legend: { ...baseOptions.value.legend, position: 'bottom' },
  dataLabels: { enabled: true, formatter: value => percent(value), dropShadow: { enabled: false } },
  tooltip: { ...baseOptions.value.tooltip, y: { formatter } },
  plotOptions: {
    pie: {
      donut: {
        size: '70%',
        labels: {
          show: true,
          value: { fontSize: '1.5rem', fontWeight: 600, color: theme.value.strong, formatter: value => formatter(value) },
          name: { color: theme.value.text },
          total: {
            show: true,
            label: totalLabel,
            color: theme.value.text,
            formatter: chart => formatter(chart.globals.seriesTotals.reduce((sum, value) => sum + value, 0)),
          },
        },
      },
    },
  },
})

// Avance: productos de la base con al menos un registro
const progressChart = computed(() => ({
  series: [Number(stats.value.progress)],
  options: {
    ...baseOptions.value,
    colors: [theme.value.color('primary')],
    plotOptions: {
      radialBar: {
        hollow: { size: '62%' },
        track: { background: theme.value.track, strokeWidth: '100%' },
        dataLabels: {
          name: { offsetY: 24, color: theme.value.text, fontSize: '0.9rem' },
          value: { offsetY: -14, color: theme.value.strong, fontSize: '2rem', fontWeight: 600, formatter: value => percent(value) },
        },
      },
    },
    stroke: { lineCap: 'round' },
    labels: ['Avance'],
  },
}))

// Conciliación: productos por estado
const reconciliationChart = computed(() => {
  const rows = RECONCILIATION_STATUSES.map(status => stats.value.reconciliation.find(row => row.status === status.value))

  return {
    series: rows.map(row => row?.products ?? 0),
    options: donutOptions(RECONCILIATION_STATUSES.map(status => status.title), RECONCILIATION_STATUSES.map(status => theme.value.color(status.color)), 'Productos'),
  }
})

// Avance diario: registros por día + avance acumulado
const timelineChart = computed(() => {
  const days = stats.value.timeline

  return {
    series: [
      { name: 'Registros', type: 'column', data: days.map(day => day.records) },
      { name: 'Productos nuevos', type: 'column', data: days.map(day => day.new_products) },
      { name: 'Avance acumulado', type: 'line', data: days.map(day => day.progress) },
    ],
    options: {
      ...baseOptions.value,
      colors: [theme.value.color('info'), theme.value.color('success'), theme.value.color('primary')],
      stroke: { width: [0, 0, 3], curve: 'smooth' },
      markers: { size: [0, 0, 4] },
      plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
      legend: { ...baseOptions.value.legend, position: 'top', horizontalAlign: 'left' },
      xaxis: { categories: days.map(day => shortDay(day.date)), axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: [
        { seriesName: 'Registros', min: 0, forceNiceScale: true, title: { text: 'Cantidad' }, labels: { formatter: value => formatQuantity(Math.round(value)) } },
        { seriesName: 'Registros', show: false },
        { seriesName: 'Avance acumulado', opposite: true, min: 0, max: 100, title: { text: 'Avance %' }, labels: { formatter: value => `${Math.round(value)}%` } },
      ],
      tooltip: {
        ...baseOptions.value.tooltip,
        shared: true,
        intersect: false,
        y: { formatter: (value, { seriesIndex }) => (seriesIndex === 2 ? percent(value) : formatQuantity(value)) },
      },
    },
  }
})

// Estado de conservación (registros)
const conditionChart = computed(() => {
  const rows = stats.value.by_condition

  return {
    series: rows.map(row => row.records),
    options: donutOptions(
      rows.map(row => scanCondition(row.condition)?.title ?? 'Sin dato'),
      rows.map(row => theme.value.color(scanCondition(row.condition)?.color ?? 'secondary')),
      'Registros',
    ),
  }
})

// Unidades por sede (ubicación)
const siteChart = computed(() => {
  const rows = stats.value.by_site

  return {
    series: [{ name: 'Unidades', data: rows.map(row => row.units) }],
    options: {
      ...baseOptions.value,
      colors: [theme.value.color('warning')],
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '55%', distributed: false } },
      dataLabels: { enabled: true, formatter: value => formatQuantity(value), style: { colors: ['#fff'] } },
      xaxis: { categories: rows.map(row => row.site), labels: { formatter: value => formatQuantity(value) } },
      tooltip: { ...baseOptions.value.tooltip, y: { formatter: (value, { dataPointIndex }) => `${formatQuantity(value)} und · ${rows[dataPointIndex]?.records ?? 0} registros` } },
    },
  }
})

// Pockets por estado
const pocketChart = computed(() => ({
  series: POCKET_STATUSES.map(status => stats.value.pockets.statuses[status.value] ?? 0),
  options: donutOptions(POCKET_STATUSES.map(status => status.title), POCKET_STATUSES.map(status => theme.value.color(status.color)), 'Pockets'),
}))

// Registros por inventariador
const userChart = computed(() => {
  const rows = stats.value.by_user

  return {
    series: [
      { name: 'Registros', data: rows.map(row => row.records) },
      { name: 'Unidades', data: rows.map(row => row.units) },
    ],
    options: {
      ...baseOptions.value,
      colors: [theme.value.color('primary'), theme.value.color('info')],
      plotOptions: { bar: { columnWidth: '50%', borderRadius: 4 } },
      legend: { ...baseOptions.value.legend, position: 'top', horizontalAlign: 'left' },
      xaxis: { categories: rows.map(row => row.user), labels: { trim: true, hideOverlappingLabels: false } },
      yaxis: { min: 0, forceNiceScale: true, labels: { formatter: value => formatQuantity(Math.round(value)) } },
      tooltip: { ...baseOptions.value.tooltip, shared: true, intersect: false, y: { formatter: value => formatQuantity(value) } },
    },
  }
})

const hasRecords = computed(() => (stats.value?.records ?? 0) > 0)
</script>

<template>
  <section class="d-flex flex-column gap-6">
    <!-- Encabezado y selección -->
    <VCard>
      <VCardText class="d-flex flex-wrap align-center gap-4">
        <div class="flex-grow-1" style="min-inline-size: 220px;">
          <h4 class="text-h4 mb-1">
            Dashboard
          </h4>
          <div class="text-body-2 text-medium-emphasis">
            {{ isInternal ? 'Elige una empresa y uno de sus inventarios.' : 'Avance y resultados de los inventarios de tu empresa.' }}
          </div>
        </div>

        <AppSelect
          v-if="isInternal"
          :model-value="companyId"
          :items="companyItems"
          placeholder="Empresa"
          prepend-inner-icon="tabler-building"
          class="filter-select"
          style="--filter-width: 17rem;"
          @update:model-value="selectCompany"
        />
        <AppSelect
          :model-value="inventoryId"
          :items="inventoryItems"
          :disabled="!inventoryItems.length"
          placeholder="Inventario"
          prepend-inner-icon="tabler-clipboard-list"
          class="filter-select"
          style="--filter-width: 22rem;"
          no-data-text="Sin inventarios"
          @update:model-value="selectInventory"
        >
          <template #item="{ props: itemProps, item }">
            <VListItem v-bind="itemProps" :subtitle="`Registrado ${formatDate(item.raw.created_at)}`">
              <template #append>
                <VChip :color="inventoryStatus(item.raw.status).color" size="x-small" label>
                  {{ inventoryStatus(item.raw.status).title }}
                </VChip>
              </template>
            </VListItem>
          </template>
        </AppSelect>

        <VBtn icon variant="tonal" :loading="loading || refreshing" @click="load()">
          <VIcon icon="tabler-refresh" />
          <VTooltip activator="parent">
            Actualizar
          </VTooltip>
        </VBtn>
      </VCardText>
    </VCard>

    <VAlert v-if="error" type="error" variant="tonal" density="compact">
      {{ error }}
    </VAlert>

    <!-- Resumen general (solo personal interno) -->
    <VCard v-if="isInternal && kpis.length" title="Resumen general">
      <VCardText class="pt-2">
        <VRow>
          <VCol v-for="kpi in kpis" :key="kpi.key" cols="6" md="4" lg="2">
            <div class="d-flex align-center gap-3">
              <VAvatar color="primary" variant="tonal" rounded size="38">
                <VIcon :icon="globalIcons[kpi.key] ?? 'tabler-chart-bar'" size="22" />
              </VAvatar>
              <div>
                <h5 class="text-h5">
                  {{ kpi.value }}
                </h5>
                <div class="text-caption text-medium-emphasis">
                  {{ kpi.label }}
                </div>
              </div>
            </div>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <VProgressLinear v-if="loading && !stats" indeterminate color="primary" />

    <!-- Sin inventarios -->
    <VCard v-else-if="!inventory && !loading">
      <VCardText class="text-center py-12">
        <VAvatar color="primary" variant="tonal" size="64" class="mb-4">
          <VIcon icon="tabler-clipboard-off" size="34" />
        </VAvatar>
        <h5 class="text-h5 mb-1">
          Aún no hay inventarios para mostrar
        </h5>
        <div class="text-body-2 text-medium-emphasis">
          {{ isInternal ? 'Cuando registres un inventario verás aquí su avance.' : 'Cuando tu empresa tenga un inventario, verás aquí su avance.' }}
        </div>
      </VCardText>
    </VCard>

    <template v-else-if="inventory && stats">
      <!-- Inventario elegido + avance -->
      <VRow class="match-height">
        <VCol cols="12" lg="4">
          <VCard>
            <VCardItem>
              <VCardTitle>{{ inventory.name }}</VCardTitle>
              <VCardSubtitle>{{ inventory.code }} · {{ inventory.company }}</VCardSubtitle>
              <template #append>
                <VChip :color="inventoryStatus(inventory.status).color" label size="small">
                  <VIcon v-if="live" icon="tabler-point-filled" size="14" start class="live-dot" />
                  {{ inventory.status_label }}
                </VChip>
              </template>
            </VCardItem>
            <VCardText class="pb-0">
              <VueApexCharts type="radialBar" height="250" :options="progressChart.options" :series="progressChart.series" />
              <div class="text-center text-body-2 text-medium-emphasis mt-n2">
                {{ formatQuantity(stats.found_products) }} de {{ formatQuantity(stats.base.products) }} productos de la base con registros
              </div>
            </VCardText>
            <VCardText>
              <VList density="compact" class="py-0 card-list">
                <VListItem v-if="inventory.start_date" prepend-icon="tabler-calendar" title="Fecha programada" :subtitle="formatDate(inventory.start_date)" />
                <VListItem prepend-icon="tabler-player-play" title="Iniciado" :subtitle="inventory.started_at ? formatDateTime(inventory.started_at) : 'Aún no inicia'" />
                <VListItem v-if="inventory.status === 'PAUSADO'" prepend-icon="tabler-player-pause" title="En pausa desde" :subtitle="formatDateTime(inventory.paused_at)" />
                <VListItem v-if="inventory.closed_at" prepend-icon="tabler-flag-check" title="Finalizado" :subtitle="formatDateTime(inventory.closed_at)" />
              </VList>
              <div v-if="updatedAt" class="text-caption text-disabled mt-3">
                Actualizado {{ updatedAt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}<template v-if="live">
                  · se actualiza solo cada 20 s
                </template>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <VCol cols="12" lg="8">
          <VRow class="match-height">
            <VCol v-for="card in summaryCards" :key="card.title" cols="6" md="4">
              <VCard>
                <VCardText>
                  <VAvatar :color="card.color" variant="tonal" rounded size="40" class="mb-3">
                    <VIcon :icon="card.icon" size="24" />
                  </VAvatar>
                  <h4 class="text-h4">
                    {{ card.value }}
                  </h4>
                  <div class="text-body-1 font-weight-medium">
                    {{ card.title }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ card.hint }}
                  </div>
                </VCardText>
              </VCard>
            </VCol>
          </VRow>
        </VCol>
      </VRow>

      <!-- Conciliación + avance diario -->
      <VRow class="match-height">
        <VCol cols="12" lg="5">
          <VCard title="Conciliación" subtitle="Productos por estado frente a la base contable">
            <VCardText>
              <VueApexCharts type="donut" height="300" :options="reconciliationChart.options" :series="reconciliationChart.series" />
              <VTable density="compact" class="mt-4 compact-table">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th class="text-end">
                      Productos
                    </th>
                    <th class="text-end d-none d-sm-table-cell">
                      Unidades (reg. / base)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in stats.reconciliation" :key="row.status">
                    <td class="text-no-wrap">
                      <VIcon :icon="reconciliationStatus(row.status).icon" :color="reconciliationStatus(row.status).color" size="18" class="me-1" />
                      {{ row.label }}
                    </td>
                    <td class="text-end font-weight-medium">
                      {{ formatQuantity(row.products) }}
                    </td>
                    <td class="text-end text-no-wrap d-none d-sm-table-cell">
                      {{ formatQuantity(row.counted) }} / {{ formatQuantity(row.expected) }}
                    </td>
                  </tr>
                </tbody>
              </VTable>
            </VCardText>
          </VCard>
        </VCol>

        <VCol cols="12" lg="7">
          <VCard title="Avance diario" subtitle="Registros por día y porcentaje acumulado de la base encontrada">
            <VCardText>
              <VueApexCharts v-if="stats.timeline.length" type="line" height="420" :options="timelineChart.options" :series="timelineChart.series" />
              <div v-else class="empty-chart">
                <VIcon icon="tabler-chart-line" size="36" class="text-disabled mb-2" />
                <div>Aún no hay registros en esta toma.</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Sede, conservación y pockets -->
      <VRow class="match-height">
        <VCol cols="12" md="6" lg="4">
          <VCard title="Unidades por sede" subtitle="Ubicación elegida en cada registro">
            <VCardText>
              <VueApexCharts v-if="stats.by_site.length" type="bar" :height="Math.max(220, stats.by_site.length * 48)" :options="siteChart.options" :series="siteChart.series" />
              <div v-else class="empty-chart">
                <VIcon icon="tabler-map-pin" size="36" class="text-disabled mb-2" />
                <div>Sin registros por sede.</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" md="6" lg="4">
          <VCard title="Estado de conservación" subtitle="Registros por estado del bien">
            <VCardText>
              <VueApexCharts v-if="hasRecords" type="donut" height="300" :options="conditionChart.options" :series="conditionChart.series" />
              <div v-else class="empty-chart">
                <VIcon icon="tabler-mood-smile" size="36" class="text-disabled mb-2" />
                <div>Sin registros todavía.</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" md="6" lg="4">
          <VCard title="Pockets" subtitle="Zonas de conteo por estado">
            <VCardText>
              <VueApexCharts v-if="stats.pockets.total" type="donut" height="300" :options="pocketChart.options" :series="pocketChart.series" />
              <div v-else class="empty-chart">
                <VIcon icon="tabler-layout-grid" size="36" class="text-disabled mb-2" />
                <div>Este inventario no usa pockets.</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Inventariadores + mayores diferencias -->
      <VRow class="match-height">
        <VCol cols="12" lg="6">
          <VCard title="Registros por inventariador" subtitle="Los 10 con más registros">
            <VCardText>
              <VueApexCharts v-if="stats.by_user.length" type="bar" height="320" :options="userChart.options" :series="userChart.series" />
              <div v-else class="empty-chart">
                <VIcon icon="tabler-users" size="36" class="text-disabled mb-2" />
                <div>Nadie ha registrado todavía.</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" lg="6">
          <VCard title="Mayores diferencias" subtitle="Productos a revisar primero (diferencia en unidades)">
            <VTable v-if="stats.top_differences.length" class="text-no-wrap">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th class="text-end">
                    Base
                  </th>
                  <th class="text-end">
                    Registrado
                  </th>
                  <th class="text-end">
                    Diferencia
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in stats.top_differences" :key="row.code">
                  <td>
                    <div class="font-weight-medium">
                      {{ row.code }}
                    </div>
                    <div class="text-caption d-flex align-center gap-2">
                      <span class="text-truncate" style="max-inline-size: 14rem;">{{ row.name ?? 'No está en la base' }}</span>
                      <VChip :color="reconciliationStatus(row.status).color" size="x-small" label>
                        {{ reconciliationStatus(row.status).title }}
                      </VChip>
                    </div>
                  </td>
                  <td class="text-end">
                    {{ formatQuantity(row.expected) }}
                  </td>
                  <td class="text-end">
                    {{ formatQuantity(row.counted) }}
                  </td>
                  <td class="text-end font-weight-medium" :class="row.difference > 0 ? 'text-info' : 'text-error'">
                    {{ row.difference > 0 ? '+' : '' }}{{ formatQuantity(row.difference) }}
                  </td>
                </tr>
              </tbody>
            </VTable>
            <VCardText v-else>
              <div class="empty-chart">
                <VIcon icon="tabler-circle-check" size="36" class="text-success mb-2" />
                <div>Sin diferencias: todo lo registrado coincide con la base.</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </template>
  </section>
</template>

<style scoped>
.filter-select {
  inline-size: var(--filter-width);
  max-inline-size: 100%;
}

.compact-table :deep(th),
.compact-table :deep(td) {
  padding-inline: 8px !important;
}

.empty-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  min-block-size: 220px;
  text-align: center;
}

.card-list :deep(.v-list-item) {
  padding-inline: 0 !important;
}

.live-dot {
  animation: live-pulse 1.4s ease-in-out infinite;
}

@keyframes live-pulse {
  50% { opacity: 0.3; }
}
</style>
