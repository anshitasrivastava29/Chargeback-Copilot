import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { cn } from '@/utils/cn'

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return undefined
    }

    const timeout = window.setTimeout(() => {
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ block: 'start' })
    }, 80)

    return () => window.clearTimeout(timeout)
  }, [pathname, hash])

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <Sidebar
        open={sidebarOpen}
        collapsed={collapsed}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={cn(
          'flex min-h-dvh flex-col transition-[padding] duration-300 ease-out',
          collapsed ? 'lg:pl-20' : 'lg:pl-64',
        )}
      >
        <Topbar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex-1">
          <Outlet />
        </main>

        <footer className="mt-auto border-t border-slate-200/70 px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-1 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>Chargeback Copilot · Merchant workspace</p>
            <p>Live FastAPI data · PayPal sandbox cases</p>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default AppLayout
