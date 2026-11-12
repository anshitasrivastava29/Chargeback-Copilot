import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileQuestion } from 'lucide-react'

import { ActivityCard } from '@/components/disputes/detail/ActivityCard'
import { AiAnalysisPanel } from '@/components/disputes/detail/AiAnalysisPanel'
import { CustomerCard } from '@/components/disputes/detail/CustomerCard'
import { EvidenceManagementCard } from '@/components/disputes/detail/EvidenceManagementCard'
import { OrderDetailsCard } from '@/components/disputes/detail/OrderDetailsCard'
import { RefundStatusCard } from '@/components/disputes/detail/RefundStatusCard'
import { TrackingCard } from '@/components/disputes/detail/TrackingCard'
import { CopyButton } from '@/components/ui/CopyButton'
import { DueBadge } from '@/components/ui/DueBadge'
import { PriorityBadge } from '@/components/ui/PriorityBadge'
import { ReasonIcon } from '@/components/ui/ReasonIcon'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ErrorPanel, LoadingPanel } from '@/components/ui/AsyncState'
import { useApiQuery } from '@/hooks/useApiQuery'
import { fetchDispute } from '@/services/disputes'
import { formatCurrency, formatFullDate } from '@/utils/format'

function DisputeNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <FileQuestion size={22} />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
        Dispute not found
      </h1>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
        This dispute does not exist in the merchant workspace, or the link is
        no longer valid.
      </p>
      <Link
        to="/disputes"
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        <ArrowLeft size={14} />
        Back to dispute inbox
      </Link>
    </div>
  )
}

function DisputeDetailPage() {
  const { disputeId } = useParams()

  const detailQuery = useApiQuery(`dispute:${disputeId}`, (signal) =>
    fetchDispute(disputeId, signal),
  )

  if (detailQuery.isError) {
    if (detailQuery.statusCode === 404) {
      return <DisputeNotFound />
    }

    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <ErrorPanel
          title="Could not load this dispute"
          message={detailQuery.error}
          onRetry={detailQuery.reload}
        />
      </div>
    )
  }

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <LoadingPanel
          label="Loading dispute details…"
          className="min-h-72"
        />
      </div>
    )
  }

  const dispute = detailQuery.data

  return (
    <DisputeDetailView
      key={dispute.id}
      dispute={dispute}
      onRefresh={detailQuery.reload}
    />
  )
}

function DisputeDetailView({ dispute, onRefresh }) {
  const isOpen = dispute.status === 'open'

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Link
        to="/disputes"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft size={13} />
        Back to dispute inbox
      </Link>

      <header className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <ReasonIcon
              reason={dispute.reason}
              className="h-12 w-12 rounded-xl"
            />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={dispute.status} />
                <PriorityBadge priority={dispute.priority} />
                {dispute.submittedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <CheckCircle2 size={11} />
                    Response recorded
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {dispute.reason}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-500">
                  {dispute.id}
                </span>
                <CopyButton text={dispute.id} label="Copy ID" />
              </div>

              <p className="mt-1.5 text-[11px] text-slate-400">
                Opened {formatFullDate(dispute.openedAt)}
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50/80 px-5 py-4 lg:min-w-56 lg:text-right">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Disputed amount
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">
              {formatCurrency(dispute.amount)}
            </p>
            {isOpen ? (
              <div className="mt-2 flex flex-col gap-0.5 lg:items-end">
                <DueBadge dateValue={dispute.dueAt} />
                <span className="text-[10px] text-slate-400">
                  Respond by {formatFullDate(dispute.dueAt)}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">
                Resolved {formatFullDate(dispute.resolvedAt)}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <CustomerCard dispute={dispute} />
          <OrderDetailsCard dispute={dispute} />
          <TrackingCard dispute={dispute} />
          <RefundStatusCard dispute={dispute} />
          <EvidenceManagementCard
            dispute={dispute}
            files={dispute.evidenceFiles ?? []}
            onRefresh={onRefresh}
          />
          <ActivityCard dispute={dispute} />
        </div>

        <aside className="min-w-0 space-y-6">
          <AiAnalysisPanel dispute={dispute} onSubmitted={onRefresh} />
        </aside>
      </div>
    </div>
  )
}

export default DisputeDetailPage
