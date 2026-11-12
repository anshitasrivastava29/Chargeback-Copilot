import { api } from '@/lib/api'

export async function fetchReportsSummary(days, signal) {
  const { data } = await api.get('/reports/summary', {
    params: days ? { days } : undefined,
    signal,
  })
  return data
}
