# TaxDrop One

Consultant review copy of the **TaxDrop One** product, the **V3 evidence-pack PDF** it exports, and the **CAD Evidence Analyzer** they share.

Production is live at **[one.taxdrop.com](https://one.taxdrop.com)**.

---

## What's in here

Three customer-facing surfaces, one shared backend:

| Path | What it is |
|---|---|
| **`public/pro/`** — `pro.jsx` | TaxDrop One app. Address + (optional) CAD evidence packet PDF in → recommended requested value + ranked strategy ladder out. This is the flagship customer self-service product. |
| **`public/test/evidence-pack-v3.html`** | V3 evidence-pack PDF. The consultant-style appeal brief One generates as a download — single-file HTML with vanilla JS (no build step). Same V3 calculation as `pro.jsx`. |
| **`public/evidence-analyzer/`** | CAD Evidence Analyzer. Reads the county's own evidence packet, identifies medians and outliers, and produces both a county-bound document and an internal agent prep packet. |
| **`api/cad-proxy.ts`** | Server-side proxy to the savings-engine database (subject lookups, equity comps, sales comps). Keeps the upstream API key off the browser. |
| **`api/evidence-read.ts`** | OpenRouter (Claude Sonnet) proxy for AI-based CAD packet reading. Falls back to the deterministic rule-based parser if `OPENROUTER_API_KEY` is missing. |
| **`middleware.ts`** | Edge routing — only fires on `one.taxdrop.com`, rewrites `/` → `/pro/`. On preview deploys it passes through. |

**Start with [STRATEGY-RECOMMENDER-EXPLAINER.md](STRATEGY-RECOMMENDER-EXPLAINER.md)** for the calculation methodology, decision logic, and constraints. It's UI-agnostic and was written specifically as a design/review handoff.

---

## Stack

Intentionally low-tech for these three surfaces — every page is plain HTML + React via `<script type="text/babel">` (in-browser Babel transpilation). No bundler, no build step. You can open any of the files directly and read top-to-bottom.

- **Hosting:** Vercel (`vercel.json` + edge middleware)
- **Frontend:** React 18 UMD + Babel-standalone, loaded from unpkg CDN per page
- **Backend:** Two serverless TS endpoints (`api/cad-proxy.ts`, `api/evidence-read.ts`)
- **PDF generation:** Browser `window.print()` from a popup window (the page auto-fires print on `?export=pdf` and closes itself)
- **No database in this repo** — the upstream savings-engine API is a separate Vercel project, owned by us, that this proxies to

---

## Running locally

```bash
npm install
vercel dev   # spins up the static files + api/ functions
```

The dev server runs at `http://localhost:3000`. Without the `one.taxdrop.com` host, the middleware doesn't rewrite — hit the surfaces directly:

- **TaxDrop One** → `http://localhost:3000/pro/`
- **V3 evidence pack** → `http://localhost:3000/test/evidence-pack-v3.html?address=4624+Junius+St+Dallas+TX+75246`
- **Evidence Analyzer** → `http://localhost:3000/evidence-analyzer/`

### Required environment variables

Set these in `.env.local` (gitignored) or via `vercel env`:

| Var | Required for | Where to get it |
|---|---|---|
| `TAXDROP_CAD_API_KEY` | The savings-engine proxy in `cad-proxy.ts`. Without it, every `/api/cad-proxy?path=...` request returns the upstream's 401. | Ask Ryder. |
| `TAXDROP_CAD_UPSTREAM` | Override the upstream base URL (defaults to the production engine). Useful if you're pointing at a staging engine. | Optional. |
| `OPENROUTER_API_KEY` | AI-based CAD packet reading in `evidence-read.ts`. Without it, the analyzer silently falls back to the rule-based parser — works, but less robust on unusual packet formats. | https://openrouter.ai/ |
| `EVIDENCE_READER_MODEL` | Override the OpenRouter model. Defaults to `anthropic/claude-sonnet-4.5`. | Optional. |

---

## How the three surfaces fit together

```
User on one.taxdrop.com/
   │
   ▼
TaxDrop One (public/pro/pro.jsx)
   │
   ├─ Address lookup     ─→ /api/cad-proxy?path=/api/evidence-pack/lookup
   │                         (returns subject + comps from the engine)
   │
   ├─ Optional CAD upload ─→ Evidence Analyzer engine (window.Analyzer.analyze)
   │                         (parses the county's packet client-side)
   │
   ├─ Runs the V3 strategy recommender (see explainer doc) and renders
   │  the recommendation card.
   │
   └─ User clicks "Download PDF":
        ├─ "TaxDrop Evidence Pack PDF"  → opens /test/evidence-pack-v3 in
        │                                  a popup, which auto-fetches data,
        │                                  auto-prints, and auto-closes
        └─ "CAD Evidence Review PDF"     → stashes the parsed CAD evidence
                                           in localStorage and opens
                                           /evidence-analyzer in a popup,
                                           which restores the analysis,
                                           auto-prints, and auto-closes
```

---

## What the consultant might want to look at

Suggestions, not requirements:

1. **The V3 calculation in [public/pro/pro.jsx](public/pro/pro.jsx)** (`computeAdjBreakdownV3`, `filterCompsV3`, `computeV3Strategy`, lines 37–184). It's duplicated verbatim into `public/test/evidence-pack-v3.html` because the screen value must match the PDF value. Worth scrutinizing whether the duplication can be eliminated without a build step.

2. **The decision engine** at `public/pro/pro.jsx:189–404` (`decide`). It builds every strategy in parallel, then selects by defensibility rank with our equity report preferred. The selection logic (and the >25% CAD-mismatch guard) has been hardened twice in response to real incidents.

3. **The PDF export flow.** Recently switched from hidden-iframe to popup-window because Chrome 117+ blocks `window.print()` from iframes positioned outside the viewport. The popup pattern is more reliable but has its own pitfalls (popup blockers). Inspect `triggerExport` in `pro.jsx` and the auto-export hooks in `evidence-pack-v3.html` (around line 1573) and `evidence-analyzer/app.jsx` (around line 195).

4. **The Evidence Analyzer.** `evidence-analyzer/analyzer.js` is the deterministic engine that turns parsed CAD evidence into our `result` object (medians, comp table, hero recommendation, strategies, settlement email, etc.). The AI prompt in `evidence-read.ts` extracts structured JSON from arbitrary CAD packet text; the engine does all dollar math.

5. **The recently added "no-opportunity" gate** in `evidence-analyzer/results.jsx` (`CountyNoOpportunity`, `_hasRealCountyOpportunity`). When the supportable reduction is below $200, the county-bound document swaps to an explainer instead of a copy-and-send email.

---

## Things that exist in the production deployment but aren't in this repo

- The savings-engine backend (a separate Vercel project we own — Python/FastAPI on top of a property database). The proxy in `cad-proxy.ts` points at it; the consultant doesn't need to run it locally if `TAXDROP_CAD_API_KEY` and `TAXDROP_CAD_UPSTREAM` are set.
- ATTOM, Stripe, Twilio, Sendgrid, DocuSign integrations. They live in the Bubble app (app.taxdrop.com), not here.
- The studio.taxdrop.com / studio assets / video studio app — that's a different (larger) sibling project in the same workspace; only the consultant-relevant subset was copied over.

---

## Conventions

- **Texas vs California** terminology — Texas uses "protest" (Appraisal District, Notice of Appraised Value), California uses "appeal" (Assessor's Office, Assessment Notice). All copy must match the state.
- **No emoji** in code or copy unless explicitly requested.
- **No comments unless the WHY is non-obvious** — most of the heavy lifting is in named functions.
- **No build step** for the three customer surfaces. Babel-in-browser is fine for what we ship.

---

*Contact: Ryder Meehan*
