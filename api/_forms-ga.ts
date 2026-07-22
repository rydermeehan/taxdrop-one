// Georgia appeal filing registry. PT-311A is a STATEWIDE form (Ga. DOR) and all
// four serviced counties accept it, so there is one PDF plus per-county filing
// detail. Verified 2026-07-20 against each county's board-of-assessors site.
//
// O.C.G.A. §48-5-311 makes PT-311A OPTIONAL — a plain letter of appeal stating
// the election of appeal method is legally sufficient. That's surfaced as a note.

export interface GaCounty {
  authority: string;
  efileUrl: string | null;   // null = no verified portal; never guess
  website: string;
  mailTo: string;
  paperOnly?: boolean;
  /**
   * Optional bespoke "how to VIEW the assessor's evidence" text. When absent the
   * UI renders its per-state default. In GA the Board of Assessors provides the
   * data behind your value on the annual notice / on request (O.C.G.A. §48-5-306).
   */
  evidenceHowTo?: string;
}

export const GA_COUNTIES: Record<string, GaCounty> = {
  fulton: {
    authority: 'Fulton County Board of Assessors',
    efileUrl: 'https://fultoncountygasf.atent.tylerapp.com/smartfile',
    website: 'https://fultonassessor.org',
    // Three different suites appear across official sources (1200, 1400, 1018).
    // 1200 is the one published for mailed appeals.
    mailTo: '235 Peachtree St NE, Suite 1200, Atlanta, GA 30303',
  },
  gwinnett: {
    authority: 'Gwinnett County Board of Assessors',
    // LayerID 43872 = real estate. 44092 is personal property — do not swap.
    efileUrl: 'https://qpublic.schneidercorp.com/Application.aspx?AppID=1282&LayerID=43872&PageTypeID=2&PageID=16058',
    website: 'https://www.gwinnettcounty.com/web/gwinnett/departments/financialservices/taxassessorsoffice',
    mailTo: "ATT: Appeals — Gwinnett County Assessors' Office, 75 Langley Drive, Lawrenceville, GA 30046",
  },
  chatham: {
    authority: 'Chatham County Board of Assessors',
    // No working online appeal path found as of 2026-07-20 (chathamtax.org
    // /Appeals 404s). Mail-only until confirmed by phone: 912-652-7271.
    efileUrl: null,
    website: 'https://boa.chathamcountyga.gov',
    mailTo: 'PO Box 9786, Savannah, GA 31412-9786',
    paperOnly: true,
  },
  dekalb: {
    authority: 'DeKalb County Board of Assessors',
    efileUrl: 'https://efile.dekalbcountyga.gov/Filing/FilingType/Info/DEKALB_APPEALS',
    website: 'https://www.dekalbcountyga.gov/property-appraisal/welcome',
    // NOT 1300 Commerce Drive — that's county HQ, a common scraping error.
    mailTo: '325 Swanton Way, Decatur, GA 30030',
  },
};

export const GA_FORM = {
  form: 'PT-311A',
  formTitle: 'Appeal of Assessment',
  pdfPath: '/forms/ga-pt-311a.pdf',
  officialUrl: 'https://dor.georgia.gov/document/form/pt-311a-appeal-assessment-form-revised-july-2018/download',
  deadline: '45 days after your assessment notice date',
  verifiedOn: '2026-07-20',
  notes: [
    'Georgia law also accepts a plain letter of appeal stating your chosen appeal method — PT-311A is optional.',
  ],
};

export function lookupGaCounty(slug: string): GaCounty | null {
  return GA_COUNTIES[slug] || null;
}
