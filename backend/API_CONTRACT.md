# API Contract — Chargeback Copilot

Base URL: `http://localhost:8000` (all routes below are prefixed with `/api` unless noted).

Interactive reference: `GET /docs` (Swagger UI) and `GET /openapi.json`.

---

## Conventions

| Topic | Rule |
| --- | --- |
| Content type | `application/json` except evidence upload (`multipart/form-data`) |
| Field naming | camelCase in every response and request body (`pageSize`, `winLikelihood`, …) |
| Timestamps | integer epoch **milliseconds** (safe for `new Date(value)` in the frontend) |
| IDs | Disputes `PP-D-#######`, orders `AC-#####`, transactions 17-char PayPal IDs; evidence/action IDs are strings |
| Money | Number in major units (e.g. `249.0`), `currency: "USD"` |
| Pagination | `page` (1-based) and `pageSize` (1–100); list responses return `total`, `totalPages`, `page`, `pageSize` |
| Auth | `Authorization: Bearer <token>`; optional unless `REQUIRE_AUTH=true` |
| Request ID | Every response carries `X-Request-ID`; send your own to correlate client and server logs |
| Body size | Requests above `MAX_REQUEST_MB` (default 12 MB) are rejected with `413` before parsing |

### Error shape

```json
{ "detail": "Human-readable message." }
```

| Status | When |
| --- | --- |
| `400` | Invalid upload (type, size, empty file) or unknown evidence IDs on submit |
| `401` | Invalid/expired token, or missing token while `REQUIRE_AUTH=true` |
| `404` | Dispute, transaction, or evidence not found (also tenant mismatch) |
| `409` | Case closed, response already submitted, no PayPal connection + refresh, or duplicate signup email |
| `413` | Request body exceeds `MAX_REQUEST_MB` |
| `422` | Request validation error (Pydantic) |
| `502` | PayPal could not be reached or rejected a stored authorization |
| `503` | PayPal sandbox credentials are not configured or were rejected |

---

## System

### `GET /` (no prefix)

```json
{ "service": "Chargeback Copilot API", "version": "0.1.0", "docs": "/docs", "health": "/api/health" }
```

### `GET /api/health`

```json
{
  "status": "ok",
  "service": "Chargeback Copilot API",
  "environment": "development",
  "database": "ok",
  "aiMode": "auto",
  "llmConfigured": false,
  "requestId": "08ad5854366b4b91b922056c6fc61fee"
}
```

`database` is `ok` or `error`. When the probe fails the endpoint returns `503` with
`status: "degraded"` and `database: "error"` so an uptime monitor sees the outage.

---

## Auth

### `POST /api/auth/signup` → `201`

```json
{ "name": "Demo Merchant", "email": "owner@shop.com", "password": "Secret123!", "businessName": "Acme Commerce" }
```

`businessName` is optional (defaults to `"Acme Commerce"`). Duplicate email → `409`.

### `POST /api/auth/login`

```json
{ "email": "demo@acmecommerce.com", "password": "Demo1234!" }
```

### `GET /api/auth/me`

Returns the current user (demo merchant when auth is disabled and no token is sent).

**Auth response shape (signup/login):**

```json
{
  "accessToken": "<jwt>",
  "tokenType": "bearer",
  "user": {
    "id": 1,
    "email": "demo@acmecommerce.com",
    "name": "Demo Merchant",
    "businessName": "Acme Commerce"
  }
}
```

Tokens are HS256 JWTs with a 24-hour default expiry. Passwords use PBKDF2-SHA256 (260k iterations).

---

## Disputes

### `GET /api/disputes`

Query parameters:

| Param | Values | Default |
| --- | --- | --- |
| `status` | `all`, `open`, `won`, `lost` | `all` |
| `reason` | exact reason string (e.g. `Item not received`) | — |
| `priority` | `high`, `medium`, `low` | — |
| `q` | free text over ID, buyer name/email, reason, order ID, transaction ID | — |
| `days` | only disputes opened within the last N days | — |
| `sort` | `newest`, `oldest`, `amount`, `amount-desc`, `amount-asc`, `deadline`, `customer` | `newest` |
| `page` | ≥ 1 | `1` |
| `pageSize` | 1–100 | `20` |

Response (truncated):

