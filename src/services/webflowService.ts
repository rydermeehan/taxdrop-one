// Webflow CMS API Service
// TaxDrop Site ID: 68c77f34ca4cc33f6523a3a4
// All requests proxied through /api/webflow-cms to avoid browser CORS restrictions

// Collection IDs
export const COLLECTIONS = {
  BLOG_POSTS: '68c77f35ca4cc33f6523a4c1',
  GLOSSARY: '69278836e7230579bfb7ce06',
  BLOG_CATEGORIES: '68c77f35ca4cc33f6523a498',
  PARTNERS: '6940b5a7d2ea98ddaa20e097',
  PROPERTY_TYPES: '697bc4bbcdd3ace86b793890',
  HELP_CENTER: '68c77f35ca4cc33f6523a56d',
  COUNTIES: '68f2d50d29a26118d2646aed',
  STATES: '68fd4a79a90a01b07e7ce258',
} as const;

// Blog Category IDs
export const BLOG_CATEGORIES = {
  MARKET_NEWS: '6977fe19acbe4525fdd63e17',
  ARTICLES: '6918d7c643516770fac05f9d',
  GUIDE: '68c77f35ca4cc33f6523a56e',
  COMPANY_UPDATES: '68c77f35ca4cc33f6523a549',
  RESOURCES: '68c77f35ca4cc33f6523a52d',
} as const;

// Glossary state relevance — Webflow option IDs
export const STATE_RELEVANCE = {
  CA: '2183d907633ca82393da249b726048df',
  TX: '9148e58f7a94f0ec17bf84e4f975d2ca',
  ALL: 'a55e3201546333da4b775bd5de269bed',
} as const;

// Map plain text state values to Webflow option IDs
export function getStateRelevanceId(state: string): string {
  const map: Record<string, string> = {
    ca: STATE_RELEVANCE.CA,
    tx: STATE_RELEVANCE.TX,
    all: STATE_RELEVANCE.ALL,
  };
  return map[state] || STATE_RELEVANCE.ALL;
}

const STORAGE_KEY = 'webflow-api-token';

// Token management
export function getWebflowToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setWebflowToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function hasWebflowToken(): boolean {
  const token = getWebflowToken();
  return !!token && token.length > 0;
}

export function clearWebflowToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// API request helper — proxied through /api/webflow-cms to avoid CORS
async function webflowRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getWebflowToken();
  if (!token) {
    throw new Error('Webflow API token not configured');
  }

  const method = options.method || 'GET';

  // Parse any body from the original options
  let body: unknown = undefined;
  if (options.body && typeof options.body === 'string') {
    try {
      body = JSON.parse(options.body);
    } catch {
      body = options.body;
    }
  }

  const response = await fetch('/api/webflow-cms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webflowToken: token,
      endpoint,
      method,
      body,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Webflow API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

// Blog Post interfaces
export interface BlogPostData {
  name: string; // Post Title (required)
  slug: string; // URL slug (required)
  'seo-page-title': string; // Min 40 chars (required)
  'seo-meta-description': string; // Min 80 chars (required)
  'post---content'?: string; // Rich text content
  'post---summary-page'?: string;
  'post---short-description-card'?: string;
  'post---category'?: string; // Reference ID to blog-categories
  'post---featured'?: boolean;
  'primary-keyword'?: string;
  'photo-prompt'?: string;
}

// Glossary Term interfaces
export interface GlossaryTermData {
  name: string; // Required
  slug: string; // Required
  term?: string;
  'short-definition'?: string;
  'full-definition': string; // Rich text (required)
  example?: string; // Rich text
  'why-it-matters'?: string; // Rich text
  'faq-1-question'?: string;
  'faq-1-answer'?: string;
  'faq-2-question'?: string;
  'faq-2-answer'?: string;
  'faq-3-question'?: string;
  'faq-3-answer'?: string;
  'state-relevance'?: string; // Option: ca, tx, all
  tier?: string; // Option: 1, 2, 3
  'related-terms'?: string[]; // MultiReference IDs
}

// Response types
interface WebflowItem {
  id: string;
  cmsLocaleId?: string;
  lastPublished?: string;
  lastUpdated?: string;
  createdOn?: string;
  isArchived?: boolean;
  isDraft?: boolean;
  fieldData: Record<string, unknown>;
}

interface WebflowItemResponse {
  id: string;
  cmsLocaleId?: string;
  lastPublished?: string;
  lastUpdated?: string;
  createdOn?: string;
  isArchived?: boolean;
  isDraft?: boolean;
  fieldData: Record<string, unknown>;
}

interface WebflowListResponse<T> {
  items: T[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
}

// Create Blog Post (draft)
export async function createBlogPost(
  data: BlogPostData,
  publishImmediately = false
): Promise<WebflowItemResponse> {
  const endpoint = publishImmediately
    ? `/collections/${COLLECTIONS.BLOG_POSTS}/items/live`
    : `/collections/${COLLECTIONS.BLOG_POSTS}/items`;

  return webflowRequest<WebflowItemResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      fieldData: data,
    }),
  });
}

