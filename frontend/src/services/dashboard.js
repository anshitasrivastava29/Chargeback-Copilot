import { api } from '@/lib/api'

export async function fetchDashboardStats(days, signal) {
  const { data } = await api.get('/dashboard/stats', {
    params: days ? { days } : undefined,
    signal,
  })
  return data
}

export async function fetchPendingActions(limit = 20, signal) {
  const { data } = await api.get('/dashboard/pending-actions', {
    params: { limit },
    signal,
  })
  return data
}
