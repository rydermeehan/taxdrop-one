import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken, isValidSupCookie, parseCookies, SUP_COOKIE } from './_token.js';
import { getReview } from './_reviews.js';
import { applyOverrides } from './_overrides.js';

// TaxDrop One report delivery + status endpoint.
//
// GET /api/report  (customer token via td_link cookie / X-TD-Token header)
//   → { status }                          when not yet approved (page shows the
//                                          holding screen), OR
//   → { status: 'approved', report }      once a reviewer has released it —
//                                          `report` is the stored draft with the
//                                          reviewer's overrides merged in.
//
// GET /api/report?jti=<jti>  (sup cookie)
//   → the FULL review row incl. draft even before approval, so the reviewer UI
//     in studio can load a submission to check/edit it.
//
// The customer never receives the draft until status === 'approved'. That's the
// whole review gate: the deliverable is served from storage, on release only.

const TOKEN_SECRET = process.env.TOKEN_SECRET || '';
const SUP_PASSWORD = process.env.SUP_PASSWORD || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-TD-Token');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (!TOKEN_SECRET) return res.status(503).json({ error: 'not_configured' });

  const cookies = parseCookies(req.headers.cookie);
  const isSup = isValidSupCookie(cookies[SUP_COOKIE], SUP_PASSWORD);

  // Reviewer path: sup cookie + explicit ?jti → full row (draft visible early).
  //   ?jti alone        → RAW row (the /review editor needs the original comps +
  //                       separate overrides to render its checkboxes/inputs).
  //   ?jti&applied=1    → the same row but with overrides applied to draft, so
  //                       the live-report iframe preview shows the reviewer's
  //                       edits (excluded comps, corrected value) exactly as the
  //                       customer will see them.
  if (isSup && typeof req.query.jti === 'string' && req.query.jti) {
    try {
      const row = await getReview(req.query.jti);
      if (!row) return res.status(404).json({ error: 'not_found' });
      if (req.query.applied) {
        return res.status(200).json({ review: { ...row, draft: applyOverrides(row.draft, row.overrides) } });
      }
      return res.status(200).json({ review: row });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'lookup failed';
      return res.status(500).json({ error: 'lookup_failed', detail: msg });
    }
  }

  // Customer path: resolve jti from the link token.
  const header = req.headers['x-td-token'];
  const raw = (typeof header === 'string' && header) ? header : (cookies['td_link'] || '');
  const payload = verifyToken(raw, TOKEN_SECRET);
  const jti = payload ? payload.jti : (isSup ? 'sup-test' : null);
  if (!jti) {
    return res.status(402).json({ error: 'access_required', message: 'A paid TaxDrop One link is required.' });
  }

  try {
    const row = await getReview(jti);
    // jti is returned so the browser can namespace its Blob evidence uploads to
    // this purchase (the token it came from is HttpOnly, so JS can't read it).
    if (!row) return res.status(200).json({ status: 'none', jti });
    if (row.status === 'needs_info') {
      const ov = (row.overrides || {}) as Record<string, unknown>;
      return res.status(200).json({ status: 'needs_info', jti, message: typeof ov.infoRequest === 'string' ? ov.infoRequest : '' });
    }
    if (row.status !== 'approved') return res.status(200).json({ status: row.status, jti });
    return res.status(200).json({ status: 'approved', jti, report: applyOverrides(row.draft, row.overrides) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'lookup failed';
    return res.status(500).json({ error: 'lookup_failed', detail: msg });
  }
}
