// Tokens de sesión: access token JWT (corto) + refresh token (rota en cada renovación).
const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

export const getStoredAccessToken = () => window.localStorage.getItem(ACCESS_TOKEN_KEY)

export const getStoredRefreshToken = () => window.localStorage.getItem(REFRESH_TOKEN_KEY)

export const storeTokens = ({ access_token: accessToken, refresh_token: refreshToken } = {}) => {
  if (accessToken)
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)

  if (refreshToken)
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export const clearStoredTokens = () => {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(REFRESH_TOKEN_KEY)
}
