// County CMS Schema — 20 fields
// Collection ID: 68f2d50d29a26118d2646aed

import { COLLECTIONS, generateSlug } from '../webflowService';
import type { CollectionSchema, ContentInput, FieldDefinition, StaticQuestion } from './types';

const fields: FieldDefinition[] = [
  { slug: 'name', label: 'County Name', type: 'PlainText', required: true, aiGenerated: true },
  { slug: 'slug', label: 'URL Slug', type: 'PlainText', required: true, aiGenerated: true },
  { slug: 'county-name-full', label: 'County Name Full', type: 'PlainText', required: false, aiGenerated: true, helpText: 'e.g., "Harris County, Texas"' },
  { slug: 'state-2', label: 'State', type: 'Reference', required: false, aiGenerated: false, referenceCollectionId: COLLECTIONS.STATES },
  { slug: 'primary-city', label: 'Primary City', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'appraisal-district-name', label: 'Appraisal District Name', type: 'PlainText', required: false, aiGenerated: true, helpText: 'TX: "Harris Central Appraisal District" / CA: "Los Angeles County Assessor"' },
  { slug: 'protest-deadline', label: 'Protest/Appeal Deadline', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'online-appeal-url', label: 'Online Appeal/Protest URL', type: 'Link', required: false, aiGenerated: true },
  { slug: 'average-home-value', label: 'Average Home Value', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'average-tax-rate', label: 'Average Tax Rate', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'average-tax-bill', label: 'Average Tax Bill', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'hero-content', label: 'Hero Content', type: 'RichText', required: false, aiGenerated: true, helpText: 'Intro paragraph for the county hero section' },
  { slug: 'main-content', label: 'Main Content', type: 'RichText', required: false, aiGenerated: true, helpText: 'Full county page content' },
  { slug: 'how-it-works', label: 'How It Works', type: 'RichText', required: false, aiGenerated: true, helpText: 'Step-by-step process for this county' },
  { slug: 'key-facts', label: 'Key Facts', type: 'RichText', required: false, aiGenerated: true, helpText: 'Bullet-point county facts' },
  { slug: 'faqs', label: 'FAQs', type: 'RichText', required: false, aiGenerated: true },
  { slug: 'seo-title', label: 'SEO Title', type: 'PlainText', required: false, aiGenerated: true, minLength: 40, maxLength: 70 },
  { slug: 'seo-description', label: 'SEO Description', type: 'PlainText', required: false, aiGenerated: true, minLength: 80, maxLength: 160 },
  { slug: 'cta-text', label: 'CTA Text', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'photo-prompt', label: 'Photo Prompt', type: 'PlainText', required: false, aiGenerated: true },
];

const staticQuestions: StaticQuestion[] = [
  {
    id: 'county-name',
    question: 'County name',
    inputType: 'text',
    placeholder: 'e.g., Harris County, Los Angeles County',
    required: true,
  },
  {
    id: 'state',
    question: 'Which state?',
    inputType: 'select',
    options: [
      { value: 'texas', label: 'Texas' },
      { value: 'california', label: 'California' },
    ],
    required: true,
  },
  {
    id: 'primary-city',
    question: 'Primary city in this county',
    inputType: 'text',
    placeholder: 'e.g., Houston, Los Angeles',
    required: true,
  },
  {
    id: 'appraisal-district',
    question: 'Appraisal district / assessor name',
    inputType: 'text',
    placeholder: 'e.g., Harris Central Appraisal District',
    required: false,
  },
  {
    id: 'deadline',
    question: 'Protest/appeal deadline',
    inputType: 'text',
    placeholder: 'e.g., May 15 or November 30',
    required: false,
  },
  {
    id: 'online-url',
    question: 'Online appeal/protest URL (if known)',
    inputType: 'text',
    placeholder: 'https://...',
    required: false,
  },
];

