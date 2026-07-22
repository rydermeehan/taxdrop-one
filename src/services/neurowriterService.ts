// NeuronWriter Service
// Content optimization and AI writing assistance
// API Docs: https://neuronwriter.com/faqs/neuronwriter-api-how-to-use/
// Uses Vercel serverless function to proxy requests (avoids CORS)

const API_KEY_STORAGE = 'neurowriter-api-key';

// Use relative path for API - works in both dev and production
const NEUROWRITER_PROXY_URL = '/api/neurowriter';

export interface NeurowriterSettings {
  apiKey: string;
}

// NeuronWriter API Types
export interface NWProject {
  project: string;
  name: string;
  language: string;
  engine: string;
}

export interface NWQuery {
  query: string;
  keyword: string;
  status: 'pending' | 'ready' | 'error';
  score?: number;
  language?: string;
  engine?: string;
  created_at?: string;
  query_url?: string;
  share_url?: string;
  readonly_url?: string;
}

export interface NWQueryResult {
  status: string;
  score?: number;
  terms?: NWTerm[];
  questions?: string[];
  competitors?: NWCompetitor[];
  recommended_length?: number;
  title_recommendations?: string[];
  meta_recommendations?: string[];
}

export interface NWTerm {
  term: string;
  importance: number;
  count_min?: number;
  count_max?: number;
  your_count?: number;
}

export interface NWCompetitor {
  url: string;
  title: string;
  score: number;
  position: number;
}

export interface NWContent {
  html: string;
  title?: string;
  description?: string;
  created_at?: string;
}

export interface NWEvaluationResult {
  status: string;
  score: number;
  terms_used?: number;
  terms_total?: number;
}

// Legacy types for compatibility
export interface ContentScore {
  overall: number;
  readability: number;
  seo: number;
  engagement: number;
  suggestions: ContentSuggestion[];
}

export interface ContentSuggestion {
  type: 'keyword' | 'readability' | 'structure' | 'length' | 'meta';
  severity: 'high' | 'medium' | 'low';
  message: string;
  position?: { start: number; end: number };
}

export interface Keyword {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc?: number;
  trend?: 'up' | 'down' | 'stable';
  relatedKeywords?: string[];
}

export interface GeneratedContent {
  title: string;
  content: string;
  metaDescription?: string;
  suggestedKeywords?: string[];
}

// Settings management
export function getNeurowriterSettings(): NeurowriterSettings {
  return {
    apiKey: localStorage.getItem(API_KEY_STORAGE) || '',
  };
}

export function saveNeurowriterSettings(settings: NeurowriterSettings): void {
  if (settings.apiKey) {
    localStorage.setItem(API_KEY_STORAGE, settings.apiKey);
  }
}

export function hasNeurowriterConfig(): boolean {
  const settings = getNeurowriterSettings();
  return !!settings.apiKey;
}

// Generic request helper - routes through Vercel serverless proxy
async function neurowriterRequest<T>(
  endpoint: string,
  body?: Record<string, unknown>
): Promise<T> {
  const settings = getNeurowriterSettings();
  if (!settings.apiKey) {
    throw new Error('NeuronWriter API key not configured');
  }

  // Send request to Vercel serverless function which proxies to NeuronWriter
  const response = await fetch(NEUROWRITER_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint,
      apiKey: settings.apiKey,
      body: body || {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`NeuronWriter ${endpoint} error (${response.status}):`, errorText);
    let errorObj: Record<string, unknown> = {};
    try { errorObj = JSON.parse(errorText); } catch { /* raw text */ }
    throw new Error(errorObj.message as string || errorObj.error as string || `NeuronWriter API error: ${response.status}`);
  }

  const data = await response.json();
  console.log(`NeuronWriter ${endpoint} response:`, data);
  return data;
}

