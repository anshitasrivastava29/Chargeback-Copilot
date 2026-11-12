import { ACCESS_TOKEN_KEY, USER_KEY } from '@/lib/api'

export function readStoredToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function readStoredUser() {
  try {
    const raw = window.localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function storeSession(token, user) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}
