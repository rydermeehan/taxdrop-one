import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { signToken } from './_token.js';

// Stripe webhook → mint a property-locked TaxDrop One link and email it.
//
// Flow: customer pays via a Stripe Payment Link (collects email only) →
// Stripe POSTs `checkout.session.completed` here → we mint an HMAC token
// (no property yet; locked on first report run) and Sendgrid emails the
// unique link. The link's property lock is enforced in cad-proxy.ts.
//
// Idempotent: the token id (jti) is the Stripe session id, so Stripe's
// automatic retries regenerate the *same* link instead of duplicates.
//
// Raw body is required for signature verification. @vercel/node buffers the
// request and then restores the stream (restoreBody), so reading req as a
// stream below returns the exact original bytes — re-stringifying the parsed
// JSON would change byte order and break the signature.

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const TOKEN_SECRET = process.env.TOKEN_SECRET || '';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_FROM = process.env.SENDGRID_FROM || 'reports@taxdrop.com';
const LINK_BASE = process.env.ONE_LINK_BASE || 'https://one.taxdrop.com';
const DEFAULT_TAX_YEAR = Number(process.env.ONE_DEFAULT_TAX_YEAR || '2026');
const LINK_TTL_DAYS = 90;

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

// Verify Stripe's `Stripe-Signature` header (scheme v1) over the raw body.
// header looks like: t=1690000000,v1=<hex>,v0=<hex>
function verifyStripeSignature(raw: Buffer, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    })
  );
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${raw.toString('utf8')}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function sendLinkEmail(to: string, link: string, state?: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) return false;
  const protestWord = state === 'CA' ? 'appeal' : 'protest';
  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: SENDGRID_FROM, name: 'TaxDrop One' },
      subject: 'Start your TaxDrop One report',
      content: [{
        type: 'text/html',
        value:
          `<p>Thanks for your purchase. Here's your private link to get started on your ${protestWord}.</p>` +
          `<p>Open it, confirm your property, and upload your county evidence packet. A TaxDrop tax expert reviews every report before it's sent — we'll email your finished report, typically within <strong>24&ndash;48 hours, Monday&ndash;Friday</strong>.</p>` +
          `<p><a href="${link}" style="background:#0C593E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Start your ${protestWord}</a></p>` +
          `<p>Or open this link: <br>${link}</p>` +
          `<p style="color:#5C666F;font-size:13px">This link covers one property. The first address you submit locks it in.</p>`,
      }],
    }),
  });
  return resp.ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!WEBHOOK_SECRET || !TOKEN_SECRET) {
    return res.status(503).json({ error: 'not_configured' });
  }

  const sig = req.headers['stripe-signature'];
  if (typeof sig !== 'string') return res.status(400).json({ error: 'missing_signature' });

  let raw: Buffer;
  try {
    raw = await readRawBody(req);
  } catch {
    return res.status(400).json({ error: 'unreadable_body' });
  }

  if (!verifyStripeSignature(raw, sig, WEBHOOK_SECRET)) {
    return res.status(400).json({ error: 'invalid_signature' });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }

  // Only act on completed checkouts; ack everything else so Stripe stops.
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  const session = (event.data?.object || {}) as Record<string, unknown>;
  const jti = String(session.id || '');
  const details = (session.customer_details || {}) as Record<string, unknown>;
  const email = String(details.email || session.customer_email || '');
  const metadata = (session.metadata || {}) as Record<string, unknown>;
  const state = metadata.state ? String(metadata.state).toUpperCase() : undefined;
  const taxYear = metadata.tax_year ? Number(metadata.tax_year) : DEFAULT_TAX_YEAR;

  if (!jti || !email) {
    // Nothing to mint/deliver — ack so Stripe doesn't hammer retries.
    return res.status(200).json({ received: true, skipped: 'missing id or email' });
  }

  const exp = Math.floor(Date.now() / 1000) + LINK_TTL_DAYS * 86400;
  const token = signToken({ jti, taxYear, state, exp }, TOKEN_SECRET);
  const link = `${LINK_BASE}/r/${token}`;

  const sent = await sendLinkEmail(email, link, state);
  if (!sent) {
    // Return 500 so Stripe retries (jti is the session id → same link next time).
    // Surfaces a Sendgrid/config problem instead of silently dropping the link.
    return res.status(500).json({ error: 'email_failed', message: 'Token minted but email not sent.' });
  }

  return res.status(200).json({ received: true, delivered: true });
}
