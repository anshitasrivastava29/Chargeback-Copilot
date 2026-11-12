import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  FolderLock,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  MessageSquareText,
  Package,
  Plug,
  RefreshCw,
  Scale,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Trophy,
  UploadCloud,
  Wallet,
  Workflow,
} from 'lucide-react'

import ThemeToggle from '@/components/ui/ThemeToggle'
import { useAuth } from '@/context/auth'
import { cn } from '@/utils/cn'

const NAV_LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Why it matters', href: '#why' },
  { label: 'Security', href: '#security' },
  { label: 'FAQ', href: '#faq' },
]

const CAPABILITIES = [
  {
    icon: Scale,
    tone: 'sky',
    title: 'A dispute inbox built for triage',
    body: 'Every PayPal chargeback in one table, with status, reason, value, priority, and response deadline. Filter by outcome, search by buyer or case ID, and sort by what is most urgent.',
    points: ['Status and reason filters', 'Deadline-aware priority', 'Value at stake per case'],
  },
  {
    icon: Sparkles,
    tone: 'violet',
    title: 'AI analysis that shows its reasoning',
    body: 'Open a case and get a grounded brief: win likelihood, a recommended next step, the evidence still missing, and a response draft built from the actual order, transaction, and delivery facts.',
    points: ['Win likelihood score', 'Missing-evidence callouts', 'Editable AI response draft'],
  },
  {
    icon: FolderLock,
    tone: 'emerald',
    title: 'One vault for every piece of evidence',
    body: 'Order confirmations, delivery proof, customer messages, policies, and transaction records live in a searchable vault that spans every dispute — not in someone’s downloads folder.',
    points: ['Search and filter across cases', 'Inline preview and download', 'Readiness status per file'],
  },
  {
    icon: Send,
    tone: 'blue',
    title: 'A response workflow with guardrails',
    body: 'Review the draft, adjust the wording, save your progress, and submit. Duplicate submissions are blocked, drafts are locked against conflicting edits, and every step is written to the case timeline.',
    points: ['Draft, save, and resume', 'Submit to PayPal once', 'Activity history on the case'],
  },
  {
    icon: ListTodo,
    tone: 'amber',
    title: 'A deadline queue, not a to-do graveyard',
    body: 'The dashboard turns open disputes into a prioritized action queue with due badges, overdue alerts, and one-click access to the case that needs attention next.',
    points: ['Overdue and due-soon counts', 'Sorted by response window', 'Jump straight into the case'],
  },
  {
    icon: BarChart3,
    tone: 'rose',
    title: 'Reporting that connects effort to outcome',
    body: 'Track win rate, recovered and lost value, average resolution time, evidence coverage, and the chargeback reasons driving the most exposure. Export the whole view as CSV.',
    points: ['Outcome mix and win rate', 'Evidence coverage and gaps', 'CSV export for finance'],
  },
]

const TONES = {
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  blue: 'bg-blue-50 text-blue-600 ring-blue-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
}

const PROBLEMS = [
  {
    icon: Timer,
    title: 'Deadlines do not wait',
    before:
      'A response window closes quietly in a shared inbox, and the case is lost by default — no reviewer ever sees it.',
    after:
      'Every open case carries its deadline, and the dashboard surfaces what is overdue or due within seven days.',
  },
  {
    icon: Layers,
    title: 'Evidence is scattered',
    before:
      'Order data lives in one system, tracking in another, refunds in a third, and the customer thread in someone’s email.',
    after:
      'A per-case checklist tells you exactly which documents PayPal expects, and the vault keeps them together.',
  },
  {
    icon: Target,
    title: 'Losses hide in the totals',
    before:
      'Without a reason-level view, teams cannot tell whether chargebacks are driven by delivery, fraud, or policy confusion.',
    after:
      'Reports break down win rate, lost value, and evidence gaps by dispute reason so prevention becomes measurable.',
  },
]

