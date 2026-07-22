import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidSupCookie, parseCookies, SUP_COOKIE, signToken } from './_token.js';
import { approveReview, updateOverrides, requestInfo, listReviews } from './_reviews.js';

// Reviewer-only actions for the TaxDrop One review queue. Sup-authenticated
// (the same td_sup cookie that gates the studio tools) — customers can never
// reach this.
//
// GET  /api/review-approve            → list pending reviews (the queue)
// GET  /api/review-approve?all=1      → list every review incl. approved
// POST /api/review-approve            → { jti, overrides? } approve + release
//
// Approving flips the row to `approved` (applying any reviewer overrides), which
// is what makes the customer's /r/<token> link start serving the report. It also
// pings Bubble so the "your report is ready" email/SMS fires.

const SUP_PASSWORD = process.env.SUP_PASSWORD || '';
const TOKEN_SECRET = process.env.TOKEN_SECRET || '';
const BUBBLE_WEBHOOK_URL = process.env.BUBBLE_APPROVE_WEBHOOK_URL || '';
const BUBBLE_WEBHOOK_SECRET = process.env.BUBBLE_WEBHOOK_SECRET || '';
const LINK_BASE = process.env.ONE_LINK_BASE || 'https://one.taxdrop.com';
const DEFAULT_TAX_YEAR = Number(process.env.ONE_DEFAULT_TAX_YEAR || '2026');
const LINK_TTL_DAYS = 90;

// Re-mint the customer's /r/<token> link from the stored jti so the "report
// ready" email/SMS has a ready-to-send URL. The token is stateless and keyed on
// jti (same property lock), so a fresh token with a new expiry is equivalent to
// the original — Bubble doesn't need to have stored the link. Returns null if
// TOKEN_SECRET isn't set (then the webhook simply omits reportUrl).
function reportLink(jti: string, taxYear: number | null, state: string | null): string | null {
  if (!TOKEN_SECRET) return null;
  const exp = Math.floor(Date.now() / 1000) + LINK_TTL_DAYS * 86400;
  const token = signToken(
    { jti, taxYear: taxYear ?? DEFAULT_TAX_YEAR, state: state ?? undefined, exp },
    TOKEN_SECRET
  );
  return `${LINK_BASE}/r/${token}`;
}

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
    /* best-effort — the row is approved regardless */
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const cookies = parseCookies(req.headers.cookie);
  if (!isValidSupCookie(cookies[SUP_COOKIE], SUP_PASSWORD)) {
    return res.status(403).json({ error: 'sup_required', message: 'Reviewer login required.' });
  }

  if (req.method === 'GET') {
    try {
      const all = req.query.all === '1' || req.query.all === 'true';
      const reviews = await listReviews(!all);
      return res.status(200).json({ reviews });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'list failed';
      return res.status(500).json({ error: 'list_failed', detail: msg });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = (req.body || {}) as Record<string, unknown>;
  const jti = String(body.jti || '').trim();
  if (!jti) return res.status(400).json({ error: 'jti_required' });

  // Send back for more info: flip to `needs_info`, save edits + the customer
  // message, and ping Bubble so the "we need a bit more" email fires.
  if (body.action === 'request_info') {
    try {
      const overrides = (body.overrides || {}) as Record<string, unknown>;
      const message = String(body.message || '').trim();
      if (!message) return res.status(400).json({ error: 'message_required', message: 'A message for the customer is required.' });
      const row = await requestInfo(jti, overrides, message);
      if (!row) return res.status(404).json({ error: 'not_found', message: 'No review for that jti.' });
      await notifyBubble({
        event: 'one.review.needs_info',
        jti: row.jti,
        address: row.address,
        reportUrl: reportLink(row.jti, row.taxYear, row.state),
        message,
        contact: { name: row.contactName, email: row.contactEmail, phone: row.contactPhone },
      });
      return res.status(200).json({ ok: true, status: row.status, jti: row.jti });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'request_info failed';
      return res.status(500).json({ error: 'request_info_failed', detail: msg });
    }
  }

  // Save-only: persist reviewer edits so they can preview the edited pack before
  // releasing. No status change, no customer notification.
  if (body.save === true) {
    try {
      const row = await updateOverrides(jti, body.overrides);
      if (!row) return res.status(404).json({ error: 'not_found', message: 'No review for that jti.' });
      return res.status(200).json({ ok: true, saved: true, status: row.status, jti: row.jti });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'save failed';
      return res.status(500).json({ error: 'save_failed', detail: msg });
    }
  }

  try {
    const row = await approveReview(jti, body.overrides);
    if (!row) return res.status(404).json({ error: 'not_found', message: 'No review for that jti.' });

    const reportUrl = reportLink(row.jti, row.taxYear, row.state);

    await notifyBubble({
      event: 'one.review.approved',
      jti: row.jti,
      address: row.address,
      reportUrl,
      contact: { name: row.contactName, email: row.contactEmail, phone: row.contactPhone },
      approvedAt: row.approvedAt,
    });

    return res.status(200).json({ ok: true, status: row.status, jti: row.jti, reportUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'approve failed';
    return res.status(500).json({ error: 'approve_failed', detail: msg });
  }
}
