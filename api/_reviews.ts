// Review-queue store for the TaxDrop One "review before delivery" flow.
// Underscore-prefixed → not a Vercel endpoint; imported by intake.ts,
// report.ts, review-approve.ts, and the approved-gate in cad-proxy.ts.
//
// One row per purchase (keyed by the token's jti). The customer submits their
// address + contact + evidence; the server auto-generates a draft; a reviewer
// approves it; only then does the customer's link serve the deliverable.
//
// Status lifecycle:
//   submitted  → intake received, files stored, draft being generated
//   in_review  → auto-draft ready, waiting on a human reviewer
//   approved   → reviewer released it; the /r/<token> link now serves the report
//   (a failed auto-draft stays `submitted` with draft_error set, so a reviewer
//    can still pick it up and build the report by hand.)
//
// Small and frequently-edited (status, draft JSON, reviewer overrides) → this
// all lives in Postgres. Only the raw evidence files go to Blob (_storage.ts).

import { getPool } from './_db.js';

export type ReviewStatus = 'submitted' | 'in_review' | 'approved' | 'needs_info';

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS one_reviews (
           jti            TEXT PRIMARY KEY,
           status         TEXT NOT NULL DEFAULT 'submitted',
           address        TEXT,
           tax_year       INT,
           state          TEXT,
           contact_name   TEXT,
           contact_email  TEXT,
           contact_phone  TEXT,
           evidence       JSONB,   -- [{url, filename, size}] stored in Blob
           draft          JSONB,   -- auto-generated engine result + cad snapshot
           overrides      JSONB,   -- reviewer edits applied at render time
           draft_error    TEXT,    -- set if the auto-draft failed; reviewer does it by hand
           submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
           reviewed_at    TIMESTAMPTZ,
           approved_at    TIMESTAMPTZ,
           updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      )
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null;
        throw e;
      });
  }
  return schemaReady;
}

export interface ReviewRow {
  jti: string;
  status: ReviewStatus;
  address: string | null;
  taxYear: number | null;
  state: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  evidence: Array<{ url: string; filename: string; size: number }> | null;
  draft: unknown;
  overrides: unknown;
  draftError: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  approvedAt: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(r: any): ReviewRow {
  return {
    jti: r.jti,
    status: r.status,
    address: r.address,
    taxYear: r.tax_year,
    state: r.state,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    evidence: r.evidence,
    draft: r.draft,
    overrides: r.overrides,
    draftError: r.draft_error,
    submittedAt: r.submitted_at,
    reviewedAt: r.reviewed_at,
    approvedAt: r.approved_at,
  };
}

export interface IntakeInput {
  address: string;
  taxYear?: number;
  state?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  evidence: Array<{ url: string; filename: string; size: number }>;
}

/**
 * Record a customer submission (idempotent on jti). Re-submitting the same jti
 * (e.g. a double-tap or a resume) overwrites the intake fields but never
 * downgrades an already-approved review back to `submitted`.
 */
export async function saveIntake(jti: string, input: IntakeInput): Promise<ReviewRow> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `INSERT INTO one_reviews
       (jti, status, address, tax_year, state, contact_name, contact_email, contact_phone, evidence, submitted_at, updated_at)
     VALUES ($1, 'submitted', $2, $3, $4, $5, $6, $7, $8, now(), now())
     ON CONFLICT (jti) DO UPDATE SET
       address       = EXCLUDED.address,
       tax_year      = EXCLUDED.tax_year,
       state         = EXCLUDED.state,
       contact_name  = EXCLUDED.contact_name,
       contact_email = EXCLUDED.contact_email,
       contact_phone = EXCLUDED.contact_phone,
       evidence      = EXCLUDED.evidence,
       -- never re-open a finished review; keep the current status otherwise
       status        = CASE WHEN one_reviews.status = 'approved' THEN 'approved' ELSE 'submitted' END,
       updated_at    = now()
     RETURNING *`,
    [
      jti,
      input.address || null,
      input.taxYear ?? null,
      input.state ?? null,
      input.contactName ?? null,
      input.contactEmail ?? null,
      input.contactPhone ?? null,
      JSON.stringify(input.evidence || []),
    ]
  );
  return mapRow(rows[0]);
}

/** Attach the auto-generated draft and advance the row to `in_review`. */
export async function saveDraft(jti: string, draft: unknown): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `UPDATE one_reviews
       SET draft = $2, draft_error = NULL,
           status = CASE WHEN status = 'approved' THEN 'approved' ELSE 'in_review' END,
           reviewed_at = COALESCE(reviewed_at, now()), updated_at = now()
     WHERE jti = $1`,
    [jti, JSON.stringify(draft ?? null)]
  );
}

