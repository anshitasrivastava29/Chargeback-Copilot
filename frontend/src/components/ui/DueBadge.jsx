import { Clock3 } from 'lucide-react'

import { cn } from '@/utils/cn'
import { getDueInfo } from '@/utils/format'

const TONE_STYLES = {
  danger: 'text-rose-600',
  warning: 'text-amber-600',
  neutral: 'text-slate-500',
}

export function DueBadge({ dateValue, className }) {
  const due = getDueInfo(dateValue)

  if (!due) {
    return null
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium',
        TONE_STYLES[due.tone],
        className,
      )}
    >
      <Clock3 size={11} />
      {due.label}
    </span>
  )
}
