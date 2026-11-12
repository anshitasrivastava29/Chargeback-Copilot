import { useEffect, useRef, useState } from 'react'
import { Check, CheckCircle2, Circle, Copy, Sparkles, X } from 'lucide-react'

import { ReasonIcon } from '@/components/ui/ReasonIcon'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PriorityBadge } from '@/components/ui/PriorityBadge'
import { cn } from '@/utils/cn'
import {
  RECOMMENDATION_STYLES,
  buildDraft,
  getActivity,
  getRecommendation,
} from '@/utils/dispute'
import { getRequiredEvidenceTypes } from '@/utils/evidence'
import { formatCurrency, formatFullDate, getDueInfo } from '@/utils/format'

function DisputeDrawer({ dispute, onClose }) {
  const [draftVisible, setDraftVisible] = useState(false)
  const [copied, setCopied] = useState(null)
  const draftRef = useRef(null)

  useEffect(() => {
    if (draftVisible) {
      draftRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [draftVisible])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const due = getDueInfo(dispute.dueAt)
  const recommendation = getRecommendation(dispute)
  const requiredEvidence = getRequiredEvidenceTypes(dispute)
  const completedEvidence = new Set(dispute.evidence.completed ?? [])
  const evidencePercent = dispute.evidence.required
    ? Math.round(
        (dispute.evidence.uploaded / dispute.evidence.required) * 100,
      )
    : 0
  const draft = buildDraft(dispute)

  const timeline = getActivity(dispute)

  async function copyText(text, key) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispute-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl animate-slide-in"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <ReasonIcon reason={dispute.reason} className="h-10 w-10" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={dispute.status} />
                <PriorityBadge priority={dispute.priority} />
              </div>
              <h2
                id="dispute-drawer-title"
                className="mt-2 truncate text-lg font-semibold tracking-tight text-slate-900"
              >
                {dispute.reason}
              </h2>
              <button
                type="button"
                onClick={() => copyText(dispute.id, 'id')}
                className="mt-0.5 inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400 transition hover:text-slate-600"
              >
                <span className="font-mono">{dispute.id}</span>
                {copied === 'id' ? (
                  <Check size={11} className="text-emerald-500" />
                ) : (
                  <Copy size={11} />
                )}
                {copied === 'id' ? 'Copied' : 'Copy ID'}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close dispute details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Disputed amount
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
              {formatCurrency(dispute.amount)}
            </p>

            <dl className="mt-4 space-y-2 border-t border-slate-200/70 pt-3 text-[11px]">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-400">Buyer</dt>
                <dd className="text-right font-medium text-slate-700">
                  {dispute.buyer.name}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-400">Email</dt>
                <dd
                  title={dispute.buyer.email}
                  className="max-w-[65%] truncate text-right text-slate-600"
                >
                  {dispute.buyer.email}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-400">Opened</dt>
                <dd className="text-right text-slate-600">
                  {formatFullDate(dispute.openedAt)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-400">
                  {dispute.status === 'open' ? 'Deadline' : 'Resolved'}
                </dt>
                <dd
                  className={cn(
                    'text-right font-medium',
                    dispute.status === 'open'
                      ? due?.tone === 'danger'
                        ? 'text-rose-600'
                        : 'text-amber-600'
                      : 'text-slate-600',
                  )}
                >
                  {dispute.status === 'open'
                    ? `${due?.label} · ${formatFullDate(dispute.dueAt)}`
                    : formatFullDate(dispute.resolvedAt)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-400">Transaction</dt>
                <dd className="break-all text-right font-mono text-[10px] text-slate-500">
                  {dispute.transactionId}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-400">Order</dt>
                <dd className="text-right font-medium text-slate-600">
                  {dispute.orderId}
                </dd>
              </div>
            </dl>
          </div>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Evidence</h3>
              <span className="text-[11px] tabular-nums text-slate-500">
                {dispute.evidence.uploaded} of {dispute.evidence.required}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${evidencePercent}%` }}
              />
            </div>
            <ul className="mt-3 space-y-2">
              {requiredEvidence.map((item, index) => {
                const complete =
                  completedEvidence.size > 0
                    ? completedEvidence.has(item)
                    : index < dispute.evidence.uploaded

                return (
                  <li key={item} className="flex items-center gap-2 text-xs">
                    {complete ? (
                      <CheckCircle2
                        size={15}
                        className="shrink-0 text-emerald-500"
                      />
                    ) : (
                      <Circle size={15} className="shrink-0 text-slate-300" />
                    )}
                    <span
                      className={complete ? 'text-slate-600' : 'text-slate-400'}
                    >
                      {item}
                    </span>
                    {!complete && (
                      <span className="ml-auto text-[10px] font-medium text-amber-600">
                        Needed
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          <div
            className={cn(
              'rounded-xl border p-4',
              RECOMMENDATION_STYLES[recommendation.tone],
            )}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={14} />
              <p className="text-xs font-semibold">{recommendation.title}</p>
            </div>
            <p className="mt-1.5 text-[11px] leading-5 opacity-80">
              {recommendation.body}
            </p>
          </div>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Activity</h3>
            <ol className="mt-3 space-y-3">
              {timeline.map((event, index) => (
                <li key={event.label} className="flex gap-3">
                  <span className="flex flex-col items-center">
                    <span
                      className={cn(
                        'mt-1 h-2 w-2 rounded-full',
                        event.dot,
                      )}
                    />
                    {index < timeline.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-slate-200" />
                    )}
                  </span>
                  <div className="pb-1">
                    <p className="text-xs font-medium text-slate-700">
                      {event.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {event.date}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {draftVisible && (
            <section
              ref={draftRef}
              className="scroll-mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-blue-900">
                  AI draft preview
                </p>
                <button
                  type="button"
                  onClick={() => copyText(draft, 'draft')}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-[10px] font-medium text-blue-700 transition hover:bg-blue-50"
                >
                  {copied === 'draft' ? <Check size={11} /> : <Copy size={11} />}
                  {copied === 'draft' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 whitespace-pre-line text-[11px] leading-5 text-slate-600">
                {draft}
              </p>
              <p className="mt-2 text-[10px] text-slate-400">
                Demo draft — review and personalize before submitting.
              </p>
            </section>
          )}
        </div>

        <div className="border-t border-slate-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            {dispute.status === 'open' ? (
              <button
                type="button"
                onClick={() => setDraftVisible((value) => !value)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              >
                <Sparkles size={15} />
                {draftVisible ? 'Hide AI draft' : 'Draft AI response'}
              </button>
            ) : (
              <p className="flex-1 text-xs text-slate-500">
                This case is closed. No response is required.
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DisputeDrawer
