// Vercel Edge Middleware. Runs BEFORE filesystem checks, so we can route
// one.taxdrop.com requests to /pro/* without `index.html` short-circuiting
// the rewrite (Vercel's `rewrites` block in vercel.json runs AFTER
// filesystem matching, which is why the host-conditional rewrite there
// wasn't firing for `/`).
//
// (2026-06-19 — Mike: "move studio.taxdrop.com/pro to one.taxdrop.com/")
//
// Rules:
//   - one.taxdrop.com/api/*  → pass through (engine endpoints work as-is)
//   - one.taxdrop.com/pro/*  → pass through (already at the right path)
//   - one.taxdrop.com/       → /pro/index.html
//   - one.taxdrop.com/<x>    → /pro/<x>
//
// Other hosts pass through unchanged. The studio.taxdrop.com/pro redirect
// is handled by `vercel.json` redirects.

import { rewrite, next } from '@vercel/edge';

export const config = {
  // Skip the middleware on Vercel internals + favicons (static assets that
  // would otherwise be 404'd unnecessarily under /pro/).
  matcher: ['/((?!_vercel/|favicon.ico).*)'],
};

export default function middleware(req: Request) {
  const host = req.headers.get('host') || '';
  if (host !== 'one.taxdrop.com') return next();

  const url = new URL(req.url);
  const path = url.pathname;

  // API + /pro pass through unchanged (resolve from filesystem normally).
  // /v2 is the Strategy Recommender design preview — it lives at its own path
  // and must not be rewritten under /pro. (2026-06-23)
  if (path.startsWith('/api/') || path === '/api' ||
      path.startsWith('/pro/') || path === '/pro' ||
      path.startsWith('/v2/') || path === '/v2') {
    return next();
  }

  // /test/* and /evidence-analyzer: Vercel's `next()` doesn't always
  // re-apply vercel.json rewrites on one.taxdrop.com after middleware
  // intercepts, so we do those rewrites explicitly here. (2026-06-19 —
  // Mike: "TaxDrop Evidence PDF button does nothing on one.taxdrop.com")
  if (path === '/test/evidence-pack-v3') {
    url.pathname = '/test/evidence-pack-v3.html';
    return rewrite(url);
  }
  if (path === '/test/evidence-pack-v2') {
    url.pathname = '/test/evidence-pack-v2.html';
    return rewrite(url);
  }
  if (path === '/evidence-analyzer' || path === '/evidence-analyzer/') {
    url.pathname = '/evidence-analyzer/index.html';
    return rewrite(url);
  }
  // Anything under /test/ or /evidence-analyzer/ (assets, sub-paths) passes
  // through directly — those files already live at the right paths.
  if (path.startsWith('/test/') || path.startsWith('/evidence-analyzer/')) {
    return next();
  }

  // Root → /pro/index.html
  if (path === '/' || path === '/index.html') {
    url.pathname = '/pro/index.html';
    return rewrite(url);
  }

  // Other paths → /pro/<path>
  url.pathname = '/pro' + path;
  return rewrite(url);
}
