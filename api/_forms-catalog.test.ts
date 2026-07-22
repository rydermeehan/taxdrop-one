import { describe, it, expect } from 'vitest';
import { resolveCatalog, catalogStateId } from './_forms-catalog.js';
import { TX_CADS } from './_tx-cads.js';
import { caDeadline, CA_COUNTIES } from './_forms-ca.js';

describe('catalogStateId', () => {
  it('reads the state off the subject', () => {
    expect(catalogStateId({ us_state: 'GA' })).toBe('GA');
    expect(catalogStateId({ state: 'California' })).toBe('CA');
    expect(catalogStateId({ site_state: 'FLORIDA' })).toBe('FL');
  });
  it('prefers an explicit hint over the subject', () => {
    expect(catalogStateId({ us_state: 'TX' }, 'GA')).toBe('GA');
  });
  it('defaults to TX so live TX is unaffected', () => {
    expect(catalogStateId({})).toBe('TX');
  });
});

describe('TX', () => {
  it('serves the mirrored 50-132 with the county CAD as authority', () => {
    const r = resolveCatalog({ us_state: 'TX', county: 'fortbend' });
    expect(r.state).toBe('TX');
    expect(r.form).toBe('Form 50-132');
    expect(r.formTitle).toBe('Notice of Protest');
    expect(r.delivery).toBe('mirror');
    expect(r.pdfPath).toBe('/forms/tx-50-132.pdf');
    expect(r.coverage).toBe('county');
    expect(r.authority).toBe('Fort Bend Central Appraisal District');
    expect(r.fee).toBeNull();
    expect(r.deadline).toBe('May 15');
  });
  it('normalizes county spelling variants to the same record', () => {
    const a = resolveCatalog({ us_state: 'TX', county: 'Fort Bend' });
    const b = resolveCatalog({ us_state: 'TX', county: 'FORTBEND' });
    expect(a.authority).toBe(b.authority);
    expect(a.filing.website).toBe(b.filing.website);
  });
  it('covers all 254 Texas counties', () => {
    expect(Object.keys(TX_CADS).length).toBe(254);
  });
  it('serves a county whose district name is unverified without guessing one', () => {
    // Andrews: in the Comptroller directory (real address/website/phone) but the
    // directory does not publish the district's legal name, so cadName is null.
    const r = resolveCatalog({ us_state: 'TX', county: 'andrews' });
    expect(r.coverage).toBe('county');
    expect(r.authority).toBe('your appraisal district');
    expect(r.filing.mailTo).toBe('600 N. Main St., Andrews, TX 79714-5207');
    expect(r.filing.website).toBe('https://www.andrewscad.org');
  });
  it('falls back to a state-level record for a county outside the registry', () => {
    // All 254 real counties are now registered, so this needs a non-county.
    const r = resolveCatalog({ us_state: 'TX', county: 'notacounty' });
    expect(r.coverage).toBe('state');
    expect(r.authority).toBe('your appraisal district');
    expect(r.filing.efileUrl).toBeNull();
    expect(r.filing.mailTo).toBeNull();
  });
});

