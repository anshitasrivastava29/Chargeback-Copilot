import { AlertCircle, Inbox, Loader2, RotateCcw } from 'lucide-react'

import { cn } from '@/utils/cn'

export function Skeleton({ className }) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-slate-100', className)}
      aria-hidden="true"
    />
  )
}

export function LoadingPanel({ label = 'Loading…', className }) {
  return (
    <div
      className={cn(
        'flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm',
        className,
      )}
      role="status"
    >
      <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
        <Loader2 size={15} className="animate-spin text-blue-600" />
        {label}
      </span>
    </div>
  )
}

export function ErrorPanel({
  title = 'Could not load this section',
  message,
  onRetry,
  className,
  compact = false,
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-rose-200 bg-rose-50/60 text-rose-900',
        compact ? 'p-4' : 'flex flex-col items-center p-8 text-center',
        className,
      )}
      role="alert"
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full bg-white text-rose-500 ring-1 ring-rose-200',
          compact ? 'h-8 w-8' : 'h-11 w-11',
        )}
      >
        <AlertCircle size={compact ? 16 : 20} />
      </span>
      <p className={cn('font-semibold', compact ? 'mt-2 text-xs' : 'mt-3 text-sm')}>
        {title}
      </p>
      {message && (
        <p
          className={cn(
            'mt-1 text-rose-700/80',
            compact ? 'text-[11px] leading-4' : 'max-w-md text-xs leading-5',
          )}
        >
          {message}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white font-medium text-rose-700 transition hover:bg-rose-50',
            compact ? 'mt-2.5 px-2.5 py-1.5 text-[10px]' : 'mt-4 px-3 py-1.5 text-xs',
          )}
        >
          <RotateCcw size={12} />
          Try again
        </button>
      )}
    </div>
  )
}

export function InlineError({ message, onRetry, className }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2.5 text-[11px] text-rose-800 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      role="alert"
    >
      <span className="inline-flex items-start gap-1.5">
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
        {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex w-fit items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 font-medium text-rose-700 transition hover:bg-rose-50"
        >
          <RotateCcw size={11} />
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyPanel({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  message,
  action,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm',
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={20} />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-800">{title}</p>
      {message && (
        <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
          {message}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function StatCardsSkeleton({ count = 4, className }) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-4 w-4" />
          </div>
          <Skeleton className="mt-4 h-3 w-24" />
          <Skeleton className="mt-2 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6, className }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm',
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-4 sm:px-5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
            <Skeleton className="hidden h-3 w-16 sm:block" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  )
}
