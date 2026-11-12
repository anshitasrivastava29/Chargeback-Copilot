# Chargeback Copilot — Backend

FastAPI service powering dispute management, evidence intelligence, risk scoring, and AI-assisted
responses for the Chargeback Copilot merchant dashboard.

The API is built to match the existing React frontend field-for-field (camelCase JSON, epoch-ms
timestamps, 26 seeded demo disputes), so Member 1 can swap the frontend's mock data/services for
HTTP calls without changing components.

---

## Quick start

```bash
cd backend

# 1. Create and activate a virtual environment
python -m venv .venv
# Windows (Git Bash):
source .venv/Scripts/activate
# Windows (PowerShell): .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements-dev.txt

# 3. (optional) configure the environment
cp .env.example .env

# 4. Run the API
uvicorn app.main:app --reload --port 8000
```

- API root: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health check: http://localhost:8000/api/health (reports API, database, AI mode, and request ID)

Every response carries an `X-Request-ID` header (supplied or generated) and the same value in the
health payload so a browser report can be matched to one structured server log line.

The first startup creates the SQLite schema (`chargeback.db`) and seeds the demo workspace. PostgreSQL
uses Alembic migrations instead — see [PostgreSQL](#postgresql) below.

### Demo credentials

```
email:    demo@acmecommerce.com
password: Demo1234!
```

Auth is optional by default (`REQUIRE_AUTH=false`): unauthenticated requests are served as the
demo merchant so frontend development is frictionless. Set `REQUIRE_AUTH=true` to enforce Bearer
tokens.

### Reset the demo workspace

The seed only runs when the database is empty. To return to a pristine workspace after testing
(uploads, submitted drafts, edited profile), stop the API and run:

```bash
python scripts/reset_demo.py          # asks for confirmation
python scripts/reset_demo.py --yes    # non-interactive demo prep
```

It deletes the SQLite file and uploaded evidence under `STORAGE_DIR`, rebuilds the schema, and
re-seeds 26 disputes (9 open) with the demo login. PostgreSQL is intentionally left alone — recreate
the database instead (`docker compose down -v` for the local stack).

---

## What is implemented

| Area | Endpoints / modules |
| --- | --- |
| Dispute management | list, filter, search, sort, paginate, detail context (`/api/disputes`) |
| Transaction analysis | transactions list/detail with linked disputes (`/api/transactions`) |
| Evidence uploads | multipart upload, type/size validation, list, delete, download (`/api/disputes/{id}/evidence`) |
| Evidence vault | workspace-wide file catalogue with search, type/status filters, pagination, stats (`/api/evidence`) |
| Reports | dispute analytics: totals, win rate, resolution, reason breakdown, monthly trend, evidence coverage, deadline exposure (`/api/reports/summary`) |
| Settings | merchant profile, notification preferences, password change, integration/workspace status (`/api/settings`) |
| Document processing | PDF text extraction (pypdf), regex field extraction, quality scoring |
| Evidence intelligence | required-vs-completed analysis, gap detection, relevance + inconsistency signals |
| Dispute classification | reason → category/type with confidence |
| Risk & strength scoring | risk level, win likelihood, contributing factors |
| Recommendations | prioritized action plan, next step, evidence guidance |
| AI response drafts | professional letter, editable, save + submit workflow |
| AI intelligence engine | cached analysis keyed by evidence fingerprint, optional LLM drafting |
| Dashboard | stats, win rate, pending actions, due dates (`/api/dashboard`) |
| PayPal sandbox OAuth | merchant connection via authorization code flow (`/api/paypal`), encrypted token storage, refresh + disconnect |
| PayPal data sync | real sandbox Disputes/Payments/Orders/Refunds reads (`POST /api/paypal/sync`), payload normalization into the existing dispute/transaction tables, per-API permission probe (`GET /api/paypal/permissions`) |
| Auth | signup, login, current user (JWT + PBKDF2) |
| Persistence | PostgreSQL via `DATABASE_URL` + Alembic migrations, SQLite fallback for local/demo |
| Hardening | request-size guard (413), tenant-scoped evidence download, DB-unique response per dispute, startup configuration warnings |
| Observability | request IDs on every response, structured request logs, AI cache/generation/fallback/latency logs |
| CI | GitHub Actions: Ruff, SQLite suite, PostgreSQL migration + integration test, frontend lint/build, Docker image build |

Full request/response details: [API_CONTRACT.md](./API_CONTRACT.md).
Delivery plan mapped to Member 2 responsibilities: [ROADMAP.md](./ROADMAP.md).

---

## Project layout

```
backend/
├── app/
│   ├── api/              # Route modules (disputes, evidence, vault, reports, settings, dashboard, transactions, auth, paypal)
│   ├── core/             # Settings, database, security, token cipher, time helpers
│   ├── models/           # SQLAlchemy 2.0 models
│   ├── schemas/          # Pydantic v2 request/response schemas (camelCase aliases)
│   ├── services/
│   │   ├── ai/           # Intelligence engine: analysis, scoring, drafts, optional LLM
│   │   ├── paypal/       # PayPal sandbox OAuth client, connection service, data sync, normalizers
│   │   ├── case_context.py      # Deterministic customer/order/tracking/refund context
│   │   ├── dispute_service.py   # Dispute workflow + serialization
│   │   ├── dashboard.py         # Stats and pending actions
│   │   ├── evidence_service.py  # Upload validation, extraction, storage
│   │   ├── evidence_vault.py    # Cross-case evidence catalogue with filters and stats
│   │   ├── reports.py           # Portfolio analytics aggregation
│   │   ├── settings.py          # Profile, notifications, password, integration summary
│   │   └── seed.py              # 26-dispute demo workspace
│   ├── tests/            # pytest suite (68 tests + 1 opt-in PostgreSQL test)
│   └── main.py           # App factory, CORS, middleware, lifespan, router mounting
├── migrations/           # Alembic environment and schema revisions
│   ├── env.py            # Reads DATABASE_URL from app settings
│   └── versions/         # 0001 initial schema · 0002 paypal oauth · 0003 unique submission · 0004 notification prefs
├── scripts/
│   ├── reset_demo.py     # Wipe + reseed the local SQLite demo workspace
│   ├── check_database.py # Redacted connectivity/revision/count check (Supabase-friendly)
│   └── mock_paypal_sandbox.py  # Local stand-in for the PayPal REST sandbox
├── storage/evidence/     # Uploaded files (git-ignored)
├── alembic.ini           # Alembic config (URL comes from env.py)
├── Dockerfile
├── docker-compose.yml    # API + PostgreSQL
├── requirements.txt
├── requirements-dev.txt
└── pyproject.toml        # Ruff + pytest config
```

---

## AI behavior

The intelligence engine is deterministic by default; the same dispute and evidence always produce
the same analysis. This keeps demos stable and testable.

`AI_MODE=auto` (default):

1. If `LLM_API_KEY` is set, the response draft is generated by an OpenAI-compatible chat model.
2. The output is validated: length bounds, and rejection if the model invents order or transaction
   IDs that are not in the case records.
3. On timeout, error, or validation failure, the service falls back to the deterministic draft.
4. Classification, risk, win likelihood, gaps, and recommendations are always rule-based — no LLM
   involvement — so scores stay explainable.

`AI_MODE=heuristic` disables the LLM entirely. `AI_MODE=llm` attempts the LLM first but still falls
back rather than failing the request.

Any OpenAI-compatible endpoint works. For Groq, set
`LLM_BASE_URL=https://api.groq.com/openai/v1` and a chat model such as
`openai/gpt-oss-120b` (list the models your key can use with
`GET https://api.groq.com/openai/v1/models`).

Analysis results are cached in `ai_results` keyed by an evidence fingerprint. Uploading or deleting
evidence changes the fingerprint, so the next `GET .../ai-analysis` recomputes gaps and scores
automatically. Use `POST .../ai-analysis/refresh` to force recomputation.

---

## Evidence processing

- Accepted: PDF, JPEG, PNG (`application/pdf`, `image/jpeg`, `image/png`) by magic bytes, not just
  extension.
- Max size: 10 MB (`MAX_UPLOAD_MB`).
- Files are stored under `STORAGE_DIR/evidence/<uuid>.<ext>` with sanitized names.
- PDFs: text extracted with pypdf (first 25 pages). Order IDs (`AC-#####`), transaction IDs, and
  tracking numbers are detected and compared against the dispute record.
- Images: accepted but flagged as not machine-readable; merchants are prompted to add a PDF or
  typed note.
- Seeded demo evidence records are metadata-only and intentionally have no downloadable file.

---

## Vault, reports, and settings

These three workspace features back the **Evidence vault**, **Reports**, and **Settings** pages.

- **Evidence vault** — `GET /api/evidence` joins every uploaded/demo file to its dispute and
  supports free-text search (`q` across file, case, buyer, order, transaction), evidence type
  (`type`), readiness (`status=all|ready|attention`), and pagination (`page`, `pageSize` up to 100).
  The response carries per-page items, `total`, `totalPages`, and workspace stats (files, bytes,
  distinct cases, ready/needs-attention counts, type counts). Files with stored bytes download
  through the authenticated `/api/evidence/{id}/file`; demo rows expose `previewUrl` or a
  metadata-only flag.
- **Reports** — `GET /api/reports/summary?days=` aggregates the merchant's disputes: totals and
  win rate, average resolution and response time, per-reason performance, monthly opened/won/lost
  buckets, evidence coverage (completed vs. required types, gaps, cases with gaps), the five most
  missing evidence types, and deadline exposure (overdue, due within 7 days, value at stake).
  Omitting `days` returns all time; the UI offers 30/90/365-day windows and a client-side CSV
  export.
- **Settings** — `GET /api/settings` returns the profile, notification preferences, workspace
  totals, PayPal/AI integration status, and app environment. `PATCH /api/settings/profile`,
  `PATCH /api/settings/notifications`, and `POST /api/settings/password` persist changes for the
  signed-in merchant. Notification booleans live on the `users` row (migration `0004`); SQLite
  workspaces created before that migration are upgraded in place on startup.

All three endpoints are tenant-scoped and require the same Bearer token as the rest of `/api`.

---

## PostgreSQL

SQLite is the default for zero-setup demos and creates its schema on startup. PostgreSQL is
supported through SQLAlchemy and psycopg 3, with Alembic as the source of truth for its schema.
Plain `postgresql://` and Heroku-style `postgres://` URLs are normalized to
`postgresql+psycopg://` automatically, so either form works.

### Local PostgreSQL setup

```bash
# 1. Install dependencies (includes psycopg 3 and Alembic)
pip install -r requirements-dev.txt

# 2. Point the app at PostgreSQL
# Git Bash / macOS / Linux:
export DATABASE_URL="postgresql+psycopg://copilot:copilot@localhost:5432/chargeback"
# Windows PowerShell:
# $env:DATABASE_URL = "postgresql+psycopg://copilot:copilot@localhost:5432/chargeback"

# 3. Create or upgrade the schema
alembic upgrade head

# 4. Run the API
uvicorn app.main:app --reload --port 8000
```

If you do not have PostgreSQL installed, start only the database from Compose:

```bash
docker compose up -d db
```

Then run the migration and API steps above against `localhost:5432`. The API refuses to start when
it connects to a PostgreSQL database whose schema is missing, and prints the `alembic upgrade head`
instruction instead of failing later on the first query.

`SEED_DEMO_DATA=true` still seeds the 26-dispute workspace on the first PostgreSQL start.

### Supabase (hosted PostgreSQL)

Supabase works as the hosted PostgreSQL database with no code changes — point `DATABASE_URL` at the
project and run the migrations.

1. Create the project at [supabase.com/dashboard](https://supabase.com/dashboard), wait for the
   database to finish provisioning, and keep the generated password somewhere safe.
2. Open **Project Settings → Database → Connection string** and choose **Session pooler** (not the
   transaction pooler). The URI looks like:
   `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
3. Copy it into `backend/.env`, switch the scheme to `postgresql+psycopg://` (optional — the app
   normalizes `postgresql://` and `postgres://` automatically), append `?sslmode=require`, and set
   `SEED_DEMO_DATA=true`:

   ```bash
   DATABASE_URL=postgresql+psycopg://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
   SEED_DEMO_DATA=true
   ```

   URL-encode special characters in the password (`@` → `%40`, `#` → `%23`, `%` → `%25`, `:` →
   `%3A`). Use the **Session pooler** on port `5432` for a long-running API and for Alembic; the
   transaction pooler on `6543` is intended for serverless clients and can break prepared
   statements and migrations.

4. Verify the connection, apply the schema, then start the API:

   ```bash
   python scripts/check_database.py     # prints target, revision, counts; never the password
   alembic upgrade head
   python scripts/check_database.py     # should now show revision 0004 (head)
   uvicorn app.main:app --port 8000
   ```

   The first start seeds the 26 demo disputes because the database is empty. `GET /api/health`
   should report `"database": "ok"`.

Notes:

- The direct connection host (`db.<project-ref>.supabase.co:5432`) is IPv6-only on many projects;
  the session pooler gives you IPv4/IPv6 without an add-on.
- Supabase requires TLS — keep `sslmode=require` in the URL. Never commit `backend/.env`; rotate the
  database password from the dashboard if it leaks.
- Free projects pause after a period of inactivity. The first request after a pause may take a few
  seconds while the database wakes; `pool_pre_ping` reconnects automatically.
- Do **not** run `scripts/reset_demo.py` against Supabase — it refuses non-SQLite URLs by design.
  To reset the hosted demo, recreate the project or drop the schema and re-run
  `alembic upgrade head` (destructive; back up first).
- If you deploy the API on Render/Railway/Fly, set the same `DATABASE_URL` there and make sure the
  platform allows outbound TLS on port 5432.

### Migrations

| Command | Purpose |
| --- | --- |
| `alembic current` | Show the revision applied to the configured database |
| `alembic history` | List revisions |
| `alembic upgrade head` | Apply all pending migrations |
| `alembic downgrade -1` | Roll back the latest revision |
| `alembic revision --autogenerate -m "describe change"` | Generate a revision from model changes |
| `alembic check` | Fail if the models and migrations have drifted |

`migrations/env.py` reads `DATABASE_URL` (or `backend/.env`) through the app settings, so the API
and migrations always target the same database. Override a single command without changing the
environment:

```bash
alembic -x db_url=postgresql://copilot:copilot@localhost:5432/chargeback upgrade head
```

The baseline revision `0001_initial_schema` creates `users`, `transactions`, `disputes`,
`activity_events`, `ai_results`, `evidence_files`, `response_drafts`, and `response_submissions`,
including foreign keys (`ON DELETE CASCADE` for case-owned rows), unique indexes, and JSON/Numeric
columns. Review any autogenerated revision before committing it, then run `alembic check` to confirm
there is no pending drift.

A SQLite database created automatically at startup (the zero-setup demo path) is not tracked by
Alembic, so `alembic current`/`alembic check` report it as unstamped. If you want to use migration
commands against that existing demo database, stamp it once (`alembic stamp head`); new databases
should be created with `alembic upgrade head` instead.

Preview the PostgreSQL DDL without a running database (useful in CI or when only SQLite is
available):

```bash
alembic -x db_url=postgresql://user:pass@localhost:5432/chargeback upgrade head --sql
```

Alembic also works against SQLite (`render_as_batch` is enabled there); SQLite does not require it
because startup still runs `CREATE_ALL` for zero-setup development.

### One-command stack

```bash
docker compose up --build
```

Starts PostgreSQL 16 and the API on `http://localhost:8000`, with volumes for database data and
uploaded evidence. The container runs `alembic upgrade head` before starting uvicorn, so schema
changes are applied automatically during deployment.

---

## PayPal sandbox OAuth

Merchants connect a PayPal **sandbox** account with the standard OAuth 2.0 authorization code
flow ("Connect with PayPal"). The flow never touches the browser with credentials:

1. `POST /api/paypal/connect` creates a single-use state (10-minute TTL) and returns the
   PayPal authorization URL.
2. The merchant authorizes on `sandbox.paypal.com` and PayPal redirects to
   `GET /api/paypal/oauth/callback?code=…&state=…`.
3. The backend verifies the state, exchanges the code with HTTP Basic auth
   (`client_id:client_secret`), fetches the merchant profile, encrypts the access/refresh tokens
   (Fernet), and redirects to the frontend at `PAYPAL_RETURN_URL` with `?paypal=connected` or
   `?paypal=error&reason=<safe reason>`.
4. `GET /api/paypal/connection` reports status. `POST /api/paypal/connection/refresh` rotates the
   access token. `POST /api/paypal/connection/disconnect` deletes the stored tokens.

Secrets never appear in API responses, redirects, or logs. The client secret lives only in the
backend environment; tokens are encrypted at rest with
`PAYPAL_TOKEN_ENCRYPTION_KEY` (falls back to a key derived from `JWT_SECRET`).

To enable it locally:

1. Create a sandbox app at the [PayPal developer dashboard](https://developer.paypal.com/dashboard/applications/sandbox),
   enable **Log in with PayPal** for it, and add
   `http://localhost:8000/api/paypal/oauth/callback` as an allowed return URL.
2. Enable the **Disputes** feature (and Payments/Orders/Refunds if you want the sync to enrich
   every record) for the same app.
3. In `backend/.env` set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` (optionally
   `PAYPAL_TOKEN_ENCRYPTION_KEY`).
4. Restart the API and connect from **PayPal account** in the frontend sidebar.

`GET /api/paypal/permissions` is the quickest way to confirm the app is wired correctly. A row
reading `authorized` for Disputes means the credentials and sandbox app are working. Payments and
Refunds stay `unverified` until the sandbox account has a dispute with a sample capture/refund;
Orders stays `unverified` unless `PAYPAL_SAMPLE_ORDER_ID` is set. `unverified` is informational,
not an error.

Endpoints and payloads: see the PayPal section in [API_CONTRACT.md](./API_CONTRACT.md).

## PayPal sandbox data sync

`POST /api/paypal/sync` pulls **real sandbox data** through the read-only PayPal APIs and
upserts it into the existing disputes/transactions tables — the frontend contract is unchanged:

- `GET /v1/customer/disputes` (list + per-dispute detail) — reasons and dispute states are
  normalized to the workspace's six reasons and `open`/`won`/`lost` statuses; response deadlines
  come from `extensions.response_required_by`.
- `GET /v2/payments/captures/{id}` — transaction amount/status and the merchant order reference
  (`custom_id`/`invoice_id`).
- `GET /v2/checkout/orders/{id}` — buyer, line items, and shipping when a dispute carries a
  checkout order id.
- `GET /v2/payments/refunds/{id}` — recorded when a dispute includes `refund_details`.

Token selection: the connected merchant's stored token is used when its scopes include
`disputes`; otherwise a cached client-credentials app token (the standard way a merchant REST app
reads its own sandbox data). `GET /api/paypal/permissions` probes each API and reports
`authorized` / `unauthorized` / `forbidden` / `error` / `unverified` so supported endpoints and
permissions are verifiable at runtime.

To try it without developer-dashboard credentials, a local mock of those APIs is included:

```bash
python scripts/mock_paypal_sandbox.py      # 127.0.0.1:9000
# second terminal:
PAYPAL_CLIENT_ID=mock PAYPAL_CLIENT_SECRET=mock PAYPAL_API_BASE=http://127.0.0.1:9000 \
  uvicorn app.main:app --port 8000
```

Then open `/paypal` → "Sync sandbox data". With real credentials, the same flow hits
`api-m.sandbox.paypal.com` — enable the Disputes/Payments APIs for the app in the dashboard and
(optionally) set `PAYPAL_SAMPLE_ORDER_ID` to verify Orders access.

---

## Tests and linting

```bash
source .venv/Scripts/activate
pytest                 # 68 tests (+1 PostgreSQL test when TEST_DATABASE_URL is set)
ruff check app         # lint
pytest --cov=app       # coverage (pytest-cov)
```

Coverage includes the list/detail contract, filters and pagination, AI analysis shape and caching,
evidence upload/delete effects on gaps, PDF extraction, draft save/submit guards, auth isolation,
dashboard stats, pending actions, transactions, migration parity (upgrade/downgrade plus
`compare_metadata` against the ORM models), the PayPal sandbox OAuth flow (authorization URL,
single-use state, mocked token exchange, encrypted storage, refresh, disconnect, and an assertion
that secrets/tokens never reach the API surface), the PayPal data sync (payload
normalization, upsert idempotency, refund recording, merchant-vs-app token selection, permission
probe classification), request IDs, request-size rejection, health degradation, path-traversal
sanitization, tenant-scoped evidence downloads, and concurrent submit/draft races. The workspace
features are covered too: vault stats reconcile with filters and pagination, reports totals/reason/
monthly aggregation and range filtering, settings defaults and persistence, notification round
trips, and password change (old password rejected, new password accepted), all with tenant
isolation assertions.

---

## Hardening and deployment

- **Request IDs** — `RequestContextMiddleware` assigns or echoes `X-Request-ID` and logs one
  `request.completed request_id=… method=… path=… status=… duration_ms=…` line per request.
- **Request-size guard** — `RequestSizeLimitMiddleware` rejects a `Content-Length` above
  `MAX_REQUEST_MB` (default 12) with `413` before parsing. The evidence service still enforces the
  per-file `MAX_UPLOAD_MB` (default 10) limit.
- **Evidence access** — `GET /api/evidence/{id}/file` requires the caller and is scoped to the
  merchant that owns the dispute; another merchant's evidence id returns `404`. Uploaded files no
  longer expose a direct `previewUrl`; the frontend fetches them as authenticated blobs.
- **One response per dispute** — `response_submissions.dispute_id` is unique (migration `0003`).
  Concurrent submits return one `200` and one `409`; concurrent first-draft saves collapse into one
  row instead of failing.
- **Startup warnings** — logs when `JWT_SECRET` is the development default or shorter than 32
  characters, when `REQUIRE_AUTH` is false with `ENVIRONMENT=production`, when CORS allows `*`, and
  when PayPal is configured without an explicit `PAYPAL_TOKEN_ENCRYPTION_KEY`.
- **Health** — `/api/health` probes the database and returns `503` with `status: "degraded"` when
  the probe fails, so an uptime monitor sees an outage.
- **Container** — the image runs as a non-root user, ships a `HEALTHCHECK`, and Compose waits for
  the API health check. `.dockerignore` keeps local databases, environments, and uploads out of the
  build context.
- **CI** — `.github/workflows/ci.yml` runs Ruff, applies and checks PostgreSQL migrations, runs the
  SQLite suite plus the PostgreSQL integration test (`TEST_DATABASE_URL`), lints/builds the
  frontend, and builds the API image.

A hosted PostgreSQL cutover still requires provisioning a database and setting `DATABASE_URL`, as
described below.

---

## Environment variables

See [.env.example](./.env.example). Key settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./chargeback.db` | SQLAlchemy connection string. SQLite auto-creates its schema; PostgreSQL (`postgresql://` or `postgresql+psycopg://`) requires `alembic upgrade head`. |
| `SEED_DEMO_DATA` | `true` | Seed the demo workspace when the DB is empty |
| `STORAGE_DIR` | `./storage` | Evidence file root |
| `MAX_UPLOAD_MB` | `10` | Per-file upload ceiling |
| `MAX_REQUEST_MB` | `12` | Whole-request ceiling (413 before parsing); keep above `MAX_UPLOAD_MB` |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed browser origins |
| `JWT_SECRET` | dev-only value | Signing key — replace in production |
| `REQUIRE_AUTH` | `false` | Enforce Bearer tokens on all `/api` routes |
| `AI_MODE` | `auto` | `auto`, `heuristic`, or `llm` |
| `LLM_API_KEY` | empty | Enables LLM-generated drafts |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `LLM_MODEL` | `gpt-4o-mini` | Draft model |
| `PAYPAL_CLIENT_ID` | empty | Sandbox app client ID (enables the OAuth flow) |
| `PAYPAL_CLIENT_SECRET` | empty | Sandbox app secret — server-side only, never in `VITE_*` |
| `PAYPAL_REDIRECT_URI` | `http://localhost:8000/api/paypal/oauth/callback` | Must match the PayPal app's allowed return URL |
| `PAYPAL_RETURN_URL` | `http://localhost:5173/paypal` | Frontend page the OAuth callback redirects to |
| `PAYPAL_SCOPES` | `openid email` | Space/comma-separated scopes requested on connect |
| `PAYPAL_ENVIRONMENT` | `sandbox` | `sandbox` or `live` (switches api-m/paypal.com bases) |
| `PAYPAL_TOKEN_ENCRYPTION_KEY` | derived from `JWT_SECRET` | Fernet key for stored tokens; generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `PAYPAL_API_BASE` | per environment | Override the REST base (e.g. the local mock server) |
| `PAYPAL_SAMPLE_ORDER_ID` | empty | Order id used by `GET /api/paypal/permissions` to verify Orders access |

---

## Frontend integration (Member 1)

**Phase 5 is complete and verified end-to-end.** The frontend ships `src/lib/api.js` (axios with
Bearer-token request interceptor and 401 handling) plus the `src/services/*` modules; no mock data
imports remain. The dashboard, inbox, detail/AI panel, evidence upload/preview/delete, login/signup,
and `/paypal` pages all run against this API. Uploading evidence was verified live: gaps drop,
win likelihood and citation counts rise, and the draft refreshes.

The original switch-over recipe, kept for reference:

1. Start the backend on port 8000.
2. In `frontend/src/services/`, replace mock functions with calls to `http://localhost:8000/api`.
   Attach `Authorization: Bearer <token>` when `REQUIRE_AUTH=true`.
3. Replace imports from `frontend/src/data/disputes.js` with `GET /api/disputes` (the response
   matches the components' expected fields).
4. Keep `frontend/src/utils/` helpers or delete them — the backend returns the same derived
   customer/order/tracking/refund/dashboard values.
5. Point evidence upload at `POST /api/disputes/{id}/evidence` using `FormData` with the
   `evidenceType` field.

PayPal sandbox OAuth (merchant account connection) and the sandbox data sync (Disputes, Payments,
Orders, Refunds reads with normalization) are implemented in the backend — see
[PayPal sandbox OAuth](#paypal-sandbox-oauth) and
[PayPal sandbox data sync](#paypal-sandbox-data-sync). The frontend page is `/paypal`
(`src/pages/PayPalConnectionPage.jsx`) with "Sync sandbox data" and "Check API permissions"
actions. Automated dispute claim submission through the PayPal REST API and webhook delivery
remain separate integration work: submissions recorded by this backend stay local with a
generated `paypalReference`.