const WORKFLOW = [
  {
    step: '01',
    icon: Plug,
    title: 'Connect PayPal and sync the account',
    summary:
      'Link a PayPal sandbox account, then pull in the data a dispute response depends on.',
    body: 'Use sandbox app credentials for a fast setup, or authorize through PayPal OAuth where the app is configured. A sync imports orders, captures, refunds, and disputes. Access and refresh tokens are encrypted at rest, and the connection can be refreshed or disconnected at any time.',
    outputs: ['Orders and captures', 'Refunds', 'Disputes', 'Encrypted tokens'],
    inProduct:
      'PayPal account page · connection status, permissions, sync history, and disconnect controls.',
  },
  {
    step: '02',
    icon: LayoutDashboard,
    title: 'Triage the inbox by urgency and value',
    summary:
      'See every case at a glance, then work the ones that matter first.',
    body: 'The overview and dispute inbox show totals, open value, win rate, and the queue of pending actions. Filter by status or chargeback reason, search by buyer or case ID, and sort by newest, value, or deadline. Priority is derived from the response window and the amount at stake.',
    outputs: ['Filtered case list', 'Deadline badges', 'Pending action queue'],
    inProduct:
      'Dashboard · KPI cards, copilot brief, disputes table, and a prioritized actions panel.',
  },
  {
    step: '03',
    icon: Search,
    title: 'Understand the case and the likely outcome',
    summary:
      'Pull the buyer, order, delivery, refund, and conversation history into one view.',
    body: 'The case page brings together the buyer profile, order details, transaction records, tracking, refund status, and the activity timeline. The AI analysis panel scores win likelihood from the case facts, recommends a next action, flags what is missing, and drafts a response grounded in the evidence you actually hold.',
    outputs: ['Win likelihood', 'Recommended action', 'Evidence gaps', 'Response draft'],
    inProduct:
      'Dispute detail · analysis panel beside order, customer, tracking, refund, and activity cards.',
  },
  {
    step: '04',
    icon: UploadCloud,
    title: 'Close the evidence gap before you respond',
    summary:
      'Match the case to PayPal’s evidence expectations and upload exactly what is missing.',
    body: 'Each dispute reason carries a required evidence checklist — order confirmation, proof of delivery, customer communication, policy, or transaction verification. Upload documents to the case or manage them centrally in the vault. Readiness updates instantly, so you can see whether the case is defensible before the deadline.',
    outputs: ['Completed checklist', 'Files in the vault', 'Readiness status'],
    inProduct:
      'Evidence management card · upload, view, and remove files with readiness and gap indicators.',
  },
  {
    step: '05',
    icon: MessageSquareText,
    title: 'Draft, review, and submit the response',
    summary:
      'Start from an AI draft, make it yours, and send it through the submission guardrails.',
    body: 'The draft references the order, transaction, and attached evidence in plain language. Edit it as needed, save the draft, and submit when ready. The backend checks tenant ownership, prevents duplicate submissions, and records the response so the case status and timeline stay accurate.',
    outputs: ['Saved draft', 'Submitted response', 'Updated case timeline'],
    inProduct:
      'Dispute detail · response editor with save, submit, and confirmation states.',
  },
  {
    step: '06',
    icon: Trophy,
    title: 'Track the outcome and learn from it',
    summary:
      'Close the loop on every case, then turn the results into better prevention.',
    body: 'Won and lost cases roll into win rate, recovered value, lost value, average resolution time, and evidence coverage. Reports break performance down by chargeback reason and month, expose the most common missing evidence, and export the full view as CSV for finance or leadership.',
    outputs: ['Win/loss tracking', 'Reason-level analytics', 'CSV export'],
    inProduct:
      'Reports · outcome mix, monthly caseload, evidence readiness, deadline exposure, and export.',
  },
]

const LIFECYCLE = [
  { label: 'Dispute opened', tone: 'bg-amber-400', text: 'text-amber-700' },
  { label: 'Under review', tone: 'bg-sky-400', text: 'text-sky-700' },
  { label: 'Response submitted', tone: 'bg-blue-500', text: 'text-blue-700' },
  { label: 'Won or lost', tone: 'bg-emerald-500', text: 'text-emerald-700' },
]

