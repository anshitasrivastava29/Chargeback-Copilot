import { Check, ChevronRight, Clock3, Inbox, Sparkles } from 'lucide-react'

import { ErrorPanel, LoadingPanel } from '@/components/ui/AsyncState'
import { cn } from '@/utils/cn'

const DUE_TONES = {
  danger: 'bg-rose-50 text-rose-600 ring-rose-100',
  warning: 'bg-amber-50 text-amber-700 ring-amber-100',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const PRIORITY_DOTS = {
  high: 'bg-rose-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-300',
}

function PendingActions({
  actions,
  isLoading = false,
  errorMessage = null,
  onRetry,
  onToggleAction,
  onSelectDispute,
}) {
  const remaining = actions.filter((action) => !action.done).length

  return (
    <section
      id="pending-actions"
      className="flex scroll-mt-24 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Pending actions
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Ordered by response deadline
          </p>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
          {remaining} open
        </span>
      </div>

      {errorMessage ? (
        <div className="p-3">
          <ErrorPanel
            compact
            title="Could not load pending actions"
            message={errorMessage}
            onRetry={onRetry}
          />
        </div>
      ) : isLoading ? (
        <LoadingPanel
          label="Loading actions…"
          className="m-3 min-h-32 border-0 shadow-none"
        />
      ) : actions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Inbox size={18} />
          </span>
          <p className="mt-2.5 text-xs font-medium text-slate-700">
            You are all caught up
          </p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            No responses or evidence uploads are due right now.
          </p>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-slate-100">
        {actions.map((action) => {
          const dispute = action.dispute

          return (
            <li
              key={action.id}
              className={cn('transition', action.done && 'opacity-60')}
            >
              <div className="flex items-start gap-3 px-4 py-4">
                <button
                  type="button"
                  onClick={() => onToggleAction(action.id)}
                  aria-pressed={action.done}
                  aria-label={
                    action.done
                      ? `Mark "${action.title}" as incomplete`
                      : `Mark "${action.title}" as complete`
                  }
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                    action.done
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 bg-white text-transparent hover:border-emerald-400',
                  )}
                >
                  <Check size={11} strokeWidth={3} />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectDispute(dispute.id)}
                  className="group flex min-w-0 flex-1 items-start gap-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-xs font-medium text-slate-800 transition group-hover:text-blue-700',
                        action.done && 'text-slate-400 line-through',
                      )}
                    >
                      {action.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                      {dispute.buyer.name} · {dispute.id}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-1.5">
                      {action.due && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset',
                            DUE_TONES[action.due.tone],
                          )}
                        >
                          <Clock3 size={10} />
                          {action.due.label}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] capitalize text-slate-500">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            PRIORITY_DOTS[dispute.priority],
                          )}
                        />
                        {dispute.priority} priority
                      </span>
                    </span>
                  </span>

                  <ChevronRight
                    size={15}
                    className="mt-0.5 shrink-0 text-slate-300 transition group-hover:text-slate-500"
                  />
                </button>
              </div>
            </li>
          )
        })}
        </ul>
      )}

      <div className="border-t border-slate-100 p-3.5">
        <div className="flex items-start gap-2 rounded-lg bg-sky-50 p-3 ring-1 ring-inset ring-sky-100">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-sky-600" />
          <p className="text-[10px] leading-4 text-sky-900/80">
            Copilot can pre-fill transaction and evidence details in every
            response.
          </p>
        </div>
      </div>
    </section>
  )
}

export default PendingActions
