// Blog Post CMS Schema — 15 fields
// Collection ID: 68c77f35ca4cc33f6523a4c1

import { COLLECTIONS, BLOG_CATEGORIES, generateSlug } from '../webflowService';
import type { CollectionSchema, ContentInput, FieldDefinition, StaticQuestion } from './types';
import { buildGlossaryLinkBlock } from './glossaryLinks';

const fields: FieldDefinition[] = [
  { slug: 'name', label: 'Post Title', type: 'PlainText', required: true, aiGenerated: true, maxLength: 100 },
  { slug: 'slug', label: 'URL Slug', type: 'PlainText', required: true, aiGenerated: true, maxLength: 100 },
  { slug: 'seo-page-title', label: 'SEO Page Title', type: 'PlainText', required: true, aiGenerated: true, minLength: 40, maxLength: 70, helpText: 'Title tag for search results (40-70 chars)' },
  { slug: 'seo-meta-description', label: 'SEO Meta Description', type: 'PlainText', required: true, aiGenerated: true, minLength: 80, maxLength: 160, helpText: 'Description for search results (80-160 chars)' },
  { slug: 'post---content', label: 'Post Content', type: 'RichText', required: false, aiGenerated: true, helpText: 'Full blog post in rich text/HTML' },
  { slug: 'post---summary-page', label: 'Summary (Full)', type: 'RichText', required: false, aiGenerated: true, helpText: 'Longer summary for the blog listing page' },
  { slug: 'post---short-description-card', label: 'Short Description (Card)', type: 'PlainText', required: false, aiGenerated: true, maxLength: 200, helpText: 'Brief description for blog cards' },
  { slug: 'key-fact-bullets-2', label: 'Key Fact Bullets', type: 'RichText', required: false, aiGenerated: true, helpText: 'Bullet-point key facts for the sidebar' },
  { slug: 'faqs', label: 'FAQs', type: 'RichText', required: false, aiGenerated: true, helpText: 'FAQ section in rich text' },
  { slug: 'primary-keyword', label: 'Primary Keyword', type: 'PlainText', required: false, aiGenerated: true, helpText: 'Main SEO keyword' },
  { slug: 'photo-prompt', label: 'Photo Prompt', type: 'PlainText', required: false, aiGenerated: true, helpText: 'AI image generation prompt for hero image' },
  { slug: 'post---category', label: 'Category', type: 'Reference', required: false, aiGenerated: false, referenceCollectionId: COLLECTIONS.BLOG_CATEGORIES, options: [
    { id: BLOG_CATEGORIES.MARKET_NEWS, label: 'Market News' },
    { id: BLOG_CATEGORIES.ARTICLES, label: 'Articles' },
    { id: BLOG_CATEGORIES.GUIDE, label: 'Guide' },
    { id: BLOG_CATEGORIES.COMPANY_UPDATES, label: 'Company Updates' },
    { id: BLOG_CATEGORIES.RESOURCES, label: 'Resources' },
  ]},
  { slug: 'post---featured', label: 'Featured', type: 'Switch', required: false, aiGenerated: false },
];

const staticQuestions: StaticQuestion[] = [
  {
    id: 'state',
    question: 'Which state should this target?',
    inputType: 'select',
    options: [
      { value: 'texas', label: 'Texas (uses "protest" terminology)' },
      { value: 'california', label: 'California (uses "appeal" terminology)' },
      { value: 'general', label: 'General / Both states' },
    ],
    required: true,
  },
  {
    id: 'category',
    question: 'What category?',
    inputType: 'select',
    options: [
      { value: BLOG_CATEGORIES.ARTICLES, label: 'Articles' },
      { value: BLOG_CATEGORIES.GUIDE, label: 'Guide' },
      { value: BLOG_CATEGORIES.MARKET_NEWS, label: 'Market News' },
      { value: BLOG_CATEGORIES.RESOURCES, label: 'Resources' },
      { value: BLOG_CATEGORIES.COMPANY_UPDATES, label: 'Company Updates' },
    ],
    required: true,
  },
  {
    id: 'keywords',
    question: 'Target keywords (comma-separated)',
    inputType: 'text',
    placeholder: 'e.g., property tax protest texas, reduce property taxes',
    required: false,
  },
];

