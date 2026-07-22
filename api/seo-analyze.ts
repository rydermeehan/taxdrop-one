import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as cheerio from 'cheerio';
import dnsPromises from 'node:dns/promises';
import net from 'node:net';

// ─── Types ───────────────────────────────────────────────────────────────────

type IssuePriority = 'critical' | 'high' | 'medium' | 'low';
type CategoryType = 'on-page' | 'technical' | 'content' | 'schema' | 'images' | 'geo';

interface SEOIssue {
  category: CategoryType;
  priority: IssuePriority;
  title: string;
  description: string;
  recommendation: string;
}

interface PageFetchResult {
  html: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  redirectChain: string[];
}

interface ParsedHTML {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  metaRobots: string | null;
  canonical: string | null;
  viewport: boolean;
  h1Tags: string[];
  h2Tags: string[];
  h3Tags: string[];
  headingHierarchy: { tag: string; text: string }[];
  images: { src: string; alt: string | null; width: string | null; height: string | null; loading: string | null; format: string }[];
  internalLinks: { href: string; text: string }[];
  externalLinks: { href: string; text: string }[];
  jsonLdBlocks: unknown[];
  ogTags: Record<string, string>;
  twitterCard: Record<string, string>;
  hreflangTags: { lang: string; href: string }[];
  wordCount: number;
  hasAuthorByline: boolean;
  hasDates: boolean;
  avgSentenceLength: number;
  avgParagraphLength: number;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing url parameter' });

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // SSRF guard: reject non-http(s) schemes and any host that resolves to a
  // private / loopback / link-local / reserved address (cloud metadata at
  // 169.254.169.254, localhost, RFC-1918, etc.). Re-checked on every redirect
  // hop inside guardedFetch below.
  try {
    await assertPublicUrl(parsedUrl.href);
  } catch (e) {
    const scheme = e instanceof Error && e.message === UNSUPPORTED_SCHEME;
    return res.status(400).json({ error: scheme ? 'Unsupported URL scheme (only http/https allowed)' : 'URL host is not allowed' });
  }

