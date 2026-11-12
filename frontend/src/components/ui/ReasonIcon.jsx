import {
  Copy,
  CreditCard,
  PackageSearch,
  PackageX,
  RefreshCw,
  Scale,
  ShieldAlert,
} from 'lucide-react'

import { cn } from '@/utils/cn'

const REASON_STYLES = {
  'Item not received': {
    icon: PackageX,
    className: 'bg-sky-50 text-sky-600 ring-sky-100',
  },
  'Unauthorized transaction': {
    icon: ShieldAlert,
    className: 'bg-violet-50 text-violet-600 ring-violet-100',
  },
  'Item not as described': {
    icon: PackageSearch,
    className: 'bg-amber-50 text-amber-600 ring-amber-100',
  },
  'Duplicate charge': {
    icon: Copy,
    className: 'bg-rose-50 text-rose-600 ring-rose-100',
  },
  'Subscription canceled': {
    icon: RefreshCw,
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
  },
  'Credit not processed': {
    icon: CreditCard,
    className: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  },
}

const FALLBACK = {
  icon: Scale,
  className: 'bg-slate-100 text-slate-500 ring-slate-200',
}

export function ReasonIcon({ reason, className }) {
  const style = REASON_STYLES[reason] ?? FALLBACK
  const Icon = style.icon

  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
        style.className,
        className,
      )}
    >
      <Icon size={16} />
    </span>
  )
}
