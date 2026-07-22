// SEO Analyzer Service
// Client-side types and API wrapper for the /api/seo-analyze endpoint

const SEO_ANALYZE_URL = '/api/seo-analyze';

// ─── Types ───────────────────────────────────────────────────────────────────

export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';
export type CategoryType = 'on-page' | 'technical' | 'content' | 'schema' | 'images' | 'geo';

export interface SEOIssue {
  category: CategoryType;
  priority: IssuePriority;
  title: string;
  description: string;
  recommendation: string;
}

export interface OnPageResult {
  score: number;
  title: { value: string | null; length: number; issues: string[] };
  metaDescription: { value: string | null; length: number; issues: string[] };
  h1Tags: string[];
  headingHierarchy: { tag: string; text: string }[];
  canonical: string | null;
  ogTags: Record<string, string>;
  twitterCard: Record<string, string>;
  internalLinkCount: number;
  externalLinkCount: number;
}

export interface TechnicalResult {
  score: number;
  https: boolean;
  securityHeaders: { name: string; present: boolean; value?: string }[];
  robotsTxt: { exists: boolean; content: string | null; aiCrawlers: { name: string; allowed: boolean }[] };
  metaRobots: string | null;
  redirectChain: string[];
  viewport: boolean;
  statusCode: number;
}

export interface ContentResult {
  score: number;
  wordCount: number;
  pageType: string;
  minWordsForType: number;
  hasAuthorByline: boolean;
  hasDates: boolean;
  readability: { avgSentenceLength: number; avgParagraphLength: number; score: string };
  internalLinkDensity: number;
}

export interface SchemaBlock {
  type: string;
  valid: boolean;
  properties: string[];
  issues: string[];
}

export interface SchemaResult {
  score: number;
  blocks: SchemaBlock[];
  recommendations: string[];
}

export interface ImageInfo {
  src: string;
  alt: string | null;
  width: string | null;
  height: string | null;
  loading: string | null;
  format: string;
}

export interface ImageResult {
  score: number;
  totalImages: number;
  missingAlt: number;
  missingDimensions: number;
  missingLazyLoading: number;
  nonOptimalFormat: number;
  images: ImageInfo[];
}

export interface GEOResult {
  score: number;
  aiCrawlerAccess: { name: string; allowed: boolean }[];
  llmsTxtExists: boolean;
  ssrDetected: boolean;
  citabilitySignals: string[];
}

export interface SEOAnalysis {
  url: string;
  analyzedAt: string;
  healthScore: number;
  scores: {
    onPage: number;
    technical: number;
    content: number;
    schema: number;
    images: number;
    geo: number;
  };
  issues: SEOIssue[];
  onPage: OnPageResult;
  technical: TechnicalResult;
  content: ContentResult;
  schema: SchemaResult;
  images: ImageResult;
  geo: GEOResult;
}

// ─── API Function ────────────────────────────────────────────────────────────

export async function analyzePage(url: string): Promise<SEOAnalysis> {
  const response = await fetch(SEO_ANALYZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { error?: string }).error || `Analysis failed: ${response.status}`);
  }

  return response.json();
}
