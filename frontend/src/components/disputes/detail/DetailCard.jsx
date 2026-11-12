import { cn } from '@/utils/cn'

export function DetailCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Icon size={14} />
              </span>
            )}
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          </div>
          {description && (
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}

export function InfoField({ label, children, className }) {
  return (
    <div className={className}>
      <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{children}</dd>
    </div>
  )
}
