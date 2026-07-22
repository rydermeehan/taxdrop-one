import type { VercelRequest, VercelResponse } from '@vercel/node';
import { gate, lookupSubject } from './_forms-common.js';
import { resolveFormWithState, isReady } from './_forms-registry.js';
import { lookupCad } from './_tx-cads.js';
import { resolveCatalog } from './_forms-catalog.js';
import { isValidSupCookie, parseCookies, SUP_COOKIE } from './_token.js';

export const config = { maxDuration: 30 };

const ACCESS_ON = /^(1|true|yes)$/i.test(process.env.ACCESS_CONTROL_ENABLED || '');
const SUP_PASSWORD = process.env.SUP_PASSWORD || '';

// The catalog + form resolvers only need county + state (+ account) off the
// subject — not a live re-lookup. The agent review console already holds a
// resolved subject in the stored draft, so it passes it directly; this avoids
// re-resolving a bare street address like "6101 LAKE SHORE DR" (no city/state),
// which the upstream engine can't geocode → the old "no form" bug. Only trusted
// for agents (sup cookie); customer links still resolve from their address.
function hintSubject(raw: unknown): any | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const county = s.county || s.county_name;
  const state = s.us_state || s.state || s.site_state;
  if (!county || !state) return null;
  return { ...s, county: String(county).toLowerCase().trim() };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  // Same fail-closed entitlement gate as generate-forms — this only ever renders
  // inside the paid flow.
  try {
    const g = await gate(req);
    if (!g.ok) return res.status(g.status || 403).json(g.body || { error: 'forbidden' });
  } catch (e: unknown) {
    if (ACCESS_ON) {
      return res.status(503).json({ error: 'access_check_failed', detail: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  const body = (req.body || {}) as { address?: string; subject?: unknown };
  const address = body.address;

  // Agents may pass the stored draft's subject to skip the live lookup.
  const isSup = isValidSupCookie(parseCookies(req.headers?.cookie)[SUP_COOKIE], SUP_PASSWORD);
  const hint = isSup ? hintSubject(body.subject) : null;

  if (!address && !hint) {
    return res.status(400).json({ error: 'address_required', message: 'An address (or, for agents, a subject) is required.' });
  }

  let subject: any = hint;
  if (!subject) {
    try {
      subject = await lookupSubject(address as string);
    } catch (e) {
      return res.status(502).json({ error: 'lookup_failed', detail: e instanceof Error ? e.message : String(e) });
    }
  }
  if (!subject) return res.status(404).json({ error: 'property_not_found' });

  // County filing metadata (where to file the protest online). Curated in
  // _tx-cads.ts; null when the county isn't in the registry so the client falls
  // back to a search link rather than a guessed URL. TX-only today — lookupCad
  // returns null for CA/GA/FL counties, which is the correct "no portal" signal.
  const cad = lookupCad(subject.county);
  const filing = cad
    ? {
        cadName: cad.cadName,
        efileUrl: cad.fileBy.efileUrl || null,
        efileNote: cad.fileBy.efileNote || null,
        efileGuideUrl: cad.fileBy.efileGuideUrl || null,
        website: cad.fileBy.website || null,
      }
    : null;

  // The blank-form catalog is the launch path: correct official form + filing
  // destination + deadline + fee for this jurisdiction. Always present.
  const catalog = resolveCatalog(subject);
  const account = subject.account || subject.account_number || subject.parcel_id || null;

  // The pre-fill router still answers alongside it, so re-enabling
  // FORMS_PREFILL_ENABLED needs no endpoint change.
  const { state, form } = resolveFormWithState(subject);
  if (isReady(form)) {
    return res.status(200).json({
      available: true,
      state,
      county: subject.county,
      filing,
      catalog,
      account,
      form: form.form,
      outputFileName: form.outputFileName,
      fields: form.intakeFields,
    });
  }
  const formName = form && 'form' in form ? form.form : null;
  return res.status(200).json({
    available: false,
    state,
    county: subject.county,
    filing,
    catalog,
    account,
    form: formName,
  });
}
