# Member 2 Roadmap — Backend, AI/ML & Dispute Intelligence

Chargeback Copilot · PayPal AI Hackathon 2026

This roadmap maps every Member 2 responsibility to concrete modules, endpoints, tests, and
delivery phases. It also defines the integration boundary with Member 1 so the two workstreams can
proceed in parallel without blocking each other.

**Current state:** All phases are implemented and verified (68 passing tests plus one opt-in
PostgreSQL integration test, clean Ruff lint on `app` and `scripts`, frontend lint/build green).
Phase 5 is verified live against the FastAPI service, including the Evidence vault, Reports, and
Settings pages; Phase 6 hardening, CI, and deployment artifacts are in place; the Phase 7 reset
script and local rehearsal are complete. What remains is provisioning a hosted PostgreSQL instance
and pointing the deployed API/frontend at it (Phase 6 deployment), which is an account/platform
action rather than a code change.

---

## 1. Responsibility coverage

| # | Responsibility | Where it lives | Status |
| --- | --- | --- | --- |
| 1 | Python FastAPI backend | `app/main.py`, `app/api/` | Done |
| 2 | REST APIs for frontend–backend communication | `app/api/*`, `API_CONTRACT.md` | Done |
| 3 | Dispute management business logic | `app/services/dispute_service.py`, `app/api/disputes.py` | Done |
| 4 | Evidence uploads and document processing | `app/services/evidence_service.py`, `app/api/evidence.py` | Done |
| 5 | Extract info from invoices, receipts, shipping proofs | pypdf + regex extraction in `evidence_service.py` / `ai/evidence_analyzer.py` | Done (text PDFs) |
| 6 | AI-based dispute classification | `app/services/ai/classifier.py` | Done |
| 7 | Chargeback reason and transaction analysis | `ai/classifier.py`, `ai/risk.py`, `api/transactions.py` | Done |
| 8 | Relevant vs. missing evidence analysis | `app/services/ai/evidence_analyzer.py` | Done |
| 9 | AI-powered evidence recommendations | `app/services/ai/recommender.py` | Done |
| 10 | Dispute strength / risk scoring | `app/services/ai/risk.py` | Done |
| 11 | Professional AI response drafts | `app/services/ai/drafts.py`, `ai/llm.py` | Done |
| 12 | Dispute intelligence engine | `app/services/ai/engine.py` | Done |
| 13 | PostgreSQL connection | `DATABASE_URL` + psycopg 3, Alembic, `docker-compose.yml`, PostgreSQL integration test | Done; hosted cutover pending provisioning |
| 14 | Testing, validation, error handling, deployment | `app/tests/`, Docker, CI, config | Done |
| 15 | Merchant workspace surfaces | Evidence vault (`services/evidence_vault.py`), reports (`services/reports.py`), settings (`services/settings.py`), migration `0004`, matching frontend pages | Done |

---

## 2. Phases

### Phase 0 — Contract and foundation (Week 1) · Done

**Goal:** lock the API shape to the existing frontend before writing business logic.

- Read the frontend mocks (`data/disputes.js`, `utils/aiAnalysis.js`, `services/aiAnalysis.js`,
  `utils/disputeDetails.js`) and reproduce the exact response shapes.
- FastAPI app factory with lifespan seeding, CORS, `/api` prefix, Swagger.
- Settings via `pydantic-settings`; SQLite for local, PostgreSQL via `DATABASE_URL`.
- SQLAlchemy 2.0 models: users, transactions, disputes, evidence, AI results, response drafts,
  submissions, activity events.
- Pydantic v2 camelCase aliasing and epoch-ms timestamps.

**Exit criteria:** `/api/health` and `/docs` reachable; models create in SQLite and use
dialect-portable types for PostgreSQL (live verification in Phase 6); seed produces 26 disputes with
9 open / 11 won / 6 lost.

---

### Phase 1 — Dispute domain APIs (Week 1–2) · Done

