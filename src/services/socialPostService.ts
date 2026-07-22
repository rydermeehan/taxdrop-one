// Social post generation service
// Handles prompt construction, platform rules, and scene auto-selection

export type SocialPlatformKey = 'linkedin' | 'instagram' | 'facebook' | 'twitter';

export type PostFormat =
  | 'freeform'
  | 'unpopular-opinion'
  | 'myth-buster'
  | 'tips-list'
  | 'how-i'
  | 'stop-doing'
  | 'what-nobody-tells'
  | 'deadline-reminder'
  | 'success-story';

export interface GeneratedDraft {
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  imagePromptHint?: string;
}

export const POST_FORMATS: { id: PostFormat; label: string; description: string }[] = [
  { id: 'freeform', label: 'Freeform', description: 'Let the AI choose the best format' },
  { id: 'unpopular-opinion', label: 'Unpopular Opinion', description: 'Bold contrarian take that sparks discussion' },
  { id: 'myth-buster', label: 'Myth Buster', description: 'Call out a misconception, reveal the truth' },
  { id: 'tips-list', label: 'Tips List', description: 'Numbered actionable items' },
  { id: 'how-i', label: 'How I [X]', description: 'Personal narrative, step-by-step story' },
  { id: 'stop-doing', label: 'Stop Doing [X]', description: 'Call out mistakes, show the better way' },
  { id: 'what-nobody-tells', label: 'What Nobody Tells You', description: 'Reveal insider knowledge' },
  { id: 'deadline-reminder', label: 'Deadline Reminder', description: 'Time-sensitive urgency, motivating' },
  { id: 'success-story', label: 'Success Story', description: 'Customer win, real-feeling results' },
];

export const PLATFORM_INFO: Record<SocialPlatformKey, { label: string; icon: string; charLimit?: number }> = {
  linkedin: { label: 'LinkedIn', icon: 'in' },
  instagram: { label: 'Instagram', icon: 'IG' },
  facebook: { label: 'Facebook', icon: 'fb' },
  twitter: { label: 'Twitter/X', icon: 'X', charLimit: 280 },
};

// ============================================================
// SYSTEM PROMPT — The heart of TaxDrop's social voice
// ============================================================

export const SOCIAL_POST_SYSTEM_PROMPT = `You are TaxDrop's social media writer. You write like a real human — a knowledgeable friend who happens to know property taxes inside and out.

YOUR VOICE:
- You sound like a sharp friend texting advice, not a brand account
- Conversational. Short sentences. Real talk.
- Confident but never salesy or pushy
- Helpful first, promotional second (way second)
- You use "you" and "your" — talk directly to the reader
- Occasional humor is great. Corporate speak is banned.
- Write like someone who'd actually post this from their personal account

NEVER DO THIS:
- Never say "Save $500+ or you pay nothing"
- Never use words like: synergy, leverage, utilize, comprehensive, cutting-edge, revolutionary
- Never write filler or fluff — every line earns its place
- Never sound like ChatGPT wrote it (no "In today's fast-paced world" or "Let's dive in!")
- Never use exclamation marks more than once per post
- Never start with "Did you know" unless it's genuinely surprising

STATE TERMINOLOGY (GET THIS RIGHT):
- Texas: "protest" your property taxes (Appraisal District, Notice of Appraised Value, May 15 deadline)
- California: "appeal" your property taxes (Assessor's Office, Assessment Notice, varies by county)
- General/nationwide: use neutral terms or mention both

STATS YOU CAN WEAVE IN (when they fit naturally):
- 30-60% of properties are over-assessed
- Only about 5% of homeowners actually protest or appeal
- Texas informal protest success rate: 80-90%
- Typical savings: 10-15% off your tax bill
- TaxDrop estimate takes under 2 minutes
- 85% of beta users found $1K+ in potential savings

ABOUT TAXDROP (mention sparingly — not every post):
- We protest (TX) / appeal (CA) your property taxes for you
- 25% of first-year savings. No upfront cost.
- If we save you less than $500, you pay nothing
- TaxDrop.com

PLATFORM FORMATTING:

LinkedIn:
- Professional but personable — you're the smart person in someone's feed
- First line is EVERYTHING (it's the hook before "...see more")
- Use lots of line breaks. Single-line paragraphs.
- 150-300 words
- End with a question or soft call-to-action
- 3-5 hashtags max, at the very end
- Can use occasional unicode bold for emphasis

Instagram:
- Caption complements the image — don't describe what they can see
- Keep it 50-150 words
- Natural emoji use (2-4, not every sentence)
- Strong first line hook
- CTA: "Link in bio", "Save this for later", "Tag a homeowner friend"
- 8-15 hashtags at the very end (separate from caption with line breaks)

Facebook:
- Most conversational of all platforms
- Community vibes — storytelling, questions, shared experiences
- 100-200 words
- Emotional hooks that relate to homeowner life
- Questions drive engagement
- 0-3 hashtags max (or none)

Twitter/X:
- Single tweet: under 280 characters. Period.
- Punchy. Sharp. One idea, said perfectly.
- Bold stats, surprising claims, or hot takes work best
- 0-2 hashtags max
- If asked for a thread, number each tweet (1/, 2/, etc.)

OUTPUT FORMAT:
Return ONLY a JSON object (no markdown fences, no explanation, just the JSON):
{
  "linkedin": "The full LinkedIn post...",
  "instagram": "The full Instagram caption...",
  "facebook": "The full Facebook post...",
  "twitter": "The full tweet...",
  "imagePromptHint": "Brief visual description for paired image"
}

Only include platforms that were requested. Always include imagePromptHint.`;

