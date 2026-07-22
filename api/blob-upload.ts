import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { verifyToken, isValidSupCookie, parseCookies, SUP_COOKIE } from './_token.js';
import { ALLOWED_CONTENT_TYPES, evidencePrefix } from './_storage.js';

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
  // Sup agents get a synthetic namespace so studio testing never collides with
  // a real purchase. Must match the sup jti used by intake.ts / report.ts.
  if (isValidSupCookie(cookies[SUP_COOKIE], SUP_PASSWORD)) return 'sup-test';
  const header = req.headers['x-td-token'];
  const raw = (typeof header === 'string' && header) ? header : (cookies['td_link'] || '');
  const payload = verifyToken(raw, TOKEN_SECRET);
  return payload ? payload.jti : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!TOKEN_SECRET) return res.status(503).json({ error: 'not_configured' });

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
    return res.status(400).json({ error: 'upload_denied', message: msg });
  }
}