- List endpoint with status/reason/priority/search/days/sort/page filters and stable counts.
- Detail endpoint with deterministic customer, order, tracking, refund, and activity context.
- Transactions list/detail with linked dispute tracking.
- Tenant scoping on every query (merchant ID), 404 rather than leaking other merchants' records.

**Exit criteria:** frontend inbox and detail pages can render from the API with no field mapping.
Covered by `test_disputes.py`.

---

### Phase 2 — Evidence pipeline (Week 2–3) · Done

- Multipart upload: magic-byte validation (PDF/JPEG/PNG), 10 MB cap, empty-file rejection,
  UUID storage names, path sanitization.
- PDF text extraction (pypdf, 25-page cap) with graceful handling of encrypted/corrupt files.
- Field extraction: order IDs (`AC-\d{4,6}`), 17-char transaction IDs, tracking numbers.
- Quality scoring, relevance checks, consistency signals (order/transaction mismatch).
- List/delete/download endpoints; activity events; AI fingerprint invalidation on change.

**Exit criteria:** upload a PDF with a mismatched order ID and the AI analysis shows a
`order_mismatch` signal and a lower score; deleting the file restores the gap. Covered by
`test_evidence.py`.

**Known limitation:** image OCR is not implemented; images are accepted but marked
`not_supported` for extraction. Phase 6 adds optional OCR.

---

### Phase 3 — Intelligence engine (Week 3–4) · Done

- `DisputeIntelligenceEngine.analyze` orchestrates: evidence analysis → classification → risk →
  win likelihood → recommendations → next step → draft.
- Classification mapping for six reason codes with confidence adjustments for evidence coverage.
- Risk rules: closed status, priority, missing evidence, deadline proximity, critical signals.
- Win likelihood: base rate by reason + evidence ratio + tracking/refund/quality/signal deltas,
  clamped 19–93; `null` for closed cases.
- Recommendation playbook per reason code, capped at three actions plus a suggested next step.
- Deterministic professional draft with evidence filenames and case facts.
- Cache in `ai_results` keyed by SHA-1 evidence fingerprint; forced refresh endpoint.
- Optional OpenAI-compatible LLM drafting with strict fact-only prompt, ID-invention guard, and
  heuristic fallback.

**Exit criteria:** analysis payload satisfies the frontend contract; same input → same output;
LLM unavailable → identical UX via fallback. Covered by `test_ai_analysis.py`.

---

### Phase 4 — Workflow, dashboard, auth (Week 4–5) · Done

- Draft save/restore with closed-case and already-submitted guards (409).
- Submit endpoint: evidence ownership validation, one submission per dispute, activity event,
  local `paypalReference` (recorded response; automated PayPal claim submission stays out of scope).
- Dashboard stats (totals, win rate, values, reasons, pending/overdue) and pending actions
  (evidence → decision → response, sorted by due date).
- JWT auth (PBKDF2-SHA256, HS256), signup/login/me, tenant isolation, optional enforcement.

**Exit criteria:** full demo loop works through HTTP: list → detail → analysis → edit draft →
submit. Covered by `test_workflow.py` and `test_dashboard_auth.py`.

---

### Phase 5 — Integration with Member 1 (Week 5–6) · Done

**Goal:** replace frontend mocks with live API calls and validate the combined demo.

Delivered:

1. `VITE_API_BASE_URL`, shared axios instance, Bearer-token interceptor, and 401 handling.
2. Inbox/detail switched to `GET /api/disputes` and `GET /api/disputes/{id}`; mock data modules
   removed.
3. AI panel switched to `GET .../ai-analysis`, `POST .../response-draft`, `POST .../submit`.
4. Evidence upload via `FormData` with analysis refresh, delete, authenticated blob previews, and
   download.
5. Dashboard stats and pending actions from `/api/dashboard/*`.
6. Login/signup against `/api/auth/*` with token storage and 401 redirects.
7. CORS/ports confirmed (`localhost:5173` + `uvicorn` on `8000`).
8. Workspace features completed after the initial switch-over: Evidence vault (`/evidence`),
   Reports (`/reports`), and Settings (`/settings`) consume new tenant-scoped endpoints; the
   sidebar "Soon" placeholders are gone.

