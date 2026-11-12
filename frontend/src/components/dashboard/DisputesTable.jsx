import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  SearchX,
  X,
} from 'lucide-react'

import { ReasonIcon } from '@/components/ui/ReasonIcon'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/utils/cn'
import { formatCurrency, formatDate, getDueInfo } from '@/utils/format'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
]

function DueIndicator({ dispute }) {
  if (dispute.status !== 'open') {
    return (
      <span className="text-[11px] text-slate-400">
        Resolved {formatDate(dispute.resolvedAt)}
      </span>
    )
  }

  const due = getDueInfo(dispute.dueAt)

  if (!due) {
    return null
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium',
        due.tone === 'danger' && 'text-rose-600',
        due.tone === 'warning' && 'text-amber-600',
        due.tone === 'neutral' && 'text-slate-500',
      )}
    >
      <Clock3 size={11} />
      {due.label}
    </span>
  )
}

function EvidenceBar({ dispute }) {
  const percent = Math.round(
    (dispute.evidence.uploaded / dispute.evidence.required) * 100,
  )

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-[11px] text-slate-500 tabular-nums">
        {dispute.evidence.uploaded}/{dispute.evidence.required}
      </span>
    </div>
  )
}

function DisputesTable({
  disputes,
  counts,
  totalInPeriod,
  statusFilter,
  onStatusChange,
  query,
  onQueryChange,
  sortKey,
  onSortChange,
  page,
  totalPages,
  startIndex,
  pageSize,
  filteredCount,
  onPageChange,
  onSelectDispute,
  onResetFilters,
}) {
  return (
    <section
      id="disputes"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="px-4 pt-5 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Recent disputes
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {totalInPeriod} disputes in the selected period
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search disputes"
                aria-label="Search disputes"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-8 text-xs text-slate-700 transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-52"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => onQueryChange('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="relative">
              <select
                value={sortKey}
                onChange={(event) => onSortChange(event.target.value)}
                aria-label="Sort disputes"
                className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-600 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="amount">Highest amount</option>
                <option value="deadline">Deadline</option>
              </select>
              <ChevronDown
                size={13}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-5 overflow-x-auto border-b border-slate-100">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onStatusChange(tab.id)}
              className={cn(
                '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-xs font-medium transition',
                statusFilter === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                  statusFilter === tab.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-slate-100 text-slate-500',
                )}
              >
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filteredCount === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <SearchX size={20} />
          </span>
          <p className="mt-3 text-sm font-medium text-slate-800">
            No disputes match your filters
          </p>
          <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
            Try a different status, search term, or date range.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-4 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                  <th
                    scope="col"
                    className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                  >
                    Dispute
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="hidden px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 2xl:table-cell"
                  >
                    Evidence
                  </th>
                  <th
                    scope="col"
                    className="hidden px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 2xl:table-cell"
                  >
                    Opened
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                  >
                    Due
                  </th>
                  <th scope="col" className="w-10 px-3 py-2.5">
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {disputes.map((dispute) => (
                  <tr
                    key={dispute.id}
                    onClick={() => onSelectDispute(dispute.id)}
                    className="group cursor-pointer transition hover:bg-slate-50/80"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <ReasonIcon reason={dispute.reason} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {dispute.reason}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {dispute.id} · {dispute.buyer.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                      {formatCurrency(dispute.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={dispute.status} />
                    </td>
                    <td className="hidden px-4 py-3 2xl:table-cell">
                      <EvidenceBar dispute={dispute} />
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-slate-500 2xl:table-cell">
                      {formatDate(dispute.openedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <DueIndicator dispute={dispute} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onSelectDispute(dispute.id)
                        }}
                        aria-label={`View dispute ${dispute.id}`}
                        className="rounded-md p-1.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 group-hover:text-slate-500"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden">
            {disputes.map((dispute) => (
              <li key={dispute.id}>
                <button
                  type="button"
                  onClick={() => onSelectDispute(dispute.id)}
                  className="w-full px-4 py-4 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {dispute.reason}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {dispute.id} · {dispute.buyer.name}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                      {formatCurrency(dispute.amount)}
                    </p>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <StatusBadge status={dispute.status} />
                    <DueIndicator dispute={dispute} />
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-[11px] text-slate-500">
              Showing{' '}
              <span className="font-medium text-slate-700 tabular-nums">
                {startIndex + 1}–
                {Math.min(startIndex + pageSize, filteredCount)}
              </span>{' '}
              of <span className="tabular-nums">{filteredCount}</span>
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page === 1}
                  aria-label="Previous page"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-transparent"
                >
                  <ChevronLeft size={14} />
                </button>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                  (pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => onPageChange(pageNumber)}
                      aria-current={page === pageNumber ? 'page' : undefined}
                      className={cn(
                        'h-7 min-w-7 rounded-md px-1.5 text-[11px] font-medium tabular-nums transition',
                        page === pageNumber
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-500 hover:bg-slate-100',
                      )}
                    >
                      {pageNumber}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page === totalPages}
                  aria-label="Next page"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-transparent"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default DisputesTable