// ============================================================
// FORMAT DESCRIPTIONS for the user prompt
// ============================================================

const FORMAT_INSTRUCTIONS: Record<PostFormat, string> = {
  freeform: '',
  'unpopular-opinion': 'Use an "Unpopular opinion:" opening — take a bold, defensible contrarian stance that sparks discussion and debate.',
  'myth-buster': 'Use a myth-busting format — clearly state the common myth, then reveal the surprising truth with evidence.',
  'tips-list': 'Use a numbered tips/list format with specific, actionable items people can use right away.',
  'how-i': 'Tell it as a first-person narrative — "How I..." or "Here\'s what happened when..." — make it feel like a real story.',
  'stop-doing': 'Use a "Stop doing [X], start doing [Y]" format — call out common mistakes homeowners make, then show the better way.',
  'what-nobody-tells': 'Use a "What nobody tells you about..." format — reveal insider knowledge that feels exclusive and valuable.',
  'deadline-reminder': 'Create urgency around the property tax deadline — make it feel time-sensitive and motivating without being manipulative.',
  'success-story': 'Frame as a success story with real-feeling details — specific savings amounts, timeline, and how the person felt.',
};

// ============================================================
// PROMPT BUILDERS
// ============================================================

export function buildUserPrompt(
  concept: string,
  platforms: SocialPlatformKey[],
  state: 'texas' | 'california' | 'general',
  format: PostFormat,
): string {
  const parts: string[] = [];

  parts.push(`Write social media posts about: "${concept}"`);

  const stateLabel = state === 'general'
    ? 'General (both Texas and California / nationwide)'
    : state === 'texas' ? 'Texas' : 'California';
  parts.push(`State context: ${stateLabel}`);

  parts.push(`Platforms to write for: ${platforms.join(', ')}`);

  const formatInstruction = FORMAT_INSTRUCTIONS[format];
  if (formatInstruction) {
    parts.push(`Format style: ${formatInstruction}`);
  }

  parts.push('Write like a real human would. Make it scroll-stopping. No filler.');

  return parts.join('\n\n');
}

// ============================================================
// SCENE AUTO-SELECTION for image generation
// ============================================================

// Scene IDs that match SCENE_TEMPLATES in SocialMediaGenerator
const SCENE_KEYWORD_MAP: Array<{ keywords: string[]; sceneId: string }> = [
  { keywords: ['deadline', 'may 15', 'urgent', 'hurry', 'time', 'last chance', 'running out'], sceneId: 'deadline-pressure' },
  { keywords: ['shock', 'increase', 'went up', 'higher', 'bill', 'notice'], sceneId: 'tax-increase-shock' },
  { keywords: ['save', 'saved', 'success', 'won', 'result', 'reduced', 'lower'], sceneId: 'phone-celebration' },
  { keywords: ['celebrate', 'congrats', 'amazing', 'great news'], sceneId: 'success-thumbs-up' },
  { keywords: ['mistake', 'error', 'wrong', 'avoid', 'stop'], sceneId: 'document-discovery' },
  { keywords: ['research', 'learn', 'understand', 'how to', 'guide'], sceneId: 'cozy-research' },
  { keywords: ['expert', 'professional', 'team', 'service'], sceneId: 'expert-at-work' },
  { keywords: ['morning', 'coffee', 'peaceful', 'relaxed'], sceneId: 'morning-coffee' },
  { keywords: ['couple', 'family', 'together'], sceneId: 'couple-front-yard' },
  { keywords: ['stress', 'worried', 'anxious', 'frustrated', 'unfair'], sceneId: 'financial-stress' },
  { keywords: ['neighborhood', 'community', 'neighbors'], sceneId: 'neighborhood-aerial' },
  { keywords: ['home', 'house', 'property', 'curb'], sceneId: 'morning-curb-appeal' },
];

export function autoSelectSceneId(concept: string, state: 'texas' | 'california' | 'general'): string {
  const lower = concept.toLowerCase();

  for (const entry of SCENE_KEYWORD_MAP) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      return entry.sceneId;
    }
  }

  // State-specific defaults
  if (state === 'texas') return 'texas-home';
  if (state === 'california') return 'california-home';

  return 'front-porch-pride';
}

