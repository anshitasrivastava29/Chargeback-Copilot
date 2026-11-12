import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  Download,
  Eye,
  FileImage,
  FileText,
  FolderLock,
  HardDrive,
  Layers,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'

import { EmptyPanel, ErrorPanel, Skeleton } from '@/components/ui/AsyncState'
import Pagination from '@/components/ui/Pagination'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getApiErrorMessage, resolveApiAssetUrl } from '@/lib/api'
import { downloadEvidenceFile } from '@/services/disputes'
import { fetchEvidenceVault } from '@/services/evidenceVault'
import { cn } from '@/utils/cn'
import { formatBytes, formatCurrency, formatFullDate } from '@/utils/format'

const PAGE_SIZE = 20

const METRIC_TONES = {
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
}

function VaultMetric({ icon: Icon, label, value, helper, tone = 'sky' }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset',
          METRIC_TONES[tone],
        )}
      >
        <Icon size={17} strokeWidth={2} />
      </span>
      <p className="mt-4 text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-4 text-slate-500">{helper}</p>
    </div>
  )
}

function VaultRow({ item, busy, onOpen }) {
  const isImage = item.mime?.startsWith('image/')
  const Icon = isImage ? FileImage : FileText
  const needsReview =
    item.status !== 'ready' || item.extractionStatus === 'failed'
  const canOpen = Boolean(item.previewUrl || item.hasFile)
  const actionLabel = item.previewUrl
    ? 'Preview'
    : item.hasFile
      ? 'Download'
      : 'Demo record'
  const ActionIcon = item.previewUrl ? Eye : Download

  return (
    <div className="flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50/60 sm:px-5 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-900">
            {item.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400">
            <span>{item.evidenceType}</span>
            <span aria-hidden="true">·</span>
            <span>{formatBytes(item.size)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatFullDate(item.uploadedAt)}</span>
            {item.source === 'demo' && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium uppercase tracking-wide text-slate-500">
                Demo
              </span>
            )}
            {item.extractionStatus === 'failed' && (
              <span className="rounded bg-rose-50 px-1.5 py-0.5 font-medium text-rose-600">
                Extraction failed
              </span>
            )}
          </div>
        </div>
      </div>

      <Link
        to={`/disputes/${item.dispute.id}`}
        className="group flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 transition hover:border-slate-300 hover:bg-slate-50 lg:w-64"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-slate-700 group-hover:text-blue-700">
            {item.dispute.id}
          </p>
          <p className="truncate text-[10px] text-slate-400">
            {item.dispute.buyerName} · {formatCurrency(item.dispute.amount)}
          </p>
        </div>
        <ArrowUpRight
          size={13}
          className="shrink-0 text-slate-300 group-hover:text-slate-500"
        />
      </Link>

      <div className="flex items-center justify-between gap-2 lg:w-56 lg:justify-end">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
            needsReview
              ? 'bg-amber-50 text-amber-700 ring-amber-200'
              : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              needsReview ? 'bg-amber-500' : 'bg-emerald-500',
            )}
          />
          {needsReview ? 'Needs review' : 'Ready'}
        </span>

        {item.qualityScore != null && (
          <span
            className="hidden rounded-md bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200 xl:inline-flex"
            title="Document extraction quality"
          >
            Quality {item.qualityScore}
          </span>
        )}

        <button
          type="button"
          onClick={() => onOpen(item)}
          disabled={!canOpen || busy}
          title={
            canOpen
              ? actionLabel
              : 'Seeded demo records have metadata only — open the case for details.'
          }
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition',
            canOpen && !busy
              ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
              : 'cursor-default border-slate-100 text-slate-300',
          )}
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <ActionIcon size={12} />
          )}
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

