import type { VercelRequest, VercelResponse } from '@vercel/node';

// Multiple queries per topic — fetched in parallel from Google News and merged
const TOPIC_QUERIES: Record<string, string[]> = {
  'all': [
    '(California+OR+Texas)+property+tax+homeowner',
    'property+tax+homeowner+overpayment+savings+reform',
  ],
  'texas': [
    'Texas+property+tax+protest+appraisal+district',
    'Texas+HCAD+TCAD+DCAD+appraisal+homeowner',
    'Texas+property+assessment+homeowner+2025+2026',
  ],
  'california': [
    'California+property+tax+appeal+assessor+Prop+13',
    'California+Prop+19+assessment+homeowner+exemption',
    'California+property+tax+savings+appeal+BOE',
  ],
  'exemptions': [
    '(California+OR+Texas)+property+tax+exemption+savings+homestead',
    'senior+homestead+veteran+property+tax+exemption+savings',
  ],
  'tax-news': [
    'property+tax+national+homeowner+tax+burden+reform',
    'Americans+property+tax+increase+assessment+unfair',
  ],
  'investors': [
    '(California+OR+Texas)+real+estate+investor+property+tax',
    'landlord+rental+property+tax+appeal+savings',
  ],
  'partners': [
    '(California+OR+Texas)+HOA+property+manager+tax+assessment',
    'property+manager+real+estate+agent+tax+savings+referral',
  ],
};

// Curated supplementary RSS feeds per topic
const SUPPLEMENTARY_FEEDS: Record<string, string[]> = {
  'texas': [
    'https://www.texastribune.org/topics/property-taxes/rss.xml',
  ],
  'california': [
    'https://calmatters.org/economy/feed/',
  ],
  'tax-news': [
    'https://ntu.org/feed',
  ],
  'all': [],
  'exemptions': [],
  'investors': [],
  'partners': [],
};

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const topic = (req.query.topic as string) || 'all';
  const queries = TOPIC_QUERIES[topic] || TOPIC_QUERIES['all'];
  const supplementary = SUPPLEMENTARY_FEEDS[topic] || [];

  try {
    // Fetch all Google News queries + supplementary feeds in parallel
    const googleFetches = queries.map(query =>
      fetchGoogleNews(query).catch(() => [] as NewsItem[])
    );
    const supplementaryFetches = supplementary.map(url =>
      fetchRssFeed(url).catch(() => [] as NewsItem[])
    );

    const allResults = await Promise.all([...googleFetches, ...supplementaryFetches]);
    const merged = deduplicateByTitle(allResults.flat());
    const items = merged.slice(0, 20);

    return res.status(200).json({ items, topic, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error('News fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch news',
      details: error instanceof Error ? error.message : 'Unknown error',
      items: [],
    });
  }
}

async function fetchGoogleNews(query: string): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; TaxDropBot/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
  });
  if (!response.ok) return [];
  const xml = await response.text();
  return parseRssItems(xml, '');
}

async function fetchRssFeed(url: string): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TaxDropBot/1.0)' },
    });
    clearTimeout(timeout);
    if (!response.ok) return [];
    const xml = await response.text();
    // Extract source name from URL
    const source = new URL(url).hostname.replace('www.', '');
    return parseRssItems(xml, source);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

function parseRssItems(xml: string, defaultSource: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  for (const match of itemMatches) {
    const item = match[1];
    const title = cleanCdata(extractXmlTag(item, 'title'));
    const link = extractXmlTag(item, 'link') || extractXmlTag(item, 'guid');
    const pubDate = extractXmlTag(item, 'pubDate');
    const source = cleanCdata(extractXmlTag(item, 'source')) || defaultSource;
    const description = cleanCdata(extractXmlTag(item, 'description'))
      .replace(/<[^>]+>/g, '')
      .slice(0, 250)
      .trim();
    if (title) items.push({ title, link, pubDate, source, description });
    if (items.length >= 15) break;
  }
  return items;
}

function deduplicateByTitle(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function cleanCdata(str: string): string {
  return str.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
}
