# Chargeback Copilot — Frontend

React + Vite (JavaScript) frontend for **Chargeback Copilot**, built for the PayPal AI Hackathon 2026.

## Stack

- React 19 + Vite 8
- Tailwind CSS 3.4 (PostCSS)
- React Router 7
- Axios (API client)
- `@paypal/react-paypal-js` (PayPal JS SDK)

## Run locally on Windows

Prerequisites: Python 3.11+ for the backend and Node.js 20.19+ (or 22.12+) and npm for the frontend.

1. Start the FastAPI backend first. In a terminal from the repository root:

   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```

   Confirm it is healthy at <http://localhost:8000/api/health>. The API must be running on port 8000 because the frontend calls it directly (no dev proxy). The demo login is `demo@acmecommerce.com` / `Demo1234!`; reset the seeded workspace with `python scripts/reset_demo.py --yes` (stop the API first).

2. In a second terminal, install frontend dependencies:

   ```powershell
   cd frontend
   npm install
   ```

3. Create your local environment file (only needed on a fresh clone):

   ```powershell
   copy .env.example .env
   ```

   The default `VITE_API_BASE_URL=http://localhost:8000/api` already matches step 1.

4. Start the dev server:

   ```powershell
   npm run dev
   ```

5. Open <http://localhost:5173>. You will land on the public product overview; use **Sign in** or
   **Try the demo** to enter the workspace. The dev server hot-reloads on save. Stop it with `Ctrl + C`.

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start Vite dev server with HMR       |
| `npm run build`   | Build production bundle into `dist/` |
| `npm run preview` | Serve the production build locally   |
| `npm run lint`    | Run ESLint                           |

## Landing page

The public overview at `/` explains the product without requiring a session: the problem, the
capabilities, a six-step workflow from connected sandbox to resolved dispute, the security model, and
an FAQ. CTAs route to `/login?demo=1` (credentials prefilled) or `/signup`, and switch to
**Open workspace** when a session already exists. The page is responsive, uses the same design
tokens as the app, and supports light and dark mode.

## Dashboard

The authenticated dashboard lives at `/dashboard` and reads live PayPal sandbox disputes from the FastAPI service:

- KPI cards: total, open, won, lost, and pending actions. Clicking a card filters the table or jumps to the task queue.
- Copilot brief with workload summary and open-queue shortcut.
- Recent disputes table: date-range filter, status tabs, search, sorting, pagination, and a slide-over detail drawer with evidence checklist, AI recommendation, activity timeline, and AI draft response.
- Pending actions queue with completable tasks and deadline/priority cues.
- Responsive shell: collapsible sidebar on desktop, off-canvas navigation on mobile, card-style dispute rows on small screens.

All data now comes from the backend API (`GET /api/dashboard/stats`, `GET /api/dashboard/pending-actions`, `GET /api/disputes`). Each panel renders a skeleton while loading, an inline error with a retry action when the request fails, and an empty state when there is nothing to show.

## Pages

| Route                  | Page            | Highlights                                                                                       |
| ---------------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| `/`                    | Landing         | Public product overview: problem, capabilities, six-step workflow, security, FAQ, demo CTA       |
| `/login`               | Sign in         | Demo credentials, optional `?demo=1` prefill, theme toggle, link back to the overview            |
| `/signup`              | Sign up         | Create a merchant workspace with a clean dispute inbox                                          |
| `/dashboard`           | Dashboard       | KPI cards, recent disputes table, copilot brief, pending actions, slide-over case drawer          |
| `/disputes`            | Dispute inbox   | Search, status/reason/priority filters, six sort modes, pagination, responsive table/card layout  |
| `/disputes/:disputeId` | Dispute details | Customer, order, tracking, refund, evidence, activity, and an AI analysis panel with an editable response draft |
| `/paypal`              | PayPal account  | Sandbox OAuth connection status, connect/verify/disconnect, sandbox data sync, permissions probe, redirect-URI setup checklist |
| `/evidence`            | Evidence vault  | Workspace-wide document catalogue with search, type/status filters, stats, pagination, previews, and case links |
| `/reports`             | Reports         | Range selector, KPI cards, monthly caseload chart, reason performance table, evidence readiness, deadline exposure, CSV export |
| `/settings`            | Settings        | Editable profile, notification switches, password change, PayPal/AI status, workspace totals, environment |

