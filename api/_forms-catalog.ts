import { normCounty, isOver120k } from './_tx-county-population.js';
import { lookupCad } from './_tx-cads.js';
import { GA_FORM, lookupGaCounty } from './_forms-ga.js';
import { FL_FORM } from './_forms-fl.js';
import { CA_FORM_FALLBACK, lookupCaCounty } from './_forms-ca.js';

export type StateId = 'TX' | 'CA' | 'GA' | 'FL';

/** Which URL the UI renders as the primary download button. */
export type Delivery = 'mirror' | 'official';

export interface CatalogRecord {
  state: StateId;
  form: string;
  formTitle: string;
  pdfPath: string | null;      // our mirror; null when we deliberately serve no PDF
  officialUrl: string | null;  // the source we mirrored from
  delivery: Delivery;
  authority: string;
  // efileNote/efileGuideUrl are optional: they only exist for districts whose
  // efileUrl isn't a direct file-your-protest page (e.g. Dallas/uFile drops you
  // on a property search), so the UI can spell out the extra step.
  filing: {
    efileUrl: string | null;
    efileNote?: string | null;
    efileGuideUrl?: string | null;
    website: string | null;
    mailTo: string | null;
    // Bespoke, per-county "how to VIEW the assessor's evidence" text (distinct
    // from efileNote, which is how to FILE). Null for most counties — the client
    // then renders its per-state statutory default (evidenceHowTo(stateId)).
    // Populate only where the mechanics are county-specific enough to be worth
    // spelling out (e.g. Dallas: 17-digit account # + PIN from the Hearing Notice).
    evidenceHowTo?: string | null;
  };
  deadline: string;
  deadlineAlt: string | null;
  fee: string | null;          // null = free to file
  paperOnly: boolean;
  notes: string[];
  verifiedOn: string;
  coverage: 'county' | 'state';
}

export function catalogStateId(subject: any, stateHint?: string): StateId {
  const raw = String(
    stateHint || subject?.us_state || subject?.state || subject?.site_state || ''
  ).trim().toUpperCase();
  if (raw === 'TX' || raw === 'CA' || raw === 'GA' || raw === 'FL') return raw;
  if (/^TEX/.test(raw)) return 'TX';
  if (/^CAL/.test(raw)) return 'CA';
  if (/^GEO/.test(raw)) return 'GA';
  if (/^FLO/.test(raw)) return 'FL';
  return 'TX';
}

// Texas publishes TWO Notice of Protest forms, split at 120,000 county population
// (Tax Code differences: electronic hearing reminders under §41.46(f), separate
// videoconference option under §41.45(b-4), and a Special Panel section). Serving
// the wrong one is a real filing defect, so this branch is not cosmetic.
const TX_FORM_OVER_120K = {
  form: 'Form 50-132',
  formTitle: 'Notice of Protest',
  pdfPath: '/forms/tx-50-132.pdf',
  officialUrl: 'https://comptroller.texas.gov/forms/50-132.pdf',
  deadline: 'May 15',
  verifiedOn: '2026-07-21',
};

const TX_FORM_UNDER_120K = {
  form: 'Form 50-132-A',
  formTitle: 'Notice of Protest',
  pdfPath: '/forms/tx-50-132-a.pdf',
  officialUrl: 'https://comptroller.texas.gov/forms/50-132-a.pdf',
  deadline: 'May 15',
  verifiedOn: '2026-07-21',
};

// Safe, no-fabrication "how to VIEW the district's evidence" line for a TX county
// that has a VERIFIED online protest portal. Interpolates ONLY data we've
// confirmed — the district's legal name and its portal URL — plus the statewide
// §41.461 right (every owner may see the district's evidence ≥14 days before the
// hearing, on request). It deliberately invents NO county-specific credential
// mechanics (account-number format, PIN source): those vary by district and a
// wrong instruction on a filing is a real defect. A county whose mechanics we
// HAVE verified carries a bespoke `fileBy.evidenceHowTo`, which wins over this.
// Counties with no portal return null → the client renders its per-state default.
function txEvidenceHowTo(cad: { cadName: string | null; fileBy: { efileUrl?: string } }): string | null {
  const url = cad.fileBy.efileUrl;
  if (!url) return null;
  const who = cad.cadName || 'your appraisal district';
  // The portal reference is a markdown link — [words](url) — so the client renders
  // the descriptive phrase as the clickable link rather than printing a bare URL.
  return `You're entitled to see the evidence ${who} used to value your property at least 14 days before your hearing (Texas Tax Code §41.461). Once you've filed, you can usually view it in [the district's online protest portal](${url}); if it isn't posted there, ask the district in writing for the evidence tied to your account. Drop whatever they send — cover letter, comps sheet, or the full PDF — here.`;
}

