import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * TaxDrop — Assessor Evidence Analyzer · AI reader
 * ================================================
 * POST /api/evidence-read  → { prompt, images? } → OpenRouter (Sonnet) → { ok, text }
 *
 * Thin, stateless proxy to OpenRouter. The frontend (extract.js) builds the
 * full schema prompt + CAD evidence text; the model returns raw JSON text, which
 * the browser parses and feeds to the deterministic analysis engine
 * (analyzer.js). Every dollar figure the user sees is computed in that auditable
 * client code — the model only reads messy CAD formats into structure.
 *
 * TWO READ MODES:
 *   - text  : { prompt }            → schema prompt + flattened PDF text
 *   - vision: { prompt, images[] }  → schema prompt + page images (data URLs)
 * The vision mode is the client's fallback when text extraction is weak —
 * scanned packets and rotated/landscape equity grids (e.g. Victoria CAD)
 * flatten to garbled text, but read reliably as images. Same model, same
 * schema; only the message payload differs.
 *
 * If OPENROUTER_API_KEY is unset (or the call fails), this returns a non-200 and
 * the frontend silently falls back to its rule-based parser.
 */

// Vision page reads can run long; give the function room (Vercel default is short).
export const config = { maxDuration: 60 };

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.EVIDENCE_READER_MODEL || 'anthropic/claude-sonnet-4.5';

// Output budget: the prompt asks for minified JSON capped at 12 comps, now with
// richer per-comp fields ($/sqft, net adjustment, year, condition). ~3k tokens
// leaves headroom so the JSON never truncates mid-array. Vision reads get more
// headroom — they tend to surface more comps off the raw grid.
const MAX_TOKENS = 3072;
const MAX_TOKENS_VISION = 4096;

// Input guard: extract.js already trims to ~45k chars; cap again server-side.
const MAX_PROMPT_CHARS = 60000;

// Vision guards: cap page count and total payload so a huge packet can't blow
// the request size or the upstream image budget.
const MAX_IMAGES = 12;
const MAX_IMAGE_BYTES = 18 * 1024 * 1024; // total across all page images

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  if (!OPENROUTER_API_KEY) {
    // Frontend treats any non-ok as "AI unavailable" and uses its fallback.
    return res.status(503).json({ ok: false, error: 'OPENROUTER_API_KEY not configured' });
  }

  let prompt: unknown;
  let images: unknown;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    prompt = body?.prompt;
    images = body?.images;
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid JSON body' });
  }

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ ok: false, error: "missing 'prompt'" });
  }
  if (prompt.length > MAX_PROMPT_CHARS) prompt = prompt.slice(0, MAX_PROMPT_CHARS);

  // Validate/sanitize the optional vision payload: data-URL image strings only,
  // capped in count and total size. Anything invalid → treat as a text read.
  const pageImages: string[] = [];
  if (Array.isArray(images)) {
    let total = 0;
    for (const img of images) {
      if (typeof img !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/.test(img)) continue;
      total += img.length;
      if (total > MAX_IMAGE_BYTES) break;
      pageImages.push(img);
      if (pageImages.length >= MAX_IMAGES) break;
    }
  }
  const isVision = pageImages.length > 0;

  // text read → plain string content; vision read → multimodal content array.
  const content: unknown = isVision
    ? [
        { type: 'text', text: prompt },
        ...pageImages.map((url) => ({ type: 'image_url', image_url: { url } })),
      ]
    : prompt;

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), isVision ? 58000 : 45000);
    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://taxdrop.com',
        'X-Title': 'TaxDrop Evidence Analyzer',
      },
      body: JSON.stringify({
        model: MODEL,
        // Deterministic extraction — no creativity wanted.
        temperature: 0,
        max_tokens: isVision ? MAX_TOKENS_VISION : MAX_TOKENS,
        messages: [{ role: 'user', content }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      return res.status(502).json({ ok: false, error: `reader upstream ${upstream.status}`, detail: detail.slice(0, 500) });
    }
    const data = await upstream.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      return res.status(502).json({ ok: false, error: 'reader returned no text' });
    }
    return res.status(200).json({ ok: true, text, model: MODEL, mode: isVision ? 'vision' : 'text', pages: pageImages.length, read_ms: Date.now() - start });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(502).json({ ok: false, error: `reader failed: ${msg}` });
  }
}
