import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Bell,
  Clock3,
  FileText,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Trophy,
} from 'lucide-react'

import { useAuth } from '@/context/auth'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { cn } from '@/utils/cn'

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    type: 'deadline',
    title: 'Response due in 24 hours',
    body: 'Jordan Ellis · PP-D-8492013',
    time: '12m ago',
    read: false,
  },
  {
    id: 2,
    type: 'won',
    title: 'Dispute won',
    body: 'Amara Okafor · $612.50 recovered',
    time: '1h ago',
    read: false,
  },
  {
    id: 3,
    type: 'evidence',
    title: 'Evidence uploaded',
    body: 'Order AC-10482 · 3 files added',
    time: '3h ago',
    read: true,
  },
]

const NOTIFICATION_STYLES = {
  deadline: {
    icon: Clock3,
    className: 'bg-amber-50 text-amber-600 ring-amber-100',
  },
  won: {
    icon: Trophy,
    className: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  },
  evidence: {
    icon: FileText,
    className: 'bg-sky-50 text-sky-600 ring-sky-100',
  },
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS)
  const containerRef = useRef(null)

  const unreadCount = notifications.filter((item) => !item.read).length

  useEffect(() => {
    if (!open) {
      return undefined
    }

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function markAsRead(id) {
    setNotifications((items) =>
      items.map((item) => (item.id === id ? { ...item, read: true } : item)),
    )
  }

  function markAllAsRead() {
    setNotifications((items) => items.map((item) => ({ ...item, read: true })))
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blue-600 ring-2 ring-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Notifications
              </p>
              <p className="text-[11px] text-slate-500">
                {unreadCount} unread
              </p>
            </div>
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.map((item) => {
              const style =
                NOTIFICATION_STYLES[item.type] ?? NOTIFICATION_STYLES.evidence
              const Icon = style.icon

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markAsRead(item.id)}
                  className={cn(
                    'flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50',
                    !item.read && 'bg-blue-50/30',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
                      style.className,
                    )}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-slate-900">
                        {item.title}
                      </span>
                      {!item.read && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      {item.body}
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-400">
                      {item.time}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function initialsOf(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Topbar({ collapsed, onToggleCollapse, onOpenSidebar }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const displayName = user?.name ?? 'Merchant'
  const pageTitle = pathname.startsWith('/disputes/')
    ? 'Dispute details'
    : pathname === '/disputes'
      ? 'Dispute inbox'
      : pathname === '/evidence'
        ? 'Evidence vault'
        : pathname === '/reports'
          ? 'Reports'
          : pathname === '/settings'
            ? 'Settings'
            : pathname === '/paypal'
              ? 'PayPal account'
              : 'Dashboard'

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={19} />
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>

        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-white lg:hidden">
          <ShieldCheck size={16} strokeWidth={2.2} />
        </span>

        <div className="min-w-0">
          <p className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 sm:block">
            Merchant workspace
          </p>
          <p className="truncate text-sm font-semibold text-slate-900">
            {pageTitle}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            PayPal sandbox
          </span>

          <ThemeToggle />

          <NotificationsMenu />

          <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-slate-900">{displayName}</p>
              <p className="text-[10px] text-slate-400">
                {user?.businessName ?? 'Merchant workspace'}
              </p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white ring-2 ring-white">
              {initialsOf(displayName)}
            </span>
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Topbar
