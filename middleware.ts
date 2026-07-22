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
  // would otherwise be rewritten under /pro/ and 404 / serve HTML). Must list
  // favicon.svg explicitly — the fallback rewrite turns /favicon.svg into
  // /pro/favicon.svg and serves the SPA shell instead of the icon.
  matcher: ['/((?!_vercel/|favicon.ico|favicon.svg|forms/|vendor/).*)'],
};

// Access control master switch (mirrors cad-proxy.ts). Off until set, so the
// live internal tool is untouched. The EDGE runtime can't run node:crypto, so
// the sup check here is presence-only — it redirects unauthenticated agents to
// the login page. The real cryptographic verification happens in the Node API
// functions (sup-login.ts / cad-proxy.ts); a forged td_sup cookie yields the
// static shell but no data.
const ACCESS_ON = /^(1|true|yes)$/i.test(process.env.ACCESS_CONTROL_ENABLED || '');

// Human-navigable entry pages gated at the edge when access control is on.
// While the product is pre-launch, the WHOLE customer surface (root + /v2) is
// password-gated so the public can't see the WIP — but a real customer arriving
// via their /r/<token> link (which sets td_link) still gets in, so a refresh
// doesn't lock them out. The gate is presence-only (edge can't run node:crypto);
// the API endpoints do the real cryptographic verification. `/agent` is the door.
const INTERNAL_ENTRIES = new Set([
  '/', '/index.html',
  '/v2', '/v2/', '/v2/index.html',
  '/pro', '/pro/', '/pro/index.html',
  // Reviewer queue for the review-before-delivery flow — agent-only.
  '/review', '/review/', '/review/index.html',
]);

function hasSupCookie(req: Request): boolean {
  return /(?:^|;\s*)td_sup=[^;]+/.test(req.headers.get('cookie') || '');
}
// A paid customer holds a td_link (set by the /r/<token> middleware). They may
// only reach the customer app (root/v2), never the agent-only pages.
function hasLinkCookie(req: Request): boolean {
  return /(?:^|;\s*)td_link=[^;]+/.test(req.headers.get('cookie') || '');
}
const AGENT_ONLY = new Set(['/pro', '/pro/', '/pro/index.html', '/review', '/review/', '/review/index.html']);

export default function middleware(req: Request) {
  const host = req.headers.get('host') || '';

  // Agent login must work on EVERY taxdrop host, not just one.taxdrop.com:
  // gated report paths also live on studio.taxdrop.com, so an agent has to be
  // able to reach the login there too. `/agent` is the canonical door; `/sup`
  // stays as a backward-compatible alias. Both serve the same login page.
  const earlyUrl = new URL(req.url);
  if (earlyUrl.pathname === '/agent' || earlyUrl.pathname === '/sup') {
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
  if (path === '/sup') {
    url.pathname = '/sup.html';
    return rewrite(url);
  }
  if (path === '/sup.html' || path === '/api/sup-login') return next();

  // --- Edge gate (presence-only; off unless ACCESS_ON) ----------------------
  // Agent-only pages (/pro, /review) require the agent cookie. The customer app
  // (root, /v2) accepts EITHER the agent cookie OR a paid customer's td_link, so
  // the public hits the password but customers (and refreshes) pass.
  if (ACCESS_ON && INTERNAL_ENTRIES.has(path)) {
    const allowed = AGENT_ONLY.has(path) ? hasSupCookie(req) : (hasSupCookie(req) || hasLinkCookie(req));
    if (!allowed) {
      const login = new URL('/agent', req.url);
      login.searchParams.set('next', path);
      return Response.redirect(login.toString(), 307);
    }
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
  // Reviewer queue (agent-gated above). Single static file + inline JS.
  if (path === '/review' || path === '/review/') {
    url.pathname = '/review/index.html';
    return rewrite(url);
  }
  if (path.startsWith('/review/')) {
    return next();
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
