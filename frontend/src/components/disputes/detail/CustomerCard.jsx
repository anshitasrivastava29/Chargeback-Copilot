import { BadgeCheck, CalendarDays, MapPin, UserRound } from 'lucide-react'

import { DetailCard, InfoField } from '@/components/disputes/detail/DetailCard'

function getInitials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
}

export function CustomerCard({ dispute }) {
  const customer = dispute.customer

  return (
    <DetailCard
      title="Customer"
      icon={UserRound}
      description="Buyer contact details and account history"
    >
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
          {getInitials(dispute.buyer.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {dispute.buyer.name}
          </p>
          <p className="truncate text-[11px] text-slate-500">
            {dispute.buyer.email}
          </p>
        </div>
        {customer.emailVerified && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <BadgeCheck size={11} />
            Verified
          </span>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <InfoField label="Phone">{customer.phone}</InfoField>
        <InfoField label="Customer ID">
          <span className="font-mono text-xs text-slate-600">
            {customer.id}
          </span>
        </InfoField>

        <InfoField label="Member since">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={12} className="text-slate-400" />
            {customer.memberSince}
          </span>
        </InfoField>
        <InfoField label="Lifetime orders">{customer.lifetimeOrders}</InfoField>

        <InfoField label="Shipping address" className="sm:col-span-2">
          <span className="flex items-start gap-1.5">
            <MapPin size={12} className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              <span className="block text-xs font-medium text-slate-800">
                {customer.address.line1}
              </span>
              <span className="block text-[11px] font-normal text-slate-500">
                {customer.address.line2}
              </span>
            </span>
          </span>
        </InfoField>
      </dl>
    </DetailCard>
  )
}

export default CustomerCard
