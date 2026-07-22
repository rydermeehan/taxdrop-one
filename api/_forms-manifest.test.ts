import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCatalog } from './_forms-catalog.js';
import { CA_COUNTIES } from './_forms-ca.js';
import { GA_COUNTIES } from './_forms-ga.js';
import { TX_CADS } from './_tx-cads.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** Every (state, county) pair the catalog can be asked about. */
function allRecords() {
  const out = [];
  for (const c of Object.keys(TX_CADS)) out.push(resolveCatalog({ us_state: 'TX', county: c }));
  for (const c of Object.keys(GA_COUNTIES)) out.push(resolveCatalog({ us_state: 'GA', county: c }));
  for (const c of Object.keys(CA_COUNTIES)) out.push(resolveCatalog({ us_state: 'CA', county: c }));
  out.push(resolveCatalog({ us_state: 'FL', county: 'broward' }));
  // Fallback records too — they must not point at a missing file either.
  out.push(resolveCatalog({ us_state: 'TX', county: 'nosuchcounty' }));
  out.push(resolveCatalog({ us_state: 'GA', county: 'nosuchcounty' }));
  out.push(resolveCatalog({ us_state: 'CA', county: 'nosuchcounty' }));
  return out;
}

describe('forms manifest', () => {
  // Guard the guard: the tests below all skip records without a pdfPath, so a
  // catalog that stopped emitting paths would make them pass vacuously.
  it('the catalog emits the expected number of PDF-backed records', () => {
    const withPdf = allRecords().filter((r) => r.pdfPath);
    // 9: both TX forms (50-132 for >=120k counties, 50-132-A for <120k) plus the
    // other states' single forms.
    expect(new Set(withPdf.map((r) => r.pdfPath)).size).toBe(9);
  });

  it('every pdfPath in the catalog exists on disk', () => {
    const missing = allRecords()
      .filter((r) => r.pdfPath)
      .map((r) => r.pdfPath as string)
      .filter((p) => !existsSync(resolve(ROOT, 'public' + p)));
    expect([...new Set(missing)]).toEqual([]);
  });

  it('every mirrored file is a real PDF, not a saved error page', () => {
    const bad: string[] = [];
    for (const r of allRecords()) {
      if (!r.pdfPath) continue;
      const abs = resolve(ROOT, 'public' + r.pdfPath);
      if (!existsSync(abs)) continue;
      const buf = readFileSync(abs);
      if (buf.subarray(0, 5).toString() !== '%PDF-' || buf.length < 20_000) bad.push(r.pdfPath);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('every record carries a parseable verifiedOn date', () => {
    for (const r of allRecords()) {
      expect(Number.isNaN(Date.parse(r.verifiedOn))).toBe(false);
    }
  });

  it('CA records are re-verified every 6 months, others every 12', () => {
    const now = Date.now();
    const stale = allRecords()
      .filter((r) => {
        const ageMonths = (now - Date.parse(r.verifiedOn)) / MONTH_MS;
        return ageMonths > (r.state === 'CA' ? 6 : 12);
      })
      .map((r) => `${r.state}/${r.authority} (verified ${r.verifiedOn})`);
    expect([...new Set(stale)]).toEqual([]);
  });

  it('never publishes an unverified portal URL', () => {
    // Chatham GA and SF CA had no confirmable portal at research time.
    expect(resolveCatalog({ us_state: 'GA', county: 'chatham' }).filing.efileUrl).toBeNull();
    expect(resolveCatalog({ us_state: 'CA', county: 'sanfrancisco' }).filing.efileUrl).toBeNull();
  });
});