  try {
    // 1. Fetch the page
    const pageResult = await fetchPage(parsedUrl.href);

    // 2. Parse HTML
    const parsed = parseHTML(pageResult.html, pageResult.finalUrl);

    // 3. Fetch robots.txt and llms.txt in parallel
    const [robotsTxt, llmsTxt] = await Promise.all([
      fetchRobotsTxt(pageResult.finalUrl).catch(() => ({ exists: false, content: null, aiCrawlers: [] as { name: string; allowed: boolean }[] })),
      fetchLlmsTxt(pageResult.finalUrl).catch(() => false),
    ]);

    // 4. Run analysis
    const issues: SEOIssue[] = [];

    const onPageScore = analyzeOnPage(parsed, pageResult, issues);
    const technicalScore = analyzeTechnical(parsed, pageResult, robotsTxt, issues);
    const contentScore = analyzeContent(parsed, pageResult, issues);
    const schemaScore = analyzeSchema(parsed, issues);
    const imagesScore = analyzeImages(parsed, issues);
    const geoScore = analyzeGEO(parsed, robotsTxt, llmsTxt, issues);

    // Weighted health score
    const healthScore = Math.round(
      technicalScore * 0.30 +
      contentScore * 0.30 +
      onPageScore * 0.20 +
      schemaScore * 0.10 +
      imagesScore * 0.05 +
      geoScore * 0.05
    );

    // Sort issues by priority
    const priorityOrder: Record<IssuePriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    issues.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return res.status(200).json({
      url: pageResult.finalUrl,
      analyzedAt: new Date().toISOString(),
      healthScore: clamp(healthScore),
      scores: {
        onPage: clamp(onPageScore),
        technical: clamp(technicalScore),
        content: clamp(contentScore),
        schema: clamp(schemaScore),
        images: clamp(imagesScore),
        geo: clamp(geoScore),
      },
      issues,
      onPage: {
        score: clamp(onPageScore),
        title: { value: parsed.title, length: parsed.titleLength, issues: [] },
        metaDescription: { value: parsed.metaDescription, length: parsed.metaDescriptionLength, issues: [] },
        h1Tags: parsed.h1Tags,
        headingHierarchy: parsed.headingHierarchy,
        canonical: parsed.canonical,
        ogTags: parsed.ogTags,
        twitterCard: parsed.twitterCard,
        internalLinkCount: parsed.internalLinks.length,
        externalLinkCount: parsed.externalLinks.length,
      },
      technical: {
        score: clamp(technicalScore),
        https: parsedUrl.protocol === 'https:',
        securityHeaders: getSecurityHeaders(pageResult.headers),
        robotsTxt,
        metaRobots: parsed.metaRobots,
        redirectChain: pageResult.redirectChain,
        viewport: parsed.viewport,
        statusCode: pageResult.statusCode,
      },
      content: {
        score: clamp(contentScore),
        wordCount: parsed.wordCount,
        pageType: detectPageType(pageResult.finalUrl),
        minWordsForType: getMinWords(detectPageType(pageResult.finalUrl)),
        hasAuthorByline: parsed.hasAuthorByline,
        hasDates: parsed.hasDates,
        readability: {
          avgSentenceLength: parsed.avgSentenceLength,
          avgParagraphLength: parsed.avgParagraphLength,
          score: parsed.avgSentenceLength <= 20 ? 'Good' : parsed.avgSentenceLength <= 25 ? 'Fair' : 'Poor',
        },
        internalLinkDensity: parsed.wordCount > 0
          ? Math.round((parsed.internalLinks.length / parsed.wordCount) * 1000 * 10) / 10
          : 0,
      },
      schema: {
        score: clamp(schemaScore),
        blocks: (parsed.jsonLdBlocks as Record<string, unknown>[]).map(block => {
          const type = (block['@type'] as string) || 'Unknown';
          const deprecated = isDeprecatedSchema(type);
          return {
            type,
            valid: !deprecated,
            properties: Object.keys(block).filter(k => !k.startsWith('@')),
            issues: deprecated ? [`${type} is deprecated`] : [],
          };
        }),
        recommendations: getSchemaRecommendations(parsed),
      },
      images: {
        score: clamp(imagesScore),
        totalImages: parsed.images.length,
        missingAlt: parsed.images.filter(i => !i.alt).length,
        missingDimensions: parsed.images.filter(i => !i.width || !i.height).length,
        missingLazyLoading: parsed.images.filter(i => i.loading !== 'lazy').length,
        nonOptimalFormat: parsed.images.filter(i => !['webp', 'avif', 'svg'].includes(i.format)).length,
        images: parsed.images.slice(0, 20),
      },
      geo: {
        score: clamp(geoScore),
        aiCrawlerAccess: robotsTxt.aiCrawlers,
        llmsTxtExists: llmsTxt as boolean,
        ssrDetected: parsed.wordCount > 50,
        citabilitySignals: getCitabilitySignals(parsed),
      },
    });
  } catch (error) {
    console.error('SEO analyze error:', error);
    return res.status(500).json({
      error: 'Analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ─── SSRF Guard ──────────────────────────────────────────────────────────────

export const UNSUPPORTED_SCHEME = 'unsupported_scheme';
const BLOCKED_HOST = 'blocked_host';

function ipv4ToInt(ip: string): number {
  const p = ip.split('.').map(Number);
  return (((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]) >>> 0;
}

function inV4Range(ip: number, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (ipv4ToInt(base) & mask);
}

function isBlockedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return (
    inV4Range(n, '0.0.0.0', 8) ||        // "this" network
    inV4Range(n, '10.0.0.0', 8) ||       // RFC-1918 private
    inV4Range(n, '100.64.0.0', 10) ||    // carrier-grade NAT
    inV4Range(n, '127.0.0.0', 8) ||      // loopback
    inV4Range(n, '169.254.0.0', 16) ||   // link-local (incl. 169.254.169.254 metadata)
    inV4Range(n, '172.16.0.0', 12) ||    // RFC-1918 private
    inV4Range(n, '192.0.0.0', 24) ||     // IETF protocol assignments
    inV4Range(n, '192.168.0.0', 16) ||   // RFC-1918 private
    inV4Range(n, '198.18.0.0', 15) ||    // benchmarking
    inV4Range(n, '224.0.0.0', 4) ||      // multicast
    inV4Range(n, '240.0.0.0', 4)         // reserved
  );
}

function isBlockedIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0]; // strip zone id
  if (addr === '::1' || addr === '::') return true;                 // loopback / unspecified
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);       // IPv4-mapped
  if (mapped) return isBlockedIPv4(mapped[1]);
  if (/^f[cd]/.test(addr)) return true;                            // unique-local fc00::/7
  if (/^fe[89ab]/.test(addr)) return true;                        // link-local fe80::/10
  if (/^ff/.test(addr)) return true;                              // multicast ff00::/8
  return false;
}

/** True when an IP literal falls in a range we must never fetch. Unknown → blocked. */
export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedIPv4(ip);
  if (net.isIPv6(ip)) return isBlockedIPv6(ip);
  return true;
}

