import type { VercelRequest } from '@vercel/node';
import { verifyToken, isValidSupCookie, parseCookies, SUP_COOKIE } from './_token.js';
import { claimOrVerifyProperty } from './_entitlements.js';

export const UPSTREAM = 'https://savings-engine-database.vercel.app';
// Server-side only. Sourced from TAXDROP_CAD_API_KEY env — no hardcoded
// fallback. Empty when unset → the engine returns 401, which surfaces plainly.
export const CAD_API_KEY = process.env.TAXDROP_CAD_API_KEY || '';
export const CMP_API_KEY = process.env.CRAFTMYPDF_API_KEY || '';
export const CMP_ENDPOINT = 'https://api.craftmypdf.com/v1/create';

const ACCESS_ON = /^(1|true|yes)$/i.test(process.env.ACCESS_CONTROL_ENABLED || '');
const TOKEN_SECRET = process.env.TOKEN_SECRET || '';
const SUP_PASSWORD = process.env.SUP_PASSWORD || '';

export function readToken(req: VercelRequest): string {
  const header = req.headers['x-td-token'];
  if (typeof header === 'string' && header) return header;
  return parseCookies(req.headers.cookie)['td_link'] || '';
}

// Same property-key normalizer as cad-proxy so a form/schema request locks or
// verifies against the SAME property the customer claimed for their report.
export function propertyKeyFromAddress(address: unknown): string {
  return String(address || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * sup cookie grants unlimited access; a customer link must be valid AND locked
 * to the requested property. Fail-closed: the caller treats a thrown error as a
 * 503 when access control is enabled.
 */
export async function gate(req: VercelRequest): Promise<{ ok: boolean; status?: number; body?: object }> {
  if (!ACCESS_ON) return { ok: true };
  const cookies = parseCookies(req.headers.cookie);
  if (isValidSupCookie(cookies[SUP_COOKIE], SUP_PASSWORD)) return { ok: true };

  const payload = verifyToken(readToken(req), TOKEN_SECRET);
  if (!payload) {
    return { ok: false, status: 402, body: { error: 'access_required', message: 'A paid TaxDrop One link or the sup password is required.' } };
  }
  const key = propertyKeyFromAddress((req.body || {}).address);
  if (!key) {
    return { ok: false, status: 400, body: { error: 'address_required', message: 'An address is required.' } };
  }
  const claim = await claimOrVerifyProperty(payload.jti, key, { taxYear: payload.taxYear, state: payload.state });
  if (!claim.allowed) {
    return { ok: false, status: 403, body: { error: 'property_locked', message: 'This link is already locked to a different property. Each link covers one property.' } };
  }
  return { ok: true };
}

/** Pull the live subject (account #, values, county, state) from the engine. */
export async function lookupSubject(address: string): Promise<any | null> {
  const r = await fetch(UPSTREAM + '/api/evidence-pack/lookup', {
    method: 'POST',
    headers: { 'X-API-Key': CAD_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  const data = await r.json();
  return data?.subject ?? null;
}
