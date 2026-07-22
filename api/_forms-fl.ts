// Florida petition registry. DR-486 is statewide and counties MAY NOT refuse it:
// s. 194.011(3), F.S. — "a county officer may not refuse to accept a form provided
// by the department for this purpose if the taxpayer chooses to use it."
// So FL needs NO per-county form records; coverage is always 'state'.
// Verified 2026-07-20.

export const FL_FORM = {
  form: 'DR-486',
  formTitle: 'Petition to the Value Adjustment Board',
  pdfPath: '/forms/fl-dr-486.pdf',
  officialUrl: 'https://floridarevenue.com/property/Documents/dr486.pdf',
  // Two distinct statutory rules — s. 194.011(3)(d), F.S. Do not collapse them.
  deadline: '25 days after your TRIM notice',
  deadlineAlt: '30 days after a denial of exemption or classification',
  // County-set, typically $15/parcel (Miami-Dade $15/folio, $5 joint condo/co-op).
  fee: 'about $15 per parcel',
  // Official county-VAB directory. flclerks.com is bot-blocked and unverified.
  website: 'https://floridarevenue.com/property/Pages/LocalOfficials.aspx',
  verifiedOn: '2026-07-20',
  notes: [
    'Florida counties must accept the state DR-486 form, though most also run their own online filing portal.',
    'The exact filing fee is set by your county — most charge about $15 per parcel.',
  ],
};
