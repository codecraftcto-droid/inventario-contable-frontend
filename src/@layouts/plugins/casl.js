import { useAbility } from '@casl/vue'
import { ability } from '@/plugins/casl/ability'

export const can = (action, subject) => {
  if (!action || !subject)
    return true

  return ability.can(action, subject)
}

export const canViewNavMenuGroup = item => {
  const hasAnyVisibleChild = item.children.some(i => can(i.action, i.subject))

  if (!(item.action && item.subject))
    return hasAnyVisibleChild

  return can(item.action, item.subject) && hasAnyVisibleChild
}

export const canNavigate = to => {
  const ability = useAbility()
  const targetRoute = to.matched[to.matched.length - 1]

  if (!targetRoute?.meta?.action || !targetRoute?.meta?.subject)
    return true

  return ability.can(targetRoute.meta.action, targetRoute.meta.subject)
}
