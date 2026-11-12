import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import ThemeToggle from '@/components/ui/ThemeToggle'

const HIGHLIGHTS = [
  {
    title: 'Dispute inbox built for speed',
    body: 'Triage every PayPal chargeback with filters, deadlines, and full case context.',
  },
  {
    title: 'AI-drafted responses',
    body: 'Evidence gaps, win likelihood, and an editable response draft for each case.',
  },
  {
    title: 'PayPal sandbox connected',
    body: 'Import real sandbox disputes, captures, orders, and refunds in one click.',
  },
]

function AuthLayout({ children }) {
  return (
    <div className="grid min-h-dvh bg-slate-50 text-slate-900 lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#070d19] p-10 text-slate-300 lg:flex xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/20">
            <ShieldCheck size={20} strokeWidth={2.2} />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-tight text-white">
              Chargeback Copilot
            </span>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Merchant suite
            </span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
            Win more chargebacks,
            <span className="block bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">
              lose less revenue.
            </span>
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            A merchant dispute workspace that keeps evidence, deadlines, and
            AI-assisted responses in one secure place.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-400/10 text-[11px] font-semibold text-sky-300 ring-1 ring-inset ring-sky-400/20">
                  ✓
                </span>
                <span>
                  <span className="block text-sm font-medium text-slate-100">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                    {item.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-slate-600">
          PayPal AI Hackathon 2026 · Sandbox environment
        </p>      </div>

      <div className="relative flex items-center justify-center px-4 pb-10 pt-16 sm:px-8 sm:pt-20">
        <div className="absolute inset-x-4 top-4 flex items-center justify-between sm:inset-x-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <ArrowLeft size={13} />
            Back to overview
          </Link>
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}

export default AuthLayout
