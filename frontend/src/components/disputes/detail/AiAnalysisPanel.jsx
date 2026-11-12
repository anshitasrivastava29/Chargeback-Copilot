import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  X,
} from 'lucide-react'

import { DetailCard } from '@/components/disputes/detail/DetailCard'
import { ErrorPanel, InlineError, LoadingPanel } from '@/components/ui/AsyncState'
import { CopyButton } from '@/components/ui/CopyButton'
import { useApiQuery } from '@/hooks/useApiQuery'
import { getApiErrorStatus, getApiErrorMessage } from '@/lib/api'
import {
  loadAnalysis,
  refreshAnalysis,
  saveResponseDraft,
  submitResponse,
} from '@/services/aiAnalysis'
import { cn } from '@/utils/cn'
import { RECOMMENDATION_STYLES } from '@/utils/dispute'
import { formatCurrency, formatFullDate } from '@/utils/format'

const RISK_META = {
  high: {
    label: 'High risk',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    panel: 'border-rose-200 bg-rose-50/50',
    dot: 'bg-rose-500',
  },
  medium: {
    label: 'Medium risk',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    panel: 'border-amber-200 bg-amber-50/50',
    dot: 'bg-amber-400',
  },
  low: {
    label: 'Low risk',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    panel: 'border-emerald-200 bg-emerald-50/50',
    dot: 'bg-emerald-500',
  },
}

