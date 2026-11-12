import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  HardDrive,
  Loader2,
  LockKeyhole,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
} from 'lucide-react'

import { ErrorPanel, InlineError, LoadingPanel } from '@/components/ui/AsyncState'
import { useAuth } from '@/context/auth'
import { useApiQuery } from '@/hooks/useApiQuery'
import { getApiErrorMessage } from '@/lib/api'
import {
  changePassword,
  fetchSettings,
  updateNotifications,
  updateProfile,
} from '@/services/settings'
import { cn } from '@/utils/cn'
import { formatBytes, formatFullDate } from '@/utils/format'

function initialsOf(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Card({ title, description, icon: Icon, children, className }) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200 bg-white shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Icon size={15} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && (
            <p className="mt-0.5 text-[11px] leading-5 text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-slate-600">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-slate-400">{hint}</span>}
    </label>
  )
}

const INPUT_CLASS =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400'

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
        checked ? 'bg-blue-600' : 'bg-slate-200',
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  )
}

function NotificationRow({ title, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div>
        <p className="text-xs font-medium text-slate-800">{title}</p>
        <p className="mt-0.5 text-[11px] leading-5 text-slate-400">
          {description}
        </p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  )
}

function StatusPill({ tone, children }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
        tones[tone] ?? tones.sky,
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          tone === 'emerald' && 'bg-emerald-500',
          tone === 'sky' && 'bg-sky-500',
          tone === 'amber' && 'bg-amber-500',
          tone === 'rose' && 'bg-rose-500',
        )}
      />
      {children}
    </span>
  )
}

