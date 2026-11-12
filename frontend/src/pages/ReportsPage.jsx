import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock3,
  Download,
  FileCheck2,
  FolderLock,
  Layers,
  Scale,
  Target,
  TrendingDown,
  Trophy,
  Wallet,
} from 'lucide-react'

import {
  ErrorPanel,
  LoadingPanel,
  StatCardsSkeleton,
} from '@/components/ui/AsyncState'
import { useApiQuery } from '@/hooks/useApiQuery'
import { fetchReportsSummary } from '@/services/reports'
import { cn } from '@/utils/cn'
import { formatCurrency } from '@/utils/format'

const RANGE_OPTIONS = [
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last 12 months' },
  { days: 0, label: 'All time' },
]

const TONES = {
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
}

function ReportStat({ icon: Icon, label, value, helper, tone = 'sky' }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset',
          TONES[tone],
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

function OutcomeBar({ totals }) {
  const total = Math.max(1, totals.total)
  const openPercent = Math.round((totals.open / total) * 100)
  const wonPercent = Math.round((totals.won / total) * 100)
  const lostPercent = Math.max(0, 100 - openPercent - wonPercent)

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="bg-emerald-400"
          style={{ width: `${wonPercent}%` }}
          title={`${totals.won} won`}
        />
        <div
          className="bg-rose-400"
          style={{ width: `${lostPercent}%` }}
          title={`${totals.lost} lost`}
        />
        <div
          className="bg-amber-300"
          style={{ width: `${openPercent}%` }}
          title={`${totals.open} open`}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { key: 'won', label: 'Won', value: totals.won, dot: 'bg-emerald-400' },
          { key: 'lost', label: 'Lost', value: totals.lost, dot: 'bg-rose-400' },
          { key: 'open', label: 'Open', value: totals.open, dot: 'bg-amber-300' },
        ].map((item) => (
          <div key={item.key} className="rounded-lg bg-slate-50 px-2 py-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
              <span className={cn('h-1.5 w-1.5 rounded-full', item.dot)} />
              {item.label}
            </span>
            <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthlyChart({ points }) {
  const max = Math.max(1, ...points.map((point) => point.total))

  if (points.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-slate-400">
        No disputes opened in this range.
      </p>
    )
  }

  return (
    <div className="mt-5 flex items-end gap-2 sm:gap-3">
      {points.map((point) => (
        <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="flex h-36 w-full items-end justify-center">
            <div
              className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-t-md bg-slate-100"
              style={{
                height: `${Math.max(10, (point.total / max) * 144)}px`,
              }}
              title={`${point.label}: ${point.total} cases · ${point.won} won · ${point.lost} lost · ${point.open} open`}
            >
              <div
                className="bg-emerald-400"
                style={{ height: `${(point.won / point.total) * 100}%` }}
              />
              <div
                className="bg-rose-400"
                style={{ height: `${(point.lost / point.total) * 100}%` }}
              />
              <div
                className="bg-amber-300"
                style={{ height: `${(point.open / point.total) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] font-medium text-slate-500">
            {point.label}
          </span>
          <span className="text-[10px] tabular-nums text-slate-400">
            {point.total}
          </span>
        </div>
      ))}
    </div>
  )
}

function ReportsPage() {
  const [rangeDays, setRangeDays] = useState(90)
  const [exporting, setExporting] = useState(false)

  const reportsQuery = useApiQuery(`reports:${rangeDays}`, (signal) =>
    fetchReportsSummary(rangeDays || undefined, signal),
  )
  const data = reportsQuery.data

  const rangeLabel =
    RANGE_OPTIONS.find((option) => option.days === rangeDays)?.label ??
    'Selected range'

  function exportCsv() {
    if (!data) {
      return
    }

    setExporting(true)
    try {
      const rows = [
        ['Chargeback Copilot report'],
        ['Range', rangeLabel],
        ['Generated', new Date().toISOString()],
        [],
        [
          'Reason',
          'Total',
          'Open',
          'Won',
          'Lost',
          'Win rate %',
          'Dispute value',
          'Open value',
          'Lost value',
          'Avg resolution days',
        ],
        ...data.reasons.map((row) => [
          row.reason,
          row.total,
          row.open,
          row.won,
          row.lost,
          row.winRate,
          row.amount,
          row.openAmount,
          row.lostAmount,
          row.averageResolutionDays ?? '',
        ]),
        [],
        ['Totals', data.totals.total, data.totals.open, data.totals.won, data.totals.lost],
        ['Win rate %', data.totals.winRate],
        ['Open value', data.totals.openValue],
        ['Won value', data.totals.wonValue],
        ['Lost value', data.totals.lostValue],
        ['Evidence coverage %', data.evidence.coveragePercent],
      ]

      const csv = rows
        .map((row) =>
          row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','),
        )
        .join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `chargeback-report-${rangeDays || 'all'}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>Merchant workspace</span>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-600">Reports</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
            Dispute analytics
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
            Win rate, value at risk, evidence coverage, and the reasons driving
            chargebacks across the workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block">
            <span className="sr-only">Report range</span>
            <CalendarDays
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              value={rangeDays}
              onChange={(event) => setRangeDays(Number(event.target.value))}
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
            onClick={exportCsv}
            disabled={!data || exporting}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-default disabled:text-slate-300"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {reportsQuery.isError ? (
        <ErrorPanel
          className="mt-6"
          title="Could not load reports"
          message={reportsQuery.error}
          onRetry={reportsQuery.reload}
        />
      ) : reportsQuery.isLoading ? (
        <>
          <StatCardsSkeleton
            count={6}
            className="mt-6 sm:grid-cols-2 xl:grid-cols-6"
          />
          <LoadingPanel className="mt-6" label="Crunching dispute history…" />
        </>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <ReportStat
              icon={Scale}
              label="Disputes"
              value={data.totals.total}
              helper={`${data.totals.resolved} resolved · ${data.totals.open} open`}
              tone="sky"
            />
            <ReportStat
              icon={Trophy}
              label="Win rate"
              value={`${data.totals.winRate}%`}
              helper={`${data.totals.won} won · ${data.totals.lost} lost`}
              tone="emerald"
            />
            <ReportStat
              icon={Wallet}
              label="At stake"
              value={formatCurrency(data.totals.openValue)}
              helper={`Avg case ${formatCurrency(data.totals.averageDisputeValue)}`}
              tone="amber"
            />
            <ReportStat
              icon={TrendingDown}
              label="Lost value"
              value={formatCurrency(data.totals.lostValue)}
              helper={`${formatCurrency(data.totals.wonValue)} recovered`}
              tone="rose"
            />
            <ReportStat
              icon={Clock3}
              label="Avg resolution"
              value={
                data.resolution.averageDays == null
                  ? '—'
                  : `${data.resolution.averageDays}d`
              }
              helper={`${data.resolution.submittedCount} responses submitted`}
              tone="violet"
            />
            <ReportStat
              icon={FileCheck2}
              label="Evidence coverage"
              value={`${data.evidence.coveragePercent}%`}
              helper={`${data.evidence.completed}/${data.evidence.required} requirements met`}
              tone="sky"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Monthly caseload
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Cases opened per month, split by outcome
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Won
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      Lost
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                      Open
                    </span>
                  </div>
                </div>
                <MonthlyChart points={data.monthly} />
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Performance by reason
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Win rate and value exposure per dispute category
                    </p>
                  </div>
                  <Target size={16} className="text-slate-300" />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                        {[
                          'Reason',
                          'Cases',
                          'Open',
                          'Won',
                          'Lost',
                          'Win rate',
                          'Value',
                          'Lost value',
                        ].map((heading) => (
                          <th
                            key={heading}
                            scope="col"
                            className={cn(
                              'px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400',
                              heading !== 'Reason' && 'text-right',
                            )}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.reasons.map((row) => (
                        <tr key={row.reason} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <p className="text-xs font-semibold text-slate-800">
                              {row.reason}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {row.averageResolutionDays == null
                                ? 'No resolved cases'
                                : `${row.averageResolutionDays}d avg resolution`}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-600">
                            {row.total}
                          </td>
                          <td className="px-4 py-3 text-right text-xs tabular-nums text-amber-600">
                            {row.open}
                          </td>
                          <td className="px-4 py-3 text-right text-xs tabular-nums text-emerald-600">
                            {row.won}
                          </td>
                          <td className="px-4 py-3 text-right text-xs tabular-nums text-rose-600">
                            {row.lost}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-emerald-400"
                                  style={{ width: `${row.winRate}%` }}
                                />
                              </div>
                              <span className="w-8 text-right text-xs font-medium tabular-nums text-slate-600">
                                {row.winRate}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-medium tabular-nums text-slate-700">
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="px-4 py-3 text-right text-xs tabular-nums text-rose-600">
                            {row.lostAmount ? formatCurrency(row.lostAmount) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Outcome mix
                  </h2>
                  <Layers size={16} className="text-slate-300" />
                </div>
                <div className="mt-4">
                  <OutcomeBar totals={data.totals} />
                </div>
                <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-5 text-slate-500">
                  {data.totals.resolved > 0
                    ? `${data.totals.winRate}% of closed cases were won, protecting ${formatCurrency(data.totals.wonValue)}.`
                    : 'No cases have closed in this range yet.'}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Evidence readiness
                  </h2>
                  <FileCheck2 size={16} className="text-slate-300" />
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <p className="text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
                    {data.evidence.coveragePercent}%
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {data.evidence.completed} of {data.evidence.required} requirements
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      data.evidence.coveragePercent >= 80
                        ? 'bg-emerald-400'
                        : data.evidence.coveragePercent >= 55
                          ? 'bg-amber-400'
                          : 'bg-rose-400',
                    )}
                    style={{ width: `${data.evidence.coveragePercent}%` }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 px-2 py-2">
                    <p className="text-sm font-semibold text-slate-900 tabular-nums">
                      {data.evidence.documents}
                    </p>
                    <p className="text-[10px] text-slate-400">Documents</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2 py-2">
                    <p className="text-sm font-semibold text-slate-900 tabular-nums">
                      {data.evidence.gaps}
                    </p>
                    <p className="text-[10px] text-slate-400">Open gaps</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Most missing evidence
                  </p>
                  {data.topGaps.length === 0 ? (
                    <p className="mt-2 text-[11px] text-slate-500">
                      Every required evidence type is covered.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {data.topGaps.map((gap) => {
                        const maxCount = data.topGaps[0]?.count || 1
                        return (
                          <li key={gap.evidenceType}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[11px] text-slate-600">
                                {gap.evidenceType}
                              </span>
                              <span className="text-[10px] font-medium tabular-nums text-slate-500">
                                {gap.count}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-amber-400"
                                style={{
                                  width: `${Math.round((gap.count / maxCount) * 100)}%`,
                                }}
                              />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <Link
                  to="/evidence"
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                >
                  <FolderLock size={12} />
                  Browse evidence vault
                  <ArrowRight size={12} />
                </Link>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Deadline exposure
                  </h2>
                  <AlertTriangle
                    size={16}
                    className={
                      data.deadlines.overdue ? 'text-rose-400' : 'text-slate-300'
                    }
                  />
                </div>

                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2">
                    <span className="text-[11px] font-medium text-rose-700">
                      Overdue responses
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-rose-700">
                      {data.deadlines.overdue}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
                    <span className="text-[11px] font-medium text-amber-700">
                      Due within 7 days
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-amber-700">
                      {data.deadlines.dueSoon}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-[11px] font-medium text-slate-600">
                      Value at stake
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-800">
                      {formatCurrency(data.totals.openValue)}
                    </span>
                  </div>
                </div>

                <Link
                  to="/disputes"
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                >
                  Review open cases
                  <ArrowRight size={12} />
                </Link>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ReportsPage
