import { api } from '@/lib/api'

export async function fetchPayPalConnection(signal) {
  const { data } = await api.get('/paypal/connection', { signal })
  return data
}

export async function startPayPalConnection() {
  const { data } = await api.post('/paypal/connect')
  return data
}

export async function refreshPayPalConnection() {
  const { data } = await api.post('/paypal/connection/refresh')
  return data
}

export async function disconnectPayPalConnection() {
  const { data } = await api.post('/paypal/connection/disconnect')
  return data
}

export async function syncPayPalData() {
  const { data } = await api.post('/paypal/sync')
  return data
}

export async function fetchPayPalPermissions() {
  const { data } = await api.get('/paypal/permissions')
  return data
}
