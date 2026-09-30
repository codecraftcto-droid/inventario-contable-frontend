import { getStoredAccessToken } from './auth-storage'

export const getLoginPath = () => '/login'

export const getDashboardPath = () => '/dashboard'

export const getChangePasswordPath = () => '/change-password'

export const isAuthenticated = () => !!(getStoredAccessToken() && useCookie('userData').value)

/**
 * Primera ruta disponible en el menú del usuario (para roles sin Dashboard).
 */
export const firstMenuPath = nodes => {
  for (const node of nodes ?? []) {
    if (node.path)
      return node.path

    const childPath = firstMenuPath(node.children)
    if (childPath)
      return childPath
  }

  return null
}