function buildGenerationPrompt(input: ContentInput): string {
  const state = input.staticAnswers.state || 'general';
  const keywords = input.staticAnswers.keywords || '';

  const stateTerms = state === 'texas'
    ? 'Use Texas terminology: "protest" (not appeal), Appraisal District, Notice of Appraised Value, May 15 deadline.'
    : state === 'california'
    ? 'Use California terminology: "appeal" (not protest), Assessor\'s Office, Assessment Notice, deadline varies by county.'
    : 'Use neutral/general terminology. Mention both Texas and California where appropriate.';

  const clarificationContext = Object.entries(input.clarificationAnswers)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  // Title lock — if user picked a title from TitlePicker
  const selectedTitle = input.userSelections._selectedTitle || '';
  const selectedSlug = input.userSelections._selectedSlug || '';

  // NeuronWriter SEO terms injection
  const nwTermsRaw = input.userSelections._nwTerms || '';
  const nwQuestionsRaw = input.userSelections._nwQuestions || '';
  let seoTermsBlock = '';
  if (nwTermsRaw) {
    try {
      const terms = JSON.parse(nwTermsRaw) as { term: string; count_min?: number }[];
      const termList = terms.slice(0, 20).map(t => `"${t.term}" (use ${t.count_min || 1}+ times)`).join(', ');
      seoTermsBlock += `\nSEO OPTIMIZATION — Include these terms naturally throughout the content:\n${termList}`;
    } catch { /* ignore parse errors */ }
  }
  if (nwQuestionsRaw) {
    try {
      const questions = JSON.parse(nwQuestionsRaw) as string[];
      if (questions.length > 0) {
        seoTermsBlock += `\n\nAlso address these questions in the content or FAQs:\n${questions.slice(0, 8).map(q => `- ${q}`).join('\n')}`;
      }
    } catch { /* ignore parse errors */ }
  }

  // GSC keyword integration
  const gscKeywords = input.userSelections._gscKeywords || '';
  const allKeywords = [keywords, gscKeywords].filter(Boolean).join(', ');

  const linkBlock = buildGlossaryLinkBlock({ mode: 'blog-to-all' });

  return `Write a complete blog post for TaxDrop about: "${input.concept}"

STATE CONTEXT: ${state === 'texas' ? 'Texas' : state === 'california' ? 'California' : 'General/Nationwide'}
${stateTerms}

${allKeywords ? `TARGET KEYWORDS: ${allKeywords}` : ''}

${clarificationContext ? `ADDITIONAL CONTEXT FROM CREATOR:\n${clarificationContext}` : ''}
${seoTermsBlock}

Generate ALL of these fields as a JSON object:

{
  ${selectedTitle ? `"name": "${selectedTitle}",\n  "slug": "${selectedSlug}",` : '"name": "Post title (compelling, outcome-driven, 50-70 chars)",\n  "slug": "url-slug-version-of-title",'}
  "seo-page-title": "SEO title with keyword, 40-70 chars, include | TaxDrop at end",
  "seo-meta-description": "Compelling meta description, 80-160 chars, include primary keyword",
  "post---content": "Full blog post in HTML. Use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <a> tags. 1200-2000 words. Structure: Hook → Problem → Solution → Proof → CTA. Use the internal links provided below.",
  "post---summary-page": "2-3 paragraph summary of the post in HTML. Good for blog listing pages.",
  "post---short-description-card": "1-2 sentence description for blog cards (max 200 chars)",
  "key-fact-bullets-2": "4-6 key facts as an HTML bulleted list (<ul><li>). Use specific numbers and stats.",
  "faqs": "3-5 FAQs as HTML. Format: <h3>Question?</h3><p>Answer.</p> for each.",
  "primary-keyword": "The single most important keyword for this post",
  "photo-prompt": "Detailed image generation prompt for the hero image. Professional photography style, TaxDrop brand colors, diverse homeowner subjects."
}

${linkBlock}

IMPORTANT:
- post---content must be full HTML with proper tags
- Use state-appropriate terminology throughout
- Include at least one CTA to TaxDrop.com
- Include relevant stats from TaxDrop's data
- Write in TaxDrop's voice: friendly, clear, helpful, not salesy`;
}

function mapToWebflow(generated: Record<string, unknown>, input: ContentInput): Record<string, unknown> {
  const categoryId = input.staticAnswers.category || BLOG_CATEGORIES.ARTICLES;

  return {
    name: generated['name'] || input.concept,
    slug: generated['slug'] || generateSlug(String(generated['name'] || input.concept)),
    'seo-page-title': generated['seo-page-title'] || `${generated['name']} | TaxDrop`,
    'seo-meta-description': generated['seo-meta-description'] || '',
    'post---content': generated['post---content'] || '',
    'post---summary-page': generated['post---summary-page'] || '',
    'post---short-description-card': generated['post---short-description-card'] || '',
    'key-fact-bullets-2': generated['key-fact-bullets-2'] || '',
    'faqs': generated['faqs'] || '',
    'primary-keyword': generated['primary-keyword'] || '',
    'photo-prompt': generated['photo-prompt'] || '',
    'post---category': categoryId,
    'post---featured': input.userSelections.featured === 'true',
    ...(generated['_imageFileId'] ? { 'post---featured-image-page': { fileId: generated['_imageFileId'], url: generated['_imageUrl'] || '' } } : {}),
  };
}

export const blogPostSchema: CollectionSchema = {
  contentType: 'blog-post',
  collectionId: COLLECTIONS.BLOG_POSTS,
  displayName: 'Blog Post',
  description: 'Educational SEO content for the TaxDrop blog',
  fields,
  staticQuestions,
  systemPromptAddendum: `You are writing a blog post for TaxDrop's website (taxdrop.com/blog).
Blog posts should be 1200-2000 words, highly scannable, and SEO-optimized.
Structure: Hook → Problem → Solution → Proof → CTA.
Use H2 and H3 headings, bullet lists, bold text for emphasis.
Include FAQ schema at the end (3-5 questions).
End with a clear CTA to TaxDrop.`,
  buildGenerationPrompt,
  mapToWebflow,
  maxTokens: 8192,
  imageFieldSlug: 'post---featured-image-page',
};
