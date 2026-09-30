import { ability } from '@/plugins/casl/ability'
import { clearStoredTokens, storeTokens } from './auth-storage'
import { getLoginPath } from './auth-context'

const RULES_KEY = 'userAbilityRules'
const MENU_KEY = 'userMenu'

/**
 * Menú en árbol que devuelve el backend (ya filtrado por permisos y plataforma).
 * Es reactivo para que el menú lateral se actualice al renovar la sesión.
 */
export const sessionMenu = ref(readJson(MENU_KEY, []))

/**
 * Permisos MODULO:ACCION → reglas CASL { subject: MODULO, action: ACCION }.
 * En plantillas: $can('IMPORTAR', 'INV_BASE'). El superusuario puede todo.
 */
export const buildAbilityRules = (permissions, isRootAdmin = false) => {
  if (isRootAdmin)
    return [{ action: 'manage', subject: 'all' }]

  return (permissions ?? [])
    .filter(Boolean)
    .map(permission => {
      const [subject, action] = String(permission).split(':')

      return { action, subject }
    })
}

export const getStoredAbilityRules = () => readJson(RULES_KEY, [])

/**
 * Aplica la respuesta de login / refresh / me / change-password.
 */
export const applySession = payload => {
  if (!payload?.user)
    return

  storeTokens(payload)

  const user = payload.user
  const rules = buildAbilityRules(payload.permissions, user.is_root_admin)

  // Cookie compacta (límite de 4 KB); menú y reglas van en localStorage.
  useCookie('userData').value = {
    id: user.id,
    username: user.username,
    email: user.email,
    document_number: user.document_number,
    first_name: user.first_name,
    last_name: user.last_name,
    full_name: user.full_name,
    user_type: user.user_type,
    company: user.company,
    is_root_admin: user.is_root_admin,
    must_change_password: user.must_change_password,
    roles: payload.roles ?? [],
  }

  writeJson(RULES_KEY, rules)
  writeJson(MENU_KEY, payload.menu ?? [])
  sessionMenu.value = payload.menu ?? []
  ability.update(rules)
}

export const clearAuthState = (redirectToLogin = true) => {
  clearStoredTokens()
  useCookie('userData').value = null
  window.localStorage.removeItem(RULES_KEY)
  window.localStorage.removeItem(MENU_KEY)
  sessionMenu.value = []
  ability.update([])

  if (redirectToLogin && window.location.pathname !== getLoginPath())
    window.location.assign(getLoginPath())
}

function readJson(key, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null') ?? fallback
  }
  catch {
    return fallback
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}