function SettingsPage() {
  const { user: authUser, updateUser, logout } = useAuth()
  const settingsQuery = useApiQuery('settings', fetchSettings)
  const data = settingsQuery.data

  // Drafts stay null until the merchant edits, so the server values remain the
  // source of truth without copying them into state from an effect.
  const [profileDraft, setProfileDraft] = useState(null)
  const [notifyDraft, setNotifyDraft] = useState(null)
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState(null)
  const [profileSuccess, setProfileSuccess] = useState(null)
  const [notifyBusy, setNotifyBusy] = useState(false)
  const [notifyError, setNotifyError] = useState(null)
  const [notifySuccess, setNotifySuccess] = useState(null)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState(null)
  const [passwordSuccess, setPasswordSuccess] = useState(null)

  const profile = profileDraft ?? {
    name: data?.user?.name ?? '',
    businessName: data?.user?.businessName ?? '',
  }
  const notifications = notifyDraft ?? {
    deadlineReminders: true,
    weeklyDigest: true,
    caseUpdates: true,
  }

  async function handleProfileSubmit(event) {
    event.preventDefault()
    setProfileError(null)
    setProfileSuccess(null)
    setProfileBusy(true)

    try {
      const result = await updateProfile(profile)
      updateUser(result.user)
      setProfileDraft({
        name: result.user.name,
        businessName: result.user.businessName,
      })
      setProfileSuccess('Profile updated across the workspace.')
      settingsQuery.reload()
    } catch (error) {
      setProfileError(getApiErrorMessage(error))
    } finally {
      setProfileBusy(false)
    }
  }

  async function handleNotificationsSubmit(event) {
    event.preventDefault()
    setNotifyError(null)
    setNotifySuccess(null)
    setNotifyBusy(true)

    try {
      const saved = await updateNotifications(notifications)
      setNotifyDraft(saved)
      setNotifySuccess('Notification preferences saved.')
    } catch (error) {
      setNotifyError(getApiErrorMessage(error))
    } finally {
      setNotifyBusy(false)
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (passwords.newPassword.length < 8) {
      setPasswordError('The new password must be at least 8 characters.')
      return
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('The new password and confirmation do not match.')
      return
    }

    setPasswordBusy(true)
    try {
      const result = await changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      })
      setPasswordSuccess(result.message)
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      setPasswordError(getApiErrorMessage(error))
    } finally {
      setPasswordBusy(false)
    }
  }

  if (settingsQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <ErrorPanel
          title="Could not load settings"
          message={settingsQuery.error}
          onRetry={settingsQuery.reload}
        />
      </div>
    )
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <LoadingPanel className="min-h-72" label="Loading workspace settings…" />
      </div>
    )
  }

  const paypal = data.integrations.paypal
  const ai = data.integrations.ai
  const paypalTone = paypal.connected
    ? 'emerald'
    : paypal.configured
      ? 'sky'
      : 'amber'
  const paypalLabel = paypal.connected
    ? 'Merchant connected'
    : paypal.status === 'app_credentials'
      ? 'App credentials'
      : paypal.configured
        ? paypal.status
        : 'Not configured'

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span>Merchant workspace</span>
          <span className="text-slate-300">/</span>
          <span className="font-medium text-slate-600">Settings</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
          Workspace settings
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
          Manage your merchant profile, alert preferences, password, and the
          integrations that power dispute intelligence.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card
            icon={UserRound}
            title="Merchant profile"
            description="Shown across the workspace, drafts, and response signatures."
          >
            <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {initialsOf(profile.name || authUser?.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {profile.name || authUser?.name}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {data.user.email} · member since{' '}
                  {formatFullDate(data.user.createdAt)}
                </p>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Your name">
                  <input
                    value={profile.name}
                    onChange={(event) =>
                      setProfileDraft({
                        ...profile,
                        name: event.target.value,
                      })
                    }
                    required
                    minLength={2}
                    maxLength={120}
                    className={INPUT_CLASS}
                    placeholder="Merchant name"
                  />
                </Field>
                <Field label="Business name">
                  <input
                    value={profile.businessName}
                    onChange={(event) =>
                      setProfileDraft({
                        ...profile,
                        businessName: event.target.value,
                      })
                    }
                    required
                    minLength={1}
                    maxLength={160}
                    className={INPUT_CLASS}
                    placeholder="Business name"
                  />
                </Field>
              </div>

              <Field
                label="Email address"
                hint="Email is your sign-in identity and cannot be changed here."
              >
                <div className="relative">
                  <Mail
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={data.user.email}
                    readOnly
                    disabled
                    className={cn(INPUT_CLASS, 'pl-8')}
                  />
                </div>
              </Field>

              {profileError && <InlineError message={profileError} />}
              {profileSuccess && (
                <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                  <CheckCircle2 size={13} />
                  {profileSuccess}
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={profileBusy}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-default disabled:bg-blue-400"
                >
                  {profileBusy ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Save size={13} />
                  )}
                  Save profile
                </button>
              </div>
            </form>
          </Card>

          <Card
            icon={Bell}
            title="Notifications"
            description="Choose which workspace alerts you want to receive."
          >
            <form onSubmit={handleNotificationsSubmit}>
              <div className="divide-y divide-slate-100">
                <NotificationRow
                  title="Deadline reminders"
                  description="Alert me when a response deadline is within 48 hours."
                  checked={notifications.deadlineReminders}
                  onChange={(value) =>
                    setNotifyDraft({ ...notifications, deadlineReminders: value })
                  }
                />
                <NotificationRow
                  title="Case updates"
                  description="Notify me when evidence is uploaded or a case changes status."
                  checked={notifications.caseUpdates}
                  onChange={(value) =>
                    setNotifyDraft({ ...notifications, caseUpdates: value })
                  }
                />
                <NotificationRow
                  title="Weekly digest"
                  description="Send a Monday summary of open cases, wins, and lost revenue."
                  checked={notifications.weeklyDigest}
                  onChange={(value) =>
                    setNotifyDraft({ ...notifications, weeklyDigest: value })
                  }
                />
              </div>

              {notifyError && <InlineError className="mt-4" message={notifyError} />}
              {notifySuccess && (
                <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                  <CheckCircle2 size={13} />
                  {notifySuccess}
                </p>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={notifyBusy}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-default disabled:text-slate-300"
                >
                  {notifyBusy ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Save size={13} />
                  )}
                  Save preferences
                </button>
              </div>
            </form>
          </Card>

          <Card
            icon={LockKeyhole}
            title="Password"
            description="Use at least 8 characters. Existing sessions stay signed in."
          >
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Field label="Current password">
                <input
                  type="password"
                  value={passwords.currentPassword}
                  onChange={(event) =>
                    setPasswords((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                  }
                  required
                  autoComplete="current-password"
                  className={INPUT_CLASS}
                  placeholder="••••••••"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="New password">
                  <input
                    type="password"
                    value={passwords.newPassword}
                    onChange={(event) =>
                      setPasswords((current) => ({
                        ...current,
                        newPassword: event.target.value,
                      }))
                    }
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={INPUT_CLASS}
                    placeholder="At least 8 characters"
                  />
                </Field>
                <Field label="Confirm new password">
                  <input
                    type="password"
                    value={passwords.confirmPassword}
                    onChange={(event) =>
                      setPasswords((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                    required
                    autoComplete="new-password"
                    className={INPUT_CLASS}
                    placeholder="Repeat new password"
                  />
                </Field>
              </div>

              {passwordError && <InlineError message={passwordError} />}
              {passwordSuccess && (
                <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                  <CheckCircle2 size={13} />
                  {passwordSuccess}
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={passwordBusy}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-default disabled:text-slate-300"
                >
                  {passwordBusy ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <LockKeyhole size={13} />
                  )}
                  Update password
                </button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            icon={ShieldCheck}
            title="Connected services"
            description="Read-only status for the demo environment."
          >
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-800">
                    <Wallet size={14} className="text-slate-400" />
                    PayPal
                  </span>
                  <StatusPill tone={paypalTone}>{paypalLabel}</StatusPill>
                </div>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
                  {paypal.connected
                    ? `Merchant token connected · ${paypal.environment}`
                    : `Reading ${paypal.environment} APIs with app credentials. OAuth is optional.`}
                </p>
                <Link
                  to="/paypal"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                >
                  Manage connection
                  <ArrowRight size={11} />
                </Link>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-800">
                    <Sparkles size={14} className="text-slate-400" />
                    AI drafting
                  </span>
                  <StatusPill tone={ai.llmConfigured ? 'emerald' : 'sky'}>
                    {ai.llmConfigured ? 'LLM enabled' : 'Heuristic'}
                  </StatusPill>
                </div>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
                  Mode {ai.mode} · {ai.model}. Scores stay deterministic; the
                  model only rewrites draft prose.
                </p>
              </div>
            </div>
          </Card>

          <Card icon={HardDrive} title="Workspace" description="Current totals.">
            <dl className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Disputes</dt>
                <dd className="font-semibold tabular-nums text-slate-900">
                  {data.workspace.disputes}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Open cases</dt>
                <dd className="font-semibold tabular-nums text-slate-900">
                  {data.workspace.open}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Evidence files</dt>
                <dd className="font-semibold tabular-nums text-slate-900">
                  {data.workspace.evidenceFiles}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Stored documents</dt>
                <dd className="font-semibold tabular-nums text-slate-900">
                  {formatBytes(data.workspace.storageBytes)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/reports"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Reports
                <ArrowRight size={11} />
              </Link>
              <Link
                to="/evidence"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Evidence vault
                <ArrowRight size={11} />
              </Link>
            </div>
          </Card>

          <Card icon={Building2} title="Environment">
            <dl className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Application</dt>
                <dd className="truncate font-medium text-slate-800">
                  {data.app.name}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Environment</dt>
                <dd className="font-medium capitalize text-slate-800">
                  {data.app.environment}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Auth enforcement</dt>
                <dd className="font-medium text-slate-800">
                  {data.app.requireAuth ? 'Required' : 'Demo optional'}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={logout}
              className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              Sign out of workspace
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
