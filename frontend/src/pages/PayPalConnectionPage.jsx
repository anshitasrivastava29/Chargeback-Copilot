import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  Database,
  KeyRound,
  Link2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Unplug,
  Wallet,
  X,
} from 'lucide-react'

import { ErrorPanel, InlineError, LoadingPanel } from '@/components/ui/AsyncState'
import CopyButton from '@/components/ui/CopyButton'
import { useApiQuery } from '@/hooks/useApiQuery'
import { getApiErrorMessage } from '@/lib/api'
import {
  disconnectPayPalConnection,
  fetchPayPalConnection,
  fetchPayPalPermissions,
  refreshPayPalConnection,
  startPayPalConnection,
  syncPayPalData,
} from '@/services/paypal'
import { cn } from '@/utils/cn'

const REASON_MESSAGES = {
  invalid_state:
    'The authorization request expired or was already used. Start the connection again.',
  access_denied: 'Authorization was canceled in PayPal. No account was connected.',
  missing_code: 'PayPal did not return an authorization code. Please try again.',
  authorization_rejected:
    'PayPal rejected this authorization. Start the connection again.',
  configuration_error:
    'PayPal rejected the configured sandbox credentials. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
  token_exchange_failed:
    'PayPal did not complete the authorization. Please try again.',
  network_error:
    'The backend could not reach PayPal. Check the network and try again.',
}

function buildNotice(searchParams) {
  const result = searchParams.get('paypal')
  if (!result) {
    return null
  }
  if (result === 'connected') {
    return {
      tone: 'success',
      message:
        'PayPal sandbox account connected. Review the account details below.',
    }
  }
  const reason = searchParams.get('reason')
  return {
    tone: 'error',
    message:
      REASON_MESSAGES[reason] ||
      'PayPal authorization did not complete. Please try again.',
  }
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatDateTime(value) {
  return value ? dateTimeFormatter.format(new Date(value)) : '—'
}

function StatusPill({ connected, configured, status }) {
  if (!connected) {
    if (configured) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
          App credentials
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Not connected
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Needs attention
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Connected
    </span>
  )
}

function SecurityItem({ icon: Icon, title, children }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100">
        <Icon size={13} />
      </span>
      <span>
        <span className="block text-[11px] font-semibold text-slate-800">
          {title}
        </span>
        <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
          {children}
        </span>
      </span>
    </li>
  )
}

function Detail({ label, children }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <div className="mt-0.5 text-[11px] font-medium text-slate-800">
        {children}
      </div>
    </div>
  )
}

const CHECK_STYLES = {
  authorized: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  unverified: 'border-slate-200 bg-slate-50 text-slate-500',
  forbidden: 'border-amber-200 bg-amber-50 text-amber-700',
  unauthorized: 'border-rose-200 bg-rose-50 text-rose-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
}

const CHECK_LABELS = {
  authorized: 'Authorized',
  unverified: 'Not verified',
  forbidden: 'Not permitted',
  unauthorized: 'Token rejected',
  error: 'Error',
}

function SyncSummary({ summary }) {
  const stats = [
    { label: 'Disputes fetched', value: summary.fetched },
    { label: 'Created', value: summary.created },
    { label: 'Updated', value: summary.updated },
    { label: 'Skipped', value: summary.skipped },
    { label: 'Transactions', value: summary.transactionsCreated + summary.transactionsUpdated },
    { label: 'Refunds seen', value: summary.refundsObserved },
  ]
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-emerald-900/80">
        <span className="font-semibold text-emerald-900">Sync complete</span>
        <span>{formatDateTime(summary.ranAt)}</span>
        <span>
          Token: {summary.tokenSource === 'merchant' ? 'connected account' : 'app credentials'}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-emerald-100 bg-white px-2 py-1.5 text-center"
          >
            <p className="text-sm font-semibold text-slate-900">{stat.value}</p>
            <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
      {summary.fetched === 0 && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] leading-4 text-amber-900">
          PayPal returned no disputes for this sandbox merchant. The seeded demo
          cases are unchanged; create a sandbox payment and open a dispute to
          import real data.
        </p>
      )}
      <p className="mt-2 text-[10px] leading-4 text-emerald-900/70">
        Imported disputes appear in the inbox and dashboard like the seeded
        workspace data, with PayPal reasons and statuses mapped to the
        workspace&apos;s own categories.
      </p>
    </div>
  )
}

