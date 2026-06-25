// Shared HMAC token + cookie helpers for one.taxdrop.com access control.
// Underscore-prefixed → Vercel does NOT expose this as an endpoint; it's a
// library imported by cad-proxy.ts / stripe-webhook.ts / sup-login.ts.
//
// Two independent secrets (set in Vercel env):
//   TOKEN_SECRET  — signs customer report links (/r/<token>)
//   SUP_PASSWORD  — the agent/testing password; its hash also signs td_sup
//
// Tokens are stateless and self-verifying: payload + HMAC, base64url-joined.
// The DB (see _entitlements.ts) only records which property a token claimed —
// the token itself is never stored.

import { createHmac, timingSafeEqual } from 'node:crypto';

const b64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64url = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function hmac(secret: string, data: string): string {
  return b64url(createHmac('sha256', secret).update(data).digest());
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ---- Customer report tokens ---------------------------------------------

export interface TokenPayload {
  /** Unique id for this purchase (Stripe checkout/session id or a random nonce). */
  jti: string;
  /** Tax year this report covers, e.g. 2026. */
  taxYear: number;
  /** State the purchase is scoped to (TX | CA | FL | GA). Loads the right flow. */
  state?: string;
  /** Unix seconds. Links expire so a leaked URL doesn't live forever. */
  exp: number;
}

export function signToken(payload: TokenPayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${hmac(secret, body)}`;
}

export function verifyToken(token: string, secret: string): TokenPayload | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  if (!safeEqual(sig, hmac(secret, body))) return null;
  let payload: TokenPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload.jti !== 'string' || typeof payload.exp !== 'number') {
    return null;
  }
  if (payload.exp * 1000 < epochMs()) return null; // expired
  return payload;
}

// `Date.now()` so links can expire. Isolated here for clarity; the workflow
// runtime forbids Date.now() but this is normal serverless code, not a script.
function epochMs(): number {
  return Date.now();
}

// ---- Sup (agent) cookie --------------------------------------------------
// We never store the raw password in a cookie. The cookie value is an HMAC of
// a fixed marker keyed by SUP_PASSWORD, so a correct cookie can only be minted
// by someone who knew the password. Rotating SUP_PASSWORD invalidates all
// existing sup sessions.

const SUP_MARKER = 'taxdrop-sup-v1';

export function supCookieValue(supPassword: string): string {
  return hmac(supPassword, SUP_MARKER);
}

export function isValidSupCookie(cookieVal: string | undefined, supPassword: string): boolean {
  if (!cookieVal || !supPassword) return false;
  return safeEqual(cookieVal, supCookieValue(supPassword));
}

/** Parse a Cookie header into a name→value map. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export const SUP_COOKIE = 'td_sup';
