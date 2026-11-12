import { Truck } from 'lucide-react'

import { DetailCard, InfoField } from '@/components/disputes/detail/DetailCard'
import { CopyButton } from '@/components/ui/CopyButton'
import { cn } from '@/utils/cn'
import { formatFullDate } from '@/utils/format'

const STATUS_STYLES = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
}

export function TrackingCard({ dispute }) {
  const tracking = dispute.tracking

  if (!tracking.available) {
    return (
      <DetailCard
        title="Tracking"
        icon={Truck}
        description="Shipment status for this order"
      >
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200">
            <Truck size={15} />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-700">
              No shipment to track
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              {tracking.note}
            </p>
          </div>
        </div>
      </DetailCard>
    )
  }

  const warningNote =
    tracking.tone === 'amber' || dispute.reason === 'Item not received'

  return (
    <DetailCard
      title="Tracking"
      icon={Truck}
      description={`${tracking.carrier} · ${tracking.statusLabel}`}
      action={
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
            STATUS_STYLES[tracking.tone],
          )}
        >
          {tracking.statusLabel}
        </span>
      }
    >
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-400">
              Tracking number
            </p>
            <p className="mt-0.5 break-all font-mono text-xs text-slate-700">
              {tracking.number}
            </p>
          </div>
          <CopyButton text={tracking.number} />
        </div>

        <dl className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200/70 pt-3 sm:grid-cols-3">
          <InfoField label="Shipped">
            <span className="text-xs font-medium text-slate-700">
              {formatFullDate(tracking.shippedAt)}
            </span>
          </InfoField>
          <InfoField label="Delivered">
            <span className="text-xs font-medium text-slate-700">
              {tracking.deliveredAt
                ? formatFullDate(tracking.deliveredAt)
                : 'Not confirmed'}
            </span>
          </InfoField>
          <InfoField label="Estimated delivery">
            <span className="text-xs font-medium text-slate-700">
              {tracking.estimatedAt
                ? formatFullDate(tracking.estimatedAt)
                : '—'}
            </span>
          </InfoField>
        </dl>
      </div>

      <ol className="mt-4 space-y-3">
        {tracking.events.map((event, index) => (
          <li key={event.label} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span
                className={cn(
                  'mt-1 h-2 w-2 rounded-full',
                  event.tone === 'pending'
                    ? 'border border-amber-400 bg-white'
                    : 'bg-emerald-500',
                )}
              />
              {index < tracking.events.length - 1 && (
                <span className="mt-1 w-px flex-1 bg-slate-200" />
              )}
            </span>
            <div className="pb-1">
              <p className="text-xs font-medium text-slate-700">
                {event.label}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {formatFullDate(event.date)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {tracking.signedBy && (
        <p className="mt-2 text-[11px] text-slate-500">
          Delivery note: {tracking.signedBy}
        </p>
      )}

      <p
        className={cn(
          'mt-3 rounded-lg px-3 py-2 text-[11px] leading-5 ring-1 ring-inset',
          warningNote
            ? 'bg-amber-50 text-amber-700 ring-amber-100'
            : 'bg-slate-50 text-slate-600 ring-slate-100',
        )}
      >
        {tracking.note}
      </p>
    </DetailCard>
  )
}

export default TrackingCard
