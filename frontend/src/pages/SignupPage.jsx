import { AlertCircle, ArrowRight, Building2, Loader2, Lock, Mail, User } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import AuthLayout from '@/components/auth/AuthLayout'
import { useAuth } from '@/context/auth'
import { getApiErrorMessage } from '@/lib/api'

function SignupPage() {
  const { user, status, signup } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    businessName: '',
    email: '',
    password: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

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
    return <Navigate to="/dashboard" replace />
  }

  function updateField(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
      setFieldErrors((current) => ({ ...current, [field]: null }))
    }
  }

  function validate() {
    const errors = {}
    if (form.name.trim().length < 2) {
      errors.name = 'Please enter your full name (at least 2 characters).'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Enter a valid email address.'
    }
    if (form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.'
    }
    return errors
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      await signup({
        name: form.name.trim(),
        businessName: form.businessName.trim() || undefined,
        email: form.email.trim(),
        password: form.password,
      })
      navigate('/dashboard', { replace: true })
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Unable to create the account.'))
    } finally {
      setSubmitting(false)
    }
  }

  const textFields = [
    {
      id: 'signup-name',
      label: 'Full name',
      icon: User,
      field: 'name',
      type: 'text',
      placeholder: 'Avery Stone',
      autoComplete: 'name',
    },
    {
      id: 'signup-business',
      label: 'Business name (optional)',
      icon: Building2,
      field: 'businessName',
      type: 'text',
      placeholder: 'Acme Commerce',
      autoComplete: 'organization',
    },
    {
      id: 'signup-email',
      label: 'Work email',
      icon: Mail,
      field: 'email',
      type: 'email',
      placeholder: 'you@company.com',
      autoComplete: 'email',
    },
    {
      id: 'signup-password',
      label: 'Password',
      icon: Lock,
      field: 'password',
      type: 'password',
      placeholder: 'At least 8 characters',
      autoComplete: 'new-password',
    },
  ]

  return (
    <AuthLayout>
      <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          Create your workspace
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          New accounts start with a clean dispute inbox.
        </p>

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

          {textFields.map((item) => {
            const Icon = item.icon
            const fieldError = fieldErrors[item.field]

            return (
              <div key={item.id}>
                <label
                  htmlFor={item.id}
                  className="block text-xs font-medium text-slate-700"
                >
                  {item.label}
                </label>
                <div className="relative mt-1.5">
                  <Icon
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id={item.id}
                    type={item.type}
                    value={form[item.field]}
                    onChange={updateField(item.field)}
                    placeholder={item.placeholder}
                    autoComplete={item.autoComplete}
                    aria-invalid={Boolean(fieldError)}
                    className={fieldError
                      ? 'w-full rounded-lg border border-red-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20'
                      : 'w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20'}
                  />
                </div>
                {fieldError && (
                  <p className="mt-1.5 text-[11px] text-red-600">{fieldError}</p>
                )}
              </div>
            )
          })}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating workspace…
              </>
            ) : (
              <>
                Create account
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-blue-600 transition hover:text-blue-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default SignupPage