### Theme

Light and dark mode are app-wide. The preference is stored in `localStorage` under `cc_theme`, applied
to `<html class="dark">` before first paint by an inline script in `index.html`, and toggled from the
topbar, the auth pages, and the landing page. Tailwind runs in `darkMode: 'class'`; the workspace's
shared light palette is mapped to a dark surface palette in `src/index.css`, while explicit `dark:`
utilities remain available for new components.

The dispute details page includes customer contact and account history, line-item order totals, carrier tracking with delivery events, refund status, a deadline in the case header, an evidence management panel, and an AI analysis panel. Every card renders the objects returned by `GET /api/disputes/{disputeId}`. The AI panel shows the dispute classification, risk level, win likelihood, model confidence, evidence gaps with severity, and prioritized recommendations. Its generated response draft is editable, with character count, restore/copy, and a real Save draft action; closed cases render it read-only. Analysis and draft state stay in sync with evidence uploads, so gaps and win likelihood update immediately.

### API integration

All data flows through `src/lib/api.js` (axios) and the typed service modules in `src/services/`:

| Area           | Endpoints                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Dashboard      | `GET /api/dashboard/stats?days=`, `GET /api/dashboard/pending-actions`                            |
| Dispute inbox  | `GET /api/disputes?page&pageSize&status&reason&priority&sort&q`                                  |
| Dispute detail | `GET /api/disputes/{disputeId}`                                                                  |
| Evidence       | `GET/POST /api/disputes/{disputeId}/evidence`, `DELETE .../evidence/{evidenceId}`, `GET /api/evidence/{evidenceId}/file` |
| AI analysis    | `GET /api/disputes/{disputeId}/ai-analysis`, `POST .../ai-analysis/refresh`, `POST /api/disputes/{disputeId}/response-draft` |
| Response       | `POST /api/disputes/{disputeId}/submit` with `{ body, evidenceIds }` → `{ disputeId, status: "recorded", submittedAt, paypalReference }` |
| PayPal account | `GET /api/paypal/connection`, `POST /api/paypal/connect`, `POST /api/paypal/connection/refresh`, `POST /api/paypal/connection/disconnect`, `POST /api/paypal/sync`, `GET /api/paypal/permissions` |
| Evidence vault | `GET /api/evidence?q&type&status&page&pageSize`, `GET /api/evidence/{evidenceId}/file` |
| Reports        | `GET /api/reports/summary?days=` (30/90/365/all), CSV export client-side |
| Settings       | `GET /api/settings`, `PATCH /api/settings/profile`, `PATCH /api/settings/notifications`, `POST /api/settings/password` |

The backend contract is documented in `backend/API_CONTRACT.md`. Timestamps are epoch milliseconds and JSON keys are camelCase. Requests are cancellable via `AbortController`, and the sidebar badges, filter counts, and pagination are driven by the server (`counts`, `total`, `totalPages`). The mock modules (`src/data/`, `src/utils/aiAnalysis.js`, `src/utils/disputeDetails.js`) have been removed.

Response handling is a draft → review → submit workflow. The AI draft can be edited and saved at any time; saving writes `POST .../response-draft` and records an activity entry. "Review & submit" opens a confirmation modal that shows the amount, ready evidence, deadline, evidence gaps, the exact response text, and the evidence files that will be referenced. Submission stays disabled until the merchant ticks an explicit approval checkbox. Confirming calls `POST .../submit` with the response body and referenced evidence IDs. The server records one submission and returns `status: "recorded"` and `submittedAt`; the UI then shows a "Response recorded" status, keeps the response read-only, and updates the case header and activity timeline. The panel never invents a PayPal outcome: it displays the returned status verbatim and states that no PayPal confirmation reference has been issued when `paypalReference` is null. If a submission is attempted twice (for example from a stale tab), the backend returns `409` and the UI reports that no duplicate submission was created.

The evidence panel lists the required checks for each dispute, the files already available, and the items still missing, with green/amber indicators and a completion progress bar. Files can be added by drag and drop or the file browser, tagged against a missing evidence type, and validated as PDF, JPG, or PNG up to 10 MB. Each row shows the filename, size, upload date, and a live Ready/Uploading/Failed status. Stored images and PDFs open in a preview modal (PDFs render inline in an iframe), and uploads can be downloaded through `GET /api/evidence/{evidenceId}/file` or deleted. Seeded demo records are metadata-only on the server, so they show neither download nor delete actions. Upload errors surface the backend validation message (for example, unsupported type or size limit) on the affected row. Completions, missing items, and the AI analysis refresh after every successful upload or delete.