/**
 * Throw unless `rawUrl` is http/https AND its host resolves only to public
 * addresses. Called before the initial fetch and again for every redirect hop.
 * Note: this resolves-then-fetches, so a determined DNS-rebinding attacker could
 * still race the TTL; pinning the resolved IP into the socket would close that,
 * but is not expressible with fetch(). The resolve-and-block check stops the
 * overwhelming majority of SSRF (metadata, localhost, RFC-1918, redirects).
 */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  const u = new URL(rawUrl);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error(UNSUPPORTED_SCHEME);
  const host = u.hostname.replace(/^\[|\]$/g, ''); // unwrap [::1] style literals
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new Error(BLOCKED_HOST);
    return;
  }
  const results = await dnsPromises.lookup(host, { all: true });
  if (!results.length) throw new Error(BLOCKED_HOST);
  for (const r of results) {
    if (isBlockedIp(r.address)) throw new Error(BLOCKED_HOST);
  }
}

/**
 * fetch() with manual redirect following, re-validating the host against the
 * SSRF guard on EVERY hop (an attacker can point a public URL at a 302 → an
 * internal address). Caps redirects; returns the final response + hop chain.
 */
async function guardedFetch(
  startUrl: string,
  init: RequestInit,
  maxRedirects = 5,
): Promise<{ response: Response; finalUrl: string; redirectChain: string[] }> {
  const redirectChain: string[] = [];
  let currentUrl = startUrl;
  let response: Response | null = null;

  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(currentUrl); // re-validate before each network call
    response = await fetch(currentUrl, { ...init, redirect: 'manual' });

    if (response.status >= 300 && response.status < 400 && i < maxRedirects) {
      const location = response.headers.get('location');
      if (location) {
        redirectChain.push(currentUrl);
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }
    }
    break;
  }

  if (!response) throw new Error('Failed to fetch');
  return { response, finalUrl: currentUrl, redirectChain };
}

// ─── Fetch Functions ─────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<PageFetchResult> {
  const { response, finalUrl, redirectChain } = await guardedFetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  const html = (await response.text()).slice(0, 2_000_000); // Cap at 2MB
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });

  return {
    html,
    finalUrl,
    statusCode: response.status,
    headers,
    redirectChain,
  };
}

async function fetchRobotsTxt(url: string) {
  const origin = new URL(url).origin;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const { response } = await guardedFetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TaxDropSEO/1.0)' },
      signal: controller.signal,
    }, 3);

    if (!response.ok) return { exists: false, content: null, aiCrawlers: [] as { name: string; allowed: boolean }[] };

    const content = await response.text();
    const aiCrawlerNames = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot', 'anthropic-ai'];
    const aiCrawlers = aiCrawlerNames.map(name => ({
      name,
      allowed: !isBlockedInRobotsTxt(content, name),
    }));

    return { exists: true, content, aiCrawlers };
  } finally {
    clearTimeout(timeout);
  }
}

function isBlockedInRobotsTxt(content: string, botName: string): boolean {
  const lines = content.split('\n');
  let currentAgent = '';
  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    if (trimmed.startsWith('user-agent:')) {
      currentAgent = trimmed.replace('user-agent:', '').trim();
    }
    if ((currentAgent === botName.toLowerCase() || currentAgent === '*') && trimmed.startsWith('disallow: /')) {
      if (trimmed === 'disallow: /') return true;
    }
  }
  return false;
}

async function fetchLlmsTxt(url: string): Promise<boolean> {
  const origin = new URL(url).origin;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const { response } = await guardedFetch(`${origin}/llms.txt`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TaxDropSEO/1.0)' },
      signal: controller.signal,
    }, 3);
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── HTML Parsing ────────────────────────────────────────────────────────────

