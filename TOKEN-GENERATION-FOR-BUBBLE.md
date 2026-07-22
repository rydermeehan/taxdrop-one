# Generating TaxDrop One report tokens in Bubble

This is everything Tom needs to mint valid `/r/<token>` links from the Bubble app.
The token is a stateless, self-verifying HMAC string — Bubble signs it, the
video-studio API (`one.taxdrop.com`) verifies it. Nothing is stored server-side
except which property a token later claims.

Reference implementation: `api/_token.ts` (`signToken`).

---

## The secret

Set in Vercel (project **video-studio**) as `TOKEN_SECRET`. Rotated 2026-06-29.

```
TOKEN_SECRET = ff4e0c0d32074d4f242b0309ed12ad08f24179c3453de1c7bd4a8e9f4e1adeab
```

- Treat the secret as the **raw UTF-8 string** above (do NOT hex-decode it before
  using it as the HMAC key).
- Store it in Bubble as a secret/private API key, never client-side.
- If it's ever rotated again, both Vercel and Bubble must be updated together.

---

## Token format

```
token = base64url( JSON.stringify(payload) )  +  "."  +  base64url( HMAC_SHA256(TOKEN_SECRET, body) )
```

where `body` is the left-hand base64url string (the part before the `.`).

**base64url** = standard base64, then:
- `+` → `-`
- `/` → `_`
- strip all trailing `=` padding

**HMAC** = HMAC-SHA256, key = the raw `TOKEN_SECRET` string, message = the `body`
string (the base64url-encoded JSON, NOT the raw JSON). The digest is then
base64url-encoded the same way.

---

## Payload fields

```json
{
  "jti": "cs_test_a1b2c3...",   // REQUIRED string — unique per purchase. Use the Stripe checkout/session id, or a random UUID. This is the property-lock key.
  "taxYear": 2026,               // REQUIRED number — tax year the report covers
  "state": "TX",                 // OPTIONAL "TX" | "CA" | "FL" | "GA" — loads the right flow; defaults are TX-friendly
  "exp": 1782777223              // REQUIRED number — expiry as Unix SECONDS (not ms). e.g. now + 90 days
}
```

Notes:
- `jti` is what locks the link to one property on first report generation
  ("first use wins"). One purchase = one `jti` = one property. Make it unique
  per checkout.
- `exp` must be Unix **seconds**. The API rejects expired tokens. Pick a window
  that comfortably outlives the customer's expected usage (e.g. 90 days).

---

## Building it in Bubble

Bubble has no native HMAC action, so use one of:

1. **A tiny Bubble Backend Workflow (API Workflow) "server script" plugin** that
   runs the snippet below, or
2. **The Toolbox plugin's "Run JavaScript"** (server-side) action, or
3. A one-line call out to any serverless function you already control.

Reference snippet (Node.js — identical to what the API verifies against):

```js
const crypto = require('crypto');

function b64url(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signToken(payload, secret) {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig  = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

// usage:
const token = signToken({
  jti: stripeSessionId,                 // unique per purchase
  taxYear: 2026,
  state: 'TX',
  exp: Math.floor(Date.now() / 1000) + 90 * 24 * 3600,
}, process.env.TOKEN_SECRET);

// Append the purchased property address so the page pre-fills it and hides the
// search bar (see "Pre-filling the address" below). URL-encode it.
const link = `https://one.taxdrop.com/r/${token}?address=${encodeURIComponent(propertyAddress)}`;
```

Then redirect/email the customer to that link. The `/r/` page sets a `td_link`
cookie from the token, and every gated API call (`cad-proxy`, `generate-forms`)
verifies it.

---

## Pre-filling the address (no search bar)

So the customer lands on a page already scoped to the property they paid for —
no free-text search, just "upload evidence and continue" — append the address
Bubble captured at checkout as a `?address=` query param on the link (shown
above). The page reads it, pre-fills it, and **locks the field**.

- The address is convenience/UX only. The real one-property guard is the
  server-side entitlement lock in `cad-proxy` ("first report wins" on the
  token's `jti`), so a customer editing `?address=` in the URL still can't run a
  second property on one purchase — they just lose the pre-fill.
- Pass the **full street address incl. city/state/ZIP** if you have it. The
  engine ZIP-resolves whatever it's given, and the lock keys on the normalized
  address the first report POSTs, so a complete address is most reliable.
- `encodeURIComponent` is required (spaces, commas).

---

## Quick sanity check

A token signed with the snippet above was verified live against
`https://one.taxdrop.com/api/cad-proxy?path=/api/counties` on 2026-06-29:
a valid token passes the gate; no token / a tampered token returns `402
access_required`. So if your Bubble output matches the snippet byte-for-byte,
it will verify.

If a token gets rejected, the usual culprits are:
- HMAC keyed over the raw JSON instead of the base64url `body` string
- forgetting to strip `=` padding (or not converting `+`/`/`)
- `exp` in milliseconds instead of seconds
- hex-decoding the secret instead of using it as a raw string
