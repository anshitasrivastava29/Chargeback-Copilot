import { RotateCcw } from 'lucide-react'

import { DetailCard, InfoField } from '@/components/disputes/detail/DetailCard'
import { cn } from '@/utils/cn'
import { formatCurrency, formatFullDate } from '@/utils/format'

const REFUND_STYLES = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function RefundStatusCard({ dispute }) {
  const refund = dispute.refund
  const refundDate = refund.date ?? refund.requestedAt ?? null

  return (
    <DetailCard
      title="Refund status"
      icon={RotateCcw}
      description="Refund activity for this charge"
      action={
        <span
          className={cn(
            'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
            REFUND_STYLES[refund.tone],
          )}
        >
          {refund.label}
        </span>
      }
    >
      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
        <InfoField label="Refund amount">
          {refund.amount === null ? '—' : formatCurrency(refund.amount)}
        </InfoField>
        <InfoField label="Refund method">
          <span className="text-xs font-medium text-slate-700">
            {refund.method ?? '—'}
          </span>
        </InfoField>
        <InfoField
          label={
            refund.key === 'pending' || refund.key === 'offered'
              ? 'Requested'
              : refundDate
                ? 'Processed'
                : 'Last update'
          }
        >
          <span className="text-xs font-medium text-slate-700">
            {refundDate ? formatFullDate(refundDate) : '—'}
          </span>
        </InfoField>
      </dl>

      <p className="mt-4 text-[11px] leading-5 text-slate-500">{refund.note}</p>
    </DetailCard>
  )
}

export default RefundStatusCard
