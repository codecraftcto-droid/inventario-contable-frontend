/**
 * Convierte el menú del backend (ya filtrado por permisos y plataforma) en items
 * del menú lateral de Vuexy. Los agrupadores sin hijos visibles no se muestran.
 */
const toNavItem = node => {
  const children = (node.children ?? []).map(toNavItem).filter(Boolean)

  if (children.length)
    return { title: node.name, icon: { icon: node.icon || 'tabler-folder' }, children }

  if (!node.path)
    return null

  return { title: node.name, icon: { icon: node.icon || 'tabler-point' }, to: { path: node.path } }
}

export const buildVerticalNavItems = menu => (menu ?? []).map(toNavItem).filter(Boolean)