**Verified live:** login → dashboard (26 disputes, 9 open) → inbox (counts 26/9/11/6) → detail
(AI analysis, 2/4 evidence) → upload PDF → gaps 2→1, win likelihood 65%→72%, citations 2→3 →
authenticated preview → PayPal page (Disputes `authorized`, other APIs `unverified` until sample
resources exist). No console errors.

**Exit criteria met:** no mock imports remain; all pages work end-to-end against the live API;
uploading evidence visibly changes gaps/win likelihood after refresh.

**Dependencies:** Member 1's PayPal sandbox data is additive; seeded disputes cover every screen,
and sandbox OAuth/sync is backend-owned.

---

### Phase 6 — Hardening, PostgreSQL, deployment (Week 6–7) · Done (hosted provisioning pending)

**Goal:** production-grade errors, security, observability, CI, and a deployable image.

Delivered:

1. **PostgreSQL cutover** — baseline `0001`, PayPal `0002`, unique submission `0003`; startup guard
   for un-migrated schemas; `docker compose up` stack; opt-in PostgreSQL integration test
   (`TEST_DATABASE_URL`) covering JSON columns, numerics, uploads, analysis, and dashboard.
2. **Validation & error handling** — audited 400/401/404/409/413/422 paths; request-size guard
   (`MAX_REQUEST_MB`, 413 before parsing) behind the per-file `MAX_UPLOAD_MB` check.
3. **Testing** — 68 passing tests (+1 PostgreSQL test); concurrent submit/draft race tests; Ruff
   added to `requirements-dev.txt`; CI runs lint, migration parity, SQLite + PostgreSQL tests.
4. **Security** — tenant-scoped evidence download, no unauthenticated preview URLs, upload path
   traversal test, startup warnings for default `JWT_SECRET`, disabled auth in production, wildcard
   CORS, and missing PayPal token encryption key.
5. **Deployment** — non-root image with `HEALTHCHECK`, `.dockerignore`, Compose healthcheck and
   restart policy, CI image build.
6. **Observability** — `X-Request-ID` on every response, one structured request log line,
   AI cache/generation/fallback/latency logs, health endpoint with a database probe (`503` when
   degraded).

**Remaining for the exit criteria:** provision managed PostgreSQL (Render/Railway/Supabase/Neon),
set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `REQUIRE_AUTH=true`, and a PayPal token
encryption key; deploy the image; verify the public `/api/health` and the post-deploy checklist
below. Those are account/platform actions, not code changes.

---

### Phase 7 — Demo readiness (final 2–3 days) · Done (local)

- `scripts/reset_demo.py` deletes the SQLite file and uploaded evidence, rebuilds the schema, and
  re-seeds 26 disputes (9 open); `--yes` for non-interactive demo prep. PostgreSQL is reset by
  recreating the database instead.
- Rehearsed end-to-end against the live API: login → dashboard → inbox → detail/AI analysis →
  evidence vault → reports → settings → PayPal account, with no console errors.
- Fallbacks documented: deterministic AI without a key, SQLite when PostgreSQL is unavailable,
  demo seed when the sandbox has no disputes, and pre-recorded backup as last resort.
- API contract frozen; the workspace endpoints (vault, reports, settings) are additive to the
  original shape.

---

## 3. Definition of done (per responsibility)

