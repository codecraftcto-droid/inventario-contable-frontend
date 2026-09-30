<script setup>
/**
 * Matriz de permisos: filas = módulos/submódulos (jerarquía), columnas = acciones.
 * Cada celda es un permiso MODULO:ACCION; "—" si esa acción no está habilitada en el módulo.
 * Marcar la fila de un módulo marca también sus submódulos; marcar una columna, esa
 * acción en todos los módulos.
 *
 * v-model: arreglo de permission_id concedidos.
 */
const props = defineProps({
  actions: { type: Array, default: () => [] },
  modules: { type: Array, default: () => [] },
  readonly: { type: Boolean, default: false },
})

const selected = defineModel({ type: Array, default: () => [] })
const selectedSet = computed(() => new Set(selected.value))

const platformLabels = { WEB: 'Web', MOVIL: 'Móvil', AMBOS: 'Web y móvil' }

// Árbol aplanado con profundidad y los permisos propios / de todo el subárbol.
const rows = computed(() => {
  const out = []

  const walk = (nodes, depth) => {
    for (const node of nodes ?? []) {
      const row = { node, depth, own: Object.values(node.permissions ?? {}).map(cell => cell.permission_id), subtree: [] }

      out.push(row)

      const start = out.length

      walk(node.children, depth + 1)
      row.subtree = [...row.own, ...out.slice(start).flatMap(child => child.own)]
    }
  }

  walk(props.modules, 0)

  return out
})

const cellOf = (row, action) => row.node.permissions?.[action.code] ?? null
const columnIds = action => rows.value.map(row => cellOf(row, action)?.permission_id).filter(Boolean)

const stateOf = ids => {
  const granted = ids.filter(id => selectedSet.value.has(id)).length

  return { checked: ids.length > 0 && granted === ids.length, indeterminate: granted > 0 && granted < ids.length }
}

const setMany = (ids, value) => {
  const next = new Set(selected.value)

  ids.forEach(id => value ? next.add(id) : next.delete(id))
  selected.value = [...next]
}

const toggleMany = ids => setMany(ids, !stateOf(ids).checked)
</script>

<template>
  <VTable class="permission-matrix text-no-wrap" density="compact" fixed-header height="100%">
    <thead>
      <tr>
        <th class="module-col">
          Módulo / opción
        </th>
        <th v-for="action in actions" :key="action.id" class="text-center action-col">
          <div class="d-flex flex-column align-center gap-1 py-2">
            <VIcon :icon="action.icon || 'tabler-point'" size="18" />
            <span>{{ action.name }}</span>
            <VCheckboxBtn
              v-if="!readonly && columnIds(action).length"
              v-bind="stateOf(columnIds(action))"
              density="compact"
              @update:model-value="toggleMany(columnIds(action))"
            />
          </div>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.node.id" :class="{ 'group-row': row.node.children?.length }">
        <td class="module-col">
          <div class="d-flex align-center gap-2" :style="{ paddingInlineStart: `${row.depth * 24}px` }">
            <VCheckboxBtn
              v-if="!readonly && row.subtree.length"
              v-bind="stateOf(row.subtree)"
              class="flex-grow-0"
              density="compact"
              @update:model-value="toggleMany(row.subtree)"
            />
            <span v-else-if="!readonly" class="checkbox-placeholder" />
            <VIcon :icon="row.node.icon || 'tabler-point'" size="20" />
            <div>
              <span :class="row.depth === 0 ? 'font-weight-medium text-high-emphasis' : ''">{{ row.node.name }}</span>
              <span class="text-caption text-disabled ms-1">{{ row.node.code }}</span>
            </div>
            <VChip v-if="row.node.is_menu === false" size="x-small" label color="info" variant="tonal">
              Opción
            </VChip>
            <VChip size="x-small" label variant="tonal">
              {{ platformLabels[row.node.platform] }}
            </VChip>
          </div>
        </td>
        <td v-for="action in actions" :key="action.id" class="text-center action-col">
          <template v-if="cellOf(row, action)">
            <VCheckboxBtn
              class="d-inline-flex"
              :model-value="selectedSet.has(cellOf(row, action).permission_id)"
              :disabled="readonly"
              density="compact"
              @update:model-value="value => setMany([cellOf(row, action).permission_id], value)"
            />
          </template>
          <span v-else class="text-disabled">—</span>
        </td>
      </tr>
    </tbody>
  </VTable>
</template>

<style scoped>
.permission-matrix .module-col {
  min-inline-size: 300px;
}

.permission-matrix .checkbox-placeholder {
  inline-size: 28px;
}

.permission-matrix .action-col {
  min-inline-size: 88px;
}

.permission-matrix .group-row {
  background: rgba(var(--v-theme-on-surface), 0.03);
}
</style>