// Create Glossary Term (draft)
export async function createGlossaryTerm(
  data: GlossaryTermData,
  publishImmediately = false
): Promise<WebflowItemResponse> {
  const endpoint = publishImmediately
    ? `/collections/${COLLECTIONS.GLOSSARY}/items/live`
    : `/collections/${COLLECTIONS.GLOSSARY}/items`;

  return webflowRequest<WebflowItemResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      fieldData: data,
    }),
  });
}

// Publish collection items
export async function publishItems(
  collectionId: string,
  itemIds: string[]
): Promise<{ publishedItemIds: string[] }> {
  return webflowRequest(`/collections/${collectionId}/items/publish`, {
    method: 'POST',
    body: JSON.stringify({
      itemIds,
    }),
  });
}

// List Blog Posts
export async function listBlogPosts(
  limit = 100,
  offset = 0
): Promise<WebflowListResponse<WebflowItem>> {
  return webflowRequest(
    `/collections/${COLLECTIONS.BLOG_POSTS}/items?limit=${limit}&offset=${offset}`
  );
}

// List Glossary Terms
export async function listGlossaryTerms(
  limit = 100,
  offset = 0
): Promise<WebflowListResponse<WebflowItem>> {
  return webflowRequest(
    `/collections/${COLLECTIONS.GLOSSARY}/items?limit=${limit}&offset=${offset}`
  );
}

// Get Blog Categories
export async function listBlogCategories(): Promise<WebflowListResponse<WebflowItem>> {
  return webflowRequest(`/collections/${COLLECTIONS.BLOG_CATEGORIES}/items`);
}

// Helper to generate slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

// Helper to map category name to ID
export function getCategoryId(categoryName: string): string | undefined {
  const categoryMap: Record<string, string> = {
    'Market News': BLOG_CATEGORIES.MARKET_NEWS,
    'Articles': BLOG_CATEGORIES.ARTICLES,
    'Guide': BLOG_CATEGORIES.GUIDE,
    'Company Updates': BLOG_CATEGORIES.COMPANY_UPDATES,
    'Resources': BLOG_CATEGORIES.RESOURCES,
  };
  return categoryMap[categoryName];
}

// Generic: Create item in any collection
export async function createCollectionItem(
  collectionId: string,
  fieldData: Record<string, unknown>,
  publishImmediately = false,
): Promise<WebflowItemResponse> {
  const endpoint = publishImmediately
    ? `/collections/${collectionId}/items/live`
    : `/collections/${collectionId}/items`;

  return webflowRequest<WebflowItemResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify({ fieldData }),
  });
}

// Generic: Update item in any collection
export async function updateCollectionItem(
  collectionId: string,
  itemId: string,
  fieldData: Record<string, unknown>,
): Promise<WebflowItemResponse> {
  return webflowRequest<WebflowItemResponse>(
    `/collections/${collectionId}/items/${itemId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ fieldData }),
    },
  );
}

// Generic: List items from any collection
export async function listCollectionItems(
  collectionId: string,
  limit = 100,
  offset = 0,
): Promise<WebflowListResponse<WebflowItem>> {
  return webflowRequest(
    `/collections/${collectionId}/items?limit=${limit}&offset=${offset}`,
  );
}

// ============================================================
// ASSET UPLOAD
// ============================================================

const SITE_ID = '68c77f34ca4cc33f6523a3a4';

export interface WebflowAssetResult {
  assetId: string;
  fileId: string;
  url: string;
}

/**
 * Upload a base64 image to Webflow as an asset via the serverless proxy.
 * Returns the asset ID, fileId, and CDN URL.
 */
export async function uploadImageAsset(
  base64DataUrl: string,
  fileName: string,
): Promise<WebflowAssetResult> {
  const token = getWebflowToken();
  if (!token) throw new Error('Webflow API token not configured');

  // Strip the data:image/...;base64, prefix to get raw base64
  const base64Data = base64DataUrl.replace(/^data:image\/[^;]+;base64,/, '');

  const response = await fetch('/api/webflow-asset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webflowToken: token,
      siteId: SITE_ID,
      fileName,
      base64Data,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Asset upload failed: ${response.status}`);
  }

  return response.json();
}

// Verify token is valid by making a test request
export async function verifyToken(): Promise<boolean> {
  try {
    await webflowRequest('/sites');
    return true;
  } catch {
    return false;
  }
}
