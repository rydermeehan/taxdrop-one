// Google Search Console Service
// OAuth 2.0 with server-side token exchange via Vercel proxy

const REDIRECT_URI = window.location.origin;
const SCOPES = 'https://www.googleapis.com/auth/webmasters.readonly';
const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3';
const GSC_OAUTH_PROXY = '/api/gsc-oauth';

// Storage keys
const ACCESS_TOKEN_KEY = 'gsc-access-token';
const REFRESH_TOKEN_KEY = 'gsc-refresh-token';
const TOKEN_EXPIRY_KEY = 'gsc-token-expiry';
const SITE_URL_KEY = 'gsc-site-url';
const CODE_VERIFIER_KEY = 'gsc-code-verifier';
const CLIENT_ID_KEY = 'gsc-client-id';
const CLIENT_SECRET_KEY = 'gsc-client-secret';

// Get OAuth credentials from settings
function getClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY) || '';
}

function getClientSecret(): string {
  return localStorage.getItem(CLIENT_SECRET_KEY) || '';
}

export function setClientId(clientId: string): void {
  localStorage.setItem(CLIENT_ID_KEY, clientId);
}

export function setClientSecret(clientSecret: string): void {
  localStorage.setItem(CLIENT_SECRET_KEY, clientSecret);
}

export function hasClientId(): boolean {
  return !!getClientId();
}

export function hasClientSecret(): boolean {
  return !!getClientSecret();
}

export interface GSCSettings {
  siteUrl: string;
  isConnected: boolean;
}

export interface SearchPerformanceRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  page?: string;
}

export interface SearchPerformanceParams {
  startDate: string;
  endDate: string;
  dimensions?: ('query' | 'page' | 'country' | 'device' | 'date')[];
  rowLimit?: number;
}

export interface URLInspectionResult {
  url: string;
  indexingState: 'INDEXED' | 'NOT_INDEXED' | 'NEUTRAL';
  lastCrawlTime?: string;
  crawlAllowed?: boolean;
  robotsTxtState?: string;
  pageFetchState?: string;
  verdict?: string;
  coverageState?: string;
}

export interface ContentIdea {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  opportunity: 'high' | 'medium' | 'low';
  reason: string;
}

// ============================================
// PKCE Helpers
// ============================================

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).map(x => possible[x % possible.length]).join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hashed = await sha256(verifier);
  return base64urlencode(hashed);
}

// ============================================
// OAuth Functions
// ============================================

export async function initiateOAuth(): Promise<void> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google OAuth Client ID not configured. Please add it in Settings.');
  }

  // Generate and store code verifier
  const codeVerifier = generateRandomString(64);
  sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);

  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function handleOAuthCallback(code: string): Promise<boolean> {
  const codeVerifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
  if (!codeVerifier) {
    console.error('No code verifier found');
    return false;
  }

  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId) {
    console.error('No OAuth client ID configured');
    return false;
  }

  try {
    // Use server-side proxy for token exchange (required for web apps with client secret)
    const response = await fetch(GSC_OAUTH_PROXY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'exchange',
        clientId,
        clientSecret: clientSecret || undefined,
        code,
        codeVerifier,
        redirectUri: REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Token exchange failed:', error);
      return false;
    }

    const data = await response.json();

    // Store tokens
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
    if (data.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }

    // Calculate and store expiry time
    const expiryTime = Date.now() + (data.expires_in * 1000);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());

    // Clean up
    sessionStorage.removeItem(CODE_VERIFIER_KEY);

    return true;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return false;
  }
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!refreshToken || !clientId) {
    return false;
  }

  try {
    // Use server-side proxy for token refresh
    const response = await fetch(GSC_OAUTH_PROXY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'refresh',
        clientId,
        clientSecret: clientSecret || undefined,
        refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed');
      return false;
    }

    const data = await response.json();

    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
    const expiryTime = Date.now() + (data.expires_in * 1000);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());

    return true;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
}

async function getValidAccessToken(): Promise<string | null> {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);

  if (!accessToken) {
    return null;
  }

  // Check if token is expired or will expire in next 5 minutes
  if (expiryTime && Date.now() > parseInt(expiryTime) - 300000) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return null;
    }
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  return accessToken;
}

export function disconnectGSC(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(SITE_URL_KEY);
}

// ============================================
// Settings Management
// ============================================

export function getGSCSettings(): GSCSettings {
  return {
    siteUrl: localStorage.getItem(SITE_URL_KEY) || '',
    isConnected: !!localStorage.getItem(ACCESS_TOKEN_KEY),
  };
}

export function saveGSCSettings(settings: { siteUrl: string }): void {
  localStorage.setItem(SITE_URL_KEY, settings.siteUrl);
}

export function hasGSCConfig(): boolean {
  const settings = getGSCSettings();
  return settings.isConnected && !!settings.siteUrl;
}

export function isGSCConnected(): boolean {
  return !!localStorage.getItem(ACCESS_TOKEN_KEY);
}

// ============================================
// API Request Helper
// ============================================

async function gscRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
): Promise<T> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error('Not authenticated with Google Search Console');
  }

  const url = `${GSC_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Try to refresh token
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry the request
        return gscRequest(endpoint, method, body);
      }
      throw new Error('Authentication expired. Please reconnect to Google Search Console.');
    }

    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `GSC API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// GSC API Functions