const GUARDRAILS = [
  {
    icon: LockKeyhole,
    title: 'Tenant-scoped by default',
    body: 'Every dispute, evidence file, report, and setting is resolved for the signed-in merchant. Cross-tenant reads are rejected at the query layer.',
  },
  {
    icon: KeyRound,
    title: 'Hashed passwords, signed sessions',
    body: 'Passwords are stored with PBKDF2 hashing, sessions use signed JWTs with expiry, and the client clears state on a 401.',
  },
  {
    icon: ShieldCheck,
    title: 'Encrypted PayPal tokens',
    body: 'OAuth access and refresh tokens are encrypted with Fernet before they touch the database, and never returned to the browser.',
  },
  {
    icon: ClipboardCheck,
    title: 'Idempotent submissions',
    body: 'A case can only be submitted once. Draft saves are serialized so two tabs cannot overwrite each other silently.',
  },
  {
    icon: FileCheck2,
    title: 'Validated evidence uploads',
    body: 'File type and size limits are enforced server-side, and downloads are authorization-checked rather than served by guessable path.',
  },
  {
    icon: BadgeCheck,
    title: 'Sandbox-first by design',
    body: 'The workspace is built for PayPal sandbox data and a seeded demo merchant. No live money movement is required to explore it.',
  },
]

const FAQS = [
  {
    question: 'Do I need a PayPal developer app to try it?',
    answer:
      'Not for the demo. The seeded workspace already contains a realistic merchant, 26 disputes, orders, and evidence files. To sync your own sandbox account, add sandbox app credentials to the backend .env (or authorize through OAuth where configured), then run a sync from the PayPal account page.',
  },
  {
    question: 'Is this connected to real PayPal disputes?',
    answer:
      'No. The workspace targets the PayPal sandbox and a seeded demo dataset. It is built to demonstrate the full response workflow without moving real money or touching live buyer data.',
  },
  {
    question: 'What exactly does the AI do?',
    answer:
      'It summarizes the case, estimates win likelihood from case facts, recommends a next action, highlights missing evidence, and drafts a response. Scoring stays deterministic; the draft is generated by an LLM from the case record. A human reviews and submits every response.',
  },
  {
    question: 'Can I get the numbers out of the app?',
    answer:
      'Yes. Reports covers win rate, open value, recovered and lost value, resolution time, evidence coverage, and reason-level performance. The current view exports to CSV in one click.',
  },
]

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/20">
        <ShieldCheck size={19} strokeWidth={2.2} />
      </span>
      <span>
        <span className="block text-sm font-semibold tracking-tight text-slate-900">
          Chargeback Copilot
        </span>
        <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-400">
          Merchant suite
        </span>
      </span>
    </Link>
  )
}

function SectionHeading({ eyebrow, title, body, align = 'left' }) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h2>
      {body && (
        <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-[15px] sm:leading-7">
          {body}
        </p>
      )}
    </div>
  )
}

function PrimaryLink({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
    >
      {children}
      <ArrowRight size={15} />
    </Link>
  )
}

function HeroPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-sky-400/20 via-blue-500/10 to-transparent blur-2xl"
      />

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#070d19] shadow-2xl shadow-slate-950/40">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="h-2 w-2 rounded-full bg-rose-400/80" />
          <span className="h-2 w-2 rounded-full bg-amber-400/80" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
          <span className="ml-2 text-[10px] text-slate-500">
            chargeback-copilot / dashboard
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-medium text-emerald-300">
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            Sandbox
          </span>
        </div>

        <div className="flex">
          <div className="hidden w-36 shrink-0 border-r border-white/[0.06] p-3 sm:block">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-white">
                <ShieldCheck size={12} />
              </span>
              <span className="text-[10px] font-semibold text-white">
                Copilot
              </span>
            </div>
            <div className="mt-4 space-y-1">
              {['Overview', 'Disputes', 'Evidence', 'Reports'].map(
                (item, index) => (
                  <div
                    key={item}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px]',
                      index === 0
                        ? 'bg-white/[0.07] text-white'
                        : 'text-slate-500',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1 w-1 rounded-full',
                        index === 0 ? 'bg-sky-400' : 'bg-slate-600',
                      )}
                    />
                    {item}
                  </div>
                ),
              )}
            </div>
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.03] p-2">
              <p className="text-[9px] text-slate-500">AI Copilot</p>
              <p className="mt-1 text-[9px] leading-4 text-slate-400">
                Drafts, gaps, and case facts in one panel.
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1 p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500">
                  Merchant workspace
                </p>
                <p className="text-xs font-semibold text-white">
                  Dispute overview
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="rounded-md border border-white/[0.08] px-1.5 py-1 text-[8px] text-slate-400">
                  Last 90 days
                </span>
                <span className="rounded-md bg-blue-600 px-1.5 py-1 text-[8px] font-medium text-white">
                  Review queue
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[
                { label: 'Open', value: '9', helper: '$9,051 at stake' },
                { label: 'Win rate', value: '65%', helper: '11 won · 6 lost' },
                { label: 'Due soon', value: '8', helper: '1 overdue' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-2"
                >
                  <p className="text-[8px] text-slate-500">{stat.label}</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[8px] text-slate-500">
                    {stat.helper}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-2 rounded-lg border border-sky-400/15 bg-sky-400/[0.06] p-2.5">
              <div className="flex items-center gap-1.5">
                <Sparkles size={10} className="text-sky-300" />
                <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-sky-300">
                  Copilot brief
                </p>
              </div>
              <p className="mt-1 text-[10px] leading-4 text-slate-300">
                <span className="font-semibold text-white">8 actions</span> need
                attention —{' '}
                <span className="font-semibold text-rose-300">1 past due</span>
                . $9,051 is currently at stake.
              </p>
            </div>

            <div className="mt-2 rounded-lg border border-white/[0.07] bg-white/[0.02]">
              <div className="flex items-center justify-between border-b border-white/[0.05] px-2.5 py-2">
                <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Highest priority
                </p>
                <span className="rounded-full bg-rose-400/10 px-1.5 py-0.5 text-[8px] font-medium text-rose-300 ring-1 ring-inset ring-rose-400/20">
                  Due in 24h
                </span>
              </div>
              <div className="p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-medium text-white">
                      Jordan Ellis · PP-D-8492013
                    </p>
                    <p className="mt-0.5 text-[8px] text-slate-500">
                      Product not received · $612.50
                    </p>
                  </div>
                  <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[8px] font-medium text-blue-300">
                    62% win
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {[
                    ['Order confirmation', true],
                    ['Proof of delivery', false],
                    ['Customer communication', true],
                  ].map(([label, done]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between text-[8px]"
                    >
                      <span className="inline-flex items-center gap-1.5 text-slate-400">
                        <span
                          className={cn(
                            'flex h-2.5 w-2.5 items-center justify-center rounded-full',
                            done
                              ? 'bg-emerald-400/15 text-emerald-300'
                              : 'bg-amber-400/15 text-amber-300',
                          )}
                        >
                          {done ? '✓' : '!'}
                        </span>
                        {label}
                      </span>
                      <span
                        className={
                          done ? 'text-emerald-300' : 'text-amber-300'
                        }
                      >
                        {done ? 'Ready' : 'Missing'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5">
              <span className="inline-flex items-center gap-1.5 text-[8px] text-slate-400">
                <MessageSquareText size={10} className="text-sky-300" />
                Draft response ready · 148 words
              </span>
              <span className="rounded bg-white px-1.5 py-0.5 text-[8px] font-semibold text-slate-900">
                Review
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[10px] text-slate-400">
        Preview of the seeded demo workspace · sandbox data
      </p>
    </div>
  )
}

function WorkflowStep({ item, isLast }) {
  const Icon = item.icon

  return (
    <li className="relative pl-12 sm:pl-16">
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute left-[19px] top-12 h-[calc(100%-1rem)] w-px bg-slate-200 sm:left-[27px]"
        />
      )}
      <span className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sky-600 shadow-sm sm:h-14 sm:w-14">
        <Icon size={18} strokeWidth={1.9} className="sm:hidden" />
        <Icon size={22} strokeWidth={1.8} className="hidden sm:block" />
      </span>

      <div className="pb-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
            {item.step}
          </span>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
            {item.title}
          </h3>
        </div>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
          {item.summary}
        </p>
        <p className="mt-2 text-[13px] leading-6 text-slate-500">{item.body}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.outputs.map((output) => (
            <span
              key={output}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
            >
              <CheckCircle2 size={11} className="text-emerald-500" />
              {output}
            </span>
          ))}
        </div>

        <p className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500">
          <LayoutDashboard size={12} className="mt-1 shrink-0 text-slate-400" />
          {item.inProduct}
        </p>
      </div>
    </li>
  )
}

function FaqItem({ item }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-slate-200 py-1 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-slate-800">
          {item.question}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-slate-400 transition duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <p className="animate-fade-in pb-4 pr-8 text-[13px] leading-6 text-slate-500">
          {item.answer}
        </p>
      )}
    </div>
  )
}