function PermissionChecks({ checks }) {
  return (
    <ul className="mt-4 space-y-2">
      {checks.map((check) => (
        <li
          key={check.api}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
        >
          <span className="w-16 text-[11px] font-semibold text-slate-800">
            {check.api}
          </span>
          <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-slate-500">
            {check.endpoint}
          </code>
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[9px] font-semibold',
              CHECK_STYLES[check.status] || CHECK_STYLES.error,
            )}
          >
            {CHECK_LABELS[check.status] || 'Error'}
          </span>
          {check.detail && (
            <p className="w-full text-[10px] leading-4 text-slate-400">
              {check.detail}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

function PayPalConnectionPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [notice, setNotice] = useState(() => buildNotice(searchParams))
  const [actionError, setActionError] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [syncSummary, setSyncSummary] = useState(null)
  const [permissionChecks, setPermissionChecks] = useState(null)

  const connectionQuery = useApiQuery('paypal-connection', (signal) =>
    fetchPayPalConnection(signal),
  )

  const connection = connectionQuery.data
  const isConnected = Boolean(connection?.connected)
  const isBusy = isConnecting || isRefreshing || isDisconnecting

  function dismissNotice() {
    setNotice(null)
    if (searchParams.toString()) {
      setSearchParams({}, { replace: true })
    }
  }

  async function handleConnect() {
    setActionError('')
    setIsConnecting(true)

    try {
      const payload = await startPayPalConnection()
      window.location.assign(payload.authorizationUrl)
    } catch (error) {
      setActionError(getApiErrorMessage(error))
      setIsConnecting(false)
    }
  }

  async function handleRefresh() {
    setActionError('')
    setIsRefreshing(true)

    try {
      await refreshPayPalConnection()
      setNotice({
        tone: 'success',
        message: 'PayPal connection verified. The access token was refreshed.',
      })
      connectionQuery.reload()
    } catch (error) {
      setActionError(getApiErrorMessage(error))
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleDisconnect() {
    setActionError('')
    setIsDisconnecting(true)

    try {
      await disconnectPayPalConnection()
      setConfirmOpen(false)
      setNotice({
        tone: 'success',
        message: 'PayPal account disconnected. Stored tokens were deleted.',
      })
      setSearchParams({}, { replace: true })
      connectionQuery.reload()
    } catch (error) {
      setActionError(getApiErrorMessage(error))
    } finally {
      setIsDisconnecting(false)
    }
  }

  async function handleSync() {
    setActionError('')
    setIsSyncing(true)

    try {
      setSyncSummary(await syncPayPalData())
    } catch (error) {
      setActionError(getApiErrorMessage(error))
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleCheckPermissions() {
    setActionError('')
    setIsChecking(true)

    try {
      const payload = await fetchPayPalPermissions()
      setPermissionChecks(payload.checks)
    } catch (error) {
      setActionError(getApiErrorMessage(error))
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-600">
            Integrations
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            PayPal account
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            Check API access and import sandbox disputes with the server&apos;s
            PayPal app credentials. Connecting a merchant account with OAuth is
            optional and only adds token-backed access.
          </p>
        </div>

        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
          <ShieldCheck size={13} />
          {connection && !connection.sandbox
            ? 'Live environment'
            : 'Sandbox environment'}
        </span>
      </div>

      {notice && (
        <div
          className={cn(
            'mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11px] leading-5',
            notice.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900',
          )}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          {notice.tone === 'success' ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{notice.message}</span>
          <button
            type="button"
            onClick={dismissNotice}
            className="rounded p-0.5 opacity-70 transition hover:bg-white/60 hover:opacity-100"
            aria-label="Dismiss message"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {actionError && <InlineError className="mt-3" message={actionError} />}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {connectionQuery.isLoading ? (
            <LoadingPanel label="Loading PayPal connection…" />
          ) : connectionQuery.isError ? (
            <ErrorPanel
              title="Could not load the PayPal connection"
              message={connectionQuery.error}
              onRetry={connectionQuery.reload}
            />
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 px-5 py-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-blue-500/20">
                  <Wallet size={20} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      PayPal sandbox account
                    </p>
                    <StatusPill
                      connected={isConnected}
                      configured={connection.configured}
                      status={connection.status}
                    />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {connection.accountEmail ||
                      (isConnected
                        ? 'Account details unavailable'
                        : 'No merchant account linked')}
                  </p>
                </div>

                {connection.accountName && (
                  <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600">
                    {connection.accountName}
                  </span>
                )}
              </div>

              <div className="p-5">
                {!connection.configured && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <div className="flex gap-2.5">
                      <AlertCircle
                        size={16}
                        className="mt-0.5 shrink-0 text-amber-600"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-amber-900">
                          Server credentials are missing
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-amber-900/80">
                          Set <code>PAYPAL_CLIENT_ID</code> and{' '}
                          <code>PAYPAL_CLIENT_SECRET</code> in{' '}
                          <code>backend/.env</code>, then restart the API. Register
                          this exact redirect URI in the PayPal app:
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <code className="break-all rounded-lg border border-amber-200 bg-white px-2 py-1 text-[10px] text-amber-900">
                            {connection.redirectUri}
                          </code>
                          <CopyButton
                            text={connection.redirectUri}
                            label="Copy URI"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled
                      className="mt-4 inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-slate-300 px-3 py-1.5 text-[11px] font-semibold text-white"
                    >
                      <Link2 size={12} />
                      Connect PayPal account
                    </button>
                  </div>
                )}

                {connection.configured && isConnected && (
                  <>
                    {connection.lastError && (
                      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] leading-5 text-amber-900">
                        <span className="font-semibold">
                          PayPal needs attention.
                        </span>{' '}
                        {connection.lastError}
                      </div>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Detail label="Account email">
                        {connection.accountEmail || 'Unavailable'}
                      </Detail>
                      <Detail label="PayPal payer ID">
                        {connection.payerId ? (
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate font-mono text-[10px]">
                              {connection.payerId}
                            </span>
                            <CopyButton
                              text={connection.payerId}
                              label="Copy"
                            />
                          </span>
                        ) : (
                          'Unavailable'
                        )}
                      </Detail>
                      <Detail label="Connected on">
                        {formatDateTime(connection.connectedAt)}
                      </Detail>
                      <Detail label="Access token expires">
                        {formatDateTime(connection.tokenExpiresAt)}
                      </Detail>
                    </div>

                    <div className="mt-3">
                      <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-400">
                        Granted scopes
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(connection.scopes.length
                          ? connection.scopes
                          : connection.requestedScopes
                        ).map((scope) => (
                          <span
                            key={scope}
                            className="max-w-full truncate rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] text-slate-600"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isRefreshing ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        {isRefreshing ? 'Verifying…' : 'Verify connection'}
                      </button>

                      {connection.status === 'error' && (
                        <button
                          type="button"
                          onClick={handleConnect}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                        >
                          {isConnecting ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <ArrowUpRight size={12} />
                          )}
                          Reconnect
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setActionError('')
                          setConfirmOpen(true)
                        }}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
                      >
                        <Unplug size={12} />
                        Disconnect
                      </button>

                      <p className="text-[10px] text-slate-400">
                        Verification refreshes the stored access token with
                        PayPal.
                      </p>
                    </div>
                  </>
                )}

                {connection.configured && !isConnected && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                    <div className="flex gap-2.5">
                      <ShieldCheck
                        size={16}
                        className="mt-0.5 shrink-0 text-sky-600"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-sky-900">
                          Sandbox API access is active
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-sky-900/80">
                          Chargeback Copilot is using the PayPal app credentials
                          configured on the server. You can verify API access and
                          import sandbox disputes without linking a merchant
                          account. A merchant connection is optional and only
                          adds token-backed access.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCheckPermissions}
                        disabled={isSyncing || isChecking}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isChecking ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <ScanLine size={12} />
                        )}
                        {isChecking ? 'Checking…' : 'Check API permissions'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSync}
                        disabled={isSyncing || isChecking}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isSyncing ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        {isSyncing
                          ? 'Syncing sandbox data…'
                          : 'Sync sandbox data'}
                      </button>
                    </div>

                    <div className="mt-4 border-t border-sky-200/70 pt-3">
                      <p className="text-[10px] leading-4 text-sky-900/70">
                        Optional: link a merchant account to use its token. If the
                        PayPal dashboard cannot save the Log in with PayPal
                        return URL, app-credential access above still works.
                      </p>
                      <button
                        type="button"
                        onClick={handleConnect}
                        disabled={isBusy}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isConnecting ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Link2 size={12} />
                        )}
                        {isConnecting
                          ? 'Redirecting to PayPal…'
                          : 'Connect merchant account'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {connection?.configured && (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100">
                  <Database size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    Sandbox data
                  </p>
                  <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
                    Import real disputes from the PayPal Sandbox Disputes API and
                    enrich them with capture, order, and refund details. Rows are
                    upserted, so running the sync again updates in place.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={isSyncing || isChecking}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-wait disabled:opacity-60"
                >
                  {isSyncing ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  {isSyncing ? 'Syncing sandbox data…' : 'Sync sandbox data'}
                </button>
                <button
                  type="button"
                  onClick={handleCheckPermissions}
                  disabled={isSyncing || isChecking}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {isChecking ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ScanLine size={12} />
                  )}
                  {isChecking ? 'Checking…' : 'Check API permissions'}
                </button>
              </div>

              {syncSummary && <SyncSummary summary={syncSummary} />}
              {permissionChecks && <PermissionChecks checks={permissionChecks} />}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Security
            </p>
            <h2 className="mt-1 text-sm font-semibold text-slate-900">
              Credentials stay server-side
            </h2>
            <ul className="mt-4 space-y-3.5">
              <SecurityItem
                icon={LockKeyhole}
                title="No secrets in the browser"
              >
                The PayPal client secret never leaves the FastAPI backend and is
                never sent to Vite environment variables.
              </SecurityItem>
              <SecurityItem icon={ShieldCheck} title="State-verified OAuth">
                Each connection request uses a single-use state token that
                expires after ten minutes.
              </SecurityItem>
              <SecurityItem icon={KeyRound} title="Encrypted token storage">
                Access and refresh tokens are encrypted at rest and are never
                included in API responses.
              </SecurityItem>
              <SecurityItem icon={Unplug} title="Removable authorization">
                Disconnecting deletes the stored tokens immediately. You can
                revoke the authorization in PayPal at any time.
              </SecurityItem>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Setup
            </p>
            <h2 className="mt-1 text-sm font-semibold text-slate-900">
              Optional merchant connection
            </h2>
            <p className="mt-2 text-[10px] leading-4 text-slate-400">
              Sync and permission checks already work with the server&apos;s app
              credentials. These steps are only for the optional OAuth
              connection.
            </p>
            <ol className="mt-3 space-y-2 text-[11px] leading-5 text-slate-500">
              <li className="flex gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-600">
                  1
                </span>
                Create or open a sandbox app in the PayPal developer dashboard.
              </li>
              <li className="flex gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-600">
                  2
                </span>
                Add the redirect URI below as an allowed return URL.
              </li>
              <li className="flex gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-600">
                  3
                </span>
                Set the client ID and secret in{' '}
                <code className="text-slate-700">backend/.env</code>.
              </li>
              <li className="flex gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-600">
                  4
                </span>
                Restart the API, then connect the sandbox merchant account.
              </li>
            </ol>

            {connection && (
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-400">
                  Redirect URI
                </p>
                <p className="mt-1 break-all font-mono text-[10px] leading-4 text-slate-600">
                  {connection.redirectUri}
                </p>
                <CopyButton
                  className="mt-2"
                  text={connection.redirectUri}
                  label="Copy redirect URI"
                />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex items-start gap-2">
              <BadgeCheck size={14} className="mt-0.5 shrink-0 text-blue-600" />
              <p className="text-[10px] leading-4 text-blue-900/80">
                Sandbox connections use test merchant accounts and never move
                real money. Live credentials are not accepted by this
                workspace&apos;s default configuration.
              </p>
            </div>
          </section>
        </aside>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="presentation"
          onClick={() => {
            if (!isDisconnecting) {
              setConfirmOpen(false)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Disconnect PayPal account"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                  <Unplug size={15} />
                </span>
                <p className="text-sm font-semibold text-slate-900">
                  Disconnect PayPal account?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isDisconnecting}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-wait disabled:opacity-50"
                aria-label="Close disconnect dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-4">
              <p className="text-[11px] leading-5 text-slate-600">
                This deletes the encrypted access and refresh tokens stored by
                Chargeback Copilot. You will need to authorize the account again
                to reconnect.
              </p>
              <p className="mt-2 text-[10px] leading-4 text-slate-400">
                This only clears the connection in Chargeback Copilot. It does
                not change your authorization settings inside PayPal.
              </p>
              {actionError && (
                <InlineError className="mt-3" message={actionError} />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isDisconnecting}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 disabled:cursor-wait disabled:opacity-60"
              >
                {isDisconnecting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Unplug size={12} />
                )}
                {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PayPalConnectionPage
