import { api } from '@/lib/api'

export async function fetchSettings(signal) {
  const { data } = await api.get('/settings', { signal })
  return data
}

export async function updateProfile(payload, signal) {
  const { data } = await api.patch('/settings/profile', payload, { signal })
  return data
}

export async function updateNotifications(payload, signal) {
  const { data } = await api.patch('/settings/notifications', payload, { signal })
  return data
}

export async function changePassword(payload, signal) {
  const { data } = await api.post('/settings/password', payload, { signal })
  return data
}