function LandingPage() {  const { user, status } = useAuth()
  const isAuthenticated = status === 'authenticated' || Boolean(user)
  const primaryTo = isAuthenticated ? '/dashboard' : '/login?demo=1'
  const primaryLabel = isAuthenticated ? 'Open workspace' : 'Open the live demo'

  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Brand />

          <nav className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs font-medium text-slate-600 transition hover:text-slate-900"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />

            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:inline-flex"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 sm:inline-flex"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:inline-flex"
                >
                  Create account
                </Link>
              </>
            )}

            <Link
              to={primaryTo}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              {isAuthenticated ? 'Open workspace' : 'Try the demo'}
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(14,165,233,0.12),transparent)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-32 top-24 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl dark:bg-sky-500/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 top-40 h-64 w-64 rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-500/10"
          />

          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:px-8 lg:pb-24 lg:pt-24">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                <Sparkles size={11} />
                PayPal AI Hackathon 2026 · Sandbox-ready
              </span>

              <h1 className="mt-5 text-4xl font-semibold leading-[1.06] tracking-tight text-slate-900 sm:text-5xl lg:text-[54px]">
                Every PayPal chargeback,
                <span className="block bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">
                  handled before the deadline.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-[15px] leading-7 text-slate-500">
                Chargeback Copilot turns a dispute into a guided workflow:
                triage the inbox, understand the case, assemble the right
                evidence, draft a grounded response, and track the outcome — in
                one merchant workspace.
              </p>

              <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
                <PrimaryLink to={primaryTo}>{primaryLabel}</PrimaryLink>
                <a
                  href="#workflow"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  See the workflow
                </a>
              </div>

              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  Seeded demo workspace
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  No live funds involved
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  Full source included
                </span>
              </p>
            </div>

            <HeroPreview />
          </div>

          <div className="relative border-y border-slate-200 bg-slate-50">
            <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
              {[
                {
                  icon: Scale,
                  label: 'Every case in one inbox',
                  helper: 'Status, reason, value, deadline',
                },
                {
                  icon: Sparkles,
                  label: 'AI case analysis',
                  helper: 'Likelihood, gaps, draft response',
                },
                {
                  icon: FolderLock,
                  label: 'Evidence readiness',
                  helper: 'Checklist and central vault',
                },
                {
                  icon: BarChart3,
                  label: 'Outcome reporting',
                  helper: 'Win rate, value, CSV export',
                },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.label}
                    className="flex items-start gap-2.5 py-5"
                  >
                    <Icon size={16} className="mt-0.5 shrink-0 text-sky-600" />
                    <div>
                      <p className="text-xs font-medium text-slate-800">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {item.helper}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Why it matters */}
        <section id="why" className="scroll-mt-20 bg-white py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Why chargebacks are hard"
              title="Chargebacks punish slow, scattered teams."
              body="The work is not complicated — it is time-boxed and fragmented. The response window is short, the evidence is spread across systems, and the losses are hard to see until the month closes."
            />

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {PROBLEMS.map((problem) => {
                const Icon = problem.icon
                return (
                  <article
                    key={problem.title}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">
                      <Icon size={17} />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold text-slate-900">
                      {problem.title}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {problem.before}
                    </p>
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
                        <CheckCircle2 size={11} />
                        With Copilot
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-emerald-900">
                        {problem.after}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section
          id="platform"
          className="scroll-mt-20 border-y border-slate-200 bg-slate-50 py-16 sm:py-24"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="What the platform does"
              title="One workspace from first alert to final outcome."
              body="Each part of the product exists to move a case forward: understand it faster, make it defensible, respond once, and learn from what happened."
            />

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((feature) => {
                const Icon = feature.icon
                return (
                  <article
                    key={feature.title}
                    className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset',
                        TONES[feature.tone],
                      )}
                    >
                      <Icon size={18} strokeWidth={2} />
                    </span>

                    <h3 className="mt-4 text-sm font-semibold tracking-tight text-slate-900">
                      {feature.title}
                    </h3>
                    <p className="mt-2 flex-1 text-xs leading-5 text-slate-500">
                      {feature.body}
                    </p>

                    <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                      {feature.points.map((point) => (
                        <li
                          key={point}
                          className="flex items-center gap-2 text-[11px] text-slate-600"
                        >
                          <CheckCircle2
                            size={11}
                            className="shrink-0 text-emerald-500"
                          />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="scroll-mt-20 bg-white py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-16">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <SectionHeading
                  eyebrow="The workflow"
                  title="From dispute to resolution, in six deliberate steps."
                  body="This is the actual path through the product — the same one the demo workspace is seeded to walk you through."
                />

                <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Case lifecycle
                  </p>
                  <ol className="mt-3 space-y-2.5">
                    {LIFECYCLE.map((stage, index) => (
                      <li key={stage.label} className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white',
                            stage.tone,
                          )}
                        >
                          {index + 1}
                        </span>
                        <span
                          className={cn(
                            'text-[11px] font-medium',
                            stage.text,
                          )}
                        >
                          {stage.label}
                        </span>
                        {index < LIFECYCLE.length - 1 && (
                          <span className="ml-auto text-[10px] text-slate-300">
                            →
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-700">
                    <Clock3 size={12} />
                    Deadline-first by default
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-sky-900">
                    Cases are ordered by response window, not by when they were
                    opened. Overdue work is called out at the top of the
                    overview.
                  </p>
                </div>
              </div>

              <ol className="relative">
                {WORKFLOW.map((item, index) => (
                  <WorkflowStep
                    key={item.step}
                    item={item}
                    isLast={index === WORKFLOW.length - 1}
                  />
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Inside a case */}
        <section className="border-y border-slate-200 bg-slate-50 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <SectionHeading
                  eyebrow="Inside a dispute"
                  title="The whole case on one page."
                  body="No tab-hopping and no hunting for transaction IDs. The detail view is organized around the questions a responder actually asks."
                />

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      icon: Sparkles,
                      title: 'AI analysis',
                      body: 'Likelihood, recommendation, gaps, and draft.',
                    },
                    {
                      icon: FileCheck2,
                      title: 'Evidence checklist',
                      body: 'Required items, uploads, and readiness.',
                    },
                    {
                      icon: Package,
                      title: 'Order & transaction',
                      body: 'Amounts, capture IDs, and dispute reason.',
                    },
                    {
                      icon: RefreshCw,
                      title: 'Refunds & tracking',
                      body: 'Fulfilment and refund state at a glance.',
                    },
                    {
                      icon: MessageSquareText,
                      title: 'Buyer context',
                      body: 'Customer record and case communication.',
                    },
                    {
                      icon: CalendarClock,
                      title: 'Activity timeline',
                      body: 'Opened, due, responded, and resolved.',
                    },
                  ].map((card) => {
                    const Icon = card.icon
                    return (
                      <div
                        key={card.title}
                        className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
                      >
                        <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-800">
                          <Icon size={13} className="text-sky-600" />
                          {card.title}
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">
                          {card.body}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      Dispute detail
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      Product not received · $612.50
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    <Clock3 size={10} />
                    Due in 24h
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                      <Sparkles size={11} />
                      AI recommendation
                    </p>
                    <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                      62% win likelihood
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-sky-900">
                    Evidence gap detected. Proof of delivery is still missing —
                    add tracking and the carrier confirmation before submitting.
                    The order confirmation and customer thread are already
                    attached.
                  </p>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/70 dark:bg-slate-900/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500"
                      style={{ width: '62%' }}
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {[
                    ['Order confirmation', 'Ready', true],
                    ['Proof of delivery', 'Missing', false],
                    ['Customer communication', 'Ready', true],
                    ['Transaction verification', 'Ready', true],
                  ].map(([label, state, ready]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <span className="inline-flex items-center gap-2 text-[11px] text-slate-600">
                        <span
                          className={cn(
                            'flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-semibold',
                            ready
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
                          )}
                        >
                          {ready ? '✓' : '!'}
                        </span>
                        {label}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-medium',
                          ready ? 'text-emerald-600' : 'text-amber-600',
                        )}
                      >
                        {state}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-600"
                    disabled
                  >
                    <FileText size={12} />
                    Save draft
                  </button>
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white"
                    disabled
                  >
                    Submit response
                    <Send size={11} />
                  </button>
                </div>
                <p className="mt-2 text-center text-[9px] text-slate-400">
                  Illustrative preview · buttons disabled on this page
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="scroll-mt-20 bg-white py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Security and guardrails"
              title="Built like a system that touches money."
              body="Disputes contain order history, customer details, and payment identifiers. The workspace treats that data as tenant-scoped case material, not as generic app state."
            />

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {GUARDRAILS.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
                        <Icon size={15} />
                      </span>
                      <h3 className="text-xs font-semibold text-slate-900">
                        {item.title}
                      </h3>
                    </div>
                    <p className="mt-2.5 text-[11px] leading-5 text-slate-500">
                      {item.body}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-inset ring-slate-200">
                  <Layers size={15} />
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Runs on the stack you can inspect
                  </p>
                  <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
                    FastAPI + SQLAlchemy on PostgreSQL, React + Vite on the front
                    end, Alembic migrations, and a documented API contract.
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-slate-500">
                <Layers size={11} />
                FastAPI · React · PayPal
              </span>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="scroll-mt-20 border-t border-slate-200 bg-slate-50 py-16 sm:py-24"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-16 lg:px-8">
            <div>
              <SectionHeading
                eyebrow="Questions"
                title="Before you open the demo."
                body="The short answers to what the workspace is, what it does with data, and how to explore it safely."
              />
              <div className="mt-6 flex items-center gap-2 text-[11px] text-slate-400">
                <ShieldCheck size={13} className="text-emerald-500" />
                Sandbox data only · human-reviewed responses
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {FAQS.map((item) => (
                <FaqItem key={item.question} item={item} />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-white py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-[#070d19] px-6 py-12 text-center shadow-2xl shadow-slate-950/30 sm:px-12 sm:py-16">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-28 -right-16 h-64 w-64 rounded-full bg-blue-600/15 blur-3xl"
              />

              <div className="relative mx-auto max-w-2xl">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-300">
                  <Workflow size={11} className="text-sky-300" />
                  Ready when the next dispute lands
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Explore the full workflow with seeded sandbox cases.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Sign in with the demo merchant, open an open dispute, read the
                  AI analysis, close the evidence gap, and submit a response.
                  The dashboard, vault, and reports are already populated.
                </p>

                <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                  <Link
                    to={primaryTo}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
                  >
                    {isAuthenticated
                      ? 'Open your workspace'
                      : 'Open the live demo'}
                    <ArrowRight size={15} />
                  </Link>
                  {!isAuthenticated && (
                    <Link
                      to="/signup"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                    >
                      Create an account
                    </Link>
                  )}
                </div>

                <p className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Wallet size={11} />
                    PayPal sandbox
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Settings size={11} />
                    Settings and reset scripts
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <BarChart3 size={11} />
                    CSV reporting
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <Brand />
            <p className="mt-3 max-w-sm text-[11px] leading-5 text-slate-400">
              An evidence-backed workspace for PayPal chargebacks. Built for the
              PayPal AI Hackathon 2026 and designed to run against sandbox data.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Product
              </p>
              <div className="mt-2 space-y-1.5 text-[11px] text-slate-500">
                <a href="#platform" className="block hover:text-slate-800">
                  Platform
                </a>
                <a href="#workflow" className="block hover:text-slate-800">
                  Workflow
                </a>
                <a href="#faq" className="block hover:text-slate-800">
                  FAQ
                </a>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Workspace
              </p>
              <div className="mt-2 space-y-1.5 text-[11px] text-slate-500">
                <Link
                  to={isAuthenticated ? '/dashboard' : '/login'}
                  className="block hover:text-slate-800"
                >
                  {isAuthenticated ? 'Dashboard' : 'Sign in'}
                </Link>
                {!isAuthenticated && (
                  <Link
                    to="/signup"
                    className="block hover:text-slate-800"
                  >
                    Create account
                  </Link>
                )}
                <Link
                  to={isAuthenticated ? '/reports' : '/login?demo=1'}
                  className="block hover:text-slate-800"
                >
                  Reports
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>
              © 2026 Chargeback Copilot · Merchant suite · Sandbox environment
            </p>
            <p className="inline-flex items-center gap-1.5">
              <ShieldCheck size={11} />
              Payloads scoped per merchant · responses submitted by humans
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