function txRecord(slug: string): CatalogRecord {
  const cad = lookupCad(slug);
  const f = isOver120k(slug) ? TX_FORM_OVER_120K : TX_FORM_UNDER_120K;
  return {
    state: 'TX',
    form: f.form,
    formTitle: f.formTitle,
    pdfPath: f.pdfPath,
    officialUrl: f.officialUrl,
    delivery: 'mirror',
    authority: (cad && cad.cadName) ? cad.cadName : 'your appraisal district',
    filing: {
      efileUrl: (cad && cad.fileBy.efileUrl) || null,
      efileNote: (cad && cad.fileBy.efileNote) || null,
      efileGuideUrl: (cad && cad.fileBy.efileGuideUrl) || null,
      website: (cad && cad.fileBy.website) || null,
      mailTo: (cad && cad.fileBy.mailTo) || null,
      // Bespoke county text wins; else a safe template for portal counties; else
      // null so the client uses its per-state statutory default.
      evidenceHowTo: (cad && (cad.fileBy.evidenceHowTo || txEvidenceHowTo(cad))) || null,
    },
    deadline: f.deadline,
    deadlineAlt: null,
    fee: null, // Texas charges nothing to file a protest.
    paperOnly: false,
    notes: [],
    verifiedOn: f.verifiedOn,
    // In the registry at all ⇒ we have real filing data (address/website), even
    // when the district's formal name is unverified.
    coverage: cad ? 'county' : 'state',
  };
}

function gaRecord(slug: string): CatalogRecord {
  const c = lookupGaCounty(slug);
  return {
    state: 'GA',
    form: GA_FORM.form,
    formTitle: GA_FORM.formTitle,
    pdfPath: GA_FORM.pdfPath,
    officialUrl: GA_FORM.officialUrl,
    delivery: 'mirror',
    authority: c ? c.authority : 'your county board of tax assessors',
    filing: {
      efileUrl: c ? c.efileUrl : null,
      website: c ? c.website : null,
      mailTo: c ? c.mailTo : null,
      evidenceHowTo: (c && c.evidenceHowTo) || null,
    },
    deadline: GA_FORM.deadline,
    deadlineAlt: null,
    fee: null, // No fee to appeal at the Board of Assessors level.
    paperOnly: !!(c && c.paperOnly),
    notes: [...GA_FORM.notes],
    verifiedOn: GA_FORM.verifiedOn,
    coverage: c ? 'county' : 'state',
  };
}

function flRecord(): CatalogRecord {
  return {
    state: 'FL',
    form: FL_FORM.form,
    formTitle: FL_FORM.formTitle,
    pdfPath: FL_FORM.pdfPath,
    officialUrl: FL_FORM.officialUrl,
    delivery: 'mirror',
    authority: 'your county Value Adjustment Board',
    filing: { efileUrl: null, website: FL_FORM.website, mailTo: null, evidenceHowTo: null },
    deadline: FL_FORM.deadline,
    deadlineAlt: FL_FORM.deadlineAlt,
    fee: FL_FORM.fee,
    paperOnly: false,
    notes: [...FL_FORM.notes],
    verifiedOn: FL_FORM.verifiedOn,
    // Statutorily statewide — a county record would add nothing.
    coverage: 'state',
  };
}

export function resolveCatalog(subject: any, stateHint?: string): CatalogRecord {
  const state = catalogStateId(subject, stateHint);
  const slug = normCounty(subject?.county);
  if (state === 'TX') return txRecord(slug);
  if (state === 'GA') return gaRecord(slug);
  if (state === 'FL') return flRecord();
  return caRecord(slug);
}

// CA is per-county with a no-PDF fallback — implemented in Task 2.
function caRecord(slug: string): CatalogRecord {
  const c = lookupCaCounty(slug);
  if (!c) return CA_FORM_FALLBACK(slug);
  return {
    state: 'CA',
    form: c.form,
    formTitle: c.formTitle,
    pdfPath: c.pdfPath,
    officialUrl: c.officialUrl,
    delivery: 'official', // see spec: Alameda voids prior form revisions
    authority: c.authority,
    filing: { efileUrl: c.efileUrl, website: c.website, mailTo: c.mailTo, evidenceHowTo: c.evidenceHowTo || null },
    deadline: c.deadline,
    deadlineAlt: null,
    fee: c.fee,
    paperOnly: !!c.paperOnly,
    notes: [...c.notes],
    verifiedOn: c.verifiedOn,
    coverage: 'county',
  };
}
