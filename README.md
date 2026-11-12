# Chargeback Copilot

**A merchant workspace that helps small teams win PayPal chargebacks before the response deadline.**

Chargebacks are a race against a clock. Evidence is scattered across inboxes, order systems, and
shipping tools; deadlines pass while someone reconstructs a case by hand. Chargeback Copilot puts
every dispute in one queue, shows what evidence is missing, scores the case, drafts a response, and
keeps the whole workspace auditable — backed by a FastAPI service and a React dashboard.

Built for the **PayPal AI Hackathon 2026**.

---

## Demo

```text
email:    demo@acmecommerce.com
password: Demo1234!
```

The seed creates a complete demo workspace: **26 disputes** (9 open, 11 won, 6 lost), **64 evidence
records**, orders, refunds, activity history, and six chargeback reasons. Every screen has data even
when the connected PayPal sandbox account has no disputes.

Local URLs:

| Service | URL |
| --- | --- |
| Frontend | <http://localhost:5173> |
| API | <http://localhost:8000> |
| Swagger UI | <http://localhost:8000/docs> |
| Health check | <http://localhost:8000/api/health> |

---

## What it does

| Area | Highlights |
| --- | --- |
| Landing page | Public product explainer at `/`: what/why/how, six-step chargeback workflow, security guarantees, FAQ, and demo CTA |
| Dashboard | KPI cards, copilot brief, recent disputes, and a pending-action queue sorted by deadline |
| Dispute inbox | Search, status/reason/priority filters, six sort modes, pagination, responsive table/card views |
| Case detail | Customer, order, tracking, refund, activity timeline, evidence checklist, and editable AI response |
| AI intelligence | Reason classification, missing-evidence analysis, risk/win scoring, and a prioritized action plan — cached by evidence fingerprint |
| AI drafts | Professional response draft with optional OpenAI-compatible LLM rewriting, fact guards, and a deterministic fallback |
| Evidence | Validated uploads (PDF/JPEG/PNG, 10 MB), PDF text and field extraction, preview, download, delete |
| Evidence vault | Workspace-wide file catalogue with search, type/readiness filters, stats, pagination, and case links |
| Reports | 30/90/365-day win rate, value at stake, resolution time, reason performance, trends, coverage gaps, CSV export |
| Settings | Profile, notification preferences, password change, integration status, workspace totals |
| PayPal | Sandbox app-credential sync, optional merchant OAuth connection, permission probe |
| Auth | JWT + PBKDF2-SHA256 signup/login with tenant isolation |
| Theme | Persisted light/dark mode across the workspace, auth pages, and landing page |
| Operations | Request IDs, request-size limits, health checks, Docker Compose, Alembic migrations |

### The workflow

1. **Dispute arrives** — synced from the PayPal sandbox or seeded into the demo workspace.
2. **Triage** — deadline, value, reason, priority, and evidence readiness are computed automatically.
3. **Analyze** — deterministic scoring identifies the dispute type, win likelihood, risk drivers, and missing evidence.
4. **Gather evidence** — the checklist maps each missing document to an upload; the vault tracks coverage across every case.
5. **Draft the response** — a fact-guarded letter is generated and stays editable; a human reviews it.
6. **Submit and learn** — the submission is recorded with a reference, the outcome is tracked, and reports show what is working.

---

## Quick start

**Prerequisites:** Python 3.11+ and Node.js 20.19+ (or 22.12+).

```bash
# Terminal 1 — API (SQLite by default, schema created and seeded on first start)
cd backend
python -m venv .venv
source .venv/Scripts/activate        # Windows Git Bash
# source .venv/bin/activate          # macOS / Linux
pip install -r requirements-dev.txt
cp .env.example .env                 # optional; defaults work for the demo
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
cp .env.example .env                 # sets VITE_API_BASE_URL=http://localhost:8000/api
npm run dev
```

Open <http://localhost:5173> and sign in with the demo credentials above.

### Reset the demo workspace

The seed only runs when the database is empty. To wipe uploads and restore the pristine demo
(stop the API first):

```bash
cd backend
python scripts/reset_demo.py --yes
```

`reset_demo.py` only operates on SQLite; it refuses PostgreSQL/Supabase URLs by design.

---

## Repository layout