describe('filing.evidenceHowTo (per-county evidence-viewing override)', () => {
  it('carries a bespoke override where one is authored (Dallas)', () => {
    const r = resolveCatalog({ us_state: 'TX', county: 'dallas' });
    expect(r.filing.evidenceHowTo).toBeTruthy();
    expect(r.filing.evidenceHowTo).toMatch(/DCAD|17-digit|Hearing Notice/);
  });
  it('auto-templates a safe line for a portal county with no bespoke text (no fabrication)', () => {
    // Collin has a verified portal (eprotest.collincad.org) but no bespoke text,
    // so it gets the template: district name + portal host + §41.461, nothing invented.
    const r = resolveCatalog({ us_state: 'TX', county: 'collin' });
    expect(r.filing.evidenceHowTo).toContain('Collin Central Appraisal District');
    expect(r.filing.evidenceHowTo).toContain('eprotest.collincad.org');
    expect(r.filing.evidenceHowTo).toContain('§41.461');
    // The template invents no credential mechanics we don't store.
    expect(r.filing.evidenceHowTo).not.toMatch(/\bPIN\b|\d+-digit/);
  });
  it('serves verified bespoke text for the high-volume counties (overrides the template)', () => {
    // Each verified 2026-07-22 against the district's own site.
    const harris = resolveCatalog({ us_state: 'TX', county: 'harris' });
    expect(harris.filing.evidenceHowTo).toContain('iFile number');
    expect(harris.filing.evidenceHowTo).toContain('owners.hcad.org');

    const travis = resolveCatalog({ us_state: 'TX', county: 'travis' });
    expect(travis.filing.evidenceHowTo).toContain('property owner ID');
    expect(travis.filing.evidenceHowTo).toContain('traviscad.org');

    const bexar = resolveCatalog({ us_state: 'TX', county: 'bexar' });
    expect(bexar.filing.evidenceHowTo).toContain('Owner/Agent ID');
    expect(bexar.filing.evidenceHowTo).toContain('Evidence View');
    // efileUrl was corrected from a help-article link to the real portal.
    expect(bexar.filing.efileUrl).toBe('https://bcad.org/online-portal/');

    const tarrant = resolveCatalog({ us_state: 'TX', county: 'tarrant' });
    expect(tarrant.filing.evidenceHowTo).toContain('Online PIN');
    expect(tarrant.filing.evidenceHowTo).toContain('tad.org');
    // efileUrl corrected off the procedures-doc URL (tadqr01) to the real portal.
    expect(tarrant.filing.efileUrl).toBe('https://www.tad.org/account/create');
  });
  it('is null for a TX county with NO verified portal, so the client uses its per-state default', () => {
    // Dawson: in the registry (website + address) but no efileUrl → no portal to
    // point at → no templated line → client falls back to the per-state default.
    const r = resolveCatalog({ us_state: 'TX', county: 'dawson' });
    expect(r.filing.efileUrl).toBeNull();
    expect(r.filing.evidenceHowTo).toBeNull();
  });
  it('covers every TX portal county and no non-portal county', () => {
    // Every county with a verified efileUrl gets a line; every county without one
    // stays null. Locks the "portal ⇔ templated" coverage across all 254.
    let withPortal = 0, templated = 0;
    for (const slug of Object.keys(TX_CADS)) {
      const r = resolveCatalog({ us_state: 'TX', county: slug });
      const hasPortal = !!r.filing.efileUrl;
      if (hasPortal) withPortal++;
      if (r.filing.evidenceHowTo) {
        templated++;
        expect(hasPortal).toBe(true); // never a line without a portal to point at
      }
    }
    expect(templated).toBe(withPortal);
    expect(withPortal).toBeGreaterThanOrEqual(45); // 49 portal counties today
  });
  it('formats portal references as markdown links, not bare inline URLs', () => {
    // Template county: the portal phrase links to the verified efileUrl.
    const collin = resolveCatalog({ us_state: 'TX', county: 'collin' });
    expect(collin.filing.evidenceHowTo).toContain('](https://eprotest.collincad.org');
    // Bespoke county: descriptive words are the anchor, no bare trailing URL.
    const dallas = resolveCatalog({ us_state: 'TX', county: 'dallas' });
    expect(dallas.filing.evidenceHowTo).toContain('[DCAD Online Protest System](https://www.dallascad.org/SearchAcct.aspx)');
    expect(dallas.filing.evidenceHowTo).not.toMatch(/System at www\.dallascad\.org/);
  });
  it('exposes the field (null default) on every state record', () => {
    for (const s of [
      { us_state: 'TX', county: 'harris' },
      { us_state: 'CA', county: 'losangeles' },
      { us_state: 'GA', county: 'fulton' },
      { us_state: 'FL', county: 'broward' },
    ]) {
      const r = resolveCatalog(s);
      expect(r.filing).toHaveProperty('evidenceHowTo');
    }
  });
});

