# TaxDrop One — Review-before-delivery flow

The customer submits their property + CAD evidence, we **review the report before
it's delivered**, then release it. This doc covers the moving parts, the one-time
Vercel Blob setup, the env vars, and the Bubble webhook contracts.

Status copy the customer sees: *"typically within 24–48 hours, Monday–Friday."*

---

## The flow end-to-end

```
Customer                     Vercel (video-studio)                Reviewer / Bubble
────────                     ─────────────────────                ─────────────────
/r/<token>  ──lands──▶  v2/app.jsx (review mode)
  address locked, uploads CAD, enters contact
        │
        ├─ files ─────▶  POST /api/blob-upload  (mints scoped client token)
        │                       │
        │                files stream straight to Vercel Blob
        │
        └─ submit ────▶  POST /api/intake
                              • saves intake + browser-computed DRAFT (Postgres)
                              • status → in_review
                              • webhook ─────────────▶  Bubble: "submitted"
        ◀── holding screen ("we're preparing your report")

                         Reviewer opens  one.taxdrop.com/review  (sup-gated)
                              • GET /api/review-approve        → the queue
                              • GET /api/report?jti=…          → draft + evidence
                              • edits requested value / rationale
                              • POST /api/review-approve       → status → approved
                                                        │
                                                        └─ webhook ─▶ Bubble: "approved"
                                                                       → sends "report ready" email/SMS

Customer re-opens /r/<token>  ──▶ GET /api/report → status:approved + report
        ◀── the finished report renders (same UI as instant mode)
```

**Why the draft is computed in the browser and only stored:** it reuses the exact
auditable calculation already shipping today (`computeDraft` in `v2/app.jsx`) —
extract CAD → engine lookup → `decide()`. The result is persisted, never shown,
until a human approves. A tampered submission only ever hurts that customer's own
report and never ships without sign-off.

---

## New / changed files

| File | Role |
|---|---|
| `api/_db.ts` | Shared Postgres pool (extracted from `_entitlements.ts`). |
| `api/_reviews.ts` | `one_reviews` table + status/draft/overrides CRUD + queue list. |
| `api/_storage.ts` | Blob key namespacing + allowed content types. |
| `api/blob-upload.ts` | Mints a short-lived, path-scoped Blob **client-upload** token (authorizes via `td_link` cookie). |
| `api/intake.ts` | Customer "Submit for review": stores intake + draft, pings Bubble. |
| `api/report.ts` | Serves `{status}` always; the deliverable **only when `approved`** (overrides merged). Sup can pass `?jti=` for the reviewer view. |
| `api/review-approve.ts` | Sup-gated: `GET` = queue, `POST {jti, overrides}` = approve + release + ping Bubble. |
| `public/review/index.html` | The reviewer dashboard (sup-gated, at `/review`). |
| `public/v2/app.jsx` + `index.html` | Intake mode / holding screen / delivered-from-stored-draft mode; loads the Blob client helper. |
| `middleware.ts` | Routes + sup-gates `/review`. |

The reviewer dashboard is **self-contained** — the flow is fully operational
without Bubble. The Bubble webhooks are for customer notifications (and to mirror
the queue into Bubble if you want it there too).

---

## One-time setup

### 1. Create the Vercel Blob store
Vercel dashboard → project **video-studio** → **Storage** → **Create** → Blob →
connect to the project. This auto-injects **`BLOB_READ_WRITE_TOKEN`** into the
project's env (Production + Preview). Pull it locally with `vercel env pull`.

### 2. Environment variables

| Var | Where it comes from | Required |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Auto-injected on Blob store connect | ✅ |
| `TOKEN_SECRET` | Already set (customer link HMAC) | ✅ (exists) |
| `SUP_PASSWORD` | Already set (reviewer/agent login) | ✅ (exists) |
| `DATABASE_URL` | Already set (engine Postgres) | ✅ (exists) |
| `BUBBLE_INTAKE_WEBHOOK_URL` | Bubble backend workflow URL (submitted) | optional |
| `BUBBLE_APPROVE_WEBHOOK_URL` | Bubble backend workflow URL (approved) | optional |
| `BUBBLE_WEBHOOK_SECRET` | Shared secret; sent as `X-TaxDrop-Secret` | optional |

The `one_reviews` table is created automatically on first use (same pattern as
`one_entitlements`). No migration to run.

---

## Bubble webhook contracts (Tom)

Both are `POST application/json`, best-effort (a failed webhook never blocks the
customer or the reviewer). If `BUBBLE_WEBHOOK_SECRET` is set, verify the
`X-TaxDrop-Secret` header.

### A. Submitted → `BUBBLE_INTAKE_WEBHOOK_URL`
Fires when a customer submits. Use it to create/update the queue row in Bubble.
```json
{
  "event": "one.review.submitted",
  "jti": "cs_test_a1b2c3",
  "address": "5051 Forest Bend Rd, Dallas, TX 75244",
  "taxYear": 2026,
  "state": "TX",
  "contact": { "name": "Jane Doe", "email": "jane@x.com", "phone": "512-555-0100" },
  "evidenceCount": 2,
  "hasDraft": true
}
```

### B. Approved → `BUBBLE_APPROVE_WEBHOOK_URL`
Fires when a reviewer releases the report. Use it to send the "your report is
ready" email/SMS — **just drop `reportUrl` straight into the email**; it's a
ready-to-send link, no lookup or token handling needed on Bubble's side.
```json
{
  "event": "one.review.approved",
  "jti": "cs_test_a1b2c3",
  "address": "5051 Forest Bend Rd, Dallas, TX 75244",
  "reportUrl": "https://one.taxdrop.com/r/<token>",
  "contact": { "name": "Jane Doe", "email": "jane@x.com", "phone": "512-555-0100" },
  "approvedAt": "2026-07-02T15:04:05.000Z"
}
```
`reportUrl` is minted server-side from the purchase's `jti` (same property lock,
fresh 90-day expiry) so Bubble never has to store or reconstruct the link. On
approval the page flips from the holding screen to the finished report.

---

## Notes / follow-ups

- **Token minting is unchanged.** Bubble/Stripe still mints the `/r/<token>` link
  exactly as in `TOKEN-GENERATION-FOR-BUBBLE.md`. The review flow only changes
  what the page *does* with the link.
- **Purchase-confirmation email copy:** `stripe-webhook.ts` now sets the
  expectation up front — upload evidence, a tax expert reviews it, finished report
  emailed within 24–48 hours, Monday–Friday.
- **Reviewer overrides:** the dashboard can override the recommended requested
  value (`target`) and the rationale. When `target` changes, `report.ts`
  recomputes `reduction`/`pct` and scales `taxSaved` so the delivered report
  stays internally consistent.
- **Draft failures:** if the browser couldn't compute a draft (bad packet, engine
  miss), the row still lands in the queue flagged "draft failed" so a reviewer can
  build it by hand — the customer isn't dead-ended.
