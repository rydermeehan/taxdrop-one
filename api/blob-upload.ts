import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { verifyToken, isValidSupCookie, parseCookies, SUP_COOKIE } from './_token.js';

// Client-upload token exchange for county evidence files.
// POST /api/blob-upload  ← @vercel/blob/client `upload()` from the browser
//
// Auth: paid customer (td_link / X-TD-Token) or sup agent (td_sup cookie).
// Pathnames must stay under one/reviews/<jti>/ so a token can't write elsewhere.

const ACCESS_ON = /^(1|true|yes)$/i.test(process.env.ACCESS_CONTROL_ENABLED || '');
const TOKEN_SECRET = process.env.TOKEN_SECRET || '';
const SUP_PASSWORD = process.env.SUP_PASSWORD || '';

function readToken(req: VercelRequest): string {
  const header = req.headers['x-td-token'];
  if (typeof header === 'string' && header) return header;
  const cookies = parseCookies(req.headers.cookie);
  return cookies['td_link'] || '';
}

function isAuthorized(req: VercelRequest): boolean {
  if (!ACCESS_ON) return true;
  const cookies = parseCookies(req.headers.cookie);
  if (isValidSupCookie(cookies[SUP_COOKIE], SUP_PASSWORD)) return true;
  return !!verifyToken(readToken(req), TOKEN_SECRET);
}

function pathnameAllowed(pathname: string, req: VercelRequest): boolean {
  if (!ACCESS_ON) return pathname.startsWith('one/reviews/');
  const cookies = parseCookies(req.headers.cookie);
  if (isValidSupCookie(cookies[SUP_COOKIE], SUP_PASSWORD)) {
    return pathname.startsWith('one/reviews/');
  }
  const payload = verifyToken(readToken(req), TOKEN_SECRET);
  if (!payload) return false;
  const prefix = `one/reviews/${payload.jti}/`;
  return pathname === prefix.slice(0, -1) || pathname.startsWith(prefix);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-TD-Token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  if (!isAuthorized(req)) {
    return res.status(402).json({ error: 'access_required', message: 'A paid TaxDrop One link is required.' });
  }

  try {
    const body = (req.body || {}) as HandleUploadBody;
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathnameAllowed(pathname, req)) {
          throw new Error('Upload path not allowed for this session.');
        }
        return {
          allowedContentTypes: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
            'text/tab-separated-values',
          ],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // Intake stores blob URLs from the client POST — nothing else to do here.
      },
    });
    return res.status(200).json(jsonResponse);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return res.status(400).json({ error: 'upload_failed', message: msg });
  }
}
