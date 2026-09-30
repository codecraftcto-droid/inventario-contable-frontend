import { getDashboardPath, getLoginPath, isAuthenticated } from '@/utils/auth-context'

export const redirects = [
  {
    path: '/',
    name: 'index',
    redirect: () => isAuthenticated() ? getDashboardPath() : getLoginPath(),
  },
]

export const routes = []
