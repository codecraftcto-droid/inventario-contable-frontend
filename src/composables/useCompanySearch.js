import { $api } from '@/utils/api'

/**
 * Autocompletado de empresas con búsqueda en el servidor (nunca se cargan todas).
 * Uso: <AppAutocomplete v-model:search="search" :items="items" :loading="loading" no-filter />
 */
export function useCompanySearch({ onlyActive = true, limit = 20 } = {}) {
  const items = ref([])
  const search = ref('')
  const loading = ref(false)

  const toItem = company => ({ title: `${company.code} · ${company.name}`, value: company.id })

  const fetch = useDebounceFn(async term => {
    loading.value = true
    try {
      const response = await $api('/companies', {
        query: { search: term || undefined, is_active: onlyActive ? 1 : undefined, per_page: limit },
      })

      items.value = response.data.map(toItem)
    }
    catch {
      items.value = []
    }
    finally {
      loading.value = false
    }
  }, 350)

  // Al elegir un ítem, Vuetify pone su título en "search": no se vuelve a buscar por eso.
  watch(search, term => {
    if (!items.value.some(item => item.title === term))
      fetch(term)
  })

  /** Asegura que la empresa actual (al editar) aparezca aunque no esté en la última búsqueda. */
  const ensure = company => {
    if (company && !items.value.some(item => item.value === company.id))
      items.value = [toItem(company), ...items.value]
  }

  return { items, search, loading, fetch, ensure }
}
