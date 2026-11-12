import { ArrowUpRight } from 'lucide-react'

import { cn } from '@/utils/cn'

const TONES = {
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'slate',
  onClick,
  className,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset',
            TONES[tone],
          )}
        >
          <Icon size={17} strokeWidth={2} />
        </span>
        <ArrowUpRight
          size={15}
          className="text-slate-300 transition group-hover:text-slate-500"
        />
      </div>

      <p className="mt-4 text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-4 text-slate-500">{helper}</p>
    </button>
  )
}

export default StatCard
