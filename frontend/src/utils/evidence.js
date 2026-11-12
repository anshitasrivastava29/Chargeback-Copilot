import { EVIDENCE_TYPES } from '@/constants/evidence'

const KB = 1024
const MB = 1024 * KB

export const MAX_FILE_SIZE = 10 * MB

export function getRequiredEvidenceTypes(dispute) {
  const { completed = [], missing = [] } = dispute.evidence ?? {}
  const required = new Set([...completed, ...missing])

  if (required.size > 0) {
    return EVIDENCE_TYPES.filter((type) => required.has(type))
  }

  return EVIDENCE_TYPES.slice(0, dispute.evidence?.required ?? 0)
}

export function getCompletedEvidenceTypes(files, requiredEvidence) {
  const required = new Set(requiredEvidence)

  return new Set(
    files
      .filter((file) => file.status === 'ready' && required.has(file.evidenceType))
      .map((file) => file.evidenceType),
  )
}

export function getMissingEvidenceTypes(dispute) {
  if (Array.isArray(dispute.evidence.missing)) {
    return dispute.evidence.missing
  }

  return getRequiredEvidenceTypes(dispute).slice(dispute.evidence.uploaded)
}

export function isAcceptedUpload(file) {
  return (
    ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) ||
    /\.(pdf|jpe?g|png)$/i.test(file.name)
  )
}

export function isPreviewableFile(file) {
  return Boolean(
    file.previewUrl ||
      file.mime?.startsWith('image/') ||
      /\.(png|jpe?g|svg)$/i.test(file.name),
  )
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '—'
  }
  if (bytes >= MB) {
    return `${(bytes / MB).toFixed(1)} MB`
  }
  return `${Math.max(1, Math.round(bytes / KB))} KB`
}
