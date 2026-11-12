import { Link } from 'react-router-dom'
import { ChevronRight, SearchX } from 'lucide-react'

import { DueBadge } from '@/components/ui/DueBadge'
import Pagination from '@/components/ui/Pagination'
import { ReasonIcon } from '@/components/ui/ReasonIcon'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDate } from '@/utils/format'

function getInitials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
}

function DeadlineCell({ dispute }) {
  if (dispute.status !== 'open') {
    return (
      <div className="flex flex-col gap-0.5 xl:whitespace-nowrap">
        <span className="text-[11px] font-medium text-slate-500">Closed</span>
        <span className="text-[10px] text-slate-400">
          {formatDate(dispute.resolvedAt)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 xl:whitespace-nowrap">
      <DueBadge dateValue={dispute.dueAt} />
      <span className="text-[10px] text-slate-400">
        {formatDate(dispute.dueAt)}
      </span>
    </div>
  )
}

function DisputeInboxTable({
  disputes,
  filteredCount,
  page,
  totalPages,
  startIndex,
  pageSize,
  onPageChange,
  onSelectDispute,
  onResetFilters,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-900">Case queue</h2>
        <p className="hidden text-[11px] text-slate-400 sm:block">
          Select a case to open its full details
        </p>
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
            Try a different search term, status, reason, or priority.
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
          <div className="hidden lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 xl:px-5"
                  >
                    Dispute ID
                  </th>
                  <th
                    scope="col"
                    className="px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 xl:px-3"
                  >
                    Customer
                  </th>
                  <th
                    scope="col"
                    className="px-2.5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 xl:px-3"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 xl:px-3"
                  >
                    Reason
                  </th>
                  <th
                    scope="col"
                    className="px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 xl:px-3"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 xl:px-3"
                  >
                    Deadline
                  </th>
                  <th scope="col" className="w-9 px-2 py-2.5 xl:w-10 xl:px-3">
                    <span className="sr-only">Open</span>
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
                    <td className="px-3 py-3 xl:px-5">
                      <Link
                        to={`/disputes/${dispute.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="font-mono text-[11px] font-medium text-blue-700 hover:underline xl:whitespace-nowrap"
                      >
                        {dispute.id}
                      </Link>
                    </td>

                    <td className="px-2.5 py-3 xl:px-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                          {getInitials(dispute.buyer.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-900">
                            {dispute.buyer.name}
                          </p>
                          <p className="hidden max-w-[180px] truncate text-[10px] text-slate-400 xl:block">
                            {dispute.buyer.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-2.5 py-3 text-right text-xs font-semibold tabular-nums text-slate-900 xl:px-3">
                      {formatCurrency(dispute.amount)}
                    </td>

                    <td className="px-2.5 py-3 xl:px-3">
                      <div className="flex items-center gap-2">
                        <ReasonIcon
                          reason={dispute.reason}
                          className="hidden h-7 w-7 rounded-md xl:flex"
                        />
                        <span className="max-w-[180px] truncate text-xs text-slate-600">
                          {dispute.reason}
                        </span>
                      </div>
                    </td>

                    <td className="px-2.5 py-3 xl:px-3">
                      <StatusBadge status={dispute.status} />
                    </td>

                    <td className="px-2.5 py-3 xl:px-3">
                      <DeadlineCell dispute={dispute} />
                    </td>

                    <td className="px-2 py-3 text-right xl:px-3">
                      <ChevronRight
                        size={15}
                        className="inline text-slate-300 transition group-hover:text-slate-500"
                        aria-hidden="true"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 lg:hidden">
            {disputes.map((dispute) => (
              <li key={dispute.id}>
                <Link
                  to={`/disputes/${dispute.id}`}
                  className="block px-4 py-4 transition hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-medium text-blue-700">
                        {dispute.id}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-slate-900">
                        {dispute.buyer.name}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {dispute.buyer.email}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <p className="text-sm font-semibold tabular-nums text-slate-900">
                        {formatCurrency(dispute.amount)}
                      </p>
                      <ChevronRight
                        size={15}
                        className="text-slate-300"
                        aria-hidden="true"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <ReasonIcon
                      reason={dispute.reason}
                      className="h-7 w-7 rounded-md"
                    />
                    <span className="truncate text-xs text-slate-600">
                      {dispute.reason}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <StatusBadge status={dispute.status} />
                    <DeadlineCell dispute={dispute} />
                  </div>
                </Link>
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

            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          </div>
        </>
      )}
    </section>
  )
}

export default DisputeInboxTable
