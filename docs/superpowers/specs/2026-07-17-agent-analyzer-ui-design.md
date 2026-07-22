# Agent Analyzer UI at `/agent` — Design

**Date:** 2026-07-17
**Status:** Approved (design), pending spec review
**Author:** Claude (with Ryder)

## Problem

Agents currently do their analysis inside the customer app (`/v2`), which forces
them through customer-oriented chrome they don't need: the 4-step intake
accordion (reviewMode), the 50-132 notice-of-protest form fill, and the email
"submit for review" step. Agents just need to **enter an address, upload the
county evidence, analyze, and produce the assessment/exports** — fast, with no
customer framing.

## Goal

A dedicated, sup-gated agent tool at `/agent`: a single screen that runs the
existing analysis pipeline and produces all four deliverables, with none of the
customer intake/form/review steps.

## Non-goals (explicitly excluded)

- The 4-step intake accordion (reviewMode step flow).
- The 50-132 protest-form fill (`/api/generate-forms`).
- The email review step (`submitForReview` → `/api/intake` → `/review` queue).
- Any persistence / review queue / history. The tool is ephemeral: analyze and
  export, nothing stored.
- No changes to the live customer app (`/v2`). It is left untouched.

## Approach (chosen)

**Approach 2 — new self-contained agent page, `/v2` untouched.**

New files under `public/agent/`. The page loads the same shared engine globals
(`/evidence-analyzer/analyzer.js`, `/evidence-analyzer/extract.js`) and **copies**
the stable pure logic it needs from `public/v2/app.jsx` into `public/agent/agent.jsx`.
The customer app is not edited, so there is zero regression risk to the path we
just stabilized. The duplicated logic (`decide`, banner builder, address helpers,
export URLs) is stable; if it changes later, both copies update.

Rejected alternatives: (1) extracting shared logic out of `app.jsx` into a common
module — cleaner long-term but edits the live customer file; (2) an "agent mode"
flag on `/v2` — reuses the same UI, which is explicitly not wanted.

## Access / auth

- `/agent` is **sup-gated** (agent password). The agent's `td_sup` cookie means
  `cad-proxy` authorizes the engine lookup with no customer token/entitlement
  friction (`cad-proxy.ts` returns `ok` for a valid sup cookie before any DB work).
- Middleware behavior:
  - `/sup` (any host) → serve login page (`/sup.html`). Unchanged.
  - `/agent` **with** `td_sup` cookie → serve `public/agent/index.html`.
  - `/agent` **without** cookie → `307` redirect to `/sup?next=/agent`. After
    login, `sup.html` sends the agent to `next` → back to `/agent`, now with the
    cookie → the tool renders.
  - `/agent/*` (static assets: `agent.jsx`, etc.) → pass through (`next()`),
    like `/v2/*` assets are served today. Static assets carry no data; the data
    path (`cad-proxy`) stays gated.
- The edge gate is presence-only (the real crypto check is in the Node APIs), so
  `/agent` uses the same `hasSupCookie` presence check the other internal pages use.

## New files

### `public/agent/index.html`
- `<base href="/agent/">`.
- Loads React 18 UMD, ReactDOM, Babel standalone (same pinned versions/integrity
  as `/v2`).
- Loads the shared engine: `/evidence-analyzer/analyzer.js`, `/evidence-analyzer/extract.js`.
- Loads Google Places (address autocomplete) — same key/params as `/v2`.
- Does **not** load the Vercel Blob client-upload helper (`/v2` needs it only for
  the review queue, which the agent tool excludes).
- `<script type="text/babel" src="agent.jsx">`.

### `public/agent/agent.jsx`
Single-screen React app. Copies from `app.jsx`:
- Constants/helpers: `CURRENT_TAX_YEAR`, `fmt`, `signed`, `titleCase`,
  `JURISDICTIONS`, `resolveStateId`, `stateFromAddress`, `ensureAddressZip`,
  `TIER_TAG`, `HANDOFF_KEY`.
- Pipeline: the `computeDraft`/`analyze` core — `extract → cad-proxy lookup →
  decide` — minus reviewMode/intake/upload-to-blob branches.
- `decide(cad, our, address)` — the analysis engine glue (unchanged).
- `buildReport(r)` — turns the `decide` result into the display banner object `b`.
- The result-render pieces needed for the assessment view (strategy banner,
  notice strips, comps/medians/$psf, data-quality notices) — **re-framed for
  agents** (see below).
- Export plumbing: `triggerExport(which, format)`, `countyAttach()`, and the
  `busy`/`exporting` state — copied verbatim (URLs unchanged).

## Screen spec (single view, no steps)

1. **Inputs:** address field (Google Places autocomplete) + multi-file evidence
   drop (PDF/Excel/CSV, same accept/size rules as today). No accordion.
2. **Analyze** button → runs the pipeline. Progress uses the same step labels.
3. **Assessment view** (agent-framed — drop "your savings"/refund/refer/next-steps
   customer chrome):
   - Case-strategy banner + recommended value/method.
   - Notice value, county comps, medians (sales/equity), $/sqft.
   - Data-quality / mismatch flags shown **plainly** (see below).
4. **Exports (4 buttons):**
   - Evidence packet **PDF** — `triggerExport('our','pdf')`.
   - Evidence packet **DOCX** — `triggerExport('our','docx')`.
   - **CAD Analyzer Pack** — `triggerExport('cad','pdf')` (requires an uploaded packet).
   - **County-facing attachment** — `countyAttach()`.

## Mismatch handling (changed vs. customer view)

The customer `decide()` sets the uploaded packet aside when it disagrees with the
engine record by >25% (`cadMismatch` → `effectiveCad = null`) and shows a soft
"set aside for this report" notice. For agents, **surface the mismatch prominently
and keep both numbers visible** — show the packet value and the engine value
side by side with a clear "packet vs. record mismatch — review before relying on
the engine strategies" banner, rather than quietly dropping the packet. The
underlying `decide()` still computes the same recommendation (we do not change the
math); the agent view just **presents** the mismatch instead of hiding it.

## Testing / verification

- Load `/agent` without a cookie → redirected to `/sup?next=/agent`.
- Log in → land on `/agent` → tool renders.
- Analyze a known TX address (e.g. `5051 Forest Bend Rd, Dallas, TX 75244`, which
  the engine returns 5 comps for) with the sup cookie → comps appear (confirms
  `cad-proxy` authorizes via sup).
- Upload a real county packet (e.g. the Collin 9843 Promontory PDF) + address →
  assessment view shows packet-derived subject value and comps.
- Each of the 4 export buttons opens its popup and produces the file.
- Trigger a deliberate packet/record mismatch → the mismatch banner shows both
  values (not silently set aside).
- `/v2` customer app is byte-for-byte unchanged (no regression).

## Risks

- **Logic duplication** between `agent.jsx` and `app.jsx` (`decide`, `buildReport`,
  export URLs). Accepted for isolation; both are stable. Noted here so a future
  change to `decide()` updates both.
- **Middleware ordering.** The new `/agent` cookie-conditional rewrite must run
  before the existing generic host rewrites, and `/agent/*` assets must pass
  through. Covered in the middleware section; verify no path (`/agent`,
  `/agent/agent.jsx`) 404s or serves the wrong shell.
- **Engine cold-start** on `cad-proxy → evidence-pack/lookup` (~28s observed).
  Out of scope for this UI change, but the agent view should show the analyzing
  state clearly so a slow lookup doesn't read as a hang.
