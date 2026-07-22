import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { verifyToken, isValidSupCookie, parseCookies, SUP_COOKIE } from './_token.js';
import { ALLOWED_CONTENT_TYPES, evidencePrefix, isBlobConfigured } from './_storage.js';

// Client-upload token minter for TaxDrop One evidence files.
//
// The browser (v2/app.jsx) calls the Vercel Blob `upload()` client helper with
// `handleUploadUrl: '/api/blob-upload'`. That helper POSTs here twice:
//   1. `blob.generate-client-token` → we authorize the customer and return a
//      short-lived token scoped to THIS purchase's Blob prefix, then the
//      browser streams the file straight to Blob (never touches this function).
//   2. `blob.upload-completed` → Blob's server-to-server confirmation callback.
//
// Authorization: the /r/<token> middleware sets an HttpOnly `td_link` cookie,
// which rides along on this request. We verify it (or a sup cookie) and pin the
// allowed upload path to `one/reviews/<jti>/…` so a customer can only write
// under their own purchase.

const TOKEN_SECRET = process.env.TOKEN_SECRET || '';
const SUP_PASSWORD = process.env.SUP_PASSWORD || '';

function customerJti(req: VercelRequest): string | null {
  const cookies = parseCookies(req.headers.cookie);
  const sup = isValidSupCookie(cookies[SUP_COOKIE], SUP_PASSWORD);
  // Agent evidence self-test (?selftest=1): a valid agent forces the dedicated
  // `sup-selftest` namespace, ignoring any customer link cookie they happen to
  // be holding — so the pipeline test can run in a normal agent session and can
  // never write into a real purchase's evidence.
  if (sup && req.query && req.query.selftest === '1') return 'sup-selftest';
  // Resolve the jti with the SAME precedence as /api/report (link token first,
  // then sup). The browser namespaces its upload pathname under whatever jti
  // /api/report handed it, so we MUST authorize that same jti here — otherwise
  // a reviewer who holds both a td_link (real test purchase) and a sup cookie
  // uploads under the real jti while we'd only allow `sup-test`, producing a
  // "pathname must be scoped to this purchase" 400 on every file.
  const header = req.headers['x-td-token'];
  const raw = (typeof header === 'string' && header) ? header : (cookies['td_link'] || '');
  const payload = verifyToken(raw, TOKEN_SECRET);
  if (payload) return payload.jti;
  if (sup) return 'sup-test';
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!TOKEN_SECRET) return res.status(503).json({ error: 'not_configured' });
  // handleUpload mints the client-upload token from BLOB_READ_WRITE_TOKEN. If the
  // Blob store is connected but that credential is missing (only BLOB_STORE_ID
  // set), every generate-client-token throws a generic 400 — which the browser
  // silently swallows, so evidence never attaches and reviewers see "no county
  // evidence" with no error anywhere. Fail loud with a clear signal instead.
  if (!isBlobConfigured()) {
    console.error('blob-upload: BLOB_READ_WRITE_TOKEN missing — evidence uploads cannot be authorized');
    return res.status(503).json({ error: 'blob_not_configured', message: 'Evidence uploads are temporarily unavailable. Please try again shortly.' });
  }

  const jti = customerJti(req);
  if (!jti) {
    return res.status(402).json({ error: 'access_required', message: 'A paid TaxDrop One link is required to upload evidence.' });
  }
  const prefix = evidencePrefix(jti);

  try {
    const jsonResponse = await handleUpload({
      body: req.body as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async (pathname: string) => {
        // Pin every upload under this purchase's prefix — a client can't smuggle
        // a pathname that writes into another purchase's folder.
        if (!pathname.startsWith(prefix)) {
          throw new Error('pathname must be scoped to this purchase');
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          addRandomSuffix: true,
          maximumSizeInBytes: 10 * 1024 * 1024,
          tokenPayload: JSON.stringify({ jti }),
        };
      },
      // No server-side bookkeeping on completion — intake.ts records the final
      // URLs when the customer submits. (Blob's callback can't reach localhost,
      // so nothing here should be required for the happy path.)
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(jsonResponse);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'upload authorization failed';
    // Log the real reason — the browser discards this response body, so without
    // this line an upload failure is invisible in server logs too.
    console.error('blob-upload: upload denied for jti=%s: %s', jti, msg);
    return res.status(400).json({ error: 'upload_denied', message: msg });
  }
}
