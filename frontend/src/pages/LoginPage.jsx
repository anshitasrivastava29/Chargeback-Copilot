import { AlertCircle, ArrowRight, Loader2, Lock, Mail, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import AuthLayout from '@/components/auth/AuthLayout'
import { useAuth } from '@/context/auth'
import { getApiErrorMessage } from '@/lib/api'

const DEMO_CREDENTIALS = {
  email: 'demo@acmecommerce.com',
  password: 'Demo1234!',
}

function LoginPage() {
  const { user, status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState(
    searchParams.get('demo') === '1' ? DEMO_CREDENTIALS.email : '',
  )
  const [password, setPassword] = useState(
    searchParams.get('demo') === '1' ? DEMO_CREDENTIALS.password : '',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const sessionExpired = searchParams.get('reason') === 'expired'
  const redirectTo = location.state?.from?.pathname ?? '/dashboard'

  if (status === 'restoring') {
    return (
      <AuthLayout>
        <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      </AuthLayout>
    )
  }

  if (status === 'authenticated' || user) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    setError(null)
    setSubmitting(true)

    try {
      await login({ email: email.trim(), password })
      navigate(redirectTo, { replace: true })
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Unable to sign in right now.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          Sign in to your workspace
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Access your disputes, evidence, and AI responses.
        </p>

        {sessionExpired && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            Your session expired or is no longer valid. Please sign in again.
          </div>
        )}

        {searchParams.get('demo') === '1' && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-xs leading-5 text-sky-900">
            <Sparkles size={15} className="mt-0.5 shrink-0" />
            <span>
              Demo credentials are filled in. Press{' '}
              <span className="font-semibold">Sign in</span> to open the seeded
              sandbox workspace.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-700"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-slate-700"
            >
              Work email
            </label>
            <div className="relative mt-1.5">
              <Mail
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-slate-700"
              >
                Password
              </label>
            </div>
            <div className="relative mt-1.5">
              <Lock
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-[11px] font-medium text-slate-600">
            Exploring the demo workspace?
          </p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Seeded merchant account:{' '}
            <span className="font-mono text-slate-700">
              {DEMO_CREDENTIALS.email}
            </span>{' '}
            /{' '}
            <span className="font-mono text-slate-700">
              {DEMO_CREDENTIALS.password}
            </span>
            <button
              type="button"
              onClick={() => {
                setEmail(DEMO_CREDENTIALS.email)
                setPassword(DEMO_CREDENTIALS.password)
                setError(null)
              }}
              className="ml-1 font-medium text-blue-600 transition hover:text-blue-700"
            >
              Fill for me
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          New to Chargeback Copilot?{' '}
          <Link
            to="/signup"
            className="font-medium text-blue-600 transition hover:text-blue-700"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default LoginPage
