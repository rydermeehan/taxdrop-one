# AGENTS.md

## Cursor Cloud specific instructions

This repo (`package.json` name `video-studio`) bundles two runnable pieces behind one Vercel deploy. See `README.md` for the product overview and `api/CLAUDE.md` for the `api/` ESM-import-extension and `_`-prefix rules.

### What the update script already does
`npm install` runs on startup. Node 22 + npm are preinstalled. That is all that is needed for the SPA, tests, typecheck, and build below.

### Runnable pieces

1. **Content Studio SPA** (`src/`, React 19 + Vite) — the part that runs standalone with no secrets.
   - Start: `npm run dev` → http://localhost:5174 (see `vite.config.ts`).
   - Client-side password gate; the password is `sup` (hardcoded in `src/components/auth/PasswordGate.tsx`, stored in `sessionStorage`).
   - Core data (brands, prompt history, etc.) is `localStorage`-only, so features like the Prompt Library work fully offline. AI/content-generation and integration panels (OpenRouter, Webflow, GSC, NeuronWriter, OnlySocial, SendFox) need their API keys entered in-app or `/api` running.
   - `npm run dev` proxies `/api` → `http://localhost:3000`, so SPA features that call `/api` also require `vercel dev` (below) running.

2. **Customer surfaces + `api/` functions** (`public/`, `api/`) — served by `vercel dev` on port 3000.
   - `vercel dev` is NOT installed by the update script and requires an interactive Vercel login (device auth), so it cannot start unattended. If you need it, install the CLI to a user-writable prefix (`npm config set prefix ~/.npm-global && npm install -g vercel`, then use `~/.npm-global/bin/vercel`) and log in.
   - The flagship TaxDrop One address-lookup flow additionally needs `TAXDROP_CAD_API_KEY` (+ the external `savings-engine` upstream) in `.env.local`; without it `/api/cad-proxy` returns 401/503. These are user-provided secrets.

### Lint / test / build / typecheck
- `npm test` — vitest, runs `api/**/*.test.ts` (passes).
- `npm run typecheck` — `tsc --noEmit` (passes).
- `npm run build` — `tsc -b && vite build`, builds the SPA (passes).
- `npm run lint` — currently **broken repo-wide**: ESLint 9 finds no `eslint.config.js` (none exists in the repo and it is not gitignored), so it errors before linting. This is a pre-existing repo gap, not an environment issue.