// Verify API key
export async function verifyNeurowriterConfig(): Promise<boolean> {
  try {
    const settings = getNeurowriterSettings();
    if (!settings.apiKey) {
      return false;
    }

    // Try listing projects to verify the API key works
    await neurowriterRequest('/list-projects', {});
    return true;
  } catch {
    return false;
  }
}

// ============================================
// NeuronWriter Native API Functions
// ============================================

// List all projects
export async function listProjects(): Promise<NWProject[]> {
  const response = await neurowriterRequest<NWProject[] | { projects: NWProject[] }>('/list-projects', {});
  // Handle both formats: direct array or { projects: [...] }
  if (Array.isArray(response)) {
    return response;
  }
  return response.projects || [];
}

// Create a new keyword analysis query
export async function createQuery(params: {
  project: string;
  keyword: string;
  engine?: string;
  language?: string;
}): Promise<NWQuery> {
  const response = await neurowriterRequest<NWQuery>('/new-query', {
    project: params.project,
    keyword: params.keyword,
    engine: params.engine || 'google.com',
    language: params.language || 'en',
  });
  return response;
}

// Get query results/recommendations
export async function getQuery(queryId: string): Promise<NWQueryResult> {
  const response = await neurowriterRequest<NWQueryResult>('/get-query', {
    query: queryId,
  });
  return response;
}

// List queries in a project
export async function listQueries(params: {
  project: string;
  status?: string;
  keyword?: string;
  limit?: number;
}): Promise<NWQuery[]> {
  const response = await neurowriterRequest<NWQuery[] | { queries: NWQuery[] }>('/list-queries', {
    project: params.project,
    status: params.status,
    keyword: params.keyword,
  });
  // Handle both formats: direct array or { queries: [...] }
  if (Array.isArray(response)) {
    return response;
  }
  return response.queries || [];
}

// Get saved content for a query
export async function getContent(queryId: string): Promise<NWContent> {
  const response = await neurowriterRequest<NWContent>('/get-content', {
    query: queryId,
  });
  return response;
}

// Import/update content for a query
export async function importContent(params: {
  query: string;
  html?: string;
  url?: string;
  title?: string;
  description?: string;
}): Promise<{ status: string }> {
  const response = await neurowriterRequest<{ status: string }>('/import-content', params);
  return response;
}

// Evaluate content without saving
export async function evaluateContent(params: {
  query: string;
  html?: string;
  url?: string;
}): Promise<NWEvaluationResult> {
  const response = await neurowriterRequest<NWEvaluationResult>('/evaluate-content', params);
  return response;
}

// ============================================
// Helper Functions
// ============================================

// Convert NeuronWriter terms to keyword format
export function termsToKeywords(terms: NWTerm[]): Keyword[] {
  return terms.map(term => ({
    keyword: term.term,
    volume: 0, // NeuronWriter doesn't provide volume
    difficulty: Math.round((1 - term.importance) * 100),
    trend: 'stable' as const,
  }));
}

// Convert query result to content score format
export function queryResultToScore(result: NWQueryResult): ContentScore {
  const score = result.score || 0;
  const suggestions: ContentSuggestion[] = [];

  // Add term suggestions
  if (result.terms) {
    const missingTerms = result.terms.filter(t => (t.your_count || 0) < (t.count_min || 1));
    missingTerms.slice(0, 5).forEach(term => {
      suggestions.push({
        type: 'keyword',
        severity: term.importance > 0.7 ? 'high' : term.importance > 0.4 ? 'medium' : 'low',
        message: `Add "${term.term}" (use ${term.count_min || 1}-${term.count_max || 3} times)`,
      });
    });
  }

  // Add length suggestion
  if (result.recommended_length) {
    suggestions.push({
      type: 'length',
      severity: 'medium',
      message: `Recommended content length: ~${result.recommended_length} words`,
    });
  }

  return {
    overall: score,
    seo: score,
    readability: Math.min(100, score + 10), // Approximate
    engagement: Math.min(100, score + 5), // Approximate
    suggestions,
  };
}