| # | Done means |
| --- | --- |
| 1 | App runs via `uvicorn app.main:app`; `/docs` lists every route; Docker image builds |
| 2 | Every frontend screen can be driven by the API; contract documented and version-frozen |
| 3 | List/detail/filter/sort/pagination/tenant scoping implemented and tested |
| 4 | Upload/list/delete/download work; invalid type/size/empty rejected with 400 |
| 5 | PDF text and order/transaction/tracking fields extracted; extraction failures degrade gracefully |
| 6 | Six reasons classified into category/type with confidence; tests cover all six |
| 7 | Reason + transaction context reflected in risk, factors, and draft |
| 8 | Completed/missing types computed; gaps carry severity and notes; uploads change the result |
| 9 | Prioritized recommendations and a concrete next step per case |
| 10 | Risk level and win likelihood deterministic, explained by factors, `null` when closed |
| 11 | Draft is professional, cites attached evidence, editable, save/submit guarded |
| 12 | One engine orchestrates all analysis, caches by fingerprint, supports forced refresh |
| 13 | Runs against PostgreSQL via env var; Alembic revisions and startup schema guard; Docker stack; PostgreSQL integration test passes in CI |
| 14 | 68 tests green, lint clean, consistent errors, request IDs, deployable image with health check; hosted URL pending provisioning |
| 15 | Vault search/filters/pagination match the workspace, report totals reconcile with the dashboard, settings persist across reloads, all tenant-scoped |

---

## 4. Integration contract with Member 1

**Backend owns**

- All `/api/*` business endpoints and response shapes.
- Evidence storage/processing and AI analysis.
- Auth token issuance (login/signup/me, JWT verification).
- Database reads/writes for disputes, evidence, AI results, responses.

**Member 1 owns**

