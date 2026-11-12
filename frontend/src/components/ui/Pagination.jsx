import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/utils/cn'

function Pagination({ page, totalPages, onPageChange, className }) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-transparent"
      >
        <ChevronLeft size={14} />
      </button>

      {Array.from({ length: totalPages }, (_, index) => index + 1).map(
        (pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            aria-current={page === pageNumber ? 'page' : undefined}
            className={cn(
              'h-7 min-w-7 rounded-md px-1.5 text-[11px] font-medium tabular-nums transition',
              page === pageNumber
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:bg-slate-100',
            )}
          >
            {pageNumber}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-transparent"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

export default Pagination
