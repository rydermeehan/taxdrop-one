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

// Access control master switch (mirrors cad-proxy.ts). Off until set, so the
// live internal tool is untouched. The EDGE runtime can't run node:crypto, so
// the sup check here is presence-only — it redirects unauthenticated agents to
// the login page. The real cryptographic verification happens in the Node API
// functions (sup-login.ts / cad-proxy.ts); a forged td_sup cookie yields the
// static shell but no data.
const ACCESS_ON = /^(1|true|yes)$/i.test(process.env.ACCESS_CONTROL_ENABLED || '');

// Internal-only entry pages that require the sup password when access control
// is on. Customer-facing surfaces (/ and /v2) stay public so anonymous visitors
// can use the marketing/instant tool; paid customers arrive via /r/<token>.
// Asset sub-paths (e.g. /v2/app.jsx) are intentionally NOT listed.
const INTERNAL_ENTRIES = new Set([
  '/pro', '/pro/', '/pro/index.html',
]);

function hasSupCookie(req: Request): boolean {
  return /(?:^|;\s*)td_sup=[^;]+/.test(req.headers.get('cookie') || '');
}

export default function middleware(req: Request) {
  const host = req.headers.get('host') || '';

  // Sup login must work on EVERY taxdrop host, not just one.taxdrop.com:
  // gated report paths also live on studio.taxdrop.com, so an agent has to be
  // able to reach /sup there too. Handle it before the host gate below.
  const earlyUrl = new URL(req.url);
  if (earlyUrl.pathname === '/sup' || earlyUrl.pathname === '/agent') {
    earlyUrl.pathname = '/sup.html';
    return rewrite(earlyUrl);
  }

  if (host !== 'one.taxdrop.com') return next();

  const url = new URL(req.url);
  const path = url.pathname;

  // --- Customer report links: /r/<token> -----------------------------------
  // Stash the token in an HttpOnly cookie (cad-proxy reads it to authorize +
  // lock the property) and serve the existing app. The app's `<base href="/v2/">`
  // makes its assets resolve under /v2/ regardless of this URL, so no fork is
  // needed. Works whether or not ACCESS_ON, so links are testable early.
  if (path === '/r' || path.startsWith('/r/')) {
    const token = path.replace(/^\/r\/?/, '').replace(/\/$/, '');
    url.pathname = '/v2/index.html';
    const res = rewrite(url);
    if (token) {
      res.headers.append(
        'Set-Cookie',
        `td_link=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7776000`
      );
    }
    return res;
  }

  // --- Sup (agent) login ----------------------------------------------------
  if (path === '/sup' || path === '/agent') {
    url.pathname = '/sup.html';
    return rewrite(url);
  }
  if (path === '/sup.html' || path === '/api/sup-login') return next();

  // --- Sup gate (presence-only; off unless ACCESS_ON) -----------------------
  if (ACCESS_ON && INTERNAL_ENTRIES.has(path) && !hasSupCookie(req)) {
    const login = new URL('/sup', req.url);
    login.searchParams.set('next', path);
    return Response.redirect(login.toString(), 307);
  }

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

  // Root → /v2/index.html. The v2 Strategy Recommender is now the live One
  // experience; the legacy /pro tree stays reachable at /pro for rollback.
  // (2026-06-24 — promote v2 to one.taxdrop.com root.)
  if (path === '/' || path === '/index.html') {
    url.pathname = '/v2/index.html';
    return rewrite(url);
  }

  // Other paths → /pro/<path> (legacy assets/sub-paths)
  url.pathname = '/pro' + path;
  return rewrite(url);
}
