import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supCookieValue, isValidSupCookie, parseCookies, SUP_COOKIE } from './_token.js';

// Sup (agent/testing) login. POST { password } → sets an HttpOnly td_sup
// cookie that the edge middleware and cad-proxy both trust. Replaces the old
// client-side PasswordGate, which compared the password in the browser and
// therefore protected nothing.
//
//   POST /api/sup-login   { "password": "..." }   → 200, Set-Cookie
//   GET  /api/sup-login                            → { authenticated: bool }
//
// The cookie holds an HMAC of a fixed marker keyed by SUP_PASSWORD — never the
// password itself — so it can't be forged and rotating SUP_PASSWORD logs
// everyone out.

const SUP_PASSWORD = process.env.SUP_PASSWORD || '';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const cookies = parseCookies(req.headers.cookie);
    return res.status(200).json({
      authenticated: isValidSupCookie(cookies[SUP_COOKIE], SUP_PASSWORD),
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  if (!SUP_PASSWORD) {
    return res.status(503).json({ error: 'not_configured', message: 'SUP_PASSWORD is not set on the server.' });
  }

  const provided = (req.body && (req.body as { password?: unknown }).password) || '';
  if (typeof provided !== 'string' || provided !== SUP_PASSWORD) {
    return res.status(401).json({ error: 'invalid_password' });
  }

  res.setHeader('Set-Cookie', [
    `${SUP_COOKIE}=${supCookieValue(SUP_PASSWORD)}`,
    'Path=/',
    // Scope to the apex so one agent login covers one.taxdrop.com AND
    // studio.taxdrop.com (the gated report paths live on both hosts).
    'Domain=.taxdrop.com',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${THIRTY_DAYS}`,
  ].join('; '));
  return res.status(200).json({ ok: true });
}