// ============================================================
// IMAGE PROMPT BUILDER
// ============================================================

// The TaxDrop brand style suffix for image generation (condensed from SocialMediaGenerator)
// IMPORTANT: Never mention brand names in image prompts — AI generators will render them as visible text/logos
const BRAND_IMAGE_STYLE = `Professional lifestyle photography, Sony A7R IV aesthetic, shallow depth of field f/2.0. Bright natural lighting, warm tones. Color palette: deep emerald green (#0B8F52), soft mint (#DFFFEA), subtle yellow-green accents (#C4FF64). Diverse American homeowner subjects, genuine expressions, plain unbranded clothing only. Mood: optimistic, trustworthy, empowering. Ultra-sharp, 8K quality.`;

export function buildAutoImagePrompt(
  concept: string,
  sceneKeywords: string,
  state: 'texas' | 'california' | 'general',
  imageHint?: string,
): string {
  const parts: string[] = [];

  parts.push(`Create a professional social media photo.`);
  parts.push(`Topic: "${concept}".`);
  parts.push(`Visual setting: ${sceneKeywords}.`);

  if (state === 'texas') {
    parts.push('Texas context: suburban Texas home, warm golden light, American southwest feel.');
  } else if (state === 'california') {
    parts.push('California context: palm trees, bright sunshine, craftsman-style or modern home.');
  }

  if (imageHint) {
    parts.push(`Additional visual guidance: ${imageHint}.`);
  }

  parts.push(BRAND_IMAGE_STYLE);
  parts.push('Avoid: text overlays, watermarks, logos, brand names, branded clothing, writing on any surface, signs with words, advertisements, distorted faces, extra limbs, cartoon, illustration, 3D render. All clothing must be plain and unbranded.');

  return parts.join(' ');
}

// ============================================================
// PAGE FETCHER — for "Promote a Link" mode
// ============================================================

export interface PageContent {
  url: string;
  title: string;
  description: string;
  ogImage: string;
  bodyText: string;
}

export async function fetchPageContent(url: string): Promise<PageContent> {
  const response = await fetch('/api/fetch-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch page: ${response.status}`);
  }

  return response.json();
}

// ============================================================
// PROMOTE PROMPT BUILDER
// ============================================================

export function buildPromotePrompt(
  page: PageContent,
  platforms: SocialPlatformKey[],
  state: 'texas' | 'california' | 'general',
  format: PostFormat,
): string {
  const parts: string[] = [];

  parts.push(`Write social media posts to PROMOTE this blog post / page:`);
  parts.push(`URL: ${page.url}`);
  parts.push(`Title: "${page.title}"`);

  if (page.description) {
    parts.push(`Summary: "${page.description}"`);
  }

  if (page.bodyText) {
    // Include first ~1500 chars of body for context
    const excerpt = page.bodyText.slice(0, 1500);
    parts.push(`Article excerpt:\n"${excerpt}..."`);
  }

  parts.push(`\nGOAL: Drive traffic to this page. The post should tease the value of the content and make people want to click through to read the full article.`);

  parts.push(`IMPORTANT RULES FOR LINK PROMOTION:
- Include the URL naturally in the post (exact URL: ${page.url})
- Don't summarize the entire article — tease the most compelling insight or stat
- Create curiosity or urgency to click
- The post should stand on its own even without the link
- For LinkedIn, put the link after the main text (before hashtags)
- For Instagram, say "Link in bio" instead of the URL
- For Facebook, the link can be in the post body
- For Twitter/X, include the shortened URL and keep the tweet punchy`);

  const stateLabel = state === 'general'
    ? 'General (both Texas and California / nationwide)'
    : state === 'texas' ? 'Texas' : 'California';
  parts.push(`State context: ${stateLabel}`);

  parts.push(`Platforms to write for: ${platforms.join(', ')}`);

  const formatInstruction = FORMAT_INSTRUCTIONS[format];
  if (formatInstruction) {
    parts.push(`Format style: ${formatInstruction}`);
  }

  parts.push('Write like a real human would. Make it scroll-stopping. No filler.');

  return parts.join('\n\n');
}

// ============================================================
// RESPONSE PARSER
// ============================================================

export function parseDraftResponse(rawContent: string): GeneratedDraft {
  // Try to parse as JSON directly
  try {
    const parsed = JSON.parse(rawContent);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as GeneratedDraft;
    }
  } catch {
    // Not valid JSON, try to extract from markdown fences
  }

  // Try extracting JSON from markdown code fences
  const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim()) as GeneratedDraft;
    } catch {
      // Still not valid
    }
  }

  // Try finding a JSON object in the text
  const braceMatch = rawContent.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]) as GeneratedDraft;
    } catch {
      // Give up on JSON parsing
    }
  }

  // Fallback: return raw content as linkedin (most versatile format)
  return { linkedin: rawContent, imagePromptHint: '' };
}