/** Record that the auto-draft failed; the row stays `submitted` for a human. */
export async function saveDraftError(jti: string, message: string): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `UPDATE one_reviews SET draft_error = $2, updated_at = now() WHERE jti = $1`,
    [jti, String(message).slice(0, 500)]
  );
}

/** Save reviewer edits (overrides) WITHOUT releasing — lets the reviewer
 *  preview the edited pack before approving. Never changes status. */
export async function updateOverrides(jti: string, overrides: unknown): Promise<ReviewRow | null> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `UPDATE one_reviews SET overrides = $2, updated_at = now() WHERE jti = $1 RETURNING *`,
    [jti, overrides === undefined ? null : JSON.stringify(overrides)]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * Send a submission back to the customer for more/better evidence. Sets status
 * `needs_info`, saves the reviewer edits + the customer-facing `message` (stored
 * in overrides.infoRequest, which applyOverrides never leaks to the report).
 * Re-submitting flips it back to `submitted` (saveIntake), so it re-enters the
 * queue.
 */
export async function requestInfo(jti: string, overrides: Record<string, unknown>, message: string): Promise<ReviewRow | null> {
  await ensureSchema();
  const merged = { ...(overrides || {}), infoRequest: String(message || '').slice(0, 1000) };
  const { rows } = await getPool().query(
    `UPDATE one_reviews SET status = 'needs_info', overrides = $2, updated_at = now()
     WHERE jti = $1 RETURNING *`,
    [jti, JSON.stringify(merged)]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Reviewer approval: apply any overrides and release the report. */
export async function approveReview(jti: string, overrides?: unknown): Promise<ReviewRow | null> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `UPDATE one_reviews
       SET status = 'approved',
           overrides = COALESCE($2, overrides),
           approved_at = COALESCE(approved_at, now()), updated_at = now()
     WHERE jti = $1
     RETURNING *`,
    [jti, overrides === undefined ? null : JSON.stringify(overrides)]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * List reviews for the reviewer queue. `pendingOnly` (default) returns just the
 * rows still awaiting a human — `submitted` (draft pending/failed) and
 * `in_review` (draft ready) — newest first. Drafts are omitted from the list to
 * keep it light; the reviewer fetches a single row's draft on open.
 */
export type ReviewListItem = Omit<ReviewRow, 'draft' | 'overrides'> & {
  savings: number | null;   // est. annual tax saved (draft figure; for queue sort/glance)
  reduction: number | null; // value reduction
  county: string | null;
};

export async function listReviews(pendingOnly = true, limit = 100): Promise<ReviewListItem[]> {
  await ensureSchema();
  const where = pendingOnly ? `WHERE status <> 'approved'` : '';
  // Pull the headline savings/reduction/county straight out of the draft JSONB as
  // text (parsed in JS to avoid a hard ::numeric cast failing on odd data), so
  // the queue can sort + show them without shipping the whole draft.
  const { rows } = await getPool().query(
    `SELECT jti, status, address, tax_year, state, contact_name, contact_email,
            contact_phone, evidence, draft_error, submitted_at, reviewed_at,
            approved_at,
            draft->'result'->>'taxSaved'  AS savings_txt,
            draft->'result'->>'reduction' AS reduction_txt,
            draft->'our'->'subject'->>'county_name' AS county
       FROM one_reviews ${where}
       ORDER BY submitted_at DESC
       LIMIT $1`,
    [Math.min(Math.max(limit, 1), 500)]
  );
  return rows.map((r) => {
    const m = mapRow({ ...r, draft: null, overrides: null });
    const { draft, overrides, ...rest } = m;
    void draft; void overrides;
    const savings = Number(r.savings_txt);
    const reduction = Number(r.reduction_txt);
    return {
      ...rest,
      savings: Number.isFinite(savings) ? savings : null,
      reduction: Number.isFinite(reduction) ? reduction : null,
      county: r.county || null,
    };
  });
}

export async function getReview(jti: string): Promise<ReviewRow | null> {
  await ensureSchema();
  const { rows } = await getPool().query(`SELECT * FROM one_reviews WHERE jti = $1`, [jti]);
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Lightweight status check for the customer page (intake vs holding vs ready). */
export async function getStatus(jti: string): Promise<ReviewStatus | null> {
  await ensureSchema();
  const { rows } = await getPool().query(`SELECT status FROM one_reviews WHERE jti = $1`, [jti]);
  return rows[0] ? (rows[0].status as ReviewStatus) : null;
}
