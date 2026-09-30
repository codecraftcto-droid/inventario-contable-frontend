import { abilitiesPlugin } from '@casl/vue'
import { getStoredAbilityRules } from '@/utils/auth'
import { ability } from './ability'

export default function (app) {
  ability.update(getStoredAbilityRules())

  app.use(abilitiesPlugin, ability, {
    useGlobalProperties: true,
  })
}
