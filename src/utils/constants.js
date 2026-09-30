export const INVENTORY_STATUSES = [
  { value: 'PENDIENTE', title: 'Pendiente', color: 'warning' },
  { value: 'EN_PROCESO', title: 'En proceso', color: 'info' },
  { value: 'PAUSADO', title: 'Pausado', color: 'secondary' },
  { value: 'CERRADO', title: 'Finalizado', color: 'success' },
]

export const inventoryStatus = value => INVENTORY_STATUSES.find(status => status.value === value) ?? { title: value, color: 'secondary' }

// Resultado de cada lectura de la toma (lo decide el servidor).
export const SCAN_OUTCOMES = [
  { value: 'FOUND', title: 'En base', color: 'success', icon: 'tabler-circle-check' },
  { value: 'SURPLUS', title: 'Sobrante', color: 'warning', icon: 'tabler-help-circle' },
  { value: 'DUPLICATE', title: 'Repetido (antiguo)', color: 'secondary', icon: 'tabler-copy' },
]

// Estado de conservación de cada registro de la toma (como el APK de suministros).
export const SCAN_CONDITIONS = [
  { value: 'BUENO', title: 'Bueno', color: 'success' },
  { value: 'REGULAR', title: 'Regular', color: 'warning' },
  { value: 'MALO', title: 'Malo', color: 'error' },
]

export const scanCondition = value => SCAN_CONDITIONS.find(condition => condition.value === value) ?? null

// Estado de cada producto al conciliar la toma con la base contable.
export const RECONCILIATION_STATUSES = [
  { value: 'CONCILIADO', title: 'Conciliado', color: 'success', icon: 'tabler-circle-check', hint: 'Registrado = base' },
  { value: 'FALTANTE', title: 'Faltante', color: 'error', icon: 'tabler-alert-triangle', hint: 'En la base, sin registros' },
  { value: 'DIFERENCIA_NEGATIVA', title: 'Diferencia negativa', color: 'warning', icon: 'tabler-trending-down', hint: 'Registrado < base' },
  { value: 'DIFERENCIA_POSITIVA', title: 'Diferencia positiva', color: 'info', icon: 'tabler-trending-up', hint: 'Registrado > base' },
  { value: 'SOBRANTE', title: 'Sobrante', color: 'secondary', icon: 'tabler-help-circle', hint: 'Registrado, no está en la base' },
]

export const reconciliationStatus = value => RECONCILIATION_STATUSES.find(status => status.value === value) ?? { title: value, color: 'secondary', icon: 'tabler-point' }

export const formatQuantity = value => Number(value ?? 0).toLocaleString('es-PE', { maximumFractionDigits: 2 })

export const scanOutcome = value => SCAN_OUTCOMES.find(outcome => outcome.value === value) ?? { title: value, color: 'secondary', icon: 'tabler-point' }

export const formatDate = value => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(`${value}`.length === 10 ? `${value}T00:00:00` : value)) : '—'

export const formatDateTime = value => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'

export const formatShortDateTime = value => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'

export const formatMoney = value => new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0))

// Pockets: zonas / tandas de conteo del inventario asignadas a inventariadores.
export const POCKET_STATUSES = [
  { value: 'PENDIENTE', title: 'Pendiente', color: 'secondary' },
  { value: 'EN_CONTEO', title: 'En conteo', color: 'info' },
  { value: 'TERMINADO', title: 'Terminado', color: 'success' },
]

export const pocketStatus = value => POCKET_STATUSES.find(status => status.value === value) ?? { title: value, color: 'secondary' }
