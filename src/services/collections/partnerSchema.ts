// Partner CMS Schema — 44 fields (generates in 3 AI calls)
// Collection ID: 6940b5a7d2ea98ddaa20e097

import { COLLECTIONS, generateSlug } from '../webflowService';
import type { CollectionSchema, ContentInput, FieldDefinition, StaticQuestion } from './types';

const fields: FieldDefinition[] = [
  // Core fields
  { slug: 'name', label: 'Partner Type Name', type: 'PlainText', required: true, aiGenerated: true },
  { slug: 'slug', label: 'URL Slug', type: 'PlainText', required: true, aiGenerated: true },
  { slug: 'partner-category', label: 'Partner Category', type: 'Option', required: false, aiGenerated: false, options: [
    { id: 'real-estate', label: 'Real Estate' },
    { id: 'financial', label: 'Financial Services' },
    { id: 'legal', label: 'Legal' },
    { id: 'insurance', label: 'Insurance' },
    { id: 'technology', label: 'Technology' },
    { id: 'community', label: 'Community' },
  ]},

  // Hero section
  { slug: 'hero-heading', label: 'Hero Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'hero-subheading', label: 'Hero Subheading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'hero-content', label: 'Hero Content', type: 'RichText', required: false, aiGenerated: true },

  // Value proposition
  { slug: 'value-prop-heading', label: 'Value Prop Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'value-prop-content', label: 'Value Prop Content', type: 'RichText', required: false, aiGenerated: true },

  // Benefits (6 benefits, each with heading + description)
  { slug: 'benefit-1-heading', label: 'Benefit 1 Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'benefit-1-description', label: 'Benefit 1 Description', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'benefit-2-heading', label: 'Benefit 2 Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'benefit-2-description', label: 'Benefit 2 Description', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'benefit-3-heading', label: 'Benefit 3 Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'benefit-3-description', label: 'Benefit 3 Description', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'benefit-4-heading', label: 'Benefit 4 Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'benefit-4-description', label: 'Benefit 4 Description', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'benefit-5-heading', label: 'Benefit 5 Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'benefit-5-description', label: 'Benefit 5 Description', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'benefit-6-heading', label: 'Benefit 6 Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'benefit-6-description', label: 'Benefit 6 Description', type: 'PlainText', required: false, aiGenerated: true },

  // Use cases
  { slug: 'use-case-1-heading', label: 'Use Case 1 Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'use-case-1-content', label: 'Use Case 1 Content', type: 'RichText', required: false, aiGenerated: true },
  { slug: 'use-case-2-heading', label: 'Use Case 2 Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'use-case-2-content', label: 'Use Case 2 Content', type: 'RichText', required: false, aiGenerated: true },
  { slug: 'use-case-3-heading', label: 'Use Case 3 Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'use-case-3-content', label: 'Use Case 3 Content', type: 'RichText', required: false, aiGenerated: true },

  // How it works
  { slug: 'how-it-works', label: 'How Partnership Works', type: 'RichText', required: false, aiGenerated: true },
  { slug: 'commission-details', label: 'Commission Details', type: 'RichText', required: false, aiGenerated: true },

  // Social proof
  { slug: 'testimonial-quote', label: 'Testimonial Quote', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'testimonial-name', label: 'Testimonial Author', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'testimonial-role', label: 'Testimonial Role', type: 'PlainText', required: false, aiGenerated: true },

  // FAQs
  { slug: 'faqs', label: 'FAQs', type: 'RichText', required: false, aiGenerated: true },

  // CTA
  { slug: 'cta-heading', label: 'CTA Heading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'cta-subheading', label: 'CTA Subheading', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'cta-button-text', label: 'CTA Button Text', type: 'PlainText', required: false, aiGenerated: true },

  // SEO
  { slug: 'seo-title', label: 'SEO Title', type: 'PlainText', required: false, aiGenerated: true, minLength: 40, maxLength: 70 },
  { slug: 'seo-description', label: 'SEO Description', type: 'PlainText', required: false, aiGenerated: true, minLength: 80, maxLength: 160 },

  // Meta
  { slug: 'photo-prompt', label: 'Photo Prompt', type: 'PlainText', required: false, aiGenerated: true },
  { slug: 'featured', label: 'Featured', type: 'Switch', required: false, aiGenerated: false },
];

const staticQuestions: StaticQuestion[] = [
  {
    id: 'partner-type',
    question: 'Partner type name',
    inputType: 'text',
    placeholder: 'e.g., Real Estate Agents, Mortgage Brokers, Tax Attorneys',
    required: true,
  },
  {
    id: 'partner-category',
    question: 'Partner category',
    inputType: 'select',
    options: [
      { value: 'real-estate', label: 'Real Estate' },
      { value: 'financial', label: 'Financial Services' },
      { value: 'legal', label: 'Legal' },
      { value: 'insurance', label: 'Insurance' },
      { value: 'technology', label: 'Technology' },
      { value: 'community', label: 'Community' },
    ],
    required: true,
  },
];

// Builder for call 1: Hero + Value Prop + Benefits
function buildHeroPrompt(input: ContentInput): string {
  const partnerType = input.staticAnswers['partner-type'] || input.concept;
  const category = input.staticAnswers['partner-category'] || 'real-estate';

  return `Write the HERO section and BENEFITS for a TaxDrop partner page targeting: "${partnerType}" (${category})

PARTNERSHIP PROGRAM:
- TaxDrop pays $20 per successful referral
- Partners refer their clients to TaxDrop for property tax protests/appeals
- Win-win: their clients save on property taxes, partners earn commission
- No cost to the partner or their clients upfront

Generate these fields as JSON:

{
  "name": "${partnerType}",
  "slug": "url-slug",
  "hero-heading": "Compelling H1 for ${partnerType} partners (8-12 words)",
  "hero-subheading": "Supporting line about why ${partnerType} should partner with TaxDrop",
  "hero-content": "2-3 paragraph HTML intro for ${partnerType}. Connect their work to property tax savings. Show the mutual benefit.",
  "value-prop-heading": "Why ${partnerType} Partner With TaxDrop",
  "value-prop-content": "HTML section (200-300 words) explaining the value proposition for ${partnerType} specifically.",
  "benefit-1-heading": "Short benefit title",
  "benefit-1-description": "1-2 sentence benefit description specific to ${partnerType}",
  "benefit-2-heading": "...",
  "benefit-2-description": "...",
  "benefit-3-heading": "...",
  "benefit-3-description": "...",
  "benefit-4-heading": "...",
  "benefit-4-description": "...",
  "benefit-5-heading": "...",
  "benefit-5-description": "...",
  "benefit-6-heading": "...",
  "benefit-6-description": "..."
}

Make every benefit SPECIFIC to ${partnerType} — not generic partnership benefits.`;
}

// Builder for call 2: Use Cases + How It Works + Testimonial
function buildUseCasesPrompt(input: ContentInput): string {
  const partnerType = input.staticAnswers['partner-type'] || input.concept;

  return `Write USE CASES, HOW IT WORKS, and a TESTIMONIAL for a TaxDrop partner page targeting: "${partnerType}"

CONTEXT: TaxDrop partner program — $20 per successful referral, property tax protests/appeals.

Generate these fields as JSON:

{
  "use-case-1-heading": "Specific scenario title for ${partnerType}",
  "use-case-1-content": "HTML: 1-2 paragraph real-world scenario where a ${partnerType} professional refers a client. Include dialogue or specifics.",
  "use-case-2-heading": "...",
  "use-case-2-content": "...",
  "use-case-3-heading": "...",
  "use-case-3-content": "...",
  "how-it-works": "HTML: 3-4 step process. How does a ${partnerType} actually refer clients and earn commission? Be specific and practical.",
  "commission-details": "HTML: Explain the $20/referral commission structure, payment timing, and tracking. Make it sound easy and transparent.",
  "testimonial-quote": "A realistic-sounding quote from a ${partnerType} professional about partnering with TaxDrop (2-3 sentences).",
  "testimonial-name": "Realistic first name and last initial (e.g., 'Sarah M.')",
  "testimonial-role": "Job title and location (e.g., '${partnerType}, Austin TX')"
}

Make use cases feel like real stories from real ${partnerType} professionals.`;
}

// Builder for call 3: FAQs + CTA + SEO
function buildFaqsPrompt(input: ContentInput): string {
  const partnerType = input.staticAnswers['partner-type'] || input.concept;

  return `Write FAQs, CTA, and SEO content for a TaxDrop partner page targeting: "${partnerType}"

Generate these fields as JSON:

{
  "faqs": "5-6 FAQs as HTML. Format: <h3>Question?</h3><p>Answer.</p>. Questions should be what ${partnerType} professionals would actually ask about partnering with TaxDrop.",
  "cta-heading": "Action-oriented heading for ${partnerType} to sign up (e.g., 'Start Earning With Every Referral')",
  "cta-subheading": "Supporting line (e.g., 'Join 500+ ${partnerType} already earning with TaxDrop')",
  "cta-button-text": "Short button text (e.g., 'Become a Partner')",
  "seo-title": "TaxDrop Partner Program for ${partnerType} | Earn $20/Referral (40-70 chars)",
  "seo-description": "Meta description about ${partnerType} partnering with TaxDrop (80-160 chars)",
  "photo-prompt": "Professional photo of a ${partnerType} professional in their work environment, looking confident and friendly. TaxDrop brand colors subtly present."
}`;
}

// We export the prompt builders for multi-call generation
export const partnerPromptBuilders = [buildHeroPrompt, buildUseCasesPrompt, buildFaqsPrompt];

function buildGenerationPrompt(input: ContentInput): string {
  // This is used for single-call mode (fallback). In practice, we use partnerPromptBuilders.
  return buildHeroPrompt(input);
}

function mapToWebflow(generated: Record<string, unknown>, input: ContentInput): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Map all fields directly
  for (const field of fields) {
    if (field.slug === 'partner-category') {
      result[field.slug] = input.staticAnswers['partner-category'] || 'real-estate';
    } else if (field.slug === 'featured') {
      result[field.slug] = false;
    } else if (field.slug === 'name') {
      result[field.slug] = generated['name'] || input.staticAnswers['partner-type'] || input.concept;
    } else if (field.slug === 'slug') {
      result[field.slug] = generated['slug'] || generateSlug(String(generated['name'] || input.concept));
    } else if (field.aiGenerated) {
      result[field.slug] = generated[field.slug] || '';
    }
  }

  // Add image field if generated
  if (generated['_imageFileId']) {
    result['feature-image'] = { fileId: generated['_imageFileId'], url: generated['_imageUrl'] || '' };
  }

  return result;
}

export const partnerSchema: CollectionSchema = {
  contentType: 'partner',
  collectionId: COLLECTIONS.PARTNERS,
  displayName: 'Partner Page',
  description: 'Partner landing pages for real estate agents, brokers, attorneys, and other referral partners',
  fields,
  staticQuestions,
  systemPromptAddendum: `You are writing a partner landing page for TaxDrop's referral program.
TaxDrop pays partners $20 per successful referral for property tax protests/appeals.
The page should convince the target professional that:
1. Their clients need this service (property taxes are usually too high)
2. It's easy to refer (simple process)
3. They earn money while helping their clients save money
4. It strengthens their client relationship
Write in a professional but warm B2B tone. Show you understand their specific industry.`,
  buildGenerationPrompt,
  mapToWebflow,
  maxTokens: 4096,
  aiCallCount: 3,
  imageFieldSlug: 'feature-image',
};
