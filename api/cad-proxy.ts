import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken, isValidSupCookie, parseCookies, SUP_COOKIE } from './_token.js';
import { claimOrVerifyProperty } from './_entitlements.js';

// Allow up to 60s — upstream Vercel function cold-starts on /api/counties can hit 25s+
export const config = { maxDuration: 60 };

const UPSTREAM = 'https://savings-engine-database.vercel.app';
// Server-side only. Set TAXDROP_CAD_API_KEY in Vercel env — no hardcoded fallback.
const API_KEY = process.env.TAXDROP_CAD_API_KEY || '';

// --- Access control (off until ACCESS_CONTROL_ENABLED is set) --------------
// Master switch. While unset/falsey the proxy behaves exactly as it did before
// access control existed — every request passes through. This lets the code
// ship without locking out the live internal tool before the secrets and the
// customer page are ready.
const ACCESS_ON = /^(1|true|yes)$/i.test(process.env.ACCESS_CONTROL_ENABLED || '');
const TOKEN_SECRET = process.env.TOKEN_SECRET || '';
const SUP_PASSWORD = process.env.SUP_PASSWORD || '';

// Proxied engine paths that return the PAID DELIVERABLE (evidence + comps).
// These are gated on every host (closes the studio.taxdrop.com bypass) and,
// for customer tokens, consume the one-property entitlement (lock-on-first-
// use). Internal-navigation paths (/api/counties, /api/browse, /api/lookup
// used by the studio database tools) are deliberately NOT here, so those
// tools keep working on studio without a login.
const REPORT_PATHS = [
  '/api/evidence-pack/lookup',
  '/api/attom-sales/lookup',
  '/api/clear-capital/lookup',
];

function isReportPath(path: string): boolean {
  return REPORT_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

// Stable lock key for a property. v1 uses the normalized address (the only
// identifier the report call carries): lowercase, strip punctuation, collapse
// whitespace so "123 Main St." and "123 main st" lock to the same property.
function propertyKeyFromAddress(address: unknown): string {
  return String(address || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Reads the customer link token from the X-TD-Token header or the td_link
// cookie (middleware sets the cookie when serving /r/<token>).
function readToken(req: VercelRequest): string {
  const header = req.headers['x-td-token'];
  if (typeof header === 'string' && header) return header;
  const cookies = parseCookies(req.headers.cookie);
  return cookies['td_link'] || '';
}

interface GateResult { ok: boolean; status?: number; body?: object; }

async function checkAccess(req: VercelRequest, path: string): Promise<GateResult> {
  if (!ACCESS_ON) return { ok: true }; // flag off → legacy pass-through

  // What gets gated:
  //   - EVERY path on one.taxdrop.com (the SaaS surface), and
  //   - the paid deliverable paths (REPORT_PATHS) on ANY host.
  // What stays open: internal-navigation paths on non-SaaS hosts — i.e. the
  // studio.taxdrop.com database tools (/api/counties, /api/browse, /api/lookup)
  // keep working without a login. This closes the studio bypass to the paid
  // evidence/comp data while leaving the legacy internal tooling untouched.
  const host = (req.headers.host || '').toLowerCase();
  const onSaasHost = host === 'one.taxdrop.com';
  const report = isReportPath(path);
  if (!onSaasHost && !report) return { ok: true };

  // 1. Agents/testing: a valid sup cookie grants unlimited access. The cookie
  //    is scoped to .taxdrop.com, so one /sup login works on both hosts.
  const cookies = parseCookies(req.headers.cookie);
  if (isValidSupCookie(cookies[SUP_COOKIE], SUP_PASSWORD)) return { ok: true };

  // 2. Customers: must present a valid, unexpired link token.
  const payload = verifyToken(readToken(req), TOKEN_SECRET);
  if (!payload) {
    return { ok: false, status: 402, body: { error: 'access_required', message: 'A paid TaxDrop One link or the sup password is required.' } };
  }

  // 3. Report generation locks the link to one property (first use wins).
  if (isReportPath(path)) {
    const key = propertyKeyFromAddress((req.body || {}).address);
    if (!key) {
      return { ok: false, status: 400, body: { error: 'address_required', message: 'An address is required to generate a report.' } };
    }
    const claim = await claimOrVerifyProperty(payload.jti, key, { taxYear: payload.taxYear, state: payload.state });
    if (!claim.allowed) {
      return { ok: false, status: 403, body: { error: 'property_locked', message: 'This link is already locked to a different property. Each link covers one property.' } };
    }
  }

  return { ok: true };
}

// Same-origin proxy for the CAD API. Eliminates browser-side cross-origin
// blocking (privacy shields, extensions, network filters) and keeps the
// upstream API key server-side.
//
// Frontend calls: /api/cad-proxy?path=/api/counties
// Or:             /api/cad-proxy?path=/api/browse&q=...&county=...&limit=...
//
// Path is required; everything else is forwarded as query string.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path, ...rest } = req.query;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Missing path query parameter' });
  }

  // Entitlement gate (no-op unless ACCESS_CONTROL_ENABLED). Fail closed on an
  // unexpected error so a DB hiccup can't silently hand out free reports.
  try {
    const gate = await checkAccess(req, path);
    if (!gate.ok) return res.status(gate.status || 403).json(gate.body || { error: 'forbidden' });
  } catch (e: unknown) {
    if (ACCESS_ON) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      return res.status(503).json({ error: 'access_check_failed', detail: msg });
    }
    // Flag off → never let access-control errors affect the legacy tool.
  }

  // Build upstream URL with all forwarded query params (except `path`)
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(rest)) {
    if (Array.isArray(v)) v.forEach(val => qs.append(k, String(val)));
    else if (v != null) qs.append(k, String(v));
  }
  const upstreamUrl = UPSTREAM + path + (qs.toString() ? '?' + qs.toString() : '');

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: req.method || 'GET',
      headers: {
        'X-API-Key': API_KEY,
        ...(req.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: req.method === 'POST' ? JSON.stringify(req.body || {}) : undefined,
    });
    const text = await upstreamRes.text();
    res.status(upstreamRes.status);
    const ct = upstreamRes.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    return res.send(text);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return res.status(502).json({ error: 'Upstream fetch failed', detail: msg });
  }
}
