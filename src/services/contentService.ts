// Content Service — Master orchestrator for TaxDrop content generation
// Composes system prompts, manages clarification flow, and handles AI calls

import { generateText, generateImage } from './openrouterService';
import type { CollectionSchema, ContentInput, GeneratedContent, TitleOption } from './collections/types';
import {
  createCollectionItem,
  publishItems,
  uploadImageAsset,
  hasWebflowToken,
} from './webflowService';
import type { PublishResult } from './collections/types';

// ============================================================
// MASTER SYSTEM PROMPT — TaxDrop brand voice for all content
// ============================================================

export const TAXDROP_SYSTEM_PROMPT = `You are TaxDrop's content writer. You create property tax content that sounds like a knowledgeable friend — clear, helpful, and confident without being corporate or salesy.

VOICE & TONE:
- Conversational and clear. Short sentences. Real talk.
- Confident but friendly — never corporate, never pushy
- Helpful first, promotional sparingly
- Use "you" and "your" — talk directly to the reader
- Write like a smart friend who happens to know property taxes inside and out

NEVER DO THIS:
- Never say "Save $500+ or you pay nothing"
- Never use: synergy, leverage, utilize, comprehensive, cutting-edge, revolutionary
- Never write filler, fluff, or generic AI-sounding copy
- Never use "In today's fast-paced world" or "Let's dive in!"
- No legal jargon unless immediately clarified in plain English
- Don't start with "Did you know" unless genuinely surprising
- Avoid exclamation marks more than once per piece

STATE TERMINOLOGY (CRITICAL — GET THIS RIGHT):
- Texas = "protest" (Appraisal District, Notice of Appraised Value, May 15 deadline)
- California = "appeal" (Assessor's Office, Assessment Notice, varies by county)
- If general/nationwide: use neutral terms or mention both

KEY STATS (weave in naturally when relevant):
- 30-60% of properties are over-assessed
- Only ~5% of homeowners actually protest or appeal
- Texas informal protest success rate: 80-90%
- Typical annual savings: 10-15%
- TaxDrop estimate takes under 2 minutes
- 85% of beta users found $1K+ in potential savings

ABOUT TAXDROP (mention sparingly):
- We protest (TX) / appeal (CA) your property taxes
- 25% of first-year savings. No upfront cost.
- If savings < $500, you pay nothing
- TaxDrop.com

WRITING STYLE:
- Short sentences, 2-4 line paragraphs
- Scannable bullets for benefits
- Headlines: bold, outcome-driven
- CTAs: direct and confident ("Start your protest", "See your potential savings")

BRAND:
- Headlines use Space Grotesk font (bold)
- Body uses Inter font
- Colors: Deep Emerald (#0C593E), Mint (#DFFFEA), Yellow-Green Pop (#C4FF64)

SEASONAL CONTEXT:
- Texas peak season: March-May, deadline May 15
- California peak season: July-November, deadline varies by county`;

// ============================================================
// CLARIFICATION QUESTIONS GENERATOR
// ============================================================

export async function generateClarifyingQuestions(
  schema: CollectionSchema,
  concept: string,
  model?: string,
): Promise<string[]> {
  const prompt = `You are helping a content creator prepare a ${schema.displayName} for TaxDrop (a property tax protest/appeal company).

The creator wants to write about: "${concept}"

Ask 3-5 specific clarifying questions that would help you write better content. Focus on:
- Missing details that would make the content stronger
- Audience-specific angles (homeowners vs landlords, TX vs CA)
- Unique data points or examples to include
- Tone preferences or specific CTAs desired

Return ONLY a JSON array of question strings. No markdown, no explanation.
Example: ["What state should this target?", "Any specific stats to include?"]`;

  const result = await generateText({
    model: model as Parameters<typeof generateText>[0]['model'],
    prompt,
    systemPrompt: 'You return only valid JSON arrays. No markdown fences, no explanation.',
    maxTokens: 512,
  });

  return parseJsonArray(result.content);
}

// ============================================================
// TITLE OPTIONS GENERATOR (Blog posts only)
// ============================================================

export async function generateTitleOptions(
  _schema: CollectionSchema,
  input: ContentInput,
  model?: string,
): Promise<TitleOption[]> {
  const state = input.staticAnswers.state || 'general';
  const keywords = input.staticAnswers.keywords || '';

  const prompt = `You are brainstorming blog post titles for TaxDrop (a property tax protest/appeal company).

Topic: "${input.concept}"
State: ${state === 'texas' ? 'Texas' : state === 'california' ? 'California' : 'General/Nationwide'}
${keywords ? `Target keywords: ${keywords}` : ''}

Generate exactly 3 title options, each with a DIFFERENT angle or approach:
1. One that leads with data/numbers (e.g., "60% of Homeowners Overpay...")
2. One that leads with a benefit/outcome (e.g., "How to Cut Your Property Tax Bill...")
3. One that leads with a hook/curiosity (e.g., "The Property Tax Mistake That Costs...")

Return a JSON array of 3 objects:
[
  { "title": "Exact title text", "slug": "url-slug-version", "angle": "1-2 sentence description of why this angle works" },
  ...
]

Keep titles under 70 characters. Make them compelling and SEO-friendly.`;

  const result = await generateText({
    model: model as Parameters<typeof generateText>[0]['model'],
    prompt,
    systemPrompt: 'You return only valid JSON arrays. No markdown fences, no explanation.',
    maxTokens: 1024,
  });

  const parsed = parseJsonArray(result.content) as unknown as TitleOption[];
  if (parsed.length === 0) {
    throw new Error('Failed to generate title options. Please try again.');
  }
  return parsed.slice(0, 3);
}

