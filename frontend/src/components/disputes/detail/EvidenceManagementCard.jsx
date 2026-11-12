import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'

import { DetailCard } from '@/components/disputes/detail/DetailCard'
import { InlineError } from '@/components/ui/AsyncState'
import { ADDITIONAL_EVIDENCE } from '@/constants/evidence'
import { getApiErrorMessage, resolveApiAssetUrl } from '@/lib/api'
import {
  deleteEvidence,
  downloadEvidenceFile,
  uploadEvidence,
} from '@/services/disputes'
import { cn } from '@/utils/cn'
import {
  MAX_FILE_SIZE,
  formatFileSize,
  getCompletedEvidenceTypes,
  getRequiredEvidenceTypes,
  isAcceptedUpload,
} from '@/utils/evidence'
import { formatDate } from '@/utils/format'

const FILE_STATUS = {
  ready: {
    label: 'Ready',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  uploading: {
    label: 'Uploading',
    icon: Loader2,
    className: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  error: {
    label: 'Failed',
    icon: AlertTriangle,
    className: 'bg-rose-50 text-rose-700 ring-rose-200',
  },
}

function FileStatusBadge({ status }) {
  const meta = FILE_STATUS[status] ?? FILE_STATUS.ready
  const Icon = meta.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset',
        meta.className,
      )}
    >
      <Icon
        size={10}
        className={status === 'uploading' ? 'animate-spin' : undefined}
      />
      {meta.label}
    </span>
  )
}

async function getDownloadErrorMessage(error) {
  const data = error?.response?.data

  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text())

      if (typeof parsed?.detail === 'string' && parsed.detail.trim()) {
        return parsed.detail
      }
    } catch {
      return 'Could not download this file.'
    }
  }

  return getApiErrorMessage(error, 'Could not download this file.')
}

