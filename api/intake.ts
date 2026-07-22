import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken, isValidSupCookie, parseCookies, SUP_COOKIE } from './_token.js';
import { saveIntake, saveDraft, saveDraftError, type IntakeInput } from './_reviews.js';

// TaxDrop One intake endpoint — the customer's "Submit for review" action.
//
// By this point the browser (v2/app.jsx, review mode) has already:
//   1. uploaded the raw evidence files straight to Blob (blob-upload.ts) and
//      collected their URLs, and
//   2. run the exact same client-side analysis it renders today (extract CAD →
//      engine lookup → decide()) to produce a DRAFT result — but instead of
//      showing it, it POSTs the draft here.
//
// This endpoint persists the intake + draft (Postgres, via _reviews.ts), moves
// the row to `in_review`, and pings Bubble so the review queue lights up. The
// customer sees a holding screen until a reviewer approves (review-approve.ts),
// at which point their /r/<token> link serves the stored report (report.ts).
//
// The draft is computed browser-side (reusing all the existing auditable calc
// code) and the reviewer verifies/edits it — so a tampered submission only ever
// hurts the customer's own report, and never ships without a human sign-off.

export const config = { maxDuration: 30 };

const TOKEN_SECRET = process.env.TOKEN_SECRET || '';
const SUP_PASSWORD = process.env.SUP_PASSWORD || '';
const BUBBLE_WEBHOOK_URL = process.env.BUBBLE_INTAKE_WEBHOOK_URL || '';
const BUBBLE_WEBHOOK_SECRET = process.env.BUBBLE_WEBHOOK_SECRET || '';

interface TokenCtx { jti: string; taxYear?: number; state?: string; }

function resolveToken(req: VercelRequest): TokenCtx | null {
  const cookies = parseCookies(req.headers.cookie);
  const sup = isValidSupCookie(cookies[SUP_COOKIE], SUP_PASSWORD);
  // Agent evidence self-test (?selftest=1): force the dedicated `sup-selftest`
  // record regardless of any customer link cookie, so the pipeline test seeds
  // its own row and never overwrites a real purchase. (Not remapped per-address
  // below since it isn't 'sup-test', so it stays a single reusable record.)
  if (sup && req.query && req.query.selftest === '1') return { jti: 'sup-selftest' };
  const header = req.headers['x-td-token'];
  const raw = (typeof header === 'string' && header) ? header : (cookies['td_link'] || '');
  const payload = verifyToken(raw, TOKEN_SECRET);
  if (payload) return { jti: payload.jti, taxYear: payload.taxYear, state: payload.state };
  // Sup agents can drive the flow end-to-end for testing under a fixed jti.
  if (sup) return { jti: 'sup-test' };
  return null;
}

// Fire-and-forget notify to Bubble. Never blocks or fails the submission —
// a queue notification is best-effort; the row is the source of truth.
async function notifyBubble(payload: Record<string, unknown>): Promise<void> {
  if (!BUBBLE_WEBHOOK_URL) return;
  try {
    await fetch(BUBBLE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(BUBBLE_WEBHOOK_SECRET ? { 'X-TaxDrop-Secret': BUBBLE_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    /* swallow — Bubble can also poll, and the row exists regardless */
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-TD-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!TOKEN_SECRET) return res.status(503).json({ error: 'not_configured' });

  const ctx = resolveToken(req);
  if (!ctx) {
    return res.status(402).json({ error: 'access_required', message: 'A paid TaxDrop One link is required.' });
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const address = String(body.address || '').trim();
  if (!address) return res.status(400).json({ error: 'address_required', message: 'An address is required.' });

  // Agent/testing submissions all resolve to the same 'sup-test' token, which
  // would collapse every test property into ONE review row (each overwriting the
  // last and inheriting its `approved` status). Key sup rows per-property so a
  // reviewer can test many properties and every one persists in the queue.
  // Real customers keep their unique per-purchase jti (one purchase = one row).
  if (ctx.jti === 'sup-test') {
    const slug = address.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    ctx.jti = 'sup-' + (slug || 'test');
  }

  const contact = (body.contact || {}) as Record<string, unknown>;
  const evidenceIn = Array.isArray(body.evidence) ? body.evidence : [];
  // Only accept https Blob URLs. Evidence URLs come from the Vercel Blob client
  // upload, which always returns https://…blob.vercel-storage.com/…. Rejecting
  // anything else stops a paid customer from smuggling a `javascript:`/`data:`
  // URL into the intake that would later run in the reviewer's dashboard when
  // clicked (stored-XSS against the sup session).
  const evidence = evidenceIn
    .map((e) => e as Record<string, unknown>)
    .filter((e) => e && typeof e.url === 'string' && /^https:\/\/[^/]+\.blob\.vercel-storage\.com\//i.test(e.url))
    .map((e) => ({
      url: String(e.url),
      filename: String(e.filename || 'evidence'),
      size: Number(e.size) || 0,
    }));

  const intake: IntakeInput = {
    address,
    taxYear: ctx.taxYear,
    state: ctx.state,
    contactName: contact.name ? String(contact.name) : undefined,
    contactEmail: contact.email ? String(contact.email) : undefined,
    contactPhone: contact.phone ? String(contact.phone) : undefined,
    evidence,
  };

  try {
    await saveIntake(ctx.jti, intake);

    // The browser-computed draft bundle. Missing/failed draft is fine — the
    // row stays `submitted` with an error note and a reviewer builds it by hand.
    const draft = body.draft;
    if (draft && typeof draft === 'object') {
      // SECURITY: the draft is CUSTOMER-authored (POSTed verbatim). The report
      // renderer injects `our.reportHtml` as RAW HTML (the WYSIWYG overlay), so
      // a customer could smuggle a stored-XSS payload through it. reportHtml and
      // reportNotes are agent-only fields that must ONLY ever originate from the
      // sup-gated overrides column (re-attached in _overrides.ts) — never from
      // the customer draft. Strip them here before persisting.
      const draftOur = (draft as { our?: unknown }).our;
      if (draftOur && typeof draftOur === 'object') {
        delete (draftOur as Record<string, unknown>).reportHtml;
        delete (draftOur as Record<string, unknown>).reportNotes;
      }
      await saveDraft(ctx.jti, draft);
    } else {
      await saveDraftError(ctx.jti, String(body.draftError || 'no draft produced by client'));
    }

    await notifyBubble({
      event: 'one.review.submitted',
      jti: ctx.jti,
      address,
      taxYear: ctx.taxYear ?? null,
      state: ctx.state ?? null,
      contact: {
        name: intake.contactName ?? null,
        email: intake.contactEmail ?? null,
        phone: intake.contactPhone ?? null,
      },
      evidenceCount: evidence.length,
      hasDraft: !!(draft && typeof draft === 'object'),
    });

    // jti is returned so a caller (e.g. the agent evidence self-test) can read
    // the attached evidence back through /api/evidence-download afterwards.
    return res.status(200).json({ ok: true, status: draft ? 'in_review' : 'submitted', jti: ctx.jti });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'intake failed';
    return res.status(500).json({ error: 'intake_failed', detail: msg });
  }
}