describe('TX population tiering', () => {
  it('serves 50-132 to a county over 120k', () => {
    const r = resolveCatalog({ us_state: 'TX', county: 'harris' });
    expect(r.form).toBe('Form 50-132');
    expect(r.pdfPath).toBe('/forms/tx-50-132.pdf');
  });
  it('serves 50-132-A to a county under 120k', () => {
    const r = resolveCatalog({ us_state: 'TX', county: 'anderson' });
    expect(r.form).toBe('Form 50-132-A');
    expect(r.pdfPath).toBe('/forms/tx-50-132-a.pdf');
  });
  it('tiers the smallest county correctly', () => {
    const r = resolveCatalog({ us_state: 'TX', county: 'loving' });
    expect(r.form).toBe('Form 50-132-A'); // Loving is tiny
    expect(r.coverage).toBe('county'); // ...and now in the 254-county registry
  });
  it('tiers correctly even for a county outside the filing registry', () => {
    const r = resolveCatalog({ us_state: 'TX', county: 'notacounty' });
    expect(r.coverage).toBe('state');
    expect(r.form).toBe('Form 50-132-A'); // unknown ⇒ under-120k form
  });
});

describe('GA', () => {
  it('serves statewide PT-311A with per-county filing detail', () => {
    const r = resolveCatalog({ us_state: 'GA', county: 'fulton' });
    expect(r.form).toBe('PT-311A');
    expect(r.delivery).toBe('mirror');
    expect(r.pdfPath).toBe('/forms/ga-pt-311a.pdf');
    expect(r.coverage).toBe('county');
    expect(r.authority).toBe('Fulton County Board of Assessors');
    expect(r.filing.mailTo).toContain('Suite 1200');
    expect(r.deadline).toBe('45 days after your assessment notice date');
    expect(r.fee).toBeNull();
    expect(r.notes.join(' ')).toContain('letter of appeal');
  });
  it('marks Chatham paper-only with no guessed portal', () => {
    const r = resolveCatalog({ us_state: 'GA', county: 'chatham' });
    expect(r.paperOnly).toBe(true);
    expect(r.filing.efileUrl).toBeNull();
  });
  it('still serves PT-311A for an uncovered GA county', () => {
    const r = resolveCatalog({ us_state: 'GA', county: 'cobb' });
    expect(r.coverage).toBe('state');
    expect(r.pdfPath).toBe('/forms/ga-pt-311a.pdf');
  });
});

describe('FL', () => {
  it('serves statewide DR-486 with both deadline rules', () => {
    const r = resolveCatalog({ us_state: 'FL', county: 'broward' });
    expect(r.form).toBe('DR-486');
    expect(r.pdfPath).toBe('/forms/fl-dr-486.pdf');
    expect(r.coverage).toBe('state'); // FL is statewide by statute — never per-county
    expect(r.deadline).toBe('25 days after your TRIM notice');
    expect(r.deadlineAlt).toBe('30 days after a denial of exemption or classification');
    expect(r.fee).toContain('$15');
    expect(r.filing.website).toBe('https://floridarevenue.com/property/Pages/LocalOfficials.aspx');
  });
});