function parseHTML(html: string, baseUrl: string): ParsedHTML {
  const $ = cheerio.load(html);
  const origin = new URL(baseUrl).origin;

  // Title
  const title = $('title').first().text().trim() || null;

  // Meta tags
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;
  const metaRobots = $('meta[name="robots"]').attr('content')?.trim() || null;
  const canonical = $('link[rel="canonical"]').attr('href')?.trim() || null;
  const viewport = $('meta[name="viewport"]').length > 0;

  // Headings
  const h1Tags = $('h1').map((_, el) => $(el).text().trim()).get();
  const h2Tags = $('h2').map((_, el) => $(el).text().trim()).get();
  const h3Tags = $('h3').map((_, el) => $(el).text().trim()).get();

  const headingHierarchy: { tag: string; text: string }[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    headingHierarchy.push({ tag: el.tagName, text: $(el).text().trim().slice(0, 100) });
  });

  // Images
  const images = $('img').map((_, el) => {
    const src = $(el).attr('src') || '';
    const ext = src.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
    return {
      src: src.slice(0, 200),
      alt: $(el).attr('alt')?.trim() || null,
      width: $(el).attr('width') || null,
      height: $(el).attr('height') || null,
      loading: $(el).attr('loading') || null,
      format: ext,
    };
  }).get().slice(0, 50);

  // Links
  const internalLinks: { href: string; text: string }[] = [];
  const externalLinks: { href: string; text: string }[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim().slice(0, 100);
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.origin === origin) {
        internalLinks.push({ href: resolved.pathname, text });
      } else if (resolved.protocol.startsWith('http')) {
        externalLinks.push({ href: resolved.href.slice(0, 200), text });
      }
    } catch {
      // Skip invalid URLs
    }
  });

  // JSON-LD
  const jsonLdBlocks: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '');
      if (Array.isArray(data)) {
        jsonLdBlocks.push(...data);
      } else {
        jsonLdBlocks.push(data);
      }
    } catch {
      // Skip invalid JSON-LD
    }
  });

  // OG Tags
  const ogTags: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property');
    const content = $(el).attr('content');
    if (prop && content) ogTags[prop] = content;
  });

  // Twitter Card
  const twitterCard: Record<string, string> = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    if (name && content) twitterCard[name] = content;
  });

  // Hreflang
  const hreflangTags = $('link[rel="alternate"][hreflang]').map((_, el) => ({
    lang: $(el).attr('hreflang') || '',
    href: $(el).attr('href') || '',
  })).get();

  // Word count (strip non-content elements)
  $('script, style, nav, footer, header, noscript').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const words = bodyText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Readability
  const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const avgSentenceLength = sentences.length > 0
    ? Math.round(words.length / sentences.length)
    : 0;

  const paragraphs = bodyText.split(/\n\n+/).filter(p => p.trim().length > 20);
  const avgParagraphLength = paragraphs.length > 0
    ? Math.round(sentences.length / Math.max(paragraphs.length, 1))
    : 0;

  // Author byline detection
  const htmlLower = html.toLowerCase();
  const hasAuthorByline =
    $('[rel="author"]').length > 0 ||
    $('[class*="author"]').length > 0 ||
    $('[itemprop="author"]').length > 0 ||
    jsonLdBlocks.some(b => (b as Record<string, unknown>)['author']) ||
    htmlLower.includes('written by') ||
    htmlLower.includes('by the ') ||
    htmlLower.includes('author:');

  // Date detection
  const hasDates =
    $('time[datetime]').length > 0 ||
    $('[class*="date"]').length > 0 ||
    $('[itemprop="datePublished"]').length > 0 ||
    jsonLdBlocks.some(b => (b as Record<string, unknown>)['datePublished']);

  return {
    title,
    titleLength: title?.length || 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length || 0,
    metaRobots,
    canonical,
    viewport,
    h1Tags,
    h2Tags,
    h3Tags,
    headingHierarchy,
    images,
    internalLinks: internalLinks.slice(0, 100),
    externalLinks: externalLinks.slice(0, 50),
    jsonLdBlocks,
    ogTags,
    twitterCard,
    hreflangTags,
    wordCount,
    hasAuthorByline,
    hasDates,
    avgSentenceLength,
    avgParagraphLength,
  };
}

// ─── Analysis Functions ──────────────────────────────────────────────────────

