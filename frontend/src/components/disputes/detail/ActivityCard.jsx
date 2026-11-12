import { History } from 'lucide-react'

import { DetailCard } from '@/components/disputes/detail/DetailCard'
import { cn } from '@/utils/cn'
import { formatFullDate } from '@/utils/format'

export function ActivityCard({ dispute }) {
  const timeline = (dispute.activity ?? []).map((event) => ({
    ...event,
    date: formatFullDate(event.date),
  }))

  return (
    <DetailCard
      title="Activity"
      icon={History}
      description="Case events and response milestones"
    >
      <ol className="mt-5 space-y-4">
        {timeline.map((event, index) => (
          <li key={event.label} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span className={cn('mt-1 h-2 w-2 rounded-full', event.dot)} />
              {index < timeline.length - 1 && (
                <span className="mt-1 w-px flex-1 bg-slate-200" />
              )}
            </span>
            <div className="pb-1">
              <p className="text-xs font-medium text-slate-700">
                {event.label}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">{event.date}</p>
            </div>
          </li>
        ))}
      </ol>
    </DetailCard>
  )
}

export default ActivityCard
