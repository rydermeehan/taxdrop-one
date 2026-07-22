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
  //
  // `forms/` is the same failure mode with worse consequences: the blank
  // official protest/appeal PDFs live there, and without this exclusion
  // /forms/tx-50-132.pdf returns 200 text/html (the SPA shell) instead of the
  // form — so the download button hands a customer a web page when they think
  // they're getting the document they have to file. Verified in production
  // 2026-07-21. These are public government forms; they are intentionally NOT
  // behind the password gate.
  //
  // `vendor/` is the same failure mode again: the self-hosted @vercel/blob
  // upload bundle (blob-client-2.6.1.js) lives there. Without this exclusion
  // the fallback rewrite turns /vendor/blob-client-2.6.1.js into
  // /pro/vendor/... which 404s to the SPA shell (text/html), so the module
  // import fails with "Failed to fetch dynamically imported module" and
  // evidence uploads break — the exact bug this bundle was added to fix.
  // (2026-07-21.)
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
// the API endpoints do the real cryptographic verification. `/sup` is the login
// door; `/agent` is the authenticated agent tool (unauth → redirected to /sup).
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

  // Agent surface — must work on EVERY taxdrop host (gated report paths also
  // live on studio.taxdrop.com, so an agent has to reach the login/tool there).
  //   - /sup            → login page (backward-compatible alias for the door)
  //   - /agent          → the agent analyzer tool when authenticated; else the
  //                       login page (returns here via ?next=/agent)
  //   - /agent/<asset>  → static tool assets (agent.jsx …), served as-is
  // The sup check here is presence-only (edge can't run node:crypto); the real
  // enforcement is in cad-proxy.ts on every data call, so a forged td_sup gets
  // the static shell but no engine data.
  const earlyUrl = new URL(req.url);
  const earlyPath = earlyUrl.pathname;
  if (earlyPath === '/sup') {
    earlyUrl.pathname = '/sup.html';
    return rewrite(earlyUrl);
  }
  if (earlyPath === '/agent') {
    if (hasSupCookie(req)) {
      earlyUrl.pathname = '/agent/index.html';
      return rewrite(earlyUrl);
    }
    // Preserve the caller's ?next (the edge gate passes the originally-requested
    // gated path, e.g. /review) so login returns them there, not to the tool.
    const login = new URL('/sup', req.url);
    login.searchParams.set('next', earlyUrl.searchParams.get('next') || '/agent');
    return Response.redirect(login.toString(), 307);
  }
  if (earlyPath.startsWith('/agent/')) {
    return next(); // agent tool static assets resolve from the filesystem
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
      // Send unauthenticated users straight to the login page (/sup), preserving
      // the requested path AND query so login returns them exactly where they
      // were headed. Dropping url.search here broke test/deep links like
      // /?test=1&address=… — after login the customer landed on bare root and
      // lost the params. (/agent is now the tool, not the login door — routing
      // through it would drop ?next.) (2026-07-22)
      const login = new URL('/sup', req.url);
      login.searchParams.set('next', path + url.search);
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