// ============================================================
// CONTENT GENERATION
// ============================================================

export async function generateContent(
  schema: CollectionSchema,
  input: ContentInput,
  model?: string,
): Promise<GeneratedContent> {
  const systemPrompt = `${TAXDROP_SYSTEM_PROMPT}

${schema.systemPromptAddendum}

OUTPUT FORMAT:
Return ONLY a JSON object with the field values. No markdown fences, no explanation.
Each key should be the field slug exactly as specified in the prompt.`;

  const userPrompt = schema.buildGenerationPrompt(input);

  const result = await generateText({
    model: model as Parameters<typeof generateText>[0]['model'],
    prompt: userPrompt,
    systemPrompt,
    maxTokens: schema.maxTokens || 4096,
  });

  const parsed = parseJsonObject(result.content);

  return {
    fields: parsed as Record<string, string | boolean | number | string[]>,
    model: result.model,
    timestamp: result.timestamp,
  };
}

// ============================================================
// MULTI-CALL GENERATION (for large schemas like Partners)
// ============================================================

export async function generateContentMultiCall(
  schema: CollectionSchema,
  input: ContentInput,
  promptBuilders: Array<(input: ContentInput) => string>,
  model?: string,
): Promise<GeneratedContent> {
  const systemPrompt = `${TAXDROP_SYSTEM_PROMPT}

${schema.systemPromptAddendum}

OUTPUT FORMAT:
Return ONLY a JSON object with the field values. No markdown fences, no explanation.`;

  const results = await Promise.all(
    promptBuilders.map(builder =>
      generateText({
        model: model as Parameters<typeof generateText>[0]['model'],
        prompt: builder(input),
        systemPrompt,
        maxTokens: schema.maxTokens || 4096,
      })
    )
  );

  // Merge all results into one object
  let merged: Record<string, unknown> = {};
  let lastModel = '';
  let lastTimestamp = '';

  for (const result of results) {
    const parsed = parseJsonObject(result.content);
    merged = { ...merged, ...parsed };
    lastModel = result.model;
    lastTimestamp = result.timestamp;
  }

  return {
    fields: merged as Record<string, string | boolean | number | string[]>,
    model: lastModel,
    timestamp: lastTimestamp,
  };
}

// ============================================================
// WEBFLOW PUBLISHING
// ============================================================

export async function publishToWebflow(
  schema: CollectionSchema,
  generatedFields: Record<string, unknown>,
  input: ContentInput,
  publishLive: boolean,
): Promise<PublishResult> {
  const fieldData = schema.mapToWebflow(generatedFields, input);

  try {
    const result = await createCollectionItem(
      schema.collectionId,
      fieldData,
      publishLive,
    );

    if (publishLive) {
      // Also explicitly publish
      try {
        await publishItems(schema.collectionId, [result.id]);
      } catch {
        // Item was created but publish failed — still a partial success
        return {
          success: true,
          message: `Created in Webflow but auto-publish failed. Publish manually from Webflow.`,
          itemId: result.id,
          publishedLive: false,
        };
      }
    }

    return {
      success: true,
      message: publishLive
        ? `${schema.displayName} published live to Webflow`
        : `${schema.displayName} saved as draft in Webflow`,
      itemId: result.id,
      publishedLive: publishLive,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to publish to Webflow',
      publishedLive: false,
    };
  }
}

// ============================================================
// IMAGE GENERATION + WEBFLOW UPLOAD
// ============================================================

export interface ImageGenerationResult {
  base64Url: string;
  webflowAsset?: { fileId: string; url: string };
  error?: string;
}

/**
 * Generate an image from a photo prompt and upload to Webflow as an asset.
 * Returns the base64 URL for preview + optional Webflow asset info for CMS.
 */
export async function generateAndUploadImage(
  photoPrompt: string,
  slug: string,
): Promise<ImageGenerationResult> {
  // Step 1: Generate image via OpenRouter
  const generated = await generateImage({
    model: 'google/gemini-3-pro-image-preview',
    prompt: photoPrompt,
    aspectRatio: '16:9',
    imageSize: '1K',
  });

  const base64Url = generated.url;

  // Step 2: Upload to Webflow (if token available)
  if (!hasWebflowToken()) {
    return {
      base64Url,
      error: 'Image generated but Webflow token not configured — upload skipped',
    };
  }

  try {
    const fileName = `${slug}-hero.png`;
    const asset = await uploadImageAsset(base64Url, fileName);

    return {
      base64Url,
      webflowAsset: {
        fileId: asset.fileId,
        url: asset.url,
      },
    };
  } catch (uploadError) {
    return {
      base64Url,
      error: `Image generated but upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`,
    };
  }
}

// ============================================================
// JSON PARSERS — Triple-fallback pattern
// ============================================================

export function parseJsonObject(raw: string): Record<string, unknown> {
  // Try 1: Direct parse
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Not valid JSON
  }

  // Try 2: Extract from markdown fences
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch {
      // Still not valid
    }
  }

  // Try 3: Find first { ... } in text
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      // Give up
    }
  }

  console.error('Failed to parse JSON from AI response:', raw.substring(0, 500));
  throw new Error('Failed to parse AI response as JSON. Please try again.');
}

function parseJsonArray(raw: string): string[] {
  // Try 1: Direct parse
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Not valid JSON
  }

  // Try 2: Extract from markdown fences
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Still not valid
    }
  }

  // Try 3: Find first [ ... ] in text
  const bracketMatch = raw.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    try {
      const parsed = JSON.parse(bracketMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Give up
    }
  }

  // Fallback: return empty array
  console.error('Failed to parse JSON array from AI response:', raw.substring(0, 300));
  return [];
}