// ============================================

// Get list of sites
export async function getSites(): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const response = await gscRequest<{ siteEntry: { siteUrl: string; permissionLevel: string }[] }>('/sites');
  return response.siteEntry || [];
}

// Verify connection by fetching sites
export async function verifyGSCConfig(): Promise<boolean> {
  try {
    if (!isGSCConnected()) {
      return false;
    }
    await getSites();
    return true;
  } catch {
    return false;
  }
}

// Get search performance data
export async function getSearchPerformance(
  params: SearchPerformanceParams
): Promise<SearchPerformanceRow[]> {
  const settings = getGSCSettings();
  if (!settings.siteUrl) {
    throw new Error('Site URL not configured');
  }

  const encodedSiteUrl = encodeURIComponent(settings.siteUrl);
  const response = await gscRequest<{ rows?: SearchPerformanceRow[] }>(
    `/sites/${encodedSiteUrl}/searchAnalytics/query`,
    'POST',
    {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions || ['query'],
      rowLimit: params.rowLimit || 100,
    }
  );

  // GSC API returns rows with 'keys' array containing dimension values
  interface GSCRow {
    keys?: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }

  return ((response.rows || []) as GSCRow[]).map(row => ({
    query: row.keys?.[0] || '',
    page: row.keys?.[1],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));
}

// Get top queries
export async function getTopQueries(
  days: number = 28,
  limit: number = 50
): Promise<SearchPerformanceRow[]> {
  const rows = await getSearchPerformance({
    startDate: getDateString(-days),
    endDate: getDateString(0),
    dimensions: ['query'],
    rowLimit: limit,
  });

  return rows.sort((a, b) => b.clicks - a.clicks);
}

// Get top pages
export async function getTopPages(
  days: number = 28,
  limit: number = 50
): Promise<SearchPerformanceRow[]> {
  const rows = await getSearchPerformance({
    startDate: getDateString(-days),
    endDate: getDateString(0),
    dimensions: ['page'],
    rowLimit: limit,
  });

  return rows.sort((a, b) => b.clicks - a.clicks);
}

// URL Inspection (note: requires different API scope)
export async function inspectURL(url: string): Promise<URLInspectionResult> {
  // URL Inspection API requires a different endpoint and scope
  // For now, return a placeholder
  return {
    url,
    indexingState: 'NEUTRAL',
    verdict: 'URL Inspection requires additional API setup',
  };
}

// Generate content ideas from GSC data
export async function getContentIdeas(days: number = 28): Promise<ContentIdea[]> {
  const rows = await getSearchPerformance({
    startDate: getDateString(-days),
    endDate: getDateString(0),
    dimensions: ['query'],
    rowLimit: 500,
  });

  const ideas: ContentIdea[] = [];

  for (const row of rows) {
    // High impressions but low CTR = opportunity
    if (row.impressions >= 100 && row.ctr < 0.03) {
      ideas.push({
        ...row,
        opportunity: 'high',
        reason: 'High impressions, low CTR - improve title/meta description',
      });
    }
    // Good position but low clicks
    else if (row.position <= 10 && row.clicks < row.impressions * 0.05) {
      ideas.push({
        ...row,
        opportunity: 'high',
        reason: 'Page 1 ranking but low clicks - optimize snippet',
      });
    }
    // Position 11-20 with decent impressions
    else if (row.position > 10 && row.position <= 20 && row.impressions >= 50) {
      ideas.push({
        ...row,
        opportunity: 'medium',
        reason: 'Page 2 - push to page 1 with content updates',
      });
    }
    // Long-tail opportunities
    else if (row.query.split(' ').length >= 4 && row.impressions >= 20) {
      ideas.push({
        ...row,
        opportunity: 'medium',
        reason: 'Long-tail keyword - create dedicated content',
      });
    }
  }

  // Sort by opportunity and impressions
  return ideas.sort((a, b) => {
    const oppOrder = { high: 0, medium: 1, low: 2 };
    if (oppOrder[a.opportunity] !== oppOrder[b.opportunity]) {
      return oppOrder[a.opportunity] - oppOrder[b.opportunity];
    }
    return b.impressions - a.impressions;
  });
}

// Get performance summary
export async function getPerformanceSummary(days: number = 28): Promise<{
  totalClicks: number;
  totalImpressions: number;
  avgCTR: number;
  avgPosition: number;
  topQueries: SearchPerformanceRow[];
  topPages: SearchPerformanceRow[];
}> {
  const [queries, pages] = await Promise.all([
    getTopQueries(days, 10),
    getTopPages(days, 10),
  ]);

  const totalClicks = queries.reduce((sum, r) => sum + r.clicks, 0);
  const totalImpressions = queries.reduce((sum, r) => sum + r.impressions, 0);
  const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const avgPosition =
    queries.length > 0
      ? queries.reduce((sum, r) => sum + r.position, 0) / queries.length
      : 0;

  return {
    totalClicks,
    totalImpressions,
    avgCTR,
    avgPosition,
    topQueries: queries,
    topPages: pages,
  };
}

// Helper to get date string in YYYY-MM-DD format
function getDateString(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}
