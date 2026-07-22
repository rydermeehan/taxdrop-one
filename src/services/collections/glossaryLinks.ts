// Shared glossary term → URL map for internal linking in generated content.
// Add new terms here as they're published to keep links current.

export const GLOSSARY_BASE_URL = 'https://taxdrop.com/glossary';
export const BLOG_BASE_URL = 'https://taxdrop.com/blog';
export const STATE_BASE_URL = 'https://taxdrop.com';

export interface GlossaryLinkEntry {
  term: string;
  slug: string;
}

export const GLOSSARY_LINKS: GlossaryLinkEntry[] = [
  { term: 'Ad Valorem Tax', slug: 'ad-valorem-tax' },
  { term: 'Appraisal District', slug: 'appraisal-district' },
  { term: 'Appraisal Review Board', slug: 'appraisal-review-board' },
  { term: 'Assessed Value', slug: 'assessed-value' },
  { term: 'Assessment Ratio', slug: 'assessment-ratio' },
  { term: 'Base Year Value', slug: 'base-year-value' },
  { term: 'Cap Rate', slug: 'cap-rate' },
  { term: 'Chief Appraiser', slug: 'chief-appraiser' },
  { term: 'Comparable Sales', slug: 'comparable-sales' },
  { term: 'Cost Approach', slug: 'cost-approach' },
  { term: 'Effective Tax Rate', slug: 'effective-tax-rate' },
  { term: 'Equalization', slug: 'equalization' },
  { term: 'Exemption', slug: 'exemption' },
  { term: 'Fair Market Value', slug: 'fair-market-value' },
  { term: 'Homestead Exemption', slug: 'homestead-exemption' },
  { term: 'Income Approach', slug: 'income-approach' },
  { term: 'Just Value', slug: 'just-value' },
  { term: 'Levy', slug: 'levy' },
  { term: 'Lien', slug: 'lien' },
  { term: 'Market Value', slug: 'market-value' },
  { term: 'Mill Rate', slug: 'mill-rate' },
  { term: 'Notice of Appraised Value', slug: 'notice-of-appraised-value' },
  { term: 'Over-65 Exemption', slug: 'over-65-exemption' },
  { term: 'Property Tax', slug: 'property-tax' },
  { term: 'Proposition 13', slug: 'proposition-13' },
  { term: 'Protest', slug: 'protest' },
  { term: 'Reassessment', slug: 'reassessment' },
  { term: 'Sales Comparison Approach', slug: 'sales-comparison-approach' },
  { term: 'Special Assessment', slug: 'special-assessment' },
  { term: 'Tax Rate', slug: 'tax-rate' },
  { term: 'Tax Roll', slug: 'tax-roll' },
  { term: 'Taxable Value', slug: 'taxable-value' },
  { term: 'Uniformity', slug: 'uniformity' },
  { term: 'Valuation', slug: 'valuation' },
  { term: 'Veterans Exemption', slug: 'veterans-exemption' },
];

// Key state/county landing pages for blog internal links
export const STATE_PAGE_LINKS = [
  { label: 'Texas property tax protest', url: `${STATE_BASE_URL}/texas` },
  { label: 'California property tax appeal', url: `${STATE_BASE_URL}/california` },
];

// Builds a concise linking instruction block for AI prompts
export function buildGlossaryLinkBlock(
  options: {
    mode: 'glossary-to-glossary' | 'blog-to-all';
    currentTerm?: string; // exclude the current term from the list
  }
): string {
  const { mode, currentTerm } = options;

  const filteredTerms = GLOSSARY_LINKS.filter(
    e => !currentTerm || e.term.toLowerCase() !== currentTerm.toLowerCase()
  );

  const termLines = filteredTerms
    .map(e => `  - ${e.term}: ${GLOSSARY_BASE_URL}/${e.slug}`)
    .join('\n');

  if (mode === 'glossary-to-glossary') {
    return `INTERNAL LINKING — When any of these terms appear naturally in the full-definition, example, or why-it-matters text, wrap them in an anchor tag: <a href="URL">term</a>. Only link the first occurrence of each term. Do not force links — only link where it reads naturally.

Linkable glossary terms:
${termLines}`;
  }

  const stateLines = STATE_PAGE_LINKS
    .map(s => `  - ${s.label}: ${s.url}`)
    .join('\n');

  return `INTERNAL LINKING — In the post content, naturally link relevant terms to TaxDrop's glossary and state pages. Only link the first occurrence of each term. Use <a href="URL">term text</a>. Do not force links — they should read naturally.

Glossary pages to link:
${termLines}

State landing pages to link:
${stateLines}`;
}
