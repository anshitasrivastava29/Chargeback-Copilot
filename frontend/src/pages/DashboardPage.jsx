import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleX,
  Clock3,
  ListTodo,
  Scale,
  Sparkles,
  Trophy,
} from 'lucide-react'

import DisputeDrawer from '@/components/dashboard/DisputeDrawer'
import DisputesTable from '@/components/dashboard/DisputesTable'
import PendingActions from '@/components/dashboard/PendingActions'
import StatCard from '@/components/dashboard/StatCard'
import {
  ErrorPanel,
  StatCardsSkeleton,
  TableSkeleton,
} from '@/components/ui/AsyncState'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { fetchDashboardStats, fetchPendingActions } from '@/services/dashboard'
import { fetchDisputes } from '@/services/disputes'
import { formatCurrency } from '@/utils/format'

const PAGE_SIZE = 8
const PENDING_ACTION_LIMIT = 20

const RANGE_OPTIONS = [
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last 12 months' },
]

const EMPTY_COUNTS = { all: 0, open: 0, won: 0, lost: 0 }

function DashboardPage() {
  const [rangeDays, setRangeDays] = useState(90)
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('newest')
  const [page, setPage] = useState(1)
  const [selectedDisputeId, setSelectedDisputeId] = useState(null)
  const [completedActionIds, setCompletedActionIds] = useState(() => new Set())

  const debouncedQuery = useDebouncedValue(query, 300)

  const statsQuery = useApiQuery(`dashboard-stats:${rangeDays}`, (signal) =>
    fetchDashboardStats(rangeDays, signal),
  )

  const actionsQuery = useApiQuery(
    `pending-actions:${PENDING_ACTION_LIMIT}`,
    (signal) => fetchPendingActions(PENDING_ACTION_LIMIT, signal),
  )

  const listParams = useMemo(() => {
    const params = {
      days: rangeDays,
      sort: sortKey,
      page,
      pageSize: PAGE_SIZE,
    }

    if (statusFilter !== 'all') {
      params.status = statusFilter
    }

    if (debouncedQuery.trim()) {
      params.q = debouncedQuery.trim()
    }

    return params
  }, [rangeDays, sortKey, statusFilter, debouncedQuery, page])

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

  const pendingTasks = useMemo(() => {
    const actions = actionsQuery.data ?? []

    return [...actions]
      .map((action) => ({
        ...action,
        done: completedActionIds.has(action.id),
      }))
      .sort((a, b) => {
        if (a.done !== b.done) {
          return a.done ? 1 : -1
        }

        return (a.due?.days ?? 999) - (b.due?.days ?? 999)
      })
  }, [actionsQuery.data, completedActionIds])

  const pendingCount = pendingTasks.filter((task) => !task.done).length
  const overdueCount = pendingTasks.filter(
    (task) => !task.done && task.due && task.due.days < 0,
  ).length
  const dueThisWeekCount = pendingTasks.filter(
    (task) => !task.done && task.due && task.due.days >= 0 && task.due.days <= 7,
  ).length

  const selectedDispute = useMemo(() => {
    if (!selectedDisputeId) {
      return null
    }

    const fromList = (listData?.items ?? []).find(
      (item) => item.id === selectedDisputeId,
    )

    if (fromList) {
      return fromList
    }

    return (
      (actionsQuery.data ?? []).find(
        (action) => action.disputeId === selectedDisputeId,
      )?.dispute ?? null
    )
  }, [selectedDisputeId, listData, actionsQuery.data])

  function scrollToSection(id) {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleStatClick(nextStatus) {
    if (nextStatus === 'pending') {
      scrollToSection('pending-actions')
      return
    }

    setStatusFilter(nextStatus)
    setPage(1)
    scrollToSection('disputes')
  }

  function handleRangeChange(value) {
    setRangeDays(Number(value))
    setPage(1)
  }

  function handleStatusChange(value) {
    setStatusFilter(value)
    setPage(1)
  }

  function handleQueryChange(value) {
    setQuery(value)
    setPage(1)
  }

  function handleSortChange(value) {
    setSortKey(value)
    setPage(1)
  }

  function handleResetFilters() {
    setStatusFilter('all')
    setQuery('')
    setSortKey('newest')
    setPage(1)
  }

  function toggleAction(actionId) {
    setCompletedActionIds((previous) => {
      const next = new Set(previous)

      if (next.has(actionId)) {
        next.delete(actionId)
      } else {
        next.add(actionId)
      }

      return next
    })
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div id="overview" className="scroll-mt-24">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Merchant workspace</span>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-600">Overview</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
              Dispute overview
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Track PayPal chargebacks, prioritize deadlines, and protect
              revenue with evidence-backed responses.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative block">
              <span className="sr-only">Date range</span>
              <CalendarDays
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <select
                value={rangeDays}
                onChange={(event) => handleRangeChange(event.target.value)}
                className="h-10 appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.days} value={option.days}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </label>

            <button
              type="button"
              onClick={() => scrollToSection('pending-actions')}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            >
              <Sparkles size={14} />
              Review queue
            </button>
          </div>
        </div>
      </div>

      <div
        id="copilot-brief"
        className="relative mt-6 scroll-mt-24 overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-white p-4 shadow-sm dark:border-sky-400/25 dark:from-sky-500/10 dark:via-[#131d2e] dark:to-[#131d2e] sm:p-5"
      >
        <div className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm shadow-sky-600/20">
            <Sparkles size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700">
              Copilot brief
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {actionsQuery.isLoading ? (
                <span className="text-slate-400">
                  Loading the latest queue…
                </span>
              ) : actionsQuery.isError ? (
                <span className="text-slate-500">
                  Pending actions are temporarily unavailable.
                </span>
              ) : (
                <>
                  <span className="font-semibold text-slate-900">
                    {pendingCount} actions
                  </span>{' '}
                  need attention —{' '}
                  <span className="font-semibold text-rose-600">
                    {overdueCount} past due
                  </span>
                  . {formatCurrency(stats?.openValue ?? 0)} is currently at
                  stake.
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => scrollToSection('pending-actions')}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-2 text-[11px] font-medium text-sky-700 transition hover:bg-sky-50"
          >
            Open queue
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {statsQuery.isError ? (
        <ErrorPanel
          className="mt-6"
          title="Could not load dashboard metrics"
          message={statsQuery.error}
          onRetry={statsQuery.reload}
        />
      ) : statsQuery.isLoading ? (
        <StatCardsSkeleton
          count={5}
          className="mt-6 sm:grid-cols-2 xl:grid-cols-5"
        />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total disputes"
            value={stats.total}
            helper={`${stats.reasons} case types in view`}
            icon={Scale}
            tone="sky"
            onClick={() => handleStatClick('all')}
          />
          <StatCard
            label="Open disputes"
            value={stats.open}
            helper={`${formatCurrency(stats.openValue)} at stake`}
            icon={Clock3}
            tone="amber"
            onClick={() => handleStatClick('open')}
          />
          <StatCard
            label="Won disputes"
            value={stats.won}
            helper={`${stats.winRate}% win rate`}
            icon={Trophy}
            tone="emerald"
            onClick={() => handleStatClick('won')}
          />
          <StatCard
            label="Lost disputes"
            value={stats.lost}
            helper={`${formatCurrency(stats.lostValue)} lost`}
            icon={CircleX}
            tone="rose"
            onClick={() => handleStatClick('lost')}
          />
          <StatCard
            label="Pending actions"
            value={pendingCount}
            helper={`${overdueCount} overdue · ${dueThisWeekCount} due this week`}
            icon={ListTodo}
            tone="violet"
            onClick={() => handleStatClick('pending')}
            className="sm:col-span-2 xl:col-span-1"
          />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {listQuery.isError ? (
          <ErrorPanel
            title="Could not load disputes"
            message={listQuery.error}
            onRetry={listQuery.reload}
          />
        ) : listQuery.isLoading ? (
          <TableSkeleton rows={PAGE_SIZE} />
        ) : (
          <DisputesTable
            disputes={disputeRows}
            counts={counts}
            totalInPeriod={counts.all}
            statusFilter={statusFilter}
            onStatusChange={handleStatusChange}
            query={query}
            onQueryChange={handleQueryChange}
            sortKey={sortKey}
            onSortChange={handleSortChange}
            page={currentPage}
            totalPages={totalPages}
            startIndex={startIndex}
            pageSize={listData?.pageSize ?? PAGE_SIZE}
            filteredCount={filteredCount}
            onPageChange={setPage}
            onSelectDispute={setSelectedDisputeId}
            onResetFilters={handleResetFilters}
          />
        )}

        <PendingActions
          actions={pendingTasks}
          isLoading={actionsQuery.isLoading}
          errorMessage={actionsQuery.isError ? actionsQuery.error : null}
          onRetry={actionsQuery.reload}
          onToggleAction={toggleAction}
          onSelectDispute={setSelectedDisputeId}
        />
      </div>

      {selectedDispute && (
        <DisputeDrawer
          dispute={selectedDispute}
          onClose={() => setSelectedDisputeId(null)}
        />
      )}
    </div>
  )
}

export default DashboardPage
