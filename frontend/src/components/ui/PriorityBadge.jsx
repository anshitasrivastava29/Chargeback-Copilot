import { cn } from '@/utils/cn'
import { PRIORITY_META } from '@/utils/dispute'

export function PriorityBadge({ priority, className }) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.low

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
        meta.badge,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}