```text
chargeback-copilot/
├── backend/
│   ├── app/
│   │   ├── api/            # Route modules (auth, disputes, evidence, reports, settings, dashboard, paypal)
│   │   ├── core/           # Settings, database, security, token encryption, observability
│   │   ├── models/         # SQLAlchemy 2.0 models
│   │   ├── schemas/        # Pydantic v2 schemas (camelCase JSON)
│   │   ├── services/       # Case context, evidence, reports, settings, PayPal sync, demo seed
│   │   │   └── ai/         # Deterministic analysis engine + optional LLM drafts
│   │   ├── tests/          # pytest suite
│   │   └── main.py         # App factory, middleware, lifespan, router mounting
│   ├── migrations/         # Alembic revisions (0001 → 0004)
│   ├── scripts/            # reset_demo, check_database, mock PayPal sandbox
│   ├── storage/evidence/   # Uploaded files (git-ignored)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── API_CONTRACT.md
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/     # Layout, dashboard, disputes, auth, shared UI
│   │   ├── context/        # Auth and theme providers
│   │   ├── pages/          # Landing, login, dashboard, inbox, case, vault, reports, settings, PayPal
│   │   ├── services/       # Typed API call modules
│   │   └── lib/            # Axios client and session storage
│   ├── public/
│   └── README.md
├── .gitignore
└── README.md
```

---

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Landing page and product explainer |
| `/login`, `/signup` | Public | Authentication (`/login?demo=1` prefills demo credentials) |
| `/dashboard` | Authenticated | Overview, KPIs, copilot brief, pending actions |
| `/disputes` | Authenticated | Dispute inbox |
| `/disputes/:disputeId` | Authenticated | Case detail, evidence, AI analysis, response |
| `/evidence` | Authenticated | Evidence vault |
| `/reports` | Authenticated | Portfolio analytics and CSV export |
| `/settings` | Authenticated | Profile, notifications, password, integrations |
| `/paypal` | Authenticated | Sandbox connection, sync, permission probe |

---

## Database

SQLite is the zero-setup default (`backend/chargeback.db`); the schema is created and seeded on
first start. PostgreSQL is supported through SQLAlchemy and psycopg 3, with Alembic as the source
of truth.

### Supabase / hosted PostgreSQL

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Copy the **Session pooler** connection string (Project Settings → Database), append
   `?sslmode=require`, and set it in `backend/.env`:

   ```bash
   DATABASE_URL=postgresql+psycopg://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
   SEED_DEMO_DATA=true
   ```

3. Verify, migrate, and run:

   ```bash
   cd backend
   python scripts/check_database.py     # prints target, revision, counts; never the password
   alembic upgrade head
   python scripts/check_database.py     # should show revision 0004 (head)
   uvicorn app.main:app --port 8000
   ```

Use the session pooler (`5432`) for the API and migrations; the transaction pooler (`6543`) is
intended for serverless clients and can break prepared statements. Plain `postgresql://` and
`postgres://` URLs are normalized to the psycopg driver automatically.

### Migrations

```bash
alembic current          # applied revision
alembic history          # revision list
alembic upgrade head     # apply pending migrations
alembic downgrade -1     # roll back one revision
alembic check            # detect model/migration drift
```

---

## Configuration

Copy `backend/.env.example` to `backend/.env`. Key variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./chargeback.db` | SQLAlchemy connection string |
| `SEED_DEMO_DATA` | `true` | Seed the demo workspace when the database is empty |
| `STORAGE_DIR` | `./storage` | Evidence file root |
| `MAX_UPLOAD_MB` | `10` | Per-file upload ceiling |
| `MAX_REQUEST_MB` | `12` | Whole-request ceiling, enforced before parsing |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed browser origins |
| `JWT_SECRET` | dev-only value | JWT signing key — replace outside local development |
| `REQUIRE_AUTH` | `false` | Set `true` to require Bearer tokens on every `/api` route |
| `AI_MODE` | `auto` | `auto`, `heuristic`, or `llm` |
| `LLM_API_KEY` | empty | Enables LLM-generated draft prose |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint |
| `LLM_MODEL` | `gpt-4o-mini` | Draft model |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | empty | Sandbox app credentials (server-side only) |
| `PAYPAL_REDIRECT_URI` | `http://localhost:8000/api/paypal/oauth/callback` | Must match the PayPal app's allowed return URL |
| `PAYPAL_RETURN_URL` | `http://localhost:5173/paypal` | Frontend page the OAuth callback redirects to |
| `PAYPAL_ENVIRONMENT` | `sandbox` | `sandbox` or `live` |
| `PAYPAL_TOKEN_ENCRYPTION_KEY` | derived from `JWT_SECRET` | Fernet key for stored OAuth tokens |
| `PAYPAL_API_BASE` | per environment | Override the REST base (for the local mock) |

