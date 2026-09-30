/**
 * Primer mensaje útil de un error de la API (validación o mensaje general).
 */
export const extractApiMessage = (error, fallback = 'No se pudo completar la solicitud.') => {
  const errors = error?.data?.errors
  const firstValidationMessage = errors ? Object.values(errors).flat().find(Boolean) : null

  return firstValidationMessage ?? error?.data?.message ?? fallback
}

/**
 * Errores de validación por campo: { campo: 'mensaje' }.
 */
export const extractValidationErrors = error => {
  const errors = error?.data?.errors ?? {}

  return Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, Array.isArray(messages) ? messages[0] : messages]))
}