function buildGenerationPrompt(input: ContentInput): string {
  const countyName = input.staticAnswers['county-name'] || input.concept;
  const state = input.staticAnswers.state || 'texas';
  const primaryCity = input.staticAnswers['primary-city'] || '';
  const appraisalDistrict = input.staticAnswers['appraisal-district'] || '';
  const deadline = input.staticAnswers.deadline || (state === 'texas' ? 'May 15' : 'varies');
  const onlineUrl = input.staticAnswers['online-url'] || '';

  const isTexas = state === 'texas';
  const terminology = isTexas
    ? { action: 'protest', office: 'Appraisal District', notice: 'Notice of Appraised Value' }
    : { action: 'appeal', office: "Assessor's Office", notice: 'Assessment Notice' };

  const clarificationContext = Object.entries(input.clarificationAnswers)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return `Write a complete county landing page for TaxDrop about: ${countyName}, ${isTexas ? 'Texas' : 'California'}

COUNTY INFO:
- County: ${countyName}
- State: ${isTexas ? 'Texas' : 'California'}
- Primary City: ${primaryCity}
- ${terminology.office}: ${appraisalDistrict || `${countyName} ${terminology.office}`}
- ${terminology.action.charAt(0).toUpperCase() + terminology.action.slice(1)} Deadline: ${deadline}
${onlineUrl ? `- Online ${terminology.action} URL: ${onlineUrl}` : ''}

TERMINOLOGY: Always use "${terminology.action}" (not ${isTexas ? 'appeal' : 'protest'}). Reference "${terminology.office}" and "${terminology.notice}".

${clarificationContext ? `ADDITIONAL CONTEXT:\n${clarificationContext}` : ''}

Generate ALL of these fields as a JSON object:

{
  "name": "${countyName}",
  "slug": "url-slug (e.g., harris-county-texas)",
  "county-name-full": "${countyName}, ${isTexas ? 'Texas' : 'California'}",
  "primary-city": "${primaryCity}",
  "appraisal-district-name": "Full official name of the ${terminology.office}",
  "protest-deadline": "${deadline}",
  "online-appeal-url": "${onlineUrl || 'Research the official online URL'}",
  "average-home-value": "Research approximate average (e.g., $285,000)",
  "average-tax-rate": "Research approximate rate (e.g., 2.31%)",
  "average-tax-bill": "Research approximate bill (e.g., $6,500)",
  "hero-content": "2-3 paragraph HTML intro. Hook: mention the county, the problem (over-assessment), and TaxDrop's solution. Include county-specific stat if possible.",
  "main-content": "Full HTML page content (800-1200 words). Sections: Overview, Why ${countyName} Properties Are Over-Assessed, The ${terminology.action.charAt(0).toUpperCase() + terminology.action.slice(1)} Process, What TaxDrop Does For You, Deadline Info, CTA.",
  "how-it-works": "3-step HTML process: 1) Check your ${terminology.notice}, 2) TaxDrop builds your case, 3) We ${terminology.action} for you. Use <ol><li> tags.",
  "key-facts": "5-7 bullet points about property taxes in ${countyName}. Use <ul><li> tags. Include specific numbers.",
  "faqs": "4-5 FAQs specific to ${countyName}. Format: <h3>Question?</h3><p>Answer</p>",
  "seo-title": "Property Tax ${terminology.action.charAt(0).toUpperCase() + terminology.action.slice(1)} in ${countyName} | TaxDrop (40-70 chars)",
  "seo-description": "Compelling meta description about ${terminology.action}ing property taxes in ${countyName} with TaxDrop (80-160 chars)",
  "cta-text": "Start Your ${countyName} Property Tax ${terminology.action.charAt(0).toUpperCase() + terminology.action.slice(1)}",
  "photo-prompt": "Professional photo of a suburban home in ${primaryCity || countyName}, ${isTexas ? 'Texas' : 'California'} with warm natural lighting. TaxDrop brand style."
}

IMPORTANT: Use only state-appropriate terminology throughout. Every mention should say "${terminology.action}" not "${isTexas ? 'appeal' : 'protest'}".`;
}

function mapToWebflow(generated: Record<string, unknown>, input: ContentInput): Record<string, unknown> {
  return {
    name: generated['name'] || input.staticAnswers['county-name'] || input.concept,
    slug: generated['slug'] || generateSlug(String(generated['name'] || input.concept)),
    'county-name-full': generated['county-name-full'] || '',
    'primary-city': generated['primary-city'] || input.staticAnswers['primary-city'] || '',
    'appraisal-district-name': generated['appraisal-district-name'] || input.staticAnswers['appraisal-district'] || '',
    'protest-deadline': generated['protest-deadline'] || input.staticAnswers.deadline || '',
    'online-appeal-url': generated['online-appeal-url'] || input.staticAnswers['online-url'] || '',
    'average-home-value': generated['average-home-value'] || '',
    'average-tax-rate': generated['average-tax-rate'] || '',
    'average-tax-bill': generated['average-tax-bill'] || '',
    'hero-content': generated['hero-content'] || '',
    'main-content': generated['main-content'] || '',
    'how-it-works': generated['how-it-works'] || '',
    'key-facts': generated['key-facts'] || '',
    faqs: generated['faqs'] || '',
    'seo-title': generated['seo-title'] || '',
    'seo-description': generated['seo-description'] || '',
    'cta-text': generated['cta-text'] || '',
    'photo-prompt': generated['photo-prompt'] || '',
    ...(generated['_imageFileId'] ? { 'featured-hero-image': { fileId: generated['_imageFileId'], url: generated['_imageUrl'] || '' } } : {}),
    // state-2 reference must be set manually (needs State item ID)
  };
}

export const countySchema: CollectionSchema = {
  contentType: 'county',
  collectionId: COLLECTIONS.COUNTIES,
  displayName: 'County Page',
  description: 'County-specific landing pages with local property tax details and protest/appeal info',
  fields,
  staticQuestions,
  systemPromptAddendum: `You are writing a county-specific landing page for TaxDrop.
County pages should feel local and specific — mention the county name, local landmarks, and specific details.
Use correct state terminology (protest for TX, appeal for CA) consistently.
Include real-sounding but approximate local statistics.
Every county page should make the homeowner feel like TaxDrop understands their specific area.`,
  buildGenerationPrompt,
  mapToWebflow,
  maxTokens: 8192,
  imageFieldSlug: 'featured-hero-image',
};