const RECOMMENDATION_PRIORITY = {
  'do-first': {
    label: 'Do first',
    className: 'bg-rose-50 text-rose-700 ring-rose-200',
  },
  recommended: {
    label: 'Recommended',
    className: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  deadline: {
    label: 'Deadline',
    className: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
}

const GAP_SEVERITY = {
  critical: 'bg-rose-50 text-rose-700 ring-rose-200',
  supporting: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const SAVE_STATUS = {
  saving: 'Saving draft…',
  saved: 'Draft saved to the dispute service.',
}

export function AiAnalysisPanel({ dispute, onSubmitted }) {
  const evidenceKey = (dispute.evidenceFiles ?? [])
    .map((file) => file.id)
    .sort()
    .join('|')

  const analysisQuery = useApiQuery(
    `ai-analysis:${dispute.id}:${evidenceKey}`,
    (signal) => loadAnalysis(dispute.id, { signal }),
  )

  const analysis = analysisQuery.data
  const isOpen = dispute.status === 'open'
  const evidenceFiles = dispute.evidenceFiles ?? []
  const readyEvidence = evidenceFiles.filter(
    (file) => file.status === 'ready',
  )

  const [draft, setDraft] = useState(null)
  const [savedDraft, setSavedDraft] = useState(null)
  const [saveState, setSaveState] = useState('idle')
  const [saveError, setSaveError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [approved, setApproved] = useState(false)
  const [submitState, setSubmitState] = useState('idle')
  const [submitError, setSubmitError] = useState(null)
  const [submission, setSubmission] = useState(null)
  const [submitNotice, setSubmitNotice] = useState(null)

  const baseDraft = analysis?.responseDraft ?? ''
  const currentDraft = draft ?? baseDraft
  const submittedAt = submission?.submittedAt ?? dispute.submittedAt ?? null
  const isSubmitted = Boolean(submittedAt)
  const canEdit = isOpen && !isSubmitted
  const isDirty =
    savedDraft === null ? currentDraft !== baseDraft : currentDraft !== savedDraft
  const gaps = analysis?.evidenceGaps ?? []

  useEffect(() => {
    if (saveState !== 'saved') {
      return undefined
    }

    const timer = window.setTimeout(() => setSaveState('idle'), 2600)
    return () => window.clearTimeout(timer)
  }, [saveState])

  useEffect(() => {
    if (!reviewOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape' && submitState !== 'submitting') {
        setReviewOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [reviewOpen, submitState])

  function handleDraftChange(event) {
    setDraft(event.target.value)
    setSaveState('idle')
    setSaveError(null)
  }

  function handleRestore() {
    setDraft(null)
    setSavedDraft(null)
    setSaveState('idle')
    setSaveError(null)
  }

  async function handleSave() {
    if (!analysis || !canEdit || !isDirty || saveState === 'saving') {
      return
    }

    setSaveState('saving')
    setSaveError(null)

    try {
      await saveResponseDraft(dispute.id, currentDraft)
      setSavedDraft(currentDraft)
      setSaveState('saved')
    } catch (error) {
      setSaveState('error')
      setSaveError(getApiErrorMessage(error, 'Could not save the draft.'))

      if (getApiErrorStatus(error) === 409) {
        onSubmitted?.()
      }
    }
  }

  function handleOpenReview() {
    if (!canEdit || !currentDraft.trim()) {
      return
    }

    setApproved(false)
    setSubmitError(null)
    setSubmitState('idle')
    setReviewOpen(true)
  }

  async function handleSubmitResponse() {
    if (!approved || !canEdit || submitState === 'submitting') {
      return
    }

    setSubmitState('submitting')
    setSubmitError(null)

    try {
      const result = await submitResponse(
        dispute.id,
        currentDraft,
        readyEvidence.map((file) => file.id),
      )

      setSubmission(result)
      setSubmitState('done')
      setSubmitNotice(null)
      setApproved(false)
      setReviewOpen(false)
      onSubmitted?.()
    } catch (error) {
      if (getApiErrorStatus(error) === 409) {
        setReviewOpen(false)
        setSubmitState('idle')
        setSubmitNotice(
          `${getApiErrorMessage(
            error,
            'The response has already been submitted.',
          )} No duplicate submission was created.`,
        )
        onSubmitted?.()
        return
      }

      setSubmitState('error')
      setSubmitError(
        getApiErrorMessage(error, 'Could not submit the response.'),
      )
    }
  }

  async function handleRefreshAnalysis() {
    if (refreshing) {
      return
    }

    setRefreshing(true)
    setRefreshError(null)

    try {
      await refreshAnalysis(dispute.id)
      analysisQuery.reload()
    } catch (error) {
      setRefreshError(
        getApiErrorMessage(error, 'Could not refresh the AI analysis.'),
      )
    } finally {
      setRefreshing(false)
    }
  }

  const headerAction = (
    <div className="flex items-center gap-1.5">
      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
        Copilot
      </span>
      <button
        type="button"
        onClick={handleRefreshAnalysis}
        disabled={refreshing || analysisQuery.isLoading}
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-wait disabled:opacity-60"
        aria-label="Refresh AI analysis"
      >
        <RefreshCw size={11} className={refreshing ? 'animate-spin' : undefined} />
        <span className="hidden sm:inline">Refresh</span>
      </button>
    </div>
  )

  if (analysisQuery.isError) {
    return (
      <DetailCard
        title="AI analysis"
        icon={Sparkles}
        description="Classification, risk, evidence gaps, and a response draft."
        action={headerAction}
      >
        <ErrorPanel
          compact
          className="mt-4"
          title="Could not load AI analysis"
          message={analysisQuery.error}
          onRetry={analysisQuery.reload}
        />
      </DetailCard>
    )
  }

  if (analysisQuery.isLoading || !analysis) {
    return (
      <DetailCard
        title="AI analysis"
        icon={Sparkles}
        description="Classification, risk, evidence gaps, and a response draft."
        action={headerAction}
      >
        <LoadingPanel
          label="Analyzing this dispute…"
          className="mt-4 min-h-48 border-0 shadow-none"
        />
      </DetailCard>
    )
  }

  const risk = RISK_META[analysis.risk.level] ?? RISK_META.medium

  return (
    <DetailCard
      title="AI analysis"
      icon={Sparkles}
      description="Classification, risk, evidence gaps, and a response draft."
      action={headerAction}
    >
      {refreshError && (
        <InlineError
          className="mt-4"
          message={refreshError}
          onRetry={handleRefreshAnalysis}
        />
      )}

      <div
        className={cn(
          'mt-4 rounded-xl border p-3.5',
          RECOMMENDATION_STYLES[analysis.recommendation.tone] ??
            RECOMMENDATION_STYLES.blue,
        )}
      >
        <p className="text-sm font-semibold">{analysis.recommendation.title}</p>
        <p className="mt-1.5 text-[11px] leading-5 opacity-80">
          {analysis.recommendation.body}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
            Win likelihood
          </p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
            {analysis.winLikelihood === null
              ? '—'
              : `${analysis.winLikelihood}%`}
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-slate-100">
            <div
              className={cn(
                'h-full rounded-full',
                analysis.winLikelihood === null
                  ? 'bg-slate-300'
                  : analysis.winLikelihood >= 65
                    ? 'bg-emerald-500'
                    : analysis.winLikelihood >= 45
                      ? 'bg-amber-400'
                      : 'bg-rose-500',
              )}
              style={{ width: `${analysis.winLikelihood ?? 0}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
            AI confidence
          </p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
            {analysis.classification.confidence}%
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-slate-100">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${analysis.classification.confidence}%` }}
            />
          </div>
        </div>
      </div>

      <section className="mt-5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Dispute classification
        </h3>
        <div className="mt-2 rounded-xl border border-slate-100 bg-white p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
              {analysis.classification.category}
            </span>
            <ChevronRight size={11} className="text-slate-300" />
            <p className="text-xs font-semibold text-slate-800">
              {analysis.classification.type}
            </p>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">
            Filed as {dispute.reason}
          </p>
        </div>
      </section>

      <section className="mt-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Risk level
        </h3>
        <div className={cn('mt-2 rounded-xl border p-3', risk.panel)}>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
              risk.badge,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', risk.dot)} />
            {risk.label}
          </span>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-600">
            {analysis.risk.summary}
          </p>
        </div>
      </section>

      <section className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Evidence gaps
          </h3>
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset',
              gaps.length
                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            )}
          >
            {gaps.length ? `${gaps.length} open` : 'None'}
          </span>
        </div>

        {gaps.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {gaps.map((gap) => (
              <li
                key={gap.type}
                className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    size={13}
                    className="mt-0.5 shrink-0 text-amber-600"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <p className="text-xs font-medium text-amber-950">
                        {gap.type}
                      </p>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ring-1 ring-inset',
                          GAP_SEVERITY[gap.severity] ?? GAP_SEVERITY.supporting,
                        )}
                      >
                        {gap.severity}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-4 text-amber-900/70">
                      {gap.note}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-medium text-emerald-800">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            All required evidence is attached.
          </div>
        )}
      </section>

      <section className="mt-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Recommendations
        </h3>
        <ol className="mt-2 space-y-2">
          {(analysis.recommendations ?? []).map((recommendation, index) => {
            const priority =
              RECOMMENDATION_PRIORITY[recommendation.priority] ??
              RECOMMENDATION_PRIORITY.recommended

            return (
              <li
                key={recommendation.title}
                className="rounded-xl border border-slate-100 bg-white p-2.5"
              >
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs font-medium text-slate-800">
                        {recommendation.title}
                      </p>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1 ring-inset',
                          priority.className,
                        )}
                      >
                        {priority.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                      {recommendation.detail}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="mt-2 rounded-xl bg-blue-50/70 p-2.5 ring-1 ring-inset ring-blue-100">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-blue-700">
            Suggested next step
          </p>
          <p className="mt-1 text-[10px] leading-4 text-slate-700">
            {analysis.nextStep}
          </p>
        </div>
      </section>

      <section className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-blue-600" />
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              AI response draft
            </h3>
          </div>
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1 ring-inset',
              isSubmitted
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : isOpen
                  ? 'bg-blue-50 text-blue-700 ring-blue-200'
                  : 'bg-slate-100 text-slate-500 ring-slate-200',
            )}
          >
            {isSubmitted ? 'Submitted' : isOpen ? 'Editable' : 'Read-only'}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-4 text-slate-400">
          Generated from the case records. Review and personalize it before
          sending.
        </p>

        {submitNotice && (
          <div
            className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-[10px] leading-4 text-amber-900"
            role="status"
          >
            {submitNotice}
          </div>
        )}

        {isSubmitted && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Response recorded
              </p>
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {submission?.status ?? 'recorded'}
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-emerald-900/80">
              Approved by the merchant and recorded on{' '}
              {formatFullDate(submittedAt)}. The dispute service stores the
              submission; PayPal delivery is handled by the backend integration.
            </p>
            <p className="mt-1 text-[10px] leading-4 text-emerald-900/70">
              {submission?.paypalReference
                ? `PayPal reference: ${submission.paypalReference}`
                : 'No PayPal confirmation reference has been issued yet.'}
            </p>
          </div>
        )}

        <label htmlFor="ai-response-draft" className="sr-only">
          AI response draft
        </label>
        <textarea
          id="ai-response-draft"
          value={currentDraft}
          onChange={handleDraftChange}
          disabled={!canEdit}
          rows={9}
          className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-[11px] leading-5 text-slate-700 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        />

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400">
          <span>{currentDraft.length} characters</span>
          <span>
            {isSubmitted
              ? 'Submission is final'
              : isOpen
                ? 'Unsaved changes stay local'
                : 'Case closed'}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleRestore}
            disabled={!canEdit || currentDraft === baseDraft}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={11} />
            Restore
          </button>
          <CopyButton text={currentDraft} label="Copy" />

          {canEdit && (
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || saveState === 'saving'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saveState === 'saving' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : saveState === 'saved' ? (
                  <Check size={12} />
                ) : (
                  <Save size={12} />
                )}
                {saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'saved'
                    ? 'Saved'
                    : 'Save draft'}
              </button>
              <button
                type="button"
                onClick={handleOpenReview}
                disabled={!currentDraft.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Send size={12} />
                Review &amp; submit
              </button>
            </div>
          )}
        </div>

        <p
          aria-live="polite"
          className={cn(
            'mt-2 text-[10px]',
            saveState === 'error' ? 'text-rose-600' : 'text-emerald-600',
          )}
        >
          {saveState === 'error' ? saveError : (SAVE_STATUS[saveState] ?? '')}
        </p>
      </section>

      <p className="mt-4 flex flex-wrap items-center gap-x-1.5 border-t border-slate-100 pt-3 text-[9px] leading-4 text-slate-400">
        <span>Generated by {analysis.model ?? 'Copilot'}</span>
        {analysis.generatedAt && (
          <>
            <span aria-hidden="true">·</span>
            <span>{formatFullDate(analysis.generatedAt)}</span>
          </>
        )}
        {analysis.citations?.length > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span>{analysis.citations.length} case citations</span>
          </>
        )}
      </p>

      {reviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => {
            if (submitState !== 'submitting') {
              setReviewOpen(false)
            }
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Review and submit response"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  Review response
                </p>
                <p className="mt-0.5 truncate text-[10px] text-slate-400">
                  {dispute.id} · {dispute.reason} ·{' '}
                  {formatCurrency(dispute.amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                disabled={submitState === 'submitting'}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-wait disabled:opacity-50"
                aria-label="Close review"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-slate-400">
                    Disputed amount
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatCurrency(dispute.amount)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-slate-400">
                    Evidence
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                    {readyEvidence.length}{' '}
                    {readyEvidence.length === 1 ? 'file' : 'files'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-slate-400">
                    Respond by
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                    {dispute.dueAt ? formatFullDate(dispute.dueAt) : '—'}
                  </p>
                </div>
              </div>

              {gaps.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-[10px] leading-4 text-amber-900">
                  <span className="font-semibold">
                    {gaps.length} required evidence{' '}
                    {gaps.length === 1 ? 'item is' : 'items are'} still missing.
                  </span>{' '}
                  You can submit now, but PayPal may weigh the gaps against this
                  case.
                </div>
              )}

              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Response to submit
                </p>
                <div className="mt-1.5 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-[11px] leading-5 text-slate-700">
                  {currentDraft}
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Evidence referenced ({readyEvidence.length})
                </p>
                {readyEvidence.length > 0 ? (
                  <ul className="mt-1.5 space-y-1">
                    {readyEvidence.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-1.5"
                      >
                        <FileText size={12} className="shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-700">
                          {file.name}
                        </span>
                        <span className="shrink-0 text-[9px] text-slate-400">
                          {file.evidenceType}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-2.5 py-2 text-[10px] text-slate-500">
                    No evidence files will be referenced with this response.
                  </p>
                )}
              </div>

              <label className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(event) => setApproved(event.target.checked)}
                  disabled={submitState === 'submitting'}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] leading-4 text-slate-600">
                  I have reviewed this response and approve submitting it on
                  behalf of the merchant account. I understand each dispute can
                  be submitted only once.
                </span>
              </label>

              {submitError && <InlineError className="mt-3" message={submitError} />}

              <p className="mt-2 text-[10px] leading-4 text-slate-400">
                Submitting records the response in Chargeback Copilot. It does
                not confirm a PayPal decision, and this screen does not create a
                PayPal reference.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                disabled={submitState === 'submitting'}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitResponse}
                disabled={!approved || submitState === 'submitting'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitState === 'submitting' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
                {submitState === 'submitting'
                  ? 'Submitting…'
                  : 'Submit response'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DetailCard>
  )
}

export default AiAnalysisPanel
