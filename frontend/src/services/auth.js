import { api } from '@/lib/api'

export async function signupUser(payload, signal) {
  const { data } = await api.post('/auth/signup', payload, { signal })
  return data
}

export async function loginUser(payload, signal) {
  const { data } = await api.post('/auth/login', payload, { signal })
  return data
}

export async function fetchCurrentUser(signal) {
  const { data } = await api.get('/auth/me', { signal })
  return data
}