export function EvidenceManagementCard({ dispute, files, onRefresh }) {
  const requiredEvidence = getRequiredEvidenceTypes(dispute)
  const [pendingFiles, setPendingFiles] = useState([])
  const displayFiles = [...pendingFiles, ...files]
  const completedTypes = getCompletedEvidenceTypes(
    displayFiles,
    requiredEvidence,
  )
  const missingEvidence = requiredEvidence.filter(
    (item) => !completedTypes.has(item),
  )
  const readyFiles = displayFiles.filter((file) => file.status === 'ready')
  const completedCount = completedTypes.size
  const uploadOptions =
    missingEvidence.length > 0
      ? [...missingEvidence, ADDITIONAL_EVIDENCE]
      : [ADDITIONAL_EVIDENCE]

  const [selectedType, setSelectedType] = useState(uploadOptions[0])
  const [dragging, setDragging] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [storedPreviews, setStoredPreviews] = useState({})
  const inputRef = useRef(null)
  const objectUrlsRef = useRef([])
  const previewFetchesRef = useRef(new Set())

  const activeType = uploadOptions.includes(selectedType)
    ? selectedType
    : uploadOptions[0]

  // <img>/<iframe> tags cannot send the Authorization header, so stored
  // previews are fetched through the authenticated API client as blobs.
  useEffect(() => {
    const pending = files.filter(
      (file) =>
        file.status === 'ready' &&
        file.source === 'upload' &&
        !file.previewUrl &&
        !storedPreviews[file.id] &&
        !previewFetchesRef.current.has(file.id) &&
        (file.mime?.startsWith('image/') || file.mime === 'application/pdf'),
    )

    if (pending.length === 0) {
      return undefined
    }

    let active = true

    pending.forEach((file) => {
      previewFetchesRef.current.add(file.id)
      downloadEvidenceFile(file.id)
        .then((blob) => {
          if (!active) return
          const url = URL.createObjectURL(blob)
          objectUrlsRef.current.push(url)
          setStoredPreviews((current) => ({ ...current, [file.id]: url }))
        })
        .catch(() => {
          // Preview stays unavailable; the row falls back to its file icon.
        })
        .finally(() => {
          previewFetchesRef.current.delete(file.id)
        })
    })

    return () => {
      active = false
    }
  }, [files, storedPreviews])

  function getFilePreviewUrl(file) {
    if (file.status !== 'ready' && file.status !== 'uploading') {
      return null
    }

    const url =
      file.previewUrl ? resolveApiAssetUrl(file.previewUrl) : storedPreviews[file.id]
    const isPreviewable =
      Boolean(url) &&
      (file.mime?.startsWith('image/') || file.mime === 'application/pdf')

    return isPreviewable ? url : null
  }

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    },
    [],
  )

  useEffect(() => {
    if (!previewFile) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setPreviewFile(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [previewFile])

  async function handleFiles(fileList) {
    const selected = Array.from(fileList)

    if (selected.length === 0) {
      return
    }

    const timestamp = Date.now()
    const entries = selected.map((file, index) => {
      const isImage =
        file.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(file.name)
      const unsupported = !isAcceptedUpload(file)
      const tooLarge = file.size > MAX_FILE_SIZE
      const error = unsupported
        ? 'Unsupported file type. Use PDF, JPG, or PNG.'
        : tooLarge
          ? 'File exceeds the 10 MB limit.'
          : null
      const previewUrl = !error && isImage ? URL.createObjectURL(file) : null

      if (previewUrl) {
        objectUrlsRef.current.push(previewUrl)
      }

      return {
        id: `pending-${timestamp}-${index}-${file.name}`,
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        previewUrl,
        evidenceType: activeType,
        status: error ? 'error' : 'uploading',
        error,
        uploadedAt: timestamp,
        source: 'upload',
        file: error ? null : file,
      }
    })

    setActionError(null)
    setPendingFiles((current) => [...current, ...entries])

    const uploadable = entries.filter((entry) => entry.status === 'uploading')

    await Promise.all(
      uploadable.map(async (entry) => {
        try {
          const uploaded = await uploadEvidence(
            dispute.id,
            entry.file,
            entry.evidenceType,
          )

          if (uploaded) {
            setPendingFiles((current) =>
              current.filter((file) => file.id !== entry.id),
            )
          }
        } catch (error) {
          const message = getApiErrorMessage(error, 'Upload failed.')

          setPendingFiles((current) =>
            current.map((file) =>
              file.id === entry.id
                ? { ...file, status: 'error', error: message }
                : file,
            ),
          )
        }
      }),
    )

    if (uploadable.length > 0) {
      onRefresh?.()
    }
  }

  function handleInputChange(event) {
    handleFiles(event.target.files)
    event.target.value = ''
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  async function handleDelete(file) {
    if (
      !window.confirm(
        `Remove "${file.name}" from this dispute? This cannot be undone.`,
      )
    ) {
      return
    }

    setActionError(null)
    setRemovingId(file.id)

    try {
      await deleteEvidence(dispute.id, file.id)
      onRefresh?.()
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Could not delete this file.'))
    } finally {
      setRemovingId(null)
    }
  }

  async function handleDownload(file) {
    setActionError(null)
    setDownloadingId(file.id)

    try {
      const blob = await downloadEvidenceFile(file.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setActionError(await getDownloadErrorMessage(error))
    } finally {
      setDownloadingId(null)
    }
  }

  function dismissPending(file) {
    setPendingFiles((current) => current.filter((item) => item.id !== file.id))
  }

  const progress = requiredEvidence.length
    ? Math.round((completedCount / requiredEvidence.length) * 100)
    : 100

  return (
    <DetailCard
      title="Evidence"
      icon={FileText}
      description={`${completedCount} of ${requiredEvidence.length} required items collected`}
      action={
        <span
          className={cn(
            'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
            missingEvidence.length === 0
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-amber-50 text-amber-700 ring-amber-200',
          )}
        >
          {missingEvidence.length === 0
            ? 'Complete'
            : `${missingEvidence.length} missing`}
        </span>
      }
    >
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            progress === 100 ? 'bg-emerald-500' : 'bg-blue-600',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
            Required
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
            {requiredEvidence.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
            Available
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-600">
            {readyFiles.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
            Missing
          </p>
          <p
            className={cn(
              'mt-0.5 text-lg font-semibold tabular-nums',
              missingEvidence.length === 0
                ? 'text-emerald-600'
                : 'text-amber-600',
            )}
          >
            {missingEvidence.length}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Required evidence
          </h3>
          <span className="text-[10px] text-slate-400">
            {completedCount} of {requiredEvidence.length} complete
          </span>
        </div>

        <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
          {requiredEvidence.map((item) => {
            const complete = completedTypes.has(item)

            return (
              <li key={item} className="flex items-center gap-2.5 px-3 py-2.5">
                {complete ? (
                  <CheckCircle2
                    size={16}
                    className="shrink-0 text-emerald-500"
                  />
                ) : (
                  <Circle size={16} className="shrink-0 text-amber-400" />
                )}
                <span
                  className={cn(
                    'min-w-0 flex-1 text-xs',
                    complete
                      ? 'font-medium text-slate-700'
                      : 'text-slate-500',
                  )}
                >
                  {item}
                </span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset',
                    complete
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : 'bg-amber-50 text-amber-700 ring-amber-200',
                  )}
                >
                  {complete ? 'Complete' : 'Missing'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Available evidence
          </h3>
          <span className="text-[10px] text-slate-400">
            {readyFiles.length} {readyFiles.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {displayFiles.length === 0 ? (
          <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
            <Paperclip size={18} className="mx-auto text-slate-300" />
            <p className="mt-2 text-xs font-medium text-slate-600">
              No evidence files yet
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Upload the first document below.
            </p>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {displayFiles.map((file) => {
              const previewUrl = getFilePreviewUrl(file)
              const canDownload =
                file.status === 'ready' && file.source === 'upload'

              return (
                <li
                  key={file.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-2.5',
                    file.status === 'error'
                      ? 'border-rose-200 bg-rose-50/40'
                      : 'border-slate-100 bg-white',
                  )}
                >
                  {previewUrl && file.mime?.startsWith('image/') ? (
                    <button
                      type="button"
                      onClick={() => setPreviewFile({ ...file, previewUrl })}
                      className="shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      aria-label={`Preview ${file.name}`}
                    >
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-10 w-10 object-cover"
                      />
                    </button>
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 ring-1 ring-slate-100">
                      <FileText size={17} />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-xs font-medium text-slate-800"
                      title={file.name}
                    >
                      {file.name}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">
                      {file.evidenceType} · {formatFileSize(file.size)} ·{' '}
                      {formatDate(file.uploadedAt)}
                    </p>
                    {file.error && (
                      <p className="mt-0.5 text-[10px] text-rose-600">
                        {file.error}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <FileStatusBadge status={file.status} />
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewFile({ ...file, previewUrl })}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                      >
                        <Eye size={11} />
                        <span className="hidden sm:inline">Preview</span>
                      </button>
                    )}
                    {canDownload && (
                      <button
                        type="button"
                        onClick={() => handleDownload(file)}
                        disabled={downloadingId === file.id}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-wait disabled:opacity-50"
                        aria-label={`Download ${file.name}`}
                      >
                        {downloadingId === file.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Download size={11} />
                        )}
                        <span className="hidden sm:inline">Download</span>
                      </button>
                    )}
                    {file.status === 'error' && (
                      <button
                        type="button"
                        onClick={() => dismissPending(file)}
                        className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label={`Dismiss ${file.name}`}
                      >
                        <X size={12} />
                      </button>
                    )}
                    {file.status === 'ready' && file.source === 'upload' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(file)}
                        disabled={removingId === file.id}
                        className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-wait disabled:opacity-50"
                        aria-label={`Delete ${file.name}`}
                      >
                        {removingId === file.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Missing evidence
          </h3>
        </div>

        {missingEvidence.length > 0 ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={15}
                className="mt-0.5 shrink-0 text-amber-600"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-amber-900">
                  {missingEvidence.length}{' '}
                  {missingEvidence.length === 1 ? 'item' : 'items'} still
                  needed
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {missingEvidence.map((item) => (
                    <li
                      key={item}
                      className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-medium text-emerald-800">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            All required evidence has been collected.
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Upload evidence
          </h3>
          <span className="text-[10px] text-slate-400">
            PDF, JPG, or PNG · up to 10 MB
          </span>
        </div>

        {actionError && (
          <InlineError
            className="mt-2"
            message={actionError}
            onRetry={() => setActionError(null)}
          />
        )}

        <div className="mt-2 flex flex-col gap-1">
          <label
            htmlFor="evidence-type"
            className="text-[10px] font-medium text-slate-500"
          >
            Tag upload as
          </label>
          <select
            id="evidence-type"
            value={activeType}
            onChange={(event) => setSelectedType(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {uploadOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'mt-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition',
            dragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-200 bg-slate-50/60',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleInputChange}
            className="sr-only"
            aria-label="Upload evidence files"
          />
          <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
            <UploadCloud size={17} />
          </span>
          <p className="mt-2 text-xs font-medium text-slate-700">
            Drop files here, or{' '}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-blue-600 underline-offset-2 hover:underline"
            >
              browse
            </button>
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            Files are stored by the dispute service and refresh the AI analysis.
          </p>
        </div>
      </div>

      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setPreviewFile(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Preview ${previewFile.name}`}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-900">
                  {previewFile.name}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {previewFile.evidenceType} · {formatFileSize(previewFile.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close preview"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-auto bg-slate-100 p-4">
              {(() => {
                const activeUrl =
                  previewFile.previewUrl ||
                  storedPreviews[previewFile.id] ||
                  null

                if (!activeUrl) {
                  return (
                    <div className="flex h-[70vh] items-center justify-center text-slate-400">
                      <Loader2 className="animate-spin" size={22} />
                    </div>
                  )
                }

                return previewFile.mime === 'application/pdf' ? (
                  <iframe
                    src={activeUrl}
                    title={previewFile.name}
                    className="h-[70vh] w-full rounded-lg bg-white shadow-sm"
                  />
                ) : (
                  <img
                    src={activeUrl}
                    alt={`${previewFile.evidenceType} preview`}
                    className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg bg-white shadow-sm"
                  />
                )
              })()}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-[10px] text-slate-400">
              <span>Uploaded {formatDate(previewFile.uploadedAt)}</span>
              <div className="flex items-center gap-3">
                {previewFile.status === 'ready' &&
                  previewFile.source === 'upload' && (
                  <button
                    type="button"
                    onClick={() => handleDownload(previewFile)}
                    disabled={downloadingId === previewFile.id}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-wait disabled:opacity-50"
                  >
                    {downloadingId === previewFile.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Download size={11} />
                    )}
                    Download
                  </button>
                )}
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 size={11} className="text-emerald-500" />
                  {FILE_STATUS[previewFile.status]?.label ?? 'Ready'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </DetailCard>
  )
}

export default EvidenceManagementCard
