# TaxDrop One — access control

Paid SaaS gating for `one.taxdrop.com` (CA/TX/FL/GA). Two doors into one
chokepoint:

- **Agents/testing** → "sup password" → `td_sup` cookie → unlimited.
- **Customers** → unique `/r/<token>` link → property-locked, one report.

All report data flows through [`api/cad-proxy.ts`](api/cad-proxy.ts), which is
where entitlement is enforced. The frontend gate is cosmetic; the proxy is real.

## Files

| File | Role |
|------|------|
| `api/_token.ts` | HMAC sign/verify for link tokens + sup cookie (shared lib, not an endpoint) |
| `api/_entitlements.ts` | Postgres `one_entitlements` table — locks a token to one property on first use |
| `api/cad-proxy.ts` | Enforcement: sup cookie **or** valid token; report paths lock the property |
| `api/sup-login.ts` | `POST {password}` → sets HttpOnly `td_sup` cookie |
| `api/stripe-webhook.ts` | `checkout.session.completed` → mint token → email `/r/<token>` via Sendgrid |
| `middleware.ts` | Routes `/r/<token>` → app (+`td_link` cookie); redirects internal pages to `/sup` |
| `public/sup.html` | Sup login page |

## Environment variables (set in Vercel → Project → Settings)

| Var | Who sets it | Notes |
|-----|-------------|-------|
| `ACCESS_CONTROL_ENABLED` | you | **Master switch. Leave unset until ready.** `1` turns enforcement on. |
| `SUP_PASSWORD` | you (choose) | The agent/testing password. Rotating it logs all agents out. |
| `TOKEN_SECRET` | you (random) | Signs customer links. Generate: `openssl rand -hex 32`. Keep secret. |
| `STRIPE_WEBHOOK_SECRET` | Stripe | From the webhook endpoint you create in Stripe (`whsec_…`). |
| `DATABASE_URL` | reuse engine's | Same Postgres the savings-engine uses. Adds table `one_entitlements`. |
| `SENDGRID_API_KEY` | existing | Sends the link email. |
| `SENDGRID_FROM` | you (optional) | Default `reports@taxdrop.com`. Must be a verified Sendgrid sender. |
| `ONE_DEFAULT_TAX_YEAR` | optional | Default `2026`. Used if Stripe metadata omits `tax_year`. |

While `ACCESS_CONTROL_ENABLED` is unset, `cad-proxy` and `middleware` behave
exactly as before — nothing is gated. This is intentional so the code ships
without locking out the live internal tool.

## Stripe setup (when ready)

1. Create a **Payment Link** for the $129 product (collect customer email).
   - Optional: set Payment Link metadata `state` (TX/CA/FL/GA) and `tax_year`.
2. Add a webhook endpoint → `https://one.taxdrop.com/api/stripe-webhook`,
   event `checkout.session.completed`. Copy its signing secret → `STRIPE_WEBHOOK_SECRET`.

## Go-live checklist

1. Set all env vars above **except** `ACCESS_CONTROL_ENABLED`.
2. Deploy via `taxdrop/deploy.sh`.
3. Smoke test with the flag still off (everything works as today).
4. Mint a test link: complete a Stripe test-mode checkout → confirm the email arrives →
   open `/r/<token>` → run one address → confirm a 2nd different address is blocked (403).
5. Set `ACCESS_CONTROL_ENABLED=1`, redeploy.
6. Confirm: `/` redirects to `/sup`; sup password grants access; a customer link still works.

## Customer lock model

- One purchase = one link = one property/tax-year (matches $129 pricing).
- The property is **not** in the link; the first address the customer runs
  locks it (`one_entitlements.property_key`). Later runs must match → they can
  regenerate their report but can't switch properties or share for new ones.
- Credits / multi-property packs are a future phase, not built here.
