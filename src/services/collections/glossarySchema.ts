// Glossary Term CMS Schema — 17 fields
// Collection ID: 69278836e7230579bfb7ce06

import { COLLECTIONS, generateSlug, getStateRelevanceId } from '../webflowService';
import type { CollectionSchema, ContentInput, FieldDefinition, StaticQuestion } from './types';
import { buildGlossaryLinkBlock } from './glossaryLinks';

const fields: FieldDefinition[] = [
  { slug: 'name', label: 'Name', type: 'PlainText', required: true, aiGenerated: true },
  { slug: 'slug', label: 'URL Slug', type: 'PlainText', required: true, aiGenerated: true },
  { slug: 'term', label: 'Term', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'short-definition', label: 'Short Definition', type: 'PlainText', required: false, aiGenerated: true, maxLength: 200, helpText: 'One-sentence definition for cards/tooltips' },
  { slug: 'full-definition', label: 'Full Definition', type: 'RichText', required: true, aiGenerated: true, helpText: 'Comprehensive definition in HTML' },
  { slug: 'example', label: 'Example', type: 'RichText', required: false, aiGenerated: true, helpText: 'Real-world example illustrating the term' },
  { slug: 'why-it-matters', label: 'Why It Matters', type: 'RichText', required: false, aiGenerated: true, helpText: 'Why homeowners should care about this term' },
  { slug: 'faq-1-question', label: 'FAQ 1 Question', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'faq-1-answer', label: 'FAQ 1 Answer', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'faq-2-question', label: 'FAQ 2 Question', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'faq-2-answer', label: 'FAQ 2 Answer', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'faq-3-question', label: 'FAQ 3 Question', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'faq-3-answer', label: 'FAQ 3 Answer', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'state-relevance', label: 'State Relevance', type: 'Option', required: false, aiGenerated: false, options: [
    { id: 'ca', label: 'California' },
    { id: 'tx', label: 'Texas' },
    { id: 'all', label: 'All States' },
  ]},
  { slug: 'tier', label: 'Tier', type: 'Option', required: false, aiGenerated: false, options: [
    { id: '1', label: 'Tier 1 (Core)' },
    { id: '2', label: 'Tier 2 (Important)' },
    { id: '3', label: 'Tier 3 (Supplemental)' },
  ]},
  { slug: 'related-terms', label: 'Related Terms', type: 'MultiReference', required: false, aiGenerated: false, referenceCollectionId: COLLECTIONS.GLOSSARY },
];

const staticQuestions: StaticQuestion[] = [
  {
    id: 'state',
    question: 'Which state is this term most relevant to?',
    inputType: 'select',
    options: [
      { value: 'all', label: 'All States' },
      { value: 'tx', label: 'Texas' },
      { value: 'ca', label: 'California' },
    ],
    required: true,
  },
  {
    id: 'tier',
    question: 'Term importance tier',
    inputType: 'select',
    options: [
      { value: '1', label: 'Tier 1 — Core term every homeowner should know' },
      { value: '2', label: 'Tier 2 — Important for anyone appealing/protesting' },
      { value: '3', label: 'Tier 3 — Supplemental / advanced' },
    ],
    required: true,
  },
];

function buildGenerationPrompt(input: ContentInput): string {
  const state = input.staticAnswers.state || 'all';
  const stateContext = state === 'tx'
    ? 'Focus on Texas context. Use "protest" terminology (Appraisal District, Notice of Appraised Value).'
    : state === 'ca'
    ? 'Focus on California context. Use "appeal" terminology (Assessor\'s Office, Assessment Notice).'
    : 'Cover both Texas and California perspectives. Mention both "protest" (TX) and "appeal" (CA) where relevant.';

  const clarificationContext = Object.entries(input.clarificationAnswers)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const linkBlock = buildGlossaryLinkBlock({ mode: 'glossary-to-glossary', currentTerm: input.concept });

  return `Write a comprehensive glossary entry for the property tax term: "${input.concept}"

STATE CONTEXT: ${stateContext}

${clarificationContext ? `ADDITIONAL CONTEXT:\n${clarificationContext}` : ''}

Generate ALL of these fields as a JSON object:

{
  "name": "The term name, properly capitalized",
  "slug": "url-slug-version",
  "term": "The term exactly as it should appear",
  "short-definition": "One clear sentence defining the term (max 200 chars). No jargon.",
  "full-definition": "2-3 paragraphs in HTML (<p> tags) that thoroughly explain the term. Include how it affects property owners, who uses it, and when it matters. Use simple language — explain like a smart friend would.",
  "example": "A concrete, relatable example in HTML showing this term in action. Use specific numbers. E.g., 'If your home is assessed at $350,000 but similar homes sold for $300,000...'",
  "why-it-matters": "1-2 paragraphs in HTML explaining why homeowners should care about this term. Connect it to their wallet — how does this affect what they pay?",
  "faq-1-question": "Most common question about this term",
  "faq-1-answer": "Clear, helpful answer (2-3 sentences)",
  "faq-2-question": "Second most common question",
  "faq-2-answer": "Clear, helpful answer (2-3 sentences)",
  "faq-3-question": "Third common question",
  "faq-3-answer": "Clear, helpful answer (2-3 sentences)"
}

${linkBlock}

IMPORTANT:
- Write for homeowners, not tax professionals
- Include state-specific details where relevant
- Use HTML tags (<p>, <strong>, <ul>, <li>, <a>) in rich text fields
- FAQs should answer questions real homeowners would Google
- Keep the short-definition to one sentence, plain English
- short-definition and FAQ fields are plain text — no HTML links there`;
}

function mapToWebflow(generated: Record<string, unknown>, input: ContentInput): Record<string, unknown> {
  return {
    name: generated['name'] || input.concept,
    slug: generated['slug'] || generateSlug(String(generated['name'] || input.concept)),
    term: generated['term'] || generated['name'] || input.concept,
    'short-definition': generated['short-definition'] || '',
    'full-definition': generated['full-definition'] || '',
    example: generated['example'] || '',
    'why-it-matters': generated['why-it-matters'] || '',
    'faq-1-question': generated['faq-1-question'] || '',
    'faq-1-answer': generated['faq-1-answer'] || '',
    'faq-2-question': generated['faq-2-question'] || '',
    'faq-2-answer': generated['faq-2-answer'] || '',
    'faq-3-question': generated['faq-3-question'] || '',
    'faq-3-answer': generated['faq-3-answer'] || '',
    'state-relevance': getStateRelevanceId(input.staticAnswers.state || 'all'),
    tier: input.staticAnswers.tier || '2',
  };
}

export const glossarySchema: CollectionSchema = {
  contentType: 'glossary',
  collectionId: COLLECTIONS.GLOSSARY,
  displayName: 'Glossary Term',
  description: 'Property tax glossary definitions for the TaxDrop knowledge base',
  fields,
  staticQuestions,
  systemPromptAddendum: `You are writing a glossary definition for TaxDrop's property tax glossary.
Glossary entries should be clear, authoritative, and accessible to regular homeowners.
Write like a helpful encyclopedia that regular people would actually want to read.
Always include practical examples with real numbers.
FAQs should answer what real homeowners search for on Google.`,
  buildGenerationPrompt,
  mapToWebflow,
  maxTokens: 4096,
};