- PayPal Developer sandbox app ownership and the REST transaction fetch/webhook sync that feeds
  the `transactions` and `disputes` tables (the backend's OAuth sandbox app lives in backend env).
- Webhook receiver that creates/updates disputes and transactions.
- PostgreSQL schema ownership (backend mirrors it; coordinate before migrations).
- Frontend pages, routing, and calling the API.

**Shared agreements**

- camelCase JSON, epoch-ms timestamps, `pageSize` query param.
- Frontend origin added to `CORS_ORIGINS`; backend on port 8000, Vite on 5173.
- `REQUIRE_AUTH=false` during integration; flip to `true` in staging.
- Any contract change goes through `API_CONTRACT.md` first.

**PayPal boundary:** the backend calls PayPal for sandbox OAuth — `POST /api/paypal/connect`
sends the merchant through "Connect with PayPal" and stores encrypted access/refresh tokens — and
now also for sandbox data sync: `POST /api/paypal/sync` reads the Disputes, Payments (captures),
Checkout Orders, and Refunds APIs, normalizes PayPal reasons/statuses into the workspace
vocabulary, and upserts the results into the existing `transactions` and `disputes` tables with no
schema change, while `GET /api/paypal/permissions` probes which APIs the credentials can reach.
Automated claim submission and dispute webhooks remain future integration work; submission keeps
returning a local `paypalReference`.

---

## 5. Testing strategy

| Layer | What | Tool |
| --- | --- | --- |
| Contract | Response shapes, camelCase, ms timestamps, counts | pytest + TestClient |
| Behavior | Filters, sort, pagination, detail context, tenant isolation | pytest |
| Evidence | Upload validation, spoofed files, extraction, gap changes, delete | pytest (generated PDFs) |
| AI | Payload contract, caching, forced refresh, closed-case `null`, LLM guard | pytest |
| Workflow | Draft guards, submit, double submit, unknown evidence | pytest |
| Dashboard/Auth | Stats ranges, pending action order, signup/login, `REQUIRE_AUTH` | pytest |
| Vault | Stats reconciliation, search/type/status filters, pagination, tenant isolation | pytest |
| Reports | Totals/win rate, reason and monthly sums, range filter, tenant isolation | pytest |
| Settings | Defaults, profile persistence, notification round trip, password change, blank input | pytest |
| Lint | Style/imports/bugs | Ruff |
| Post-Phase 6 | PostgreSQL integration, concurrency, deployment smoke | CI + hosted env |
Run locally:

```bash
pytest
ruff check app
pytest --cov=app
```

---

## 6. Deployment plan

**Local demo**

```bash
uvicorn app.main:app --port 8000          # SQLite, seeded, heuristic/auto AI
npm run dev --prefix ../frontend          # Vite on 5173
```

**Containerized**

```bash
docker compose up --build                 # API + PostgreSQL 16 + volumes
```

**Hosted (choose one)**

- Supabase: create a project, copy the **Session pooler** URI, append `?sslmode=require`, set
  `DATABASE_URL`, then run `python scripts/check_database.py` and `alembic upgrade head`. See the
  Supabase section in `README.md`; the app and migrations need no code changes.
- Render/Railway: deploy the `Dockerfile`, attach managed Postgres, set env vars, mount a disk for
  `/app/storage/evidence` (or move uploads to S3-compatible storage).
- Fly.io: `fly launch` with the Dockerfile; `fly postgres attach`.
- Any platform: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `REQUIRE_AUTH`, `LLM_API_KEY` are the
  only required settings.

Post-deploy checklist:

- [ ] `GET /api/health` returns `status: ok`
- [ ] Seed produced 26 disputes (or production data imported)
- [ ] Login with demo credentials works
- [ ] Upload → analysis refresh → draft save → submit works over HTTPS
- [ ] Uploaded file survives a restart
- [ ] CORS allows only the deployed frontend origin
- [ ] `REQUIRE_AUTH=true` and 401s behave correctly

---

## 7. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Frontend contract drift | Integration rework | Contract doc frozen in Phase 0; backend adapts, not UI |
| PayPal sandbox unavailable / rate-limited | No live data for demo | Seeded 26 disputes; Member 1's sync is additive; OAuth connect unaffected by data-sync outages |
| LLM latency, cost, or hallucinated facts | Broken or unsafe drafts | Deterministic default; strict prompt; ID guard; heuristic fallback |
| Scanned/image-only PDFs | No extracted fields | Quality score + `extraction_failed` signal; prompt for PDF/typed note; OCR in Phase 6 |
| Persistence on ephemeral hosting | Lost uploads/DB | Managed Postgres + mounted volume or object storage |
| Schema drift between models and database | Failed queries or lost changes | Alembic baseline added; run `alembic check` after model changes; coordinate schema with Member 1 |
| Auth left disabled in public demo | Data exposure | Enforce `REQUIRE_AUTH=true` in staging/production; demo tenant is isolated |
| Double submission | Duplicate claims | 409 guard + submission record; concurrency test in Phase 6 |

---

## 8. Post-hackathon backlog

1. Run migrations and `alembic check` against PostgreSQL in CI.
2. Background jobs (Celery/RQ) for extraction, LLM drafting, and bulk analysis.
3. OCR for scanned documents (Tesseract or a vision model) with the same field-extraction contract.
4. Embedding-based evidence relevance and citation excerpts.
5. Consume PayPal dispute webhooks to auto-create cases (Member 1 boundary); automated claim
   submission over the stored OAuth tokens.
6. Merchant policy knowledge base for richer rebuttals.
7. Feedback loop: record human accept/edit/reject on drafts to tune prompts and scoring.
8. Multi-user roles (owner, analyst, reviewer) and audit log.
9. Rate limiting, request IDs, metrics, and alerting.
10. Object storage for evidence with signed URLs and retention policy.

---

## 9. Demo script (3 minutes)

1. **Dashboard** — 26 disputes, 65% win rate, pending actions sorted by deadline.
2. **Inbox** — filter to open, highest amount; open `PP-D-8490741` (no evidence, due in 3 days).
3. **AI analysis** — high risk, five missing items, low win likelihood, draft asks for proof.
4. **Upload evidence** — add an order confirmation PDF; refresh analysis; show gaps drop, score and
   confidence rise, citations appear.
5. **Edit draft** — personalize the greeting; save; show saved timestamp.
6. **Submit** — confirm, show `submittedAt`, read-only draft, 409 on repeat submit.
7. **Closed case** — open a won dispute to show `winLikelihood: null` and read-only state.
8. **Dashboard again** — pending action count reflects the work completed.
9. **Evidence vault** — filter by case or type, show readiness stats, open a file preview, jump
   back to its dispute.
10. **Reports** — switch 30/90/365-day windows, walk the reason table and evidence gaps, export CSV.
11. **Settings** — edit the profile, toggle a notification, show PayPal/AI connection status.
12. **Reset** — `python scripts/reset_demo.py --yes` before the live run for a pristine workspace.
