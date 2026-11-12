import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CircleX, Clock3, Scale, Trophy } from 'lucide-react'

import DisputeFilterBar from '@/components/disputes/DisputeFilterBar'
import DisputeInboxTable from '@/components/disputes/DisputeInboxTable'
import StatCard from '@/components/dashboard/StatCard'
import {
  ErrorPanel,
  StatCardsSkeleton,
  TableSkeleton,
} from '@/components/ui/AsyncState'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { fetchDashboardStats } from '@/services/dashboard'
import { fetchDisputes } from '@/services/disputes'
import { formatCurrency } from '@/utils/format'

const PAGE_SIZE = 10
const EMPTY_COUNTS = { all: 0, open: 0, won: 0, lost: 0 }

function DisputeInboxPage() {
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [reasonFilter, setReasonFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sortKey, setSortKey] = useState('newest')
  const [page, setPage] = useState(1)

  const debouncedQuery = useDebouncedValue(query, 300)

  const statsQuery = useApiQuery('inbox-stats', (signal) =>
    fetchDashboardStats(undefined, signal),
  )

  const reasonsQuery = useApiQuery('inbox-reasons', (signal) =>
    fetchDisputes({ page: 1, pageSize: 100 }, signal),
  )

  const reasons = useMemo(() => {
    const items = reasonsQuery.data?.items ?? []
    return [...new Set(items.map((dispute) => dispute.reason))].sort()
  }, [reasonsQuery.data])

  const listParams = useMemo(() => {
    const params = { sort: sortKey, page, pageSize: PAGE_SIZE }

    if (statusFilter !== 'all') {
      params.status = statusFilter
    }
    if (reasonFilter !== 'all') {
      params.reason = reasonFilter
    }
    if (priorityFilter !== 'all') {
      params.priority = priorityFilter
    }
    if (debouncedQuery.trim()) {
      params.q = debouncedQuery.trim()
    }

    return params
  }, [
    statusFilter,
    reasonFilter,
    priorityFilter,
    sortKey,
    debouncedQuery,
    page,
  ])

  const listQuery = useApiQuery(JSON.stringify(listParams), (signal) =>
    fetchDisputes(listParams, signal),
  )

  const stats = statsQuery.data
  const listData = listQuery.data
  const disputeRows = listData?.items ?? []
  const counts = listData?.counts ?? EMPTY_COUNTS
  const totalPages = Math.max(1, listData?.totalPages ?? 1)
  const currentPage = Math.min(page, totalPages)
  const filteredCount = listData?.total ?? 0
  const startIndex = (currentPage - 1) * (listData?.pageSize ?? PAGE_SIZE)

  const hasFilters =
    Boolean(query.trim()) ||
    statusFilter !== 'all' ||
    reasonFilter !== 'all' ||
    priorityFilter !== 'all'

  function handleStatusChange(nextStatus) {
    setStatusFilter(nextStatus)
    setPage(1)
  }

  function handleQueryChange(nextQuery) {
    setQuery(nextQuery)
    setPage(1)
  }

  function handleReasonChange(nextReason) {
    setReasonFilter(nextReason)
    setPage(1)
  }

  function handlePriorityChange(nextPriority) {
    setPriorityFilter(nextPriority)
    setPage(1)
  }

  function handleSortChange(nextSort) {
    setSortKey(nextSort)
    setPage(1)
  }

  function handleResetFilters() {
    setQuery('')
    setStatusFilter('all')
    setReasonFilter('all')
    setPriorityFilter('all')
    setPage(1)
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>Merchant workspace</span>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-600">Disputes</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
            Dispute inbox
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
            Search, filter, and triage every PayPal chargeback from a single
            queue. Open a case to review evidence and respond.
          </p>
        </div>

        <Link
          to="/dashboard#pending-actions"
          className="inline-flex h-10 w-fit shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        >
          Review pending queue
          <ArrowRight size={14} />
        </Link>
      </div>

      {statsQuery.isError ? (
        <ErrorPanel
          className="mt-6"
          title="Could not load dispute metrics"
          message={statsQuery.error}
          onRetry={statsQuery.reload}
        />
      ) : statsQuery.isLoading ? (
        <StatCardsSkeleton count={4} className="mt-6 xl:grid-cols-4" />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total disputes"
            value={stats.total}
            helper={`${stats.reasons} case types`}
            icon={Scale}
            tone="sky"
            onClick={() => handleStatusChange('all')}
          />
          <StatCard
            label="Open disputes"
            value={stats.open}
            helper={`${formatCurrency(stats.openValue)} at stake`}
            icon={Clock3}
            tone="amber"
            onClick={() => handleStatusChange('open')}
          />
          <StatCard
            label="Won disputes"
            value={stats.won}
            helper={`${stats.winRate}% win rate`}
            icon={Trophy}
            tone="emerald"
            onClick={() => handleStatusChange('won')}
          />
          <StatCard
            label="Lost disputes"
            value={stats.lost}
            helper={`${formatCurrency(stats.lostValue)} lost`}
            icon={CircleX}
            tone="rose"
            onClick={() => handleStatusChange('lost')}
          />
        </div>
      )}

      <div className="mt-6">
        <DisputeFilterBar
          query={query}
          onQueryChange={handleQueryChange}
          status={statusFilter}
          onStatusChange={handleStatusChange}
          counts={counts}
          reason={reasonFilter}
          onReasonChange={handleReasonChange}
          reasons={reasons}
          priority={priorityFilter}
          onPriorityChange={handlePriorityChange}
          sort={sortKey}
          onSortChange={handleSortChange}
          hasFilters={hasFilters}
          onReset={handleResetFilters}
          resultCount={filteredCount}
          totalCount={counts.all}
        />
      </div>

      <div className="mt-4">
        {listQuery.isError ? (
          <ErrorPanel
            title="Could not load the dispute queue"
            message={listQuery.error}
            onRetry={listQuery.reload}
          />
        ) : listQuery.isLoading ? (
          <TableSkeleton rows={PAGE_SIZE} />
        ) : (
          <DisputeInboxTable
            disputes={disputeRows}
            filteredCount={filteredCount}
            page={currentPage}
            totalPages={totalPages}
            startIndex={startIndex}
            pageSize={listData?.pageSize ?? PAGE_SIZE}
            onPageChange={setPage}
            onSelectDispute={(disputeId) => navigate(`/disputes/${disputeId}`)}
            onResetFilters={handleResetFilters}
          />
        )}
      </div>
    </div>
  )
}

export default DisputeInboxPage
