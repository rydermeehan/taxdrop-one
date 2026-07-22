import type { VercelRequest, VercelResponse } from '@vercel/node';
import { gate, lookupSubject, CMP_API_KEY, CMP_ENDPOINT } from './_forms-common.js';
import { resolveFormWithState, isReady } from './_forms-registry.js';

// CraftMyPDF render can take a few seconds; give it headroom.
export const config = { maxDuration: 30 };

const ACCESS_ON = /^(1|true|yes)$/i.test(process.env.ACCESS_CONTROL_ENABLED || '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  // Entitlement gate (no-op unless ACCESS_CONTROL_ENABLED). Fail closed so a DB
  // hiccup can't hand out an off-property form.
  try {
    const g = await gate(req);
    if (!g.ok) return res.status(g.status || 403).json(g.body || { error: 'forbidden' });
  } catch (e: unknown) {
    if (ACCESS_ON) {
      return res.status(503).json({ error: 'access_check_failed', detail: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  // Pre-fill is dark for launch: step 2 serves the blank official form from the
  // catalog instead. Kept intact so TX pre-fill can be re-enabled by setting
  // FORMS_PREFILL_ENABLED=1. Placed AFTER the entitlement gate so an unauthorized
  // caller still gets 402/403 rather than learning the feature exists.
  if (!/^(1|true|yes)$/i.test(process.env.FORMS_PREFILL_ENABLED || '')) {
    return res.status(404).json({ error: 'prefill_disabled' });
  }

  if (!CMP_API_KEY) {
    return res.status(503).json({ error: 'pdf_not_configured', message: 'CraftMyPDF key is not set.' });
  }

  const body = (req.body || {}) as { address?: string; inputs?: Record<string, string>; owner?: Record<string, string> };
  const address = body.address;
  const inputs = body.inputs || body.owner || {}; // legacy `owner` alias for one release
  if (!address) {
    return res.status(400).json({ error: 'address_required', message: 'An address is required to generate a form.' });
  }

  // 1) Pull the live subject (account #, values, county, state) from the engine.
  let subject: any;
  try {
    subject = await lookupSubject(address);
  } catch (e) {
    return res.status(502).json({ error: 'lookup_failed', detail: e instanceof Error ? e.message : String(e) });
  }
  if (!subject) return res.status(404).json({ error: 'property_not_found' });

  // 2) Resolve the jurisdiction's form. Pending / unknown → no filled form yet.
  const { state, form } = resolveFormWithState(subject);
  if (!isReady(form)) {
    return res.status(400).json({ error: 'form_not_available', message: 'A pre-filled form is not available for this property yet.', state, county: subject.county });
  }

  // 3) Validate the caller supplied every required intake field.
  const missing = form.intakeFields
    .filter((f) => f.required && !String(inputs[f.key] || '').trim())
    .map((f) => f.key);
  if (missing.length) {
    return res.status(400).json({ error: 'missing_fields', message: 'Missing required fields: ' + missing.join(', '), missing });
  }

  // 4) Render the filled form via CraftMyPDF.
  try {
    const cmp = await fetch(CMP_ENDPOINT, {
      method: 'POST',
      headers: { 'X-API-KEY': CMP_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: form.templateId(),
        export_type: 'json',   // returns a hosted file URL
        expiration: 60,        // minutes
        output_file: form.outputFileName,
        data: form.buildPayload(subject, inputs),
      }),
    });
    const out = await cmp.json();
    if (!cmp.ok) return res.status(502).json({ error: 'pdf_render_failed', detail: out });
    return res.status(200).json({ ok: true, file: out.file, state, county: subject.county, form: form.form });
  } catch (e) {
    return res.status(502).json({ error: 'pdf_render_failed', detail: e instanceof Error ? e.message : String(e) });
  }
}
