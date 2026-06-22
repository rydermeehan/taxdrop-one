import type { VercelRequest, VercelResponse } from '@vercel/node';

// Allow up to 60s — upstream Vercel function cold-starts on /api/counties can hit 25s+
export const config = { maxDuration: 60 };

// Both pulled from env. Set TAXDROP_CAD_UPSTREAM + TAXDROP_CAD_API_KEY on the
// deployment (Vercel dashboard → Settings → Environment Variables) before this
// endpoint will work. No fallback values are baked in — see README.
const UPSTREAM = process.env.TAXDROP_CAD_UPSTREAM || 'https://savings-engine-database.vercel.app';
const API_KEY = process.env.TAXDROP_CAD_API_KEY || '';

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