The dispute inbox searches IDs, customers, emails, reasons, order IDs, and transaction IDs. Status tab counts react to the active search and filters, and clicking any row (or card on smaller screens) opens the full case page. An unknown dispute ID shows a friendly not-found state.

## PayPal account page

`/paypal` connects a PayPal **sandbox** merchant account through the backend's OAuth flow. "Connect" calls `POST /api/paypal/connect` and performs a full-page redirect to the returned PayPal authorization URL; PayPal then redirects back to this page with `?paypal=connected` or `?paypal=error&reason=…`, which renders as a dismissible banner. The card shows the connected account (email, payer ID, granted scopes, token expiry), and offers **Verify connection** (`POST /api/paypal/connection/refresh`) and **Disconnect** (`POST /api/paypal/connection/disconnect`, guarded by an explicit confirmation modal that states tokens are deleted). When the backend has no credentials configured, the page shows the exact redirect URI to register in the PayPal developer dashboard and disables connecting. No client secret, access token, or refresh token ever reaches the frontend — the API only returns status metadata, and credentials live solely in `backend/.env` server-side variables.

Once credentials are configured, the page's **Sandbox data** section adds two live PayPal actions. **Sync sandbox data** calls `POST /api/paypal/sync`, which pulls seller disputes from the PayPal Disputes API and enriches each with its Payments capture, Checkout order, and Refund records before upserting them into the workspace; the green summary reports counts (fetched, created, updated, skipped), the token source used, and the run time, and imported cases appear in the dashboard and dispute inbox immediately. **Check API permissions** calls `GET /api/paypal/permissions` and lists one row per PayPal API (Disputes, Payments, Orders, Refunds) with an authorized / unauthorized / forbidden / unverified status and an explanation of what was probed — rows can read `unverified` when the sandbox account has no sample resource for that API yet. PayPal reasons and statuses are normalized to the workspace vocabulary on the backend (unknown reasons map to "Item not as described"; ambiguous resolved states stay open for review), so no frontend mapping is needed.

## Project structure

```
frontend/
├── public/                  # Static files served as-is (favicon, demo evidence previews)
├── src/
│   ├── components/
│   │   ├── dashboard/       # StatCard, DisputesTable, PendingActions, DisputeDrawer
│   │   ├── disputes/        # DisputeFilterBar, DisputeInboxTable
│   │   │   └── detail/      # Customer, order, tracking, refund, evidence management, AI, response cards
│   │   ├── layout/          # App shell: AppLayout, Sidebar, Topbar
│   │   └── ui/              # Reusable presentational components (badges, pagination, async states)
│   ├── constants/           # Evidence type labels and shared constants
│   ├── hooks/               # useApiQuery (fetch/cancel/retry) and useDebouncedValue
│   ├── lib/                 # Shared clients and helpers (api.js)
│   ├── pages/               # Dashboard, DisputeInbox, DisputeDetail, EvidenceVault, Reports, Settings, PayPalConnection
│   ├── services/            # API bindings: dashboard, disputes, evidence, evidenceVault, reports, settings, AI analysis, paypal
│   ├── utils/               # Formatting, due-date, evidence and case helpers
│   ├── App.jsx              # Route definitions
│   ├── index.css            # Tailwind entry point
│   └── main.jsx             # React root + router
├── .env.example             # Documented environment variables
├── jsconfig.json            # Editor support for the `@/` alias
├── tailwind.config.js       # Content globs, font, drawer animations
└── vite.config.js           # React and `@` alias config
```

Imports can use the `@/` alias, e.g. `import { api } from '@/lib/api'`.

## Environment variables

| Variable              | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `VITE_API_BASE_URL`   | FastAPI base URL. Use `http://localhost:8000/api` (the default in `.env.example`) when running the backend locally. There is no Vite dev proxy, so this must point at the running API. |
| `VITE_PAYPAL_CLIENT_ID` | PayPal sandbox client ID for `@paypal/react-paypal-js`                |

Only public values belong in `VITE_*` variables — the PayPal **client secret** must stay on the backend.