function VaultSkeleton() {
  return (
    <div className="divide-y divide-slate-100" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-4 sm:px-5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="hidden h-9 w-40 rounded-lg lg:block" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function EvidenceVaultPage() {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const debouncedQuery = useDebouncedValue(query, 300)

  const params = {
    page,
    pageSize: PAGE_SIZE,
    ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
  }

  const vaultQuery = useApiQuery(JSON.stringify(params), (signal) =>
    fetchEvidenceVault(params, signal),
  )

  const data = vaultQuery.data
  const stats = data?.stats ?? {
    files: 0,
    bytes: 0,
    ready: 0,
    needsAttention: 0,
    disputes: 0,
    types: 0,
  }
  const types = data?.types ?? []
  const hasFilters =
    Boolean(query.trim()) || typeFilter !== 'all' || statusFilter !== 'all'

  function resetFilters() {
    setQuery('')
    setTypeFilter('all')
    setStatusFilter('all')
    setPage(1)
  }

  async function handleOpen(item) {
    setActionError(null)

    if (item.previewUrl) {
      window.open(
        resolveApiAssetUrl(item.previewUrl),
        '_blank',
        'noopener,noreferrer',
      )
      return
    }

    if (!item.hasFile) {
      return
    }

    setBusyId(item.id)
    try {
      const blob = await downloadEvidenceFile(item.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = item.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setActionError(getApiErrorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>Merchant workspace</span>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-600">Evidence vault</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
            Evidence vault
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
            Every document attached to a dispute in one searchable catalogue.
            Open a file or jump straight back to its case.
          </p>
        </div>

        <Link
          to="/disputes"
          className="inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <FolderLock size={14} />
          Open dispute inbox
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <VaultMetric
          icon={FolderLock}
          label="Evidence files"
          value={stats.files}
          helper={`${stats.types} evidence types in the vault`}
          tone="sky"
        />
        <VaultMetric
          icon={HardDrive}
          label="Document storage"
          value={formatBytes(stats.bytes)}
          helper="Uploaded and demo file metadata"
          tone="violet"
        />
        <VaultMetric
          icon={Layers}
          label="Cases covered"
          value={stats.disputes}
          helper={`${stats.ready} files ready to cite`}
          tone="emerald"
        />
        <VaultMetric
          icon={stats.needsAttention ? AlertTriangle : ShieldCheck}
          label="Needs attention"
          value={stats.needsAttention}
          helper={
            stats.needsAttention
              ? 'Extraction issues to review'
              : 'All documents are readable'
          }
          tone={stats.needsAttention ? 'amber' : 'emerald'}
        />
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Document catalogue
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {data
                  ? `${data.total} file${data.total === 1 ? '' : 's'} match the current filters`
                  : 'Loading evidence records…'}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block">
                <span className="sr-only">Search evidence</span>
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPage(1)
                  }}
                  placeholder="Search file, case, buyer, order…"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-64"
                />
              </label>

              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All evidence types</option>
                {types.map((type) => (
                  <option key={type.evidenceType} value={type.evidenceType}>
                    {type.evidenceType} ({type.count})
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">Any status</option>
                <option value="ready">Ready</option>
                <option value="attention">Needs review</option>
              </select>

              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                >
                  <X size={12} />
                  Clear
                </button>
              )}
            </div>
          </div>

          {actionError && (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
              {actionError}
            </p>
          )}
        </div>

        {vaultQuery.isError ? (
          <div className="p-4 sm:p-5">
            <ErrorPanel
              title="Could not load the evidence vault"
              message={vaultQuery.error}
              onRetry={vaultQuery.reload}
            />
          </div>
        ) : vaultQuery.isLoading ? (
          <VaultSkeleton />
        ) : (data?.items?.length ?? 0) === 0 ? (
          <EmptyPanel
            className="rounded-none border-0 shadow-none"
            icon={hasFilters ? Search : FolderLock}
            title={
              hasFilters
                ? 'No evidence matches these filters'
                : 'No evidence uploaded yet'
            }
            message={
              hasFilters
                ? 'Try a different search term, evidence type, or status.'
                : 'Upload documents from a dispute page and they will appear here.'
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Reset filters
                </button>
              ) : (
                <Link
                  to="/disputes"
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                >
                  Go to disputes
                </Link>
              )
            }
          />
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {data.items.map((item) => (
                <VaultRow
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onOpen={handleOpen}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-[11px] text-slate-400">
                Page {data.page} of {data.totalPages} · {data.total} files
              </p>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default EvidenceVaultPage