function analyzeOnPage(parsed: ParsedHTML, page: PageFetchResult, issues: SEOIssue[]): number {
  let score = 100;

  // Title
  if (!parsed.title) {
    score -= 20;
    issues.push({ category: 'on-page', priority: 'critical', title: 'Missing title tag', description: 'No <title> tag found on the page.', recommendation: 'Add a unique, descriptive title tag between 30-60 characters.' });
  } else {
    if (parsed.titleLength < 30) {
      score -= 10;
      issues.push({ category: 'on-page', priority: 'medium', title: 'Title tag too short', description: `Title is ${parsed.titleLength} characters (minimum 30).`, recommendation: 'Expand your title to include your primary keyword and a compelling description.' });
    }
    if (parsed.titleLength > 60) {
      score -= 5;
      issues.push({ category: 'on-page', priority: 'low', title: 'Title tag too long', description: `Title is ${parsed.titleLength} characters (maximum 60). May be truncated in search results.`, recommendation: 'Shorten your title to 60 characters or fewer.' });
    }
  }

  // Meta Description
  if (!parsed.metaDescription) {
    score -= 15;
    issues.push({ category: 'on-page', priority: 'high', title: 'Missing meta description', description: 'No meta description found.', recommendation: 'Add a compelling meta description between 120-160 characters with a clear call to action.' });
  } else {
    if (parsed.metaDescriptionLength < 120) {
      score -= 5;
      issues.push({ category: 'on-page', priority: 'low', title: 'Meta description too short', description: `Meta description is ${parsed.metaDescriptionLength} characters (minimum 120).`, recommendation: 'Expand your meta description to better summarize the page content.' });
    }
    if (parsed.metaDescriptionLength > 160) {
      score -= 3;
      issues.push({ category: 'on-page', priority: 'low', title: 'Meta description too long', description: `Meta description is ${parsed.metaDescriptionLength} characters (maximum 160).`, recommendation: 'Shorten your meta description to prevent truncation in search results.' });
    }
  }

  // H1
  if (parsed.h1Tags.length === 0) {
    score -= 15;
    issues.push({ category: 'on-page', priority: 'critical', title: 'Missing H1 tag', description: 'No H1 heading found on the page.', recommendation: 'Add a single, descriptive H1 tag that includes your primary keyword.' });
  } else if (parsed.h1Tags.length > 1) {
    score -= 10;
    issues.push({ category: 'on-page', priority: 'medium', title: 'Multiple H1 tags', description: `Found ${parsed.h1Tags.length} H1 tags. Pages should have exactly one.`, recommendation: 'Use a single H1 tag and change others to H2 or lower.' });
  }

  // Heading hierarchy
  if (parsed.headingHierarchy.length > 1) {
    let broken = false;
    for (let i = 1; i < parsed.headingHierarchy.length; i++) {
      const prev = parseInt(parsed.headingHierarchy[i - 1].tag.replace('h', ''));
      const curr = parseInt(parsed.headingHierarchy[i].tag.replace('h', ''));
      if (curr > prev + 1) { broken = true; break; }
    }
    if (broken) {
      score -= 5;
      issues.push({ category: 'on-page', priority: 'medium', title: 'Heading hierarchy broken', description: 'Heading levels are skipped (e.g., H1 to H3 without H2).', recommendation: 'Maintain a logical heading hierarchy: H1 > H2 > H3.' });
    }
  }

  // Canonical
  if (!parsed.canonical) {
    score -= 10;
    issues.push({ category: 'on-page', priority: 'high', title: 'Missing canonical tag', description: 'No canonical URL specified.', recommendation: 'Add a self-referencing canonical tag to prevent duplicate content issues.' });
  }

  // OG Tags
  const requiredOg = ['og:title', 'og:description', 'og:image', 'og:url'];
  const missingOg = requiredOg.filter(tag => !parsed.ogTags[tag]);
  if (missingOg.length > 0) {
    score -= missingOg.length * 3;
    issues.push({ category: 'on-page', priority: 'medium', title: 'Missing Open Graph tags', description: `Missing: ${missingOg.join(', ')}.`, recommendation: 'Add all required Open Graph tags for better social media sharing.' });
  }

  // Twitter Card
  if (!parsed.twitterCard['twitter:card']) {
    score -= 5;
    issues.push({ category: 'on-page', priority: 'low', title: 'Missing Twitter Card', description: 'No Twitter Card meta tags found.', recommendation: 'Add twitter:card, twitter:title, twitter:description meta tags.' });
  }

  // Internal links
  if (parsed.internalLinks.length === 0) {
    score -= 10;
    issues.push({ category: 'on-page', priority: 'high', title: 'No internal links', description: 'No internal links found on the page.', recommendation: 'Add relevant internal links to help users and search engines navigate your site.' });
  }

  return score;
}

