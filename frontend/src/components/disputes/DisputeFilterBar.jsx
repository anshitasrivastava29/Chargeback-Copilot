import { ChevronDown, RotateCcw, Search, X } from 'lucide-react'

import { cn } from '@/utils/cn'

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
]

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All priorities' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount-desc', label: 'Amount: high to low' },
  { value: 'amount-asc', label: 'Amount: low to high' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'customer', label: 'Customer A–Z' },
]

function FilterSelect({ label, value, onChange, options, className }) {
  return (
    <label
      className={cn(
        'flex w-full items-center gap-1.5 text-[11px] font-medium text-slate-500 sm:w-auto',
        className,
      )}
    >
      <span className="hidden sm:inline">{label}</span>
      <span className="relative w-full sm:w-auto">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-2.5 pr-7 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-auto"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </span>
    </label>
  )
}

function DisputeFilterBar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  counts,
  reason,
  onReasonChange,
  reasons,
  priority,
  onPriorityChange,
  sort,
  onSortChange,
  hasFilters,
  onReset,
  resultCount,
  totalCount,
}) {
  const reasonOptions = [
    { value: 'all', label: 'All reasons' },
    ...reasons.map((item) => ({ value: item, label: item })),
  ]

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search ID, customer, or reason"
            aria-label="Search disputes"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-8 text-xs text-slate-700 transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <FilterSelect
            label="Reason"
            value={reason}
            onChange={onReasonChange}
            options={reasonOptions}
          />
          <FilterSelect
            label="Priority"
            value={priority}
            onChange={onPriorityChange}
            options={PRIORITY_OPTIONS}
          />
          <FilterSelect
            label="Sort by"
            value={sort}
            onChange={onSortChange}
            options={SORT_OPTIONS}
            className="col-span-2 sm:col-auto"
          />
          {hasFilters && (
            <button
              type="button"
              onClick={onReset}
              className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 sm:col-auto"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mb-px flex gap-5 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onStatusChange(tab.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 border-b-2 pb-2 text-xs font-medium transition',
                status === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                  status === tab.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-slate-100 text-slate-500',
                )}
              >
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        <p className="text-[11px] text-slate-500">
          {resultCount === totalCount ? (
            <>
              {totalCount} {totalCount === 1 ? 'case' : 'cases'} in view
            </>
          ) : (
            <>
              <span className="font-medium text-slate-700">{resultCount}</span>{' '}
              of <span className="tabular-nums">{totalCount}</span>{' '}
              {totalCount === 1 ? 'case' : 'cases'} match
            </>
          )}
        </p>
      </div>
    </section>
  )
}

export default DisputeFilterBar
