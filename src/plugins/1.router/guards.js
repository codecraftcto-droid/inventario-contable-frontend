import { canNavigate } from '@layouts/plugins/casl'
import { firstMenuPath, getChangePasswordPath, getDashboardPath, getLoginPath, isAuthenticated } from '@/utils/auth-context'
import { sessionMenu } from '@/utils/auth'

export const setupGuards = router => {
  router.beforeEach(to => {
    if (to.meta.public)
      return

    const loggedIn = isAuthenticated()

    if (to.meta.unauthenticatedOnly)
      return loggedIn ? getDashboardPath() : undefined

    if (!loggedIn)
      return { path: getLoginPath(), query: { to: to.fullPath !== '/' ? to.fullPath : undefined } }

    // Primer ingreso o clave reseteada: no puede usar el sistema hasta cambiarla.
    if (useCookie('userData').value?.must_change_password && to.path !== getChangePasswordPath())
      return getChangePasswordPath()

    // Rol sin Dashboard: ir al primer módulo de su menú.
    if (to.path === getDashboardPath() && !canNavigate(to)) {
      const firstPath = firstMenuPath(sessionMenu.value)
      if (firstPath && firstPath !== getDashboardPath())
        return firstPath
    }

    if (!canNavigate(to) && to.matched.length)
      return { name: 'not-authorized' }
  })
}
