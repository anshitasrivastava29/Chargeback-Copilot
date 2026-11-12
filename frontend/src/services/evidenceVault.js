import { api } from '@/lib/api'

export async function fetchEvidenceVault(params = {}, signal) {
  const { data } = await api.get('/evidence', { params, signal })
  return data
}
