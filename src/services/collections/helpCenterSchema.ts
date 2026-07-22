// Help Center CMS Schema — 7 fields
// Collection ID: 68c77f35ca4cc33f6523a56d

import { COLLECTIONS, generateSlug } from '../webflowService';
import type { CollectionSchema, ContentInput, FieldDefinition, StaticQuestion } from './types';

// Help Center category IDs (from Webflow)
const HELP_CATEGORIES = {
  GETTING_STARTED: '68c77f35ca4cc33f6523a56e',
  ACCOUNT: '68c77f35ca4cc33f6523a549',
  APPEALS: '68c77f35ca4cc33f6523a52d',
  BILLING: '6918d7c643516770fac05f9d',
  GENERAL: '6977fe19acbe4525fdd63e17',
};

const fields: FieldDefinition[] = [
  { slug: 'name', label: 'Title', type: 'PlainText', required: true, aiGenerated: true },
  { slug: 'slug', label: 'URL Slug', type: 'PlainText', required: true, aiGenerated: true },
  { slug: 'summary', label: 'Summary', type: 'RichText', required: false, aiGenerated: true, helpText: 'Full help article content in HTML' },
  { slug: 'short-description', label: 'Short Description', type: 'PlainText', required: false, aiGenerated: true, maxLength: 200, helpText: 'Brief description for help center cards' },
  { slug: 'post-content', label: 'Post Content', type: 'RichText', required: false, aiGenerated: true, helpText: 'Main article content' },
  { slug: 'category', label: 'Category', type: 'Reference', required: false, aiGenerated: false, options: [
    { id: HELP_CATEGORIES.GETTING_STARTED, label: 'Getting Started' },
    { id: HELP_CATEGORIES.ACCOUNT, label: 'Account' },
    { id: HELP_CATEGORIES.APPEALS, label: 'Appeals & Protests' },
    { id: HELP_CATEGORIES.BILLING, label: 'Billing & Payments' },
    { id: HELP_CATEGORIES.GENERAL, label: 'General' },
  ]},
  { slug: 'featured', label: 'Featured', type: 'Switch', required: false, aiGenerated: false },
];

const staticQuestions: StaticQuestion[] = [
  {
    id: 'category',
    question: 'Which help center category?',
    inputType: 'select',
    options: [
      { value: HELP_CATEGORIES.GETTING_STARTED, label: 'Getting Started' },
      { value: HELP_CATEGORIES.ACCOUNT, label: 'Account' },
      { value: HELP_CATEGORIES.APPEALS, label: 'Appeals & Protests' },
      { value: HELP_CATEGORIES.BILLING, label: 'Billing & Payments' },
      { value: HELP_CATEGORIES.GENERAL, label: 'General' },
    ],
    required: true,
  },
  {
    id: 'audience',
    question: 'Who is this article for?',
    inputType: 'select',
    options: [
      { value: 'new-user', label: 'New TaxDrop users' },
      { value: 'active-user', label: 'Active users with a case' },
      { value: 'general', label: 'General / All visitors' },
    ],
    required: false,
  },
];

function buildGenerationPrompt(input: ContentInput): string {
  const audience = input.staticAnswers.audience || 'general';
  const audienceLabel = audience === 'new-user' ? 'new TaxDrop users who just signed up'
    : audience === 'active-user' ? 'active users who have a case in progress'
    : 'all website visitors';

  const clarificationContext = Object.entries(input.clarificationAnswers)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return `Write a help center article for TaxDrop about: "${input.concept}"

TARGET AUDIENCE: ${audienceLabel}

${clarificationContext ? `ADDITIONAL CONTEXT:\n${clarificationContext}` : ''}

Generate ALL of these fields as a JSON object:

{
  "name": "Clear, specific article title (e.g., 'How to Check Your Appeal Status')",
  "slug": "url-slug-version",
  "summary": "The full help article in HTML. Use <h2>, <h3>, <p>, <ul>, <li>, <strong> tags. 300-800 words. Be clear, step-by-step, and helpful. Include screenshots placeholders where useful [Screenshot: description].",
  "short-description": "One sentence describing what this article covers (max 200 chars)",
  "post-content": "Same as summary but formatted for the main content area. Include a 'Related Articles' section at the end with 2-3 suggested topic links."
}

HELP CENTER STYLE:
- Answer the question directly in the first sentence
- Use numbered steps for processes
- Use bullet points for lists
- Keep paragraphs to 2-3 sentences
- Include a "Still need help?" section at the end with support contact info
- Tone: helpful, patient, clear — like a good support article`;
}

function mapToWebflow(generated: Record<string, unknown>, input: ContentInput): Record<string, unknown> {
  return {
    name: generated['name'] || input.concept,
    slug: generated['slug'] || generateSlug(String(generated['name'] || input.concept)),
    summary: generated['summary'] || '',
    'short-description': generated['short-description'] || '',
    'post-content': generated['post-content'] || generated['summary'] || '',
    category: input.staticAnswers.category || HELP_CATEGORIES.GENERAL,
  };
}

export const helpCenterSchema: CollectionSchema = {
  contentType: 'help-center',
  collectionId: COLLECTIONS.HELP_CENTER,
  displayName: 'Help Center Article',
  description: 'Support articles and FAQ content for the TaxDrop help center',
  fields,
  staticQuestions,
  systemPromptAddendum: `You are writing a help center / support article for TaxDrop.
Help center articles should be clear, concise, and action-oriented.
Write like a great support team — patient, helpful, and direct.
Always answer the question in the first sentence.
Use numbered steps and bullet points for clarity.
Include a "Still need help?" section at the end.`,
  buildGenerationPrompt,
  mapToWebflow,
  maxTokens: 4096,
};
