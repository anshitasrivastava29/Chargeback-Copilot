import { api } from '@/lib/api'

export async function loadAnalysis(disputeId, { signal } = {}) {
  const { data } = await api.get(`/disputes/${disputeId}/ai-analysis`, {
    signal,
  })
  return data
}

export async function refreshAnalysis(disputeId, { signal } = {}) {
  const { data } = await api.post(
    `/disputes/${disputeId}/ai-analysis/refresh`,
    undefined,
    { signal },
  )
  return data
}

export async function saveResponseDraft(disputeId, draft, { signal } = {}) {
  const { data } = await api.post(
    `/disputes/${disputeId}/response-draft`,
    { draft },
    { signal },
  )
  return data
}

export async function submitResponse(
  disputeId,
  body,
  evidenceIds,
  { signal } = {},
) {
  const { data } = await api.post(
    `/disputes/${disputeId}/submit`,
    { body, evidenceIds },
    { signal },
  )
  return data
}
