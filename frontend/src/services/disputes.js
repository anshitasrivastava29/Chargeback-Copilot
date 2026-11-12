import { api } from '@/lib/api'

export async function fetchDisputes(params = {}, signal) {
  const { data } = await api.get('/disputes', { params, signal })
  return data
}

export async function fetchDispute(disputeId, signal) {
  const { data } = await api.get(`/disputes/${disputeId}`, { signal })
  return data
}

export async function fetchEvidence(disputeId, signal) {
  const { data } = await api.get(`/disputes/${disputeId}/evidence`, { signal })
  return data
}

export async function uploadEvidence(disputeId, file, evidenceType, signal) {
  const form = new FormData()
  form.append('file', file)
  form.append('evidenceType', evidenceType)

  const { data } = await api.post(`/disputes/${disputeId}/evidence`, form, {
    signal,
  })
  return data
}

export async function deleteEvidence(disputeId, evidenceId, signal) {
  await api.delete(`/disputes/${disputeId}/evidence/${evidenceId}`, { signal })
}

export async function downloadEvidenceFile(evidenceId, signal) {
  const { data } = await api.get(`/evidence/${evidenceId}/file`, {
    responseType: 'blob',
    signal,
  })
  return data
}

export function getEvidenceFileUrl(evidenceId) {
  return `/api/evidence/${evidenceId}/file`
}
