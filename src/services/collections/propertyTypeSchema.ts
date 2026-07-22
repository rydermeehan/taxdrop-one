// Property Type CMS Schema — 25 fields
// Collection ID: 697bc4bbcdd3ace86b793890

import { COLLECTIONS, generateSlug } from '../webflowService';
import type { CollectionSchema, ContentInput, FieldDefinition, StaticQuestion } from './types';

const fields: FieldDefinition[] = [
  { slug: 'name', label: 'Property Type Name', type: 'PlainText', required: true, aiGenerated: true },
  { slug: 'slug', label: 'URL Slug', type: 'PlainText', required: true, aiGenerated: true },
  { slug: 'category', label: 'Category', type: 'Option', required: false, aiGenerated: false, options: [
    { id: 'residential', label: 'Residential' },
    { id: 'commercial', label: 'Commercial' },
    { id: 'agricultural', label: 'Agricultural' },
  ]},
  { slug: 'hero-heading', label: 'Hero Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'hero-subheading', label: 'Hero Subheading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'hero-content', label: 'Hero Content', type: 'RichText', required: false, aiGenerated: true },
  { slug: 'overview', label: 'Overview', type: 'RichText', required: false, aiGenerated: true, helpText: 'What this property type is and how it\'s assessed' },
  { slug: 'common-issues', label: 'Common Assessment Issues', type: 'RichText', required: false, aiGenerated: true },
  { slug: 'appeal-strategies', label: 'Appeal/Protest Strategies', type: 'RichText', required: false, aiGenerated: true },
  { slug: 'valuation-methods', label: 'Valuation Methods', type: 'RichText', required: false, aiGenerated: true },
  { slug: 'key-factors', label: 'Key Assessment Factors', type: 'RichText', required: false, aiGenerated: true },
  { slug: 'taxdrop-approach', label: 'TaxDrop Approach', type: 'RichText', required: false, aiGenerated: true },
  { slug: 'success-metrics', label: 'Success Metrics', type: 'RichText', required: false, aiGenerated: true },
  { slug: 'faqs', label: 'FAQs', type: 'RichText', required: false, aiGenerated: true },
  { slug: 'key-stats', label: 'Key Stats', type: 'RichText', required: false, aiGenerated: true },
  { slug: 'cta-heading', label: 'CTA Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'cta-text', label: 'CTA Button Text', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'seo-title', label: 'SEO Title', type: 'PlainText', required: false, aiGenerated: true, minLength: 40, maxLength: 70 },
  { slug: 'seo-description', label: 'SEO Description', type: 'PlainText', required: false, aiGenerated: true, minLength: 80, maxLength: 160 },
  { slug: 'average-over-assessment', label: 'Avg Over-Assessment %', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'typical-savings', label: 'Typical Savings Range', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'success-rate', label: 'Success Rate', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'photo-prompt', label: 'Photo Prompt', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'related-types', label: 'Related Property Types', type: 'MultiReference', required: false, aiGenerated: false, referenceCollectionId: COLLECTIONS.PROPERTY_TYPES },
  { slug: 'featured', label: 'Featured', type: 'Switch', required: false, aiGenerated: false },
];

const staticQuestions: StaticQuestion[] = [
  {
    id: 'property-type',
    question: 'Property type name',
    inputType: 'text',
    placeholder: 'e.g., Single Family Home, Office Building, Ranch Land',
    required: true,
  },
  {
    id: 'category',
    question: 'Property category',
    inputType: 'select',
    options: [
      { value: 'residential', label: 'Residential' },
      { value: 'commercial', label: 'Commercial' },
      { value: 'agricultural', label: 'Agricultural' },
    ],
    required: true,
  },
];

function buildGenerationPrompt(input: ContentInput): string {
  const propertyType = input.staticAnswers['property-type'] || input.concept;
  const category = input.staticAnswers.category || 'residential';

  const categoryContext = category === 'residential'
    ? 'Focus on homeowner concerns: family budgets, home values, neighborhood comparables.'
    : category === 'commercial'
    ? 'Focus on business/investor concerns: income approach, cap rates, lease analysis, NOI.'
    : 'Focus on agricultural concerns: agricultural exemptions, productivity values, land classification.';

  const clarificationContext = Object.entries(input.clarificationAnswers)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return `Write a complete property type page for TaxDrop about: "${propertyType}" (${category})

CATEGORY: ${category.charAt(0).toUpperCase() + category.slice(1)}
${categoryContext}

NOTE: This page covers BOTH Texas (protest) and California (appeal). Mention both where relevant.

${clarificationContext ? `ADDITIONAL CONTEXT:\n${clarificationContext}` : ''}

Generate ALL of these fields as a JSON object:

{
  "name": "${propertyType}",
  "slug": "url-slug",
  "hero-heading": "Compelling H1 about ${propertyType} tax reduction (8-12 words)",
  "hero-subheading": "Supporting line about why ${propertyType} owners overpay (15-20 words)",
  "hero-content": "2-3 paragraph HTML intro connecting ${propertyType} to the over-assessment problem.",
  "overview": "HTML section explaining how ${propertyType} properties are assessed, what makes them unique, and why they're often over-assessed. 200-400 words.",
  "common-issues": "HTML section: 4-6 specific assessment issues that affect ${propertyType} properties. Use <h3> for each issue. Be specific to this property type.",
  "appeal-strategies": "HTML section: 3-5 strategies for protesting/appealing a ${propertyType} assessment. Include evidence types, comparable selection, etc.",
  "valuation-methods": "HTML section explaining which valuation approaches (cost, sales comparison, income) apply to ${propertyType} and how assessors use them.",
  "key-factors": "HTML bullet list of 5-8 factors that affect ${propertyType} property values. Use <ul><li>.",
  "taxdrop-approach": "HTML section: How TaxDrop specifically handles ${propertyType} property tax cases. What evidence we gather, how we build the case.",
  "success-metrics": "HTML section: Success rates and typical savings for ${propertyType} properties. Use specific-sounding numbers.",
  "faqs": "5-6 FAQs specific to ${propertyType} property taxes. Format: <h3>Q?</h3><p>A.</p>",
  "key-stats": "4-6 stats about ${propertyType} property tax appeals as HTML bullets.",
  "cta-heading": "Action-oriented heading (e.g., 'See How Much You Could Save on Your ${propertyType}')",
  "cta-text": "Short button text (e.g., 'Check My ${propertyType} Assessment')",
  "seo-title": "${propertyType} Property Tax Appeal & Protest | TaxDrop (40-70 chars)",
  "seo-description": "Meta description about ${propertyType} property tax reduction (80-160 chars)",
  "average-over-assessment": "Estimated % (e.g., '15-25%')",
  "typical-savings": "Estimated range (e.g., '$800-$3,500/year')",
  "success-rate": "Estimated rate (e.g., '82%')",
  "photo-prompt": "Professional photo related to ${propertyType} properties. Specific to this property type. TaxDrop brand style."
}`;
}

function mapToWebflow(generated: Record<string, unknown>, input: ContentInput): Record<string, unknown> {
  return {
    name: generated['name'] || input.staticAnswers['property-type'] || input.concept,
    slug: generated['slug'] || generateSlug(String(generated['name'] || input.concept)),
    category: input.staticAnswers.category || 'residential',
    'hero-heading': generated['hero-heading'] || '',
    'hero-subheading': generated['hero-subheading'] || '',
    'hero-content': generated['hero-content'] || '',
    overview: generated['overview'] || '',
    'common-issues': generated['common-issues'] || '',
    'appeal-strategies': generated['appeal-strategies'] || '',
    'valuation-methods': generated['valuation-methods'] || '',
    'key-factors': generated['key-factors'] || '',
    'taxdrop-approach': generated['taxdrop-approach'] || '',
    'success-metrics': generated['success-metrics'] || '',
    faqs: generated['faqs'] || '',
    'key-stats': generated['key-stats'] || '',
    'cta-heading': generated['cta-heading'] || '',
    'cta-text': generated['cta-text'] || '',
    'seo-title': generated['seo-title'] || '',
    'seo-description': generated['seo-description'] || '',
    'average-over-assessment': generated['average-over-assessment'] || '',
    'typical-savings': generated['typical-savings'] || '',
    'success-rate': generated['success-rate'] || '',
    'photo-prompt': generated['photo-prompt'] || '',
    ...(generated['_imageFileId'] ? { 'hero-image': { fileId: generated['_imageFileId'], url: generated['_imageUrl'] || '' } } : {}),
  };
}

export const propertyTypeSchema: CollectionSchema = {
  contentType: 'property-type',
  collectionId: COLLECTIONS.PROPERTY_TYPES,
  displayName: 'Property Type Page',
  description: 'Property type landing pages (residential, commercial, agricultural) with type-specific appeal/protest strategies',
  fields,
  staticQuestions,
  systemPromptAddendum: `You are writing a property type landing page for TaxDrop.
Property type pages should feel authoritative and specific to that exact property type.
Cover both Texas (protest) and California (appeal) contexts.
Use specific numbers and percentages for stats (they can be approximate but realistic).
The reader is a property owner of this type looking for help reducing their taxes.`,
  buildGenerationPrompt,
  mapToWebflow,
  maxTokens: 8192,
  imageFieldSlug: 'hero-image',
};
