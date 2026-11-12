import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const ACCESS_TOKEN_KEY = 'cc_access_token'
export const USER_KEY = 'cc_user'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
})

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // An expired or revoked session invalidates every stored credential;
    // auth endpoints themselves are excluded so login failures stay inline.
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !/^\/auth\/(login|signup)$/.test(error.config?.url ?? '')
    ) {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY)
      window.localStorage.removeItem(USER_KEY)

      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?reason=expired')
      }
    }

    return Promise.reject(error)
  },
)

export function isCanceledError(error) {
  return axios.isCancel(error) || error?.code === 'ERR_CANCELED'
}

export function resolveApiAssetUrl(url) {
  if (!url) {
    return null
  }

  if (/^(https?:|blob:|data:)/i.test(url)) {
    return url
  }

  // Seeded demo previews live in the frontend's public/ folder, not on the
  // API host. Uploaded files are served through /api/evidence/{id}/file.
  if (url.startsWith('/evidence/')) {
    return url
  }

  const apiUrl = new URL(API_BASE_URL, window.location.origin)
  return new URL(url, apiUrl.origin).toString()
}

export function getApiErrorStatus(error) {
  return axios.isAxiosError(error) ? (error.response?.status ?? null) : null
}

export function getApiErrorMessage(
  error,
  fallback = 'Something went wrong while contacting the server.',
) {
  if (!axios.isAxiosError(error)) {
    return error?.message || fallback
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return 'The request timed out. Please try again.'
  }

  if (!error.response) {
    return 'Unable to reach the backend API. Make sure it is running on port 8000.'
  }

  const detail = error.response.data?.detail

  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join(' ')
  }

  return `Request failed with status ${error.response.status}.`
}
