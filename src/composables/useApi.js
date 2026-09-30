import { createFetch } from '@vueuse/core'
import { destr } from 'destr'
import { clearAuthState } from '@/utils/auth'
import { getStoredAccessToken } from '@/utils/auth-storage'

export const useApi = createFetch({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1',
  fetchOptions: {
    headers: {
      Accept: 'application/json',
    },
  },
  options: {
    refetch: true,
    async beforeFetch({ options }) {
      const accessToken = getStoredAccessToken()

      if (accessToken) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
        }
      }

      return { options }
    },
    afterFetch(ctx) {
      const { data, response } = ctx

      let parsedData = null

      try {
        parsedData = destr(data)
      }
      catch (error) {
        console.error(error)
      }

      return { data: parsedData, response }
    },
    async onFetchError(ctx) {
      const { error, response } = ctx

      if (response?.status === 401 || error?.message?.includes('Unauthenticated'))
        clearAuthState()

      return ctx
    },
  },
})