The frontend reads `VITE_API_BASE_URL` and an optional `VITE_PAYPAL_CLIENT_ID` from
`frontend/.env`. Never place the PayPal client secret or any other secret in a `VITE_*` variable.

---

## AI behavior

The intelligence engine is deterministic by default, so demos and tests are repeatable:

- **Classification, risk, win likelihood, evidence gaps, and recommendations** are rule-based.
- **Draft prose** can be rewritten by an OpenAI-compatible model when `LLM_API_KEY` is set
  (`AI_MODE=auto`). Output is length-checked and rejected if it invents order or transaction IDs
  that are not in the case record; any error falls back to the deterministic draft.
- Analysis results are cached in `ai_results` and keyed by an evidence fingerprint. Uploading or
  deleting evidence invalidates the cache; `POST .../ai-analysis/refresh` forces recomputation.

For Groq:

```bash
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=openai/gpt-oss-120b
```

---

## PayPal sandbox

- **Data sync** — `POST /api/paypal/sync` reads the sandbox Disputes, Payments, Orders, and Refunds
  APIs and normalizes them into the workspace. It works with client-credentials app access, so the
  demo does not depend on the merchant OAuth redirect.
- **Optional OAuth connection** — the `/paypal` page implements the authorization-code flow with
  single-use state, encrypted token storage, refresh, and disconnect. Completing it depends on the
  PayPal developer app enabling **Log in with PayPal** and allowing the callback URL.
- **Permission probe** — `GET /api/paypal/permissions` reports which APIs the app can reach.
- **Offline mock** — `python scripts/mock_paypal_sandbox.py` serves a stand-in REST API on
  `127.0.0.1:9000`; point `PAYPAL_API_BASE` at it to demo sync without developer credentials.

Sandbox accounts with zero disputes simply show the seeded workspace — that is expected.

---

## Tests and verification

```bash
cd backend
source .venv/Scripts/activate
pytest                 # 68 passing + 1 opt-in PostgreSQL test
ruff check app scripts
alembic check          # against a migrated database

cd ../frontend
npm run lint
npm run build
```

The pytest suite covers the API contracts, filters and pagination, AI analysis and caching,
evidence upload/delete effects, PDF extraction, draft save/submit guards, auth isolation, the
PayPal OAuth flow and sync normalization, request IDs and size limits, tenant-scoped downloads,
migration parity, and concurrent submit/draft races. Set `TEST_DATABASE_URL` to run the PostgreSQL
integration test.

---

## Docker

The backend ships a production-style image and a Compose stack with PostgreSQL:

```bash
cd backend
docker compose up --build
```

The API runs on <http://localhost:8000>; the container applies `alembic upgrade head` before
starting Uvicorn, runs as a non-root user, and exposes a health check. Compose volumes persist the
database and uploaded evidence.

For a hosted deployment, set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `REQUIRE_AUTH=true`, and
the PayPal/LLM variables in the platform environment. The frontend is a static Vite build
(`npm run build`) and can be served from any static host; point `VITE_API_BASE_URL` at the deployed
API during the build.

---

## Security notes

- Secrets live only in `backend/.env` (git-ignored); `.env.example` documents every variable.
- PayPal tokens are encrypted at rest and no client secret or token is returned by the API.
- Evidence downloads are authorization-checked and tenant-scoped; another merchant's file id
  returns `404`.
- Uploads are validated by magic bytes, not just extension, with per-file and whole-request limits.
- One response per dispute is enforced by a unique constraint; concurrent submits return `409`.
- Set `REQUIRE_AUTH=true` whenever the API is reachable beyond localhost.
- Rotate `JWT_SECRET`, `PAYPAL_TOKEN_ENCRYPTION_KEY`, `LLM_API_KEY`, the database password, and the
  PayPal client secret before any public deployment.

---

## Known limitations

- Automated claim submission to PayPal and dispute webhooks are out of scope. Submissions are
  recorded locally with a generated reference.
- Image OCR is not implemented; images upload successfully and are flagged for manual review.
- Hosted deployment requires your own database and hosting accounts; the local, Supabase, and
  Docker paths are complete.

---

## Documentation

- [Backend guide](backend/README.md) — setup, configuration, AI, evidence, PayPal OAuth, deployment.
- [API contract](backend/API_CONTRACT.md) — every endpoint and payload.
- [Roadmap](backend/ROADMAP.md) — delivery phases, testing strategy, demo script.
- [Frontend guide](frontend/README.md) — routes, pages, theme, and API integration.
