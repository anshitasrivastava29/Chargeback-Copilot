import {
  BarChart3,
  FolderLock,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Scale,
  Settings,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '@/context/auth'
import { useApiQuery } from '@/hooks/useApiQuery'
import { fetchDashboardStats } from '@/services/dashboard'
import { cn } from '@/utils/cn'

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        icon: LayoutDashboard,
        to: '/dashboard',
      },
      {
        id: 'disputes',
        label: 'Disputes',
        icon: Scale,
        to: '/disputes',
      },
      {
        id: 'paypal',
        label: 'PayPal account',
        icon: Wallet,
        to: '/paypal',
      },
      {
        id: 'pending',
        label: 'Pending actions',
        icon: ListTodo,
        to: '/dashboard#pending-actions',
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        id: 'copilot',
        label: 'AI Copilot',
        icon: Sparkles,
        to: '/dashboard#copilot-brief',
      },
      {
        id: 'evidence',
        label: 'Evidence vault',
        icon: FolderLock,
        to: '/evidence',
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        id: 'reports',
        label: 'Reports',
        icon: BarChart3,
        to: '/reports',
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        to: '/settings',
      },
    ],
  },
]

function initialsOf(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Sidebar({ open, onClose, collapsed }) {
  const { pathname, hash } = useLocation()
  const { user, logout } = useAuth()
  const statsQuery = useApiQuery('sidebar-stats', (signal) =>
    fetchDashboardStats(90, signal),
  )
  const badges = {
    disputes: statsQuery.data?.open,
    pending: statsQuery.data?.pendingActions,
  }
  const displayName = user?.name ?? 'Merchant'
  const businessName = user?.businessName ?? 'Merchant workspace'

  const activeItem = pathname.startsWith('/disputes')
    ? 'disputes'
    : pathname.startsWith('/paypal')
      ? 'paypal'
      : pathname.startsWith('/evidence')
        ? 'evidence'
        : pathname.startsWith('/reports')
          ? 'reports'
          : pathname.startsWith('/settings')
            ? 'settings'
            : pathname.startsWith('/dashboard') && hash === '#pending-actions'
              ? 'pending'
              : pathname.startsWith('/dashboard') && hash === '#copilot-brief'
                ? 'copilot'
                : 'overview'

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/[0.06] bg-[#070d19] text-slate-400 shadow-2xl shadow-black/30 transition-[width,transform] duration-300 ease-out lg:translate-x-0',
          collapsed ? 'lg:w-20' : 'lg:w-64',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Sidebar navigation"
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4',
            collapsed && 'lg:justify-center lg:px-0',
          )}
        >
          <Link to="/dashboard" onClick={onClose} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/20">
              <ShieldCheck size={19} strokeWidth={2.2} />
            </span>
            <span className={cn('min-w-0', collapsed && 'lg:hidden')}>
              <span className="block truncate text-sm font-semibold tracking-tight text-white">
                Chargeback Copilot
              </span>
              <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Merchant suite
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className={cn(
            'mx-3 mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3',
            collapsed && 'lg:hidden',
          )}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400/20 to-blue-500/20 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/20">
              {initialsOf(businessName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">
                {businessName}
              </p>
              <p className="text-[11px] text-slate-500">Sandbox workspace</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p
                className={cn(
                  'px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600',
                  collapsed && 'lg:hidden',
                )}
              >
                {group.label}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = activeItem === item.id

                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      onClick={onClose}
                      aria-current={isActive ? 'page' : undefined}
                      title={item.label}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        collapsed && 'lg:justify-center lg:px-0',
                        isActive
                          ? 'bg-white/[0.07] text-white'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100',
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sky-400" />
                      )}
                      <Icon
                        size={18}
                        className={cn(
                          'shrink-0',
                          isActive
                            ? 'text-sky-300'
                            : 'text-slate-500 group-hover:text-slate-300',
                        )}
                      />
                      <span
                        className={cn(
                          'flex-1 truncate',
                          collapsed && 'lg:hidden',
                        )}
                      >
                        {item.label}
                      </span>
                      {badges[item.id] ? (
                        <span
                          className={cn(
                            'rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-300',
                            collapsed && 'lg:hidden',
                          )}
                        >
                          {badges[item.id]}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.06] p-3">
          <div
            className={cn(
              'mb-3 rounded-xl border border-sky-400/10 bg-sky-400/[0.06] p-3',
              collapsed && 'lg:hidden',
            )}
          >
            <div className="flex items-center gap-2 text-[11px] font-medium text-sky-200">
              <Sparkles size={13} />
              Sandbox workspace
            </div>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">
              Demo disputes from the FastAPI service. Connect your PayPal
              sandbox account from the workspace menu.
            </p>
          </div>

          <div
            className={cn(
              'flex items-center gap-3 rounded-lg px-2 py-1.5',
              collapsed && 'lg:justify-center lg:px-0',
            )}
            title={`${displayName} · ${user?.email ?? ''}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-slate-200 ring-1 ring-white/10">
              {initialsOf(displayName)}
            </span>
            <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
              <p className="truncate text-xs font-medium text-slate-200">
                {displayName}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {user?.email ?? ''}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-slate-200',
                collapsed && 'lg:hidden',
              )}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
