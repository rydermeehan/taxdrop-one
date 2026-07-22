// Shared interfaces for CMS content generation

export type ContentType = 'blog-post' | 'glossary' | 'partner' | 'property-type' | 'help-center' | 'county';

export type FieldType =
  | 'PlainText'
  | 'RichText'
  | 'Number'
  | 'Switch'
  | 'Option'
  | 'Reference'
  | 'MultiReference'
  | 'Image'
  | 'Link'
  | 'Email';

export interface FieldDefinition {
  /** Webflow field slug (e.g., 'seo-meta-description') */
  slug: string;
  /** Human-readable label */
  label: string;
  /** Webflow field type */
  type: FieldType;
  /** Whether the field is required in Webflow */
  required: boolean;
  /** Help text shown to the VA */
  helpText?: string;
  /** Whether AI should generate this field (vs user-selected) */
  aiGenerated: boolean;
  /** For Option fields: allowed values */
  options?: { id: string; label: string }[];
  /** For Reference fields: target collection ID */
  referenceCollectionId?: string;
  /** Minimum character count (for validation) */
  minLength?: number;
  /** Maximum character count */
  maxLength?: number;
}

export interface StaticQuestion {
  /** Unique key for this question */
  id: string;
  /** The question to display */
  question: string;
  /** Input type */
  inputType: 'text' | 'textarea' | 'select';
  /** Options for select type */
  options?: { value: string; label: string }[];
  /** Placeholder text */
  placeholder?: string;
  /** Whether this question is required */
  required: boolean;
}

export interface ContentInput {
  /** The user's initial concept / topic idea */
  concept: string;
  /** Answers to static questions defined by the schema */
  staticAnswers: Record<string, string>;
  /** Answers to AI-generated clarifying questions */
  clarificationAnswers: Record<string, string>;
  /** User-selected values (category, state, etc.) */
  userSelections: Record<string, string>;
}

export interface GeneratedContent {
  /** All generated field values, keyed by field slug */
  fields: Record<string, string | boolean | number | string[]>;
  /** Model used for generation */
  model: string;
  /** Generation timestamp */
  timestamp: string;
}

export interface CollectionSchema {
  /** Content type identifier */
  contentType: ContentType;
  /** Webflow CMS collection ID */
  collectionId: string;
  /** Human-readable name (e.g., "Blog Post") */
  displayName: string;
  /** Short description of this content type */
  description: string;
  /** All CMS fields for this collection */
  fields: FieldDefinition[];
  /** Questions the VA always answers before generation */
  staticQuestions: StaticQuestion[];
  /** Additional system prompt instructions for this content type */
  systemPromptAddendum: string;
  /** Build the user-facing generation prompt from input */
  buildGenerationPrompt: (input: ContentInput) => string;
  /** Map AI-generated JSON output to Webflow CMS field data */
  mapToWebflow: (generated: Record<string, unknown>, input: ContentInput) => Record<string, unknown>;
  /** Optional: max tokens for the AI call (defaults to 4096) */
  maxTokens?: number;
  /** Optional: number of AI calls needed (for large schemas like Partners) */
  aiCallCount?: number;
  /** Optional: Webflow Image field slug for auto-generated hero image */
  imageFieldSlug?: string;
}

export interface TitleOption {
  title: string;
  slug: string;
  angle: string;
}

export interface PublishResult {
  success: boolean;
  message: string;
  itemId?: string;
  /** Whether the item was published live or saved as draft */
  publishedLive: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

/** Validate generated content against schema requirements */
export function validateContent(
  schema: CollectionSchema,
  fields: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const fieldDef of schema.fields) {
    if (!fieldDef.required) continue;

    const value = fields[fieldDef.slug];

    if (value === undefined || value === null || value === '') {
      errors.push({
        field: fieldDef.slug,
        message: `${fieldDef.label} is required`,
      });
      continue;
    }

    if (typeof value === 'string') {
      if (fieldDef.minLength && value.length < fieldDef.minLength) {
        errors.push({
          field: fieldDef.slug,
          message: `${fieldDef.label} must be at least ${fieldDef.minLength} characters (currently ${value.length})`,
        });
      }
    }
  }

  return errors;
}
