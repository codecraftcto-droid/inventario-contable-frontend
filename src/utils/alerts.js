import Swal from 'sweetalert2'

const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
})

export const showSuccessAlert = (message = 'Operación realizada correctamente.') => {
  return toast.fire({
    icon: 'success',
    title: message,
  })
}

export const showErrorAlert = (message = 'No se pudo completar la operación.') => {
  return Swal.fire({
    icon: 'error',
    title: 'Error',
    text: message,
    confirmButtonText: 'Entendido',
  })
}

export const confirmDeleteAlert = (message = 'Esta acción no se puede deshacer.') => {
  return Swal.fire({
    icon: 'warning',
    title: '¿Estás seguro?',
    text: message,
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
  })
}

export const confirmAlert = ({ title = '¿Confirmas la acción?', text = '', confirmButtonText = 'Sí, continuar' } = {}) => {
  return Swal.fire({
    icon: 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
  })
}
