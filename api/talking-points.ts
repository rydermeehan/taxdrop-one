import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidSupCookie, parseCookies, SUP_COOKIE } from './_token.js';
import { getReview } from './_reviews.js';
import { applyOverrides } from './_overrides.js';

// Hearing talking-points generator for the pro-agent review workspace.
// Sup-gated. POST { jti } → loads the (override-applied) case → asks OpenRouter
// for concise ARB-hearing talking points → returns { text }.
//
// Reuses the OpenRouter pattern from evidence-read.ts. If OPENROUTER_API_KEY is
// unset the endpoint returns 503 and the UI shows a "not configured" note.

export const config = { maxDuration: 60 };

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.TALKING_POINTS_MODEL || 'anthropic/claude-sonnet-4.5';
const SUP_PASSWORD = process.env.SUP_PASSWORD || '';

/* eslint-disable @typescript-eslint/no-explicit-any */
function caseSummary(draft: any): string {
  const r = (draft && draft.result) || {};
  const s = (draft && draft.our && draft.our.subject) || {};
  const comps = ((draft && draft.our && draft.our.comps) || []).slice(0, 12).map((c: any) => ({
    address: c.full_address || c.site_address || c.address,
    market_value: c.total_market,
    living_sqft: c.living_sqft,
    year_built: c.year_built,
  }));
  return JSON.stringify({
    address: r.address || s.site_address,
    county: s.county_name || s.county,
    state: r.jurisdiction?.stateName || 'Texas',
    proceeding: r.jurisdiction?.proceeding || 'protest',
    authority: r.jurisdiction?.authority,
    review_body: r.jurisdiction?.boardLong,
    statute: r.jurisdiction?.statute,
    noticed_value: r.notice,
    recommended_value: r.target,
    reduction: r.reduction,
    pct_reduction: r.pct,
    est_tax_saved: r.taxSaved,
    subject: { living_sqft: s.living_sqft, year_built: s.year_built, land_value: s.land_value, improvement_value: s.improvement_value },
    strategy: r.tier,
    draft_rationale: r.rationale,
    comps,
  }, null, 2);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const cookies = parseCookies(req.headers.cookie);
  if (!isValidSupCookie(cookies[SUP_COOKIE], SUP_PASSWORD)) {
    return res.status(403).json({ error: 'sup_required', message: 'Reviewer login required.' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!OPENROUTER_API_KEY) return res.status(503).json({ error: 'not_configured', message: 'OPENROUTER_API_KEY not set.' });

  const jti = String((req.body || {}).jti || '').trim();
  if (!jti) return res.status(400).json({ error: 'jti_required' });

  try {
    const row = await getReview(jti);
    if (!row || !row.draft) return res.status(404).json({ error: 'not_found', message: 'No draft to work from.' });
    const draft = applyOverrides(row.draft, row.overrides);

    const prompt =
      'You are an expert property-tax agent preparing to represent a homeowner at their ' +
      'appraisal hearing. Using ONLY the case data below, write tight, practical hearing ' +
      'talking points the agent can glance at during the informal and the board hearing. ' +
      'Use short markdown sections with bullets:\n' +
      '1. Opening ask (one sentence stating the requested value).\n' +
      '2. The value argument (why the noticed value is too high; the methodology in plain terms).\n' +
      '3. Best comparables to cite (2-4, with the one-line reason each supports the ask).\n' +
      '4. Likely appraiser pushback and a crisp rebuttal for each.\n' +
      '5. Fallback position (the least reduction to accept before walking).\n' +
      'Be concrete and cite the actual numbers. Do not invent facts not in the data. ' +
      'Keep it under ~400 words.\n\nCASE DATA:\n' + caseSummary(draft);

    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      return res.status(502).json({ error: 'upstream_failed', detail: detail.slice(0, 300) });
    }
    const data = await upstream.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return res.status(200).json({ ok: true, text, model: MODEL });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'generation failed';
    return res.status(500).json({ error: 'generation_failed', detail: msg });
  }
}
