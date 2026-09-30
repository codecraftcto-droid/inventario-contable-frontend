import { $api } from '@/utils/api'
import { extractApiMessage } from '@/utils/security'

/**
 * Tabla con paginación, búsqueda y orden EN EL SERVIDOR: solo se traen los
 * registros de la página visible, así la pantalla es igual de rápida con 100
 * o con 100 000 filas. Se usa con <VDataTableServer>.
 *
 * El backend responde { data: [...], meta: { total, ... } } y acepta
 * page, per_page, search, sort_by, sort_dir y los filtros que se pasen.
 *
 * @param {string|(() => string)} url      Endpoint (puede ser reactivo).
 * @param {object} options
 * @param {object} options.filters         Filtros reactivos extra (se envían como query).
 * @param {number} options.itemsPerPage    Tamaño de página inicial.
 */
export function useServerTable(url, { filters = reactive({}), itemsPerPage = 15 } = {}) {
  const items = ref([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')

  const options = ref({ page: 1, itemsPerPage, sortBy: [] })
  const search = ref('')
  const debouncedSearch = refDebounced(search, 400)

  let requestId = 0

  const load = async () => {
    const currentRequest = ++requestId
    const [sort] = options.value.sortBy ?? []

    loading.value = true
    error.value = ''

    try {
      const response = await $api(toValue(url), {
        query: {
          page: options.value.page,
          per_page: options.value.itemsPerPage,
          search: debouncedSearch.value || undefined,
          sort_by: sort?.key,
          sort_dir: sort?.order,
          ...Object.fromEntries(Object.entries(toRaw(filters)).filter(([, value]) => value !== null && value !== '' && value !== undefined)),
        },
      })

      // Si llegó una respuesta más nueva mientras tanto, se descarta esta.
      if (currentRequest !== requestId)
        return

      items.value = response.data
      total.value = response.meta?.total ?? response.data.length
    }
    catch (err) {
      if (currentRequest === requestId)
        error.value = extractApiMessage(err, 'No se pudo cargar la información.')
    }
    finally {
      if (currentRequest === requestId)
        loading.value = false
    }
  }

  // Al cambiar la búsqueda o un filtro se vuelve a la primera página.
  watch([debouncedSearch, () => ({ ...filters })], () => {
    if (options.value.page !== 1)
      options.value = { ...options.value, page: 1 }
    else
      load()
  }, { deep: true })

  watch(options, load, { deep: true })

  /** Props para <VDataTableServer v-bind="tableProps" v-model:options="options"> */
  const tableProps = computed(() => ({
    items: items.value,
    itemsLength: total.value,
    loading: loading.value,
    itemsPerPageOptions: [
      { value: 10, title: '10' },
      { value: 15, title: '15' },
      { value: 25, title: '25' },
      { value: 50, title: '50' },
      { value: 100, title: '100' },
    ],
  }))

  return { items, total, loading, error, options, search, filters, load, reload: load, tableProps }
}