describe('CA', () => {
  it('routes Los Angeles to its own AAB-100, official-URL primary', () => {
    const r = resolveCatalog({ us_state: 'CA', county: 'losangeles' });
    expect(r.state).toBe('CA');
    expect(r.form).toBe('AAB-100');
    expect(r.delivery).toBe('official');
    expect(r.coverage).toBe('county');
    expect(r.authority).toBe('Assessment Appeals Board, County of Los Angeles');
    expect(r.deadline).toBe('July 2 – November 30');
    expect(r.fee).toBe('$46');
    expect(r.filing.mailTo).toContain('Room B4');
  });

  it('gives the two Sep-15 counties the right deadline', () => {
    expect(resolveCatalog({ us_state: 'CA', county: 'sanfrancisco' }).deadline).toBe('July 2 – September 15');
    expect(resolveCatalog({ us_state: 'CA', county: 'alameda' }).deadline).toBe('July 2 – September 15');
  });

  it('gives the three Nov-30 counties the right deadline', () => {
    expect(resolveCatalog({ us_state: 'CA', county: 'sacramento' }).deadline).toBe('July 2 – November 30');
    expect(resolveCatalog({ us_state: 'CA', county: 'contracosta' }).deadline).toBe('July 2 – November 30');
    expect(resolveCatalog({ us_state: 'CA', county: 'losangeles' }).deadline).toBe('July 2 – November 30');
  });

  it('carries each county fee', () => {
    expect(resolveCatalog({ us_state: 'CA', county: 'sanfrancisco' }).fee).toBe('$120');
    expect(resolveCatalog({ us_state: 'CA', county: 'alameda' }).fee).toBe('$50');
    expect(resolveCatalog({ us_state: 'CA', county: 'contracosta' }).fee).toBe('$40');
    expect(resolveCatalog({ us_state: 'CA', county: 'sacramento' }).fee).toBe('$30');
  });

  it('marks Sacramento paper-only with no portal', () => {
    const r = resolveCatalog({ us_state: 'CA', county: 'sacramento' });
    expect(r.paperOnly).toBe(true);
    expect(r.filing.efileUrl).toBeNull();
  });

  it('does NOT publish an SF portal URL (unpublished until 2026-07-22)', () => {
    expect(resolveCatalog({ us_state: 'CA', county: 'sanfrancisco' }).filing.efileUrl).toBeNull();
  });

  it('warns that Alameda voids prior form revisions', () => {
    const r = resolveCatalog({ us_state: 'CA', county: 'alameda' });
    expect(r.notes.join(' ')).toMatch(/current version|previous version|invalid/i);
  });

  it('routes a newly added county to its own official application', () => {
    const r = resolveCatalog({ us_state: 'CA', county: 'orange' });
    expect(r.coverage).toBe('county');
    expect(r.delivery).toBe('official');
    expect(r.form).toBe('BOE-305-AH');
    expect(r.fee).toBeNull(); // Orange charges no filing fee
    expect(r.deadline).toBe('July 2 – November 30');
    expect(r.officialUrl).toContain('cob.oc.gov');
  });

  it('certifies a deadline for every county via caDeadline', () => {
    expect(caDeadline('ventura')).toBe('July 2 – September 15');
    expect(caDeadline('kern')).toBe('July 2 – November 30');
  });

  it('covers 53 counties', () => {
    expect(Object.keys(CA_COUNTIES).length).toBe(53);
  });

  it('ships Marin with the re-verified filing address', () => {
    const r = resolveCatalog({ us_state: 'CA', county: 'marin' });
    expect(r.coverage).toBe('county');
    expect(r.filing.mailTo).toContain('Ste 329');
  });

  it('gives Placer and Sonoma the correct re-verified deadlines', () => {
    expect(resolveCatalog({ us_state: 'CA', county: 'placer' }).deadline).toBe('July 2 – September 15');
    expect(resolveCatalog({ us_state: 'CA', county: 'sonoma' }).deadline).toBe('July 2 – November 30');
  });

  it('carries both fee tiers for Santa Barbara', () => {
    const r = resolveCatalog({ us_state: 'CA', county: 'santabarbara' });
    expect(r.fee).toContain('$65 per parcel');
    expect(r.fee).toContain('$1,000');
  });

  it('serves NO pdf for an uncovered CA county', () => {
    const r = resolveCatalog({ us_state: 'CA', county: 'notacounty' });
    expect(r.coverage).toBe('state');
    expect(r.pdfPath).toBeNull(); // no safe generic CA form exists
    expect(r.notes.join(' ')).toMatch(/own appeal application/i);
  });

  it('falls back for Santa Clara but still gives it the certified deadline', () => {
    // Every Santa Clara host is Cloudflare-blocked, so its form/fee/address are
    // unverified and deliberately unshipped — but the BOE deadline is known.
    const r = resolveCatalog({ us_state: 'CA', county: 'santaclara' });
    expect(r.coverage).toBe('state');
    expect(r.pdfPath).toBeNull();
    expect(r.deadline).toBe('July 2 – September 15');
  });
});