```json
{
  "items": [
    {
      "id": "PP-D-8490741",
      "buyer": { "name": "Liam Foster", "email": "liam.foster@example.com" },
      "reason": "Item not as described",
      "amount": 1899.0,
      "currency": "USD",
      "status": "open",
      "priority": "high",
      "openedAt": 1794205138984,
      "dueAt": 1794550738984,
      "resolvedAt": null,
      "evidence": {
        "uploaded": 0,
        "required": 5,
        "missing": [
          "Order confirmation",
          "Customer communication",
          "Proof of delivery",
          "Refund & cancellation policy",
          "Transaction verification"
        ],
        "completed": []
      },
      "transactionId": "6BV20485MR9912470",
      "orderId": "AC-10352"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 26,
  "totalPages": 2,
  "counts": { "all": 26, "open": 9, "won": 11, "lost": 6 }
}
```

Notes:
- `counts` reflects all filters **except** `status`, so status tabs keep stable counts.
- `evidence.uploaded` counts all stored files; `completed` lists required types that have evidence;
  `missing` lists required types that do not.
- Closed cases (`won`/`lost`) have `dueAt: null`.

### `GET /api/disputes/{disputeId}`

Extends the summary with:

| Field | Description |
| --- | --- |
| `customer` | `{ id, phone, memberSince, lifetimeOrders, emailVerified, address }` |
| `order` | `{ id, placedAt, transactionId, paymentMethod, items[], subtotal, shipping, tax, taxIncluded, total, shippingAddress }` |
| `tracking` | `{ available, carrier, number, statusLabel, tone, shippedAt, deliveredAt, estimatedAt, events[], signedBy, note }` |
| `refund` | `{ key, label, tone, amount, method, date, requestedAt, note }` |
| `activity` | `[{ label, date, dot }]` — newest first |
| `evidenceFiles` | see [Evidence](#evidence) |
| `submittedAt` | epoch ms or `null` |

The derived context is deterministic and identical for the same dispute, matching the frontend's
`utils/disputeDetails.js` generators.

---

## AI analysis

### `GET /api/disputes/{disputeId}/ai-analysis`

Optional query: `refresh=true` (recommended after evidence changes; otherwise cached results are
reused while the evidence fingerprint is unchanged).

### `POST /api/disputes/{disputeId}/ai-analysis/refresh`

Forces recomputation with no query parameters.

Response (`200`):

```json
{
  "classification": {
    "category": "Consumer dispute",
    "type": "Merchandise not received",
    "confidence": 91
  },
  "risk": {
    "level": "high",
    "summary": "2 required evidence items still missing. The response is due tomorrow."
  },
  "winLikelihood": 65,
  "evidenceGaps": [
    {
      "type": "Customer communication",
      "severity": "supporting",
      "note": "Shows the buyer was informed and had a chance to resolve the issue."
    }
  ],
  "recommendations": [
    {
      "title": "Close 2 evidence gaps",
      "detail": "Upload customer communication, transaction verification.",
      "priority": "do-first"
    },
    {
      "title": "Lead with delivery proof",
      "detail": "Point to the carrier scan and signature, then restate the shipping address on file.",
      "priority": "recommended"
    },
    {
      "title": "Respond before the deadline",
      "detail": "Submit the response by Nov 11, 2026.",
      "priority": "deadline"
    }
  ],
  "nextStep": "Upload customer communication before Nov 11, 2026 to close the evidence gap.",
  "recommendation": {
    "tone": "amber",
    "title": "Evidence gap detected",
    "body": "2 required evidence items still missing. Add customer communication or transaction verification before submitting your response."
  },
  "responseDraft": "Hi Jordan,\n\nThank you for contacting us about order AC-10482...",
  "citations": [
    {
      "evidenceType": "Order confirmation",
      "fileName": "order-confirmation-AC-10482.pdf",
      "excerpt": null
    }
  ],
  "factors": [
    { "tone": "negative", "text": "2 of 4 required evidence items collected — 2 still missing" },
    { "tone": "positive", "text": "Carrier tracking shows delivered on Oct 31, 2026" }
  ],
  "signals": [],
  "model": "heuristic-v1",
  "generatedAt": 1794291539150
}
```

Field notes:

- `winLikelihood` is `null` for closed cases (won/lost).
- `risk.level`: `high` | `medium` | `low`.
- `evidenceGaps[].severity`: `critical` | `supporting`.
- `recommendations[].priority`: `do-first` | `recommended` | `deadline`.
- `recommendation.tone`: `amber` | `blue` | `emerald` | `rose` (drives the panel style).
- `signals[].code`: `extraction_failed`, `low_relevance`, `delivery_evidence_weak`,
  `order_mismatch`, `transaction_mismatch`.
- A saved draft (below) overrides `responseDraft` in this response.
- `model` is `heuristic-v1` or the configured LLM model name.

---

## Response workflow

### `POST /api/disputes/{disputeId}/response-draft`

```json
{ "draft": "Hi Jordan, ..." }
```

```json
{ "disputeId": "PP-D-8492013", "draft": "Hi Jordan, ...", "savedAt": 1794291700123 }
```

- `400` if the draft is empty or > 20,000 chars.
- `409` if the case is closed or the response was already submitted.

### `POST /api/disputes/{disputeId}/submit`

```json
{ "body": "Hi Jordan, ...", "evidenceIds": ["ev-123"] }
```

```json
{
  "disputeId": "PP-D-8492013",
  "status": "submitted",
  "submittedAt": 1794291800456,
  "paypalReference": "SUB-1X9F2C3A"
}
```

- Evidence IDs must belong to the dispute (`400` otherwise).
- One submission per dispute; repeat or closed-case attempts return `409`. The rule is enforced by
  a unique index on `response_submissions.dispute_id`, so two concurrent submits produce one `200`
  and one `409` rather than a duplicate record.
- `paypalReference` is a local generated reference. Merchant PayPal accounts connect through the
  OAuth flow below; automated claim submission to PayPal remains a separate integration.

---

## Evidence

### `GET /api/disputes/{disputeId}/evidence`

```json
[
  {
    "id": "3f8c...",
    "name": "order-confirmation-AC-10482.pdf",
    "size": 48213,
    "mime": "application/pdf",
    "previewUrl": null,
    "evidenceType": "Order confirmation",
    "status": "ready",
    "uploadedAt": 1794291500000,
    "source": "upload",
    "error": null,
    "extractionStatus": "extracted",
    "qualityScore": 82,
    "extractedFields": { "orderIds": ["AC-10482"], "transactionIds": [] }
  }
]
```

`status`: `ready` | `uploading` | `error` (server uploads are always `ready` or rejected).
`extractionStatus`: `pending` | `extracted` | `failed` | `not_supported`.
`previewUrl` is `null` for stored uploads — fetch the file through the authenticated
`GET /api/evidence/{id}/file` endpoint instead (the browser cannot attach a Bearer token to an
`<img>`/`<iframe>`). Seeded demo records may carry a public frontend asset URL.

### `POST /api/disputes/{disputeId}/evidence` → `201`

`multipart/form-data`:

| Field | Type | Notes |
| --- | --- | --- |
| `file` | file | PDF/JPEG/PNG, ≤ 10 MB |
| `evidenceType` | text | One of the five checklist labels, or `Additional supporting file` |

Validation is by magic bytes. Rejections return `400` with a specific message:

- `"Unsupported file type. Use PDF, JPG, or PNG."`
- `"File exceeds the 10 MB limit."`
- `"The uploaded file is empty."`
- `"Unknown evidence type '<value>'. Choose one of the checklist items."`

On success the API records an activity event, updates the dispute timestamp, and the next AI
analysis automatically reflects the new completeness.

### `DELETE /api/disputes/{disputeId}/evidence/{evidenceId}` → `204`

Removes the record and the stored file. Seeded demo records cannot be deleted through this route
(they are not user uploads — `404` if the ID is unknown to the dispute).

### `GET /api/evidence/{evidenceId}/file`

Streams the stored file with its MIME type. Requires authentication (or the demo merchant when
`REQUIRE_AUTH=false`) and is scoped to the merchant that owns the dispute: another merchant's
evidence id returns `404` with `"Evidence file not found."`. Seeded demo evidence is metadata-only
and returns `404` with `"This demo evidence record has no stored file."`.

---

## Evidence vault

### `GET /api/evidence?q=&type=&status=&page=&pageSize=`

Workspace-wide catalogue of evidence joined to its dispute. Sorted newest first.

| Parameter | Values | Notes |
| --- | --- | --- |
| `q` | free text, ≤200 chars | Matches file name, case ID, buyer name/email, order ID, transaction ID |
| `type` | evidence type key | e.g. `Order confirmation`; omit for all |
| `status` | `all` (default), `ready`, `attention` | `attention` = extraction failed/needs review |
| `page`, `pageSize` | 1-based, 1–100 (default 20) | Pagination |

```json
{
  "items": [
    {
      "id": "seed-PP-D-8488821-2",
      "name": "order-confirmation-AC-10098.pdf",
      "size": 192512,
      "mime": "application/pdf",
      "evidenceType": "Order confirmation",
      "status": "ready",
      "extractionStatus": "demo",
      "qualityScore": 60,
      "uploadedAt": 1794053916680,
      "source": "demo",
      "previewUrl": null,
      "hasFile": false,
      "dispute": {
        "id": "PP-D-8488821",
        "reason": "Unauthorized transaction",
        "status": "open",
        "buyerName": "Grace Thompson",
        "amount": 2450.0,
        "currency": "USD",
        "orderId": "AC-10098"
      }
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 64,
  "totalPages": 4,
  "stats": {
    "files": 64,
    "bytes": 31961088,
    "ready": 64,
    "needsAttention": 0,
    "disputes": 25,
    "types": 5
  },
  "types": [
    { "evidenceType": "Order confirmation", "count": 16 },
    { "evidenceType": "Transaction verification", "count": 14 }
  ]
}
```

`stats` and `types` describe the whole tenant workspace, not the filtered page. `hasFile` is
`true` only for uploaded files (downloadable at `GET /api/evidence/{evidenceId}/file`); demo rows
are metadata-only and may carry a `previewUrl` served by the frontend.

---

## Reports

### `GET /api/reports/summary?days=`

`days` limits the window to disputes opened within the last N days (1–3650); omit for all time.

```json
{
  "rangeDays": 365,
  "generatedAt": 1794323456789,
  "totals": {
    "total": 26, "open": 9, "won": 11, "lost": 6, "resolved": 17,
    "winRate": 65, "openValue": 9051.0, "wonValue": 2900.12,
    "lostValue": 2306.0, "averageDisputeValue": 548.35
  },
  "resolution": {
    "averageDays": 8.2,
    "resolvedCount": 17,
    "submittedCount": 0,
    "averageResponseDays": null
  },
  "reasons": [
    {
      "reason": "Item not received", "total": 7, "open": 1, "won": 5, "lost": 1,
      "winRate": 83, "amount": 3101.9, "openAmount": 249.0,
      "lostAmount": 455.0, "averageResolutionDays": 7.5
    }
  ],
  "monthly": [
    {
      "month": "2026-11", "label": "Nov", "total": 9,
      "open": 9, "won": 0, "lost": 0,
      "amount": 9051.0, "wonValue": 0.0, "lostValue": 0.0
    }
  ],
  "evidence": {
    "documents": 64, "required": 98, "completed": 64, "gaps": 34,
    "coveragePercent": 65, "needsAttention": 0, "disputesWithGaps": 15
  },
  "topGaps": [
    { "evidenceType": "Customer communication", "count": 11 },
    { "evidenceType": "Refund & cancellation policy", "count": 8 }
  ],
  "deadlines": {
    "overdue": 1, "dueSoon": 8, "dueSoonValue": 8631.0, "openValue": 9051.0
  }
}
```

`winRate` is an integer percentage of resolved cases; `null` days/counts mean "not enough data".
`deadlines.dueSoon` counts open cases due within 7 days. The frontend renders 30/90/365-day windows
and exports the current view to CSV client-side.

---

## Settings

### `GET /api/settings`

```json
{
  "user": {
    "id": 1,
    "email": "demo@acmecommerce.com",
    "name": "Demo Merchant",
    "businessName": "Acme Commerce",
    "createdAt": 1762732800000
  },
  "notifications": {
    "deadlineReminders": true,
    "weeklyDigest": true,
    "caseUpdates": true
  },
  "workspace": {
    "disputes": 26, "open": 9, "evidenceFiles": 64, "storageBytes": 31457280
  },
  "integrations": {
    "paypal": {
      "configured": true,
      "connected": false,
      "status": "app_credentials",
      "environment": "sandbox",
      "accountEmail": null
    },
    "ai": { "mode": "auto", "llmConfigured": true, "model": "openai/gpt-oss-120b" }
  },
  "app": { "name": "Aniket app", "environment": "development", "requireAuth": true }
}
```

`integrations.paypal.status`: `connected` (merchant token stored), `app_credentials` (credentials
configured, no OAuth connection), or `not_configured`. Secrets are never returned.

### `PATCH /api/settings/profile`

```json
{ "name": "Demo Merchant", "businessName": "Acme Commerce" }
```

Returns `{ "user": { ...SettingsUser } }`. Blank or over-long values → `400`.

### `PATCH /api/settings/notifications`

```json
{ "deadlineReminders": true, "weeklyDigest": false, "caseUpdates": true }
```

Returns the saved booleans. Persisted on the signed-in user row.

### `POST /api/settings/password`

```json
{ "currentPassword": "Demo1234!", "newPassword": "NewSecret123!" }
```

Returns `{ "message": "Password updated. Use it the next time you sign in." }`. A wrong current
password or a new password shorter than 8 characters → `400`. Existing sessions stay valid.

---

## Dashboard

### `GET /api/dashboard/stats?days=`

`days` optionally limits to disputes opened within the last N days.

```json
{
  "total": 26,
  "open": 9,
  "won": 11,
  "lost": 6,
  "winRate": 65,
  "openValue": 9051.0,
  "wonValue": 2900.12,
  "lostValue": 2306.0,
  "reasons": 6,
  "pendingActions": 9,
  "overdueActions": 1
}
```

### `GET /api/dashboard/pending-actions?limit=20`

One action per open dispute, sorted by nearest due date:

- missing evidence → `type: "evidence"`
- possible duplicate charge → `type: "decision"`
- otherwise → `type: "response"`

```json
[
  {
    "id": "PA-8492013-evidence",
    "disputeId": "PP-D-8492013",
    "type": "evidence",
    "title": "Upload missing evidence for PP-D-8492013",
    "dispute": { "...": "DisputeSummary" },
    "due": { "days": 1, "label": "Due tomorrow", "tone": "warning" }
  }
]
```

`due.tone`: `danger` | `warning` | `neutral`.

---

## Transactions

### `GET /api/transactions?q=&page=&pageSize=`

Search spans transaction ID, order ID, buyer name, and buyer email.

```json
{
  "items": [
    {
      "id": "8AB12935KJ7731042",
      "orderId": "AC-10482",
      "disputeId": "PP-D-8492013",
      "buyerName": "Jordan Ellis",
      "buyerEmail": "jordan.ellis@example.com",
      "amount": 249.0,
      "currency": "USD",
      "status": "completed",
      "paymentMethod": "PayPal Balance",
      "items": [{ "name": "Aero Wireless Headphones", "sku": "AC-HP-201", "quantity": 1, "total": 249.0 }],
      "shippingAddress": { "name": "Jordan Ellis", "line1": "482 Willow Lane", "line2": "Portland, OR 97205", "country": "US" },
      "createdAt": 1793000000000,
      "tracking": { "...": "TrackingInfo or null" }
    }
  ],
  "total": 26
}
```

### `GET /api/transactions/{transactionId}`

Returns a single transaction in the same shape.

---

## PayPal account

Sandbox OAuth 2.0 (authorization code flow) for the merchant's PayPal account. Secrets and tokens
are never present in any response, redirect, or log. Timestamps are epoch ms.

### `GET /api/paypal/connection`

```json
{
  "configured": true,
  "environment": "sandbox",
  "sandbox": true,
  "connected": true,
  "status": "connected",
  "accountEmail": "merchant@sandbox.example",
  "accountName": "Sandbox Merchant",
  "payerId": "PAYER123",
  "scopes": ["openid", "email"],
  "connectedAt": 1794292000000,
  "tokenExpiresAt": 1794295600000,
  "refreshTokenExpiresAt": 1794378400000,
  "lastVerifiedAt": 1794292000000,
  "lastError": null,
  "redirectUri": "http://localhost:8000/api/paypal/oauth/callback",
  "requestedScopes": ["openid", "email"]
}
```

- `configured` is false until `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` are set; the other fields
  still report `connected: false`.
- `status`: `connected` | `error` | `disconnected`. There is no token field by design.

### `POST /api/paypal/connect` → `503` when unconfigured

```json
{ "authorizationUrl": "https://www.sandbox.paypal.com/connect?flowEntry=static&…", "expiresAt": 1794292600000 }
```

Open `authorizationUrl` (full-page navigation). The single-use state behind it expires in 10
minutes.

### `GET /api/paypal/oauth/callback` (browser redirect, no auth)

PayPal redirects here. The API never returns JSON; it redirects the browser to `PAYPAL_RETURN_URL`
(default `http://localhost:5173/paypal`) with `?paypal=connected` or
`?paypal=error&reason=<code>`.

Safe reason codes: `access_denied`, `invalid_state`, `missing_code`,
`authorization_rejected`, `configuration_error`, `token_exchange_failed`, `network_error`.
Raw PayPal error text is not forwarded.

### `POST /api/paypal/connection/refresh`

Exchanges the stored refresh token for a new access token and returns the
`GET /api/paypal/connection` shape. Errors:

- `409` no connection, or PayPal rejected the stored authorization (`reconnect_required`,
  `authorization_rejected`).
- `502` PayPal unreachable.
- `503` configured credentials rejected.

### `POST /api/paypal/connection/disconnect`

Deletes the stored tokens and pending states, returns the `GET /api/paypal/connection` shape with
`connected: false`.

### `POST /api/paypal/sync`

Pulls real sandbox data from PayPal and upserts it into the existing `disputes` and `transactions`
tables, so all frontend contracts stay unchanged. Uses the connected merchant's stored token when
its scopes include `disputes`; otherwise a client-credentials app token.

Calls made (read-only): `GET /v1/customer/disputes` (+ per-dispute detail), `GET
/v2/payments/captures/{id}`, `GET /v2/checkout/orders/{id}` (only when a dispute carries a
checkout order id), `GET /v2/payments/refunds/{id}` (when `refund_details` is present).

```json
{
  "ranAt": 1794304834647,
  "tokenSource": "application",
  "fetched": 2,
  "created": 2,
  "updated": 0,
  "skipped": 0,
  "transactionsCreated": 0,
  "transactionsUpdated": 2,
  "ordersEnriched": 0,
  "refundsObserved": 0
}
```

- PayPal reasons/states are mapped to the workspace's six canonical reasons and `open`/`won`/`lost`
  statuses; unknown reasons map to "Item not as described" and ambiguous resolved states stay
  `open` for manual review.
- Disputes without a transaction reference are skipped. Re-running the sync updates in place;
  existing disputes' local drafts/submissions are never overwritten.
- Errors: `409` app not permitted for an API, `502` PayPal unreachable/rejected, `503`
  unconfigured credentials.

### `GET /api/paypal/permissions`

Probes each PayPal API with the sync token and reports per-API access. `authorized` means the
token was accepted (a 404 for the sampled resource still counts — permission is fine).

```json
{
  "tokenSource": "application",
  "checks": [
    { "api": "Disputes", "endpoint": "GET /v1/customer/disputes", "status": "authorized", "detail": "Token accepted and dispute list returned." },
    { "api": "Payments", "endpoint": "GET /v2/payments/captures/{id}", "status": "authorized", "detail": "Verified with capture 8AB12935KJ7731042." },
    { "api": "Refunds", "endpoint": "GET /v2/payments/refunds/{id}", "status": "unverified", "detail": "No refunded dispute available to sample a refund id from." },
    { "api": "Orders", "endpoint": "GET /v2/checkout/orders/{id}", "status": "unverified", "detail": "Set PAYPAL_SAMPLE_ORDER_ID to verify Orders access." }
  ]
}
```

`status`: `authorized` | `unauthorized` | `forbidden` | `error` | `unverified`. Payments samples a
capture from the newest sandbox dispute; Refunds samples a refund from a dispute's
`refund_details` when present; Orders needs `PAYPAL_SAMPLE_ORDER_ID`.

---

## Frontend switch-over checklist

1. Set an API base URL (`VITE_API_BASE_URL` or a small `api.js` axios instance) pointing at
   `http://localhost:8000/api`.
2. `src/data/disputes.js` → `GET /api/disputes` (`pageSize=100` for parity with the current inbox).
3. `src/utils/aiAnalysis.js` / `src/services/aiAnalysis.js` → `GET /api/disputes/:id/ai-analysis`
   and `POST /api/disputes/:id/response-draft`.
4. Evidence upload form → `FormData` with `file` + `evidenceType` to
   `POST /api/disputes/:id/evidence`; refresh analysis afterwards.
5. Dashboard stats/pending actions → `/api/dashboard/stats` and `/api/dashboard/pending-actions`.
6. Auth pages → `/api/auth/login` and `/api/auth/signup`; store `accessToken` and send it as a
   Bearer header.
7. Remove frontend-only mock delays; keep loading states bound to real request lifecycles.
