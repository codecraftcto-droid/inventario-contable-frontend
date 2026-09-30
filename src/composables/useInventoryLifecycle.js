import { $api } from '@/utils/api'
import { confirmAlert, showErrorAlert, showSuccessAlert } from '@/utils/alerts'
import { extractApiMessage } from '@/utils/security'

/**
 * Botones del inventario: Iniciar → Pausar / Reanudar → Finalizar.
 * Solo con el inventario "En proceso" se puede registrar desde los teléfonos y la web.
 */
export const LIFECYCLE_ACTIONS = [
  {
    key: 'start',
    title: 'Iniciar',
    icon: 'tabler-player-play',
    color: 'success',
    from: ['PENDIENTE'],
    confirm: inventory => ({
      title: `¿Iniciar el inventario ${inventory.code}?`,
      text: 'Los inventariadores asignados podrán registrar desde sus teléfonos.',
      confirmButtonText: 'Sí, iniciar',
    }),
  },
  {
    key: 'pause',
    title: 'Pausar',
    icon: 'tabler-player-pause',
    color: 'warning',
    from: ['EN_PROCESO'],
    confirm: inventory => ({
      title: `¿Pausar el inventario ${inventory.code}?`,
      text: 'Nadie podrá registrar hasta reanudarlo. Lo que se registre sin señal queda guardado en los teléfonos y se envía al reanudar.',
      confirmButtonText: 'Sí, pausar',
    }),
  },
  {
    key: 'resume',
    title: 'Reanudar',
    icon: 'tabler-player-play',
    color: 'success',
    from: ['PAUSADO'],
    confirm: inventory => ({
      title: `¿Reanudar el inventario ${inventory.code}?`,
      text: 'Se vuelve a registrar desde los teléfonos.',
      confirmButtonText: 'Sí, reanudar',
    }),
  },
  {
    key: 'close',
    title: 'Finalizar',
    icon: 'tabler-flag-check',
    color: 'error',
    from: ['PENDIENTE', 'EN_PROCESO', 'PAUSADO'],
    confirm: inventory => ({
      title: `¿Finalizar el inventario ${inventory.code}?`,
      text: 'Ya no admitirá cargas de base contable ni registros. No se puede deshacer.',
      confirmButtonText: 'Sí, finalizar',
    }),
  },
]

export const lifecycleActionsFor = inventory => LIFECYCLE_ACTIONS.filter(action => action.from.includes(inventory?.status))

/**
 * @param {(inventory: object) => void} onChanged  Recibe el inventario actualizado.
 */
export function useInventoryLifecycle(onChanged = () => {}) {
  const running = ref(null)

  const run = async (inventory, action) => {
    const { isConfirmed } = await confirmAlert(action.confirm(inventory))
    if (!isConfirmed)
      return

    running.value = action.key
    try {
      const response = await $api(`/inventories/${inventory.id}/${action.key}`, { method: 'POST' })

      showSuccessAlert(response.message)
      onChanged(response.data)
    }
    catch (error) {
      showErrorAlert(extractApiMessage(error))
    }
    finally {
      running.value = null
    }
  }

  return { running, run }
}
