import { Package } from 'lucide-react'

import { DetailCard, InfoField } from '@/components/disputes/detail/DetailCard'
import { CopyButton } from '@/components/ui/CopyButton'
import { formatCurrency, formatFullDate } from '@/utils/format'

function TotalRow({ label, value, emphasis = false }) {
  return (
    <div
      className={
        emphasis
          ? 'flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-semibold text-slate-900'
          : 'flex items-center justify-between text-xs text-slate-500'
      }
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

export function OrderDetailsCard({ dispute }) {
  const order = dispute.order

  return (
    <DetailCard
      title="Order details"
      icon={Package}
      description={`Placed ${formatFullDate(order.placedAt)} · ${order.paymentMethod}`}
      action={<CopyButton text={order.id} label="Copy order" />}
    >
      <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
        {order.items.map((item) => (
          <li
            key={item.sku}
            className="flex items-start justify-between gap-3 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-800">
                {item.name}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {item.sku} · Qty {item.quantity}
              </p>
            </div>
            <p className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">
              {formatCurrency(item.total)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-1.5">
        <TotalRow label="Subtotal" value={formatCurrency(order.subtotal)} />
        <TotalRow
          label="Shipping"
          value={order.shipping === 0 ? 'Free' : formatCurrency(order.shipping)}
        />
        <TotalRow
          label="Tax"
          value={order.taxIncluded ? 'Included' : formatCurrency(order.tax)}
        />
        <TotalRow
          label="Total charged"
          value={formatCurrency(order.total)}
          emphasis
        />
      </dl>

      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <InfoField label="Order number">
          <span className="font-mono text-xs text-slate-600">{order.id}</span>
        </InfoField>
        <InfoField label="Transaction ID">
          <span className="break-all font-mono text-[11px] font-normal text-slate-600">
            {order.transactionId}
          </span>
        </InfoField>
        <InfoField label="Ship to" className="sm:col-span-2">
          <span className="block text-xs font-medium text-slate-800">
            {order.shippingAddress.name}
          </span>
          <span className="block text-[11px] font-normal text-slate-500">
            {order.shippingAddress.line1}
          </span>
          <span className="block text-[11px] font-normal text-slate-500">
            {order.shippingAddress.line2}
          </span>
        </InfoField>
      </dl>
    </DetailCard>
  )
}

export default OrderDetailsCard