function analyzeTechnical(
  parsed: ParsedHTML,
  page: PageFetchResult,
  robotsTxt: { exists: boolean; content: string | null; aiCrawlers: { name: string; allowed: boolean }[] },
  issues: SEOIssue[]
): number {
  let score = 100;

  // HTTPS
  if (!page.finalUrl.startsWith('https://')) {
    score -= 25;
    issues.push({ category: 'technical', priority: 'critical', title: 'Not using HTTPS', description: 'The page is served over HTTP instead of HTTPS.', recommendation: 'Migrate to HTTPS. This is a confirmed Google ranking factor.' });
  }

  // Security headers
  const secHeaders = [
    { name: 'content-security-policy', label: 'Content-Security-Policy' },
    { name: 'strict-transport-security', label: 'Strict-Transport-Security' },
    { name: 'x-frame-options', label: 'X-Frame-Options' },
    { name: 'x-content-type-options', label: 'X-Content-Type-Options' },
    { name: 'referrer-policy', label: 'Referrer-Policy' },
  ];
  const missingHeaders = secHeaders.filter(h => !page.headers[h.name]);
  if (missingHeaders.length > 0) {
    score -= Math.min(missingHeaders.length * 5, 20);
    issues.push({ category: 'technical', priority: 'medium', title: `Missing security headers (${missingHeaders.length})`, description: `Missing: ${missingHeaders.map(h => h.label).join(', ')}.`, recommendation: 'Configure your server to include these security headers.' });
  }

  // robots.txt
  if (!robotsTxt.exists) {
    score -= 10;
    issues.push({ category: 'technical', priority: 'high', title: 'No robots.txt', description: 'No robots.txt file found at the domain root.', recommendation: 'Create a robots.txt file to guide search engine crawlers.' });
  }

  // Meta robots blocking
  if (parsed.metaRobots && (parsed.metaRobots.includes('noindex') || parsed.metaRobots.includes('none'))) {
    score -= 20;
    issues.push({ category: 'technical', priority: 'critical', title: 'Page blocked from indexing', description: `Meta robots directive: "${parsed.metaRobots}". This page will not appear in search results.`, recommendation: 'Remove the noindex directive if this page should be indexed.' });
  }

  // Redirect chain
  if (page.redirectChain.length > 1) {
    score -= (page.redirectChain.length - 1) * 5;
    issues.push({ category: 'technical', priority: page.redirectChain.length > 2 ? 'high' : 'medium', title: `Redirect chain (${page.redirectChain.length} hops)`, description: `The URL passes through ${page.redirectChain.length} redirects before reaching the final page.`, recommendation: 'Reduce redirect chains to a single hop for faster page loading.' });
  }

  // Viewport
  if (!parsed.viewport) {
    score -= 15;
    issues.push({ category: 'technical', priority: 'critical', title: 'Missing viewport meta tag', description: 'No viewport meta tag found. The page may not render properly on mobile devices.', recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head>.' });
  }

  // Status code
  if (page.statusCode !== 200) {
    score -= 20;
    issues.push({ category: 'technical', priority: 'critical', title: `Non-200 status code (${page.statusCode})`, description: `The page returned HTTP ${page.statusCode}.`, recommendation: 'Ensure the page returns a 200 OK status code.' });
  }

  return score;
}

function analyzeContent(parsed: ParsedHTML, page: PageFetchResult, issues: SEOIssue[]): number {
  let score = 100;

  const pageType = detectPageType(page.finalUrl);
  const minWords = getMinWords(pageType);

  // Word count
  if (parsed.wordCount < minWords) {
    const deficit = minWords - parsed.wordCount;
    score -= 25;
    if (parsed.wordCount < minWords * 0.5) score -= 15;
    issues.push({ category: 'content', priority: parsed.wordCount < minWords * 0.5 ? 'critical' : 'high', title: 'Thin content', description: `Page has ${parsed.wordCount} words. Minimum for a ${pageType} page is ${minWords}. ${deficit} more words needed.`, recommendation: `Expand content to at least ${minWords} words with valuable, relevant information.` });
  }

  // Author byline
  if (!parsed.hasAuthorByline) {
    score -= 10;
    issues.push({ category: 'content', priority: 'medium', title: 'No author byline', description: 'No author attribution found. This weakens E-E-A-T signals.', recommendation: 'Add an author byline with credentials or a link to an author page.' });
  }

  // Dates
  if (!parsed.hasDates) {
    score -= 10;
    issues.push({ category: 'content', priority: 'medium', title: 'No publication date', description: 'No publication or update date found on the page.', recommendation: 'Add visible publication and last-updated dates to show content freshness.' });
  }

  // Readability
  if (parsed.avgSentenceLength > 25) {
    score -= 10;
    issues.push({ category: 'content', priority: 'medium', title: 'Poor readability', description: `Average sentence length is ${parsed.avgSentenceLength} words (target: 15-20).`, recommendation: 'Break long sentences into shorter ones. Aim for 15-20 words per sentence.' });
  }

  // Internal link density
  const linkDensity = parsed.wordCount > 0 ? (parsed.internalLinks.length / parsed.wordCount) * 1000 : 0;
  if (linkDensity < 3 && parsed.wordCount > 300) {
    score -= 10;
    issues.push({ category: 'content', priority: 'medium', title: 'Low internal linking', description: `Internal link density is ${linkDensity.toFixed(1)} per 1,000 words (target: 3-5).`, recommendation: 'Add more internal links to relevant pages on your site.' });
  }

  return score;
}

function analyzeSchema(parsed: ParsedHTML, issues: SEOIssue[]): number {
  let score = 100;

  if (parsed.jsonLdBlocks.length === 0) {
    score -= 40;
    issues.push({ category: 'schema', priority: 'high', title: 'No structured data', description: 'No JSON-LD schema markup found.', recommendation: 'Add Organization, WebSite, and page-type specific schema markup (e.g., Article, LocalBusiness).' });
    return score;
  }

  const types = parsed.jsonLdBlocks.map(b => (b as Record<string, unknown>)['@type'] as string).filter(Boolean);

  // Check for deprecated types
  const deprecated = ['HowTo', 'SpecialAnnouncement', 'CourseInfo', 'EstimatedSalary', 'ClaimReview'];
  for (const type of types) {
    if (deprecated.includes(type)) {
      score -= 20;
      issues.push({ category: 'schema', priority: 'high', title: `Deprecated schema: ${type}`, description: `The ${type} schema type is deprecated by Google and no longer generates rich results.`, recommendation: `Remove the ${type} schema markup.` });
    }
  }

  // Check for essential schemas
  const hasOrg = types.some(t => t === 'Organization' || t === 'LocalBusiness');
  const hasWebSite = types.some(t => t === 'WebSite');
  if (!hasOrg && !hasWebSite) {
    score -= 15;
    issues.push({ category: 'schema', priority: 'medium', title: 'Missing core schema types', description: 'No Organization or WebSite schema found.', recommendation: 'Add Organization and WebSite schema to establish entity identity.' });
  }

  // Validate @context
  for (const block of parsed.jsonLdBlocks) {
    const ctx = (block as Record<string, unknown>)['@context'] as string;
    if (ctx && ctx.startsWith('http://schema.org')) {
      score -= 5;
      issues.push({ category: 'schema', priority: 'low', title: 'Use HTTPS for schema context', description: '@context uses http://schema.org instead of https://schema.org.', recommendation: 'Update @context to use https://schema.org.' });
      break;
    }
  }

  return score;
}

function analyzeImages(parsed: ParsedHTML, issues: SEOIssue[]): number {
  if (parsed.images.length === 0) return 100;

  let score = 100;
  const total = parsed.images.length;
  const missingAlt = parsed.images.filter(i => !i.alt).length;
  const missingDims = parsed.images.filter(i => !i.width || !i.height).length;
  const missingLazy = parsed.images.filter(i => i.loading !== 'lazy').length;
  const nonOptimal = parsed.images.filter(i => !['webp', 'avif', 'svg'].includes(i.format)).length;

  if (missingAlt > 0) {
    score -= Math.round((missingAlt / total) * 40);
    issues.push({ category: 'images', priority: missingAlt > total * 0.5 ? 'high' : 'medium', title: `Missing alt text (${missingAlt}/${total})`, description: `${missingAlt} images are missing alt text.`, recommendation: 'Add descriptive alt text (10-125 characters) to all non-decorative images.' });
  }

  if (missingDims > 0) {
    score -= Math.round((missingDims / total) * 30);
    issues.push({ category: 'images', priority: 'medium', title: `Missing dimensions (${missingDims}/${total})`, description: `${missingDims} images lack explicit width/height attributes, which can cause layout shifts (CLS).`, recommendation: 'Add width and height attributes to all <img> tags.' });
  }

  if (missingLazy > 0 && missingLazy < total) {
    score -= Math.round((missingLazy / total) * 15);
    issues.push({ category: 'images', priority: 'low', title: `Missing lazy loading (${missingLazy}/${total})`, description: `${missingLazy} images are not using lazy loading.`, recommendation: 'Add loading="lazy" to below-fold images. Keep loading="eager" for above-fold images.' });
  }

  if (nonOptimal > 0) {
    score -= Math.round((nonOptimal / total) * 15);
    issues.push({ category: 'images', priority: 'low', title: `Non-optimal format (${nonOptimal}/${total})`, description: `${nonOptimal} images use JPEG/PNG instead of WebP/AVIF.`, recommendation: 'Convert images to WebP or AVIF for better compression and faster loading.' });
  }

  return score;
}

function analyzeGEO(
  parsed: ParsedHTML,
  robotsTxt: { exists: boolean; aiCrawlers: { name: string; allowed: boolean }[] },
  llmsTxt: boolean,
  issues: SEOIssue[]
): number {
  let score = 100;

  // AI crawler access
  const blockedCrawlers = robotsTxt.aiCrawlers.filter(c => !c.allowed);
  if (blockedCrawlers.length === robotsTxt.aiCrawlers.length && robotsTxt.aiCrawlers.length > 0) {
    score -= 30;
    issues.push({ category: 'geo', priority: 'high', title: 'All AI crawlers blocked', description: `All ${blockedCrawlers.length} AI crawlers are blocked in robots.txt.`, recommendation: 'Allow major AI crawlers (GPTBot, ClaudeBot) to access your content for AI search visibility.' });
  } else if (blockedCrawlers.length > 0) {
    score -= blockedCrawlers.length * 5;
    issues.push({ category: 'geo', priority: 'medium', title: `Some AI crawlers blocked (${blockedCrawlers.length})`, description: `Blocked: ${blockedCrawlers.map(c => c.name).join(', ')}.`, recommendation: 'Consider allowing these crawlers for broader AI search visibility.' });
  }

  // llms.txt
  if (!llmsTxt) {
    score -= 15;
    issues.push({ category: 'geo', priority: 'low', title: 'No llms.txt file', description: 'No llms.txt file found. This file helps AI models understand your site.', recommendation: 'Create an llms.txt file at your domain root to guide AI crawlers.' });
  }

  // SSR detection (if very few words found in raw HTML, likely CSR)
  if (parsed.wordCount < 50) {
    score -= 20;
    issues.push({ category: 'geo', priority: 'high', title: 'Low SSR content detected', description: 'Very little text content found in the raw HTML. The page may rely on client-side rendering.', recommendation: 'Implement server-side rendering (SSR) — AI crawlers typically do not execute JavaScript.' });
  }

  // Citability signals
  const signals = getCitabilitySignals(parsed);
  if (signals.length < 2) {
    score -= 15;
    issues.push({ category: 'geo', priority: 'medium', title: 'Low AI citability', description: 'Few signals found that help AI models cite your content.', recommendation: 'Add statistics, clear definitions, structured data, and direct-answer formatting to improve citability.' });
  }

  return score;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function detectPageType(url: string): string {
  const path = new URL(url).pathname.toLowerCase();
  if (path === '/' || path === '') return 'homepage';
  if (path.includes('/blog') || path.includes('/article') || path.includes('/post')) return 'blog';
  if (path.includes('/product')) return 'product';
  if (path.includes('/categor')) return 'category';
  if (path.includes('/service') || path.includes('/feature')) return 'service';
  if (path.includes('/about')) return 'about';
  if (path.includes('/contact')) return 'contact';
  if (path.includes('/faq') || path.includes('/help')) return 'faq';
  return 'general';
}

function getMinWords(pageType: string): number {
  const mins: Record<string, number> = {
    homepage: 500, blog: 1500, product: 400, category: 400,
    service: 800, about: 400, contact: 200, faq: 800, general: 500,
  };
  return mins[pageType] || 500;
}

function isDeprecatedSchema(type: string): boolean {
  return ['HowTo', 'SpecialAnnouncement', 'CourseInfo', 'EstimatedSalary', 'ClaimReview', 'LearningVideo', 'VehicleListing'].includes(type);
}

function getSecurityHeaders(headers: Record<string, string>) {
  const checks = [
    { name: 'Content-Security-Policy', key: 'content-security-policy' },
    { name: 'Strict-Transport-Security', key: 'strict-transport-security' },
    { name: 'X-Frame-Options', key: 'x-frame-options' },
    { name: 'X-Content-Type-Options', key: 'x-content-type-options' },
    { name: 'Referrer-Policy', key: 'referrer-policy' },
  ];
  return checks.map(c => ({ name: c.name, present: !!headers[c.key], value: headers[c.key] || undefined }));
}

function getSchemaRecommendations(parsed: ParsedHTML): string[] {
  const types = parsed.jsonLdBlocks.map(b => (b as Record<string, unknown>)['@type'] as string).filter(Boolean);
  const recs: string[] = [];

  if (!types.includes('Organization') && !types.includes('LocalBusiness')) recs.push('Add Organization schema');
  if (!types.includes('WebSite')) recs.push('Add WebSite schema with SearchAction');
  if (!types.includes('BreadcrumbList')) recs.push('Add BreadcrumbList schema for navigation');

  if (parsed.h1Tags.some(h => h.toLowerCase().includes('blog') || h.toLowerCase().includes('article'))) {
    if (!types.includes('Article') && !types.includes('BlogPosting')) {
      recs.push('Add Article or BlogPosting schema');
    }
  }

  return recs;
}

function getCitabilitySignals(parsed: ParsedHTML): string[] {
  const signals: string[] = [];

  if (parsed.jsonLdBlocks.length > 0) signals.push('Structured data present');
  if (parsed.headingHierarchy.length > 3) signals.push('Well-structured headings');
  if (parsed.avgSentenceLength > 0 && parsed.avgSentenceLength <= 20) signals.push('Good readability');
  if (parsed.hasDates) signals.push('Content dates visible');
  if (parsed.hasAuthorByline) signals.push('Author attribution');
  if (parsed.h2Tags.some(h => h.includes('?'))) signals.push('Question-based headings');

  return signals;
}
