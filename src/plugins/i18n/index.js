import { createI18n } from 'vue-i18n'
import { es } from 'vuetify/locale'

// El sistema es solo en español. Los textos propios de Vuetify (paginador,
// "sin datos", etc.) salen de su traducción oficial.
let _i18n = null
export const getI18n = () => {
  if (_i18n === null) {
    _i18n = createI18n({
      legacy: false,
      locale: 'es',
      fallbackLocale: 'es',
      messages: { es: { $vuetify: es } },
    })
  }

  return _i18n
}
export default function (app) {
  app.use(getI18n())
}
