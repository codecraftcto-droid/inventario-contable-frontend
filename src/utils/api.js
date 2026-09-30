import { ofetch } from 'ofetch'
import { applySession, clearAuthState } from './auth'
import { getChangePasswordPath } from './auth-context'
import { getStoredAccessToken, getStoredRefreshToken } from './auth-storage'

export const apiBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

const rawApi = ofetch.create({
  baseURL: apiBaseURL,
  headers: { Accept: 'application/json' },
  onRequest({ options }) {
    const accessToken = getStoredAccessToken()
    const headers = new Headers(options.headers ?? {})

    if (accessToken)
      headers.set('Authorization', `Bearer ${accessToken}`)

    options.headers = headers
  },
})

const isAuthEndpoint = url => /\/security\/auth\/(login|refresh)/.test(String(url))

// Una sola renovación compartida aunque varias peticiones reciban 401 a la vez.
let refreshing = null

const refreshSession = async () => {
  const refreshToken = getStoredRefreshToken()
  if (!refreshToken)
    throw new Error('Sin refresh token')

  const response = await rawApi('/security/auth/refresh', { method: 'POST', body: { refresh_token: refreshToken } })

  applySession(response.data)
}

/**
 * Cliente de la API. Si el access token venció, lo renueva con el refresh token y
 * reintenta una vez; si la sesión terminó (revocada/expirada) vuelve al login.
 */
export const $api = async (url, options = {}) => {
  try {
    return await rawApi(url, options)
  }
  catch (error) {
    const status = error?.response?.status
    const code = error?.data?.code

    if (status === 401 && !isAuthEndpoint(url) && !options._retried && getStoredRefreshToken()) {
      try {
        refreshing ??= refreshSession().finally(() => { refreshing = null })
        await refreshing

        return await rawApi(url, { ...options, _retried: true })
      }
      catch {
        // El refresh también falló: la sesión terminó.
      }
    }

    if (status === 401 && !isAuthEndpoint(url))
      clearAuthState()

    if (status === 403 && code === 'PASSWORD_CHANGE_REQUIRED' && window.location.pathname !== getChangePasswordPath())
      window.location.assign(getChangePasswordPath())

    throw error
  }
}

/**
 * Descarga un archivo (Excel) respetando la autenticación.
 */
export const downloadFile = async (url, fileName, options = {}) => {
  const blob = await $api(url, { ...options, responseType: 'blob' })
  const link = document.createElement('a')

  link.href = URL.createObjectURL(blob)
  link.download = fileName
  link.click()
  URL.revokeObjectURL(link.href)
}
