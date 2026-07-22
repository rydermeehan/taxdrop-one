import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken, isValidSupCookie, parseCookies, SUP_COOKIE } from './_token.js';
import { getReview } from './_reviews.js';

// Authenticated read proxy for PRIVATE county-evidence packets.
//
// Evidence files are uploaded to a PRIVATE Blob store (they're customer tax
// documents — owner names, addresses, parcel IDs), so their URLs can't be
// opened directly in the browser. This endpoint gates access behind the agent
// sup cookie (or the customer's own td_link) and streams the file back by
// fetching the private blob with the store's read-write token server-side.
//
//   GET /api/evidence-download?jti=<jti>&i=<index>[&dl=1]
//     - i   : index into the review row's evidence[] array
//     - dl  : if present, force download (attachment) instead of inline view

const SUP_PASSWORD = process.env.SUP_PASSWORD || '';
const TOKEN_SECRET = process.env.TOKEN_SECRET || '';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';

function safeFilename(name: string): string {
  // Strip anything that could break the header or smuggle a path.
  return String(name || 'evidence').replace(/[^a-zA-Z0-9._ -]+/g, '_').slice(0, 120) || 'evidence';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const jti = typeof req.query.jti === 'string' ? req.query.jti : '';
  if (!jti) return res.status(400).json({ error: 'missing_jti' });

  // Auth: an agent (sup cookie) may read any record; a customer may read only
  // the record their own link token was minted for.
  const cookies = parseCookies(req.headers.cookie);
  let authed = isValidSupCookie(cookies[SUP_COOKIE], SUP_PASSWORD);
  if (!authed) {
    const payload = verifyToken(cookies['td_link'] || '', TOKEN_SECRET);
    authed = !!(payload && payload.jti === jti);
  }
  if (!authed) return res.status(403).json({ error: 'forbidden' });

  if (!BLOB_TOKEN) {
    console.error('evidence-download: BLOB_READ_WRITE_TOKEN missing — cannot read private blobs');
    return res.status(503).json({ error: 'blob_not_configured' });
  }

  const row = await getReview(jti);
  const evidence = (row && row.evidence) || [];
  const idx = Number(req.query.i);
  const file = Number.isInteger(idx) && idx >= 0 ? evidence[idx] : null;
  if (!file || !file.url) return res.status(404).json({ error: 'not_found' });

  // Defense-in-depth: the URL comes from our own row (intake already pins it to
  // *.blob.vercel-storage.com), but re-validate the host before we attach the
  // store token and fetch it, so a poisoned row can't turn this into an SSRF.
  let target: URL;
  try { target = new URL(file.url); } catch { return res.status(400).json({ error: 'bad_url' }); }
  if (target.protocol !== 'https:' || !/(^|\.)blob\.vercel-storage\.com$/i.test(target.hostname)) {
    return res.status(400).json({ error: 'bad_url' });
  }

  const upstream = await fetch(target.toString(), { headers: { Authorization: `Bearer ${BLOB_TOKEN}` } });
  if (!upstream.ok) {
    console.error('evidence-download: blob fetch failed jti=%s status=%s', jti, upstream.status);
    return res.status(502).json({ error: 'fetch_failed', status: upstream.status });
  }

  const buf = Buffer.from(await upstream.arrayBuffer());

  // XSS defense: evidence is customer-uploaded and served from our own
  // (sup-authenticated) origin, so an uploaded HTML/SVG file rendered inline
  // would execute script in the reviewer's session. Only render a small set of
  // non-executable types inline; force everything else to download as an opaque
  // octet-stream, and always send nosniff so the browser can't MIME-sniff its
  // way to text/html. `?dl=1` forces download regardless.
  const INLINE_SAFE = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  const upstreamType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const inline = !req.query.dl && INLINE_SAFE.has(upstreamType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', inline ? upstreamType : 'application/octet-stream');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${safeFilename(file.filename)}"`);
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).send(buf);
}
