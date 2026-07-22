// Social Inbox Service
// Manages comment/DM tracking from social media platforms
// Data flows in from N8N workflow (via webhook or manual import)

const STORAGE_KEY = 'social-inbox-items';
const SETTINGS_KEY = 'social-inbox-settings';

// --- Types ---

export type InboxPlatform = 'facebook' | 'instagram' | 'twitter' | 'linkedin';
export type InboxType = 'comment' | 'dm';
export type InboxCategory = 'LEAD' | 'QUESTION' | 'POSITIVE' | 'NEGATIVE' | 'SPAM' | 'CONVERSATIONAL';
export type InboxUrgency = 'high' | 'medium' | 'low';
export type InboxSentiment = 'positive' | 'neutral' | 'negative' | 'frustrated';
export type InboxStatus = 'pending_review' | 'replied' | 'ignored' | 'escalated';

export interface InboxItem {
  id: string;
  platform: InboxPlatform;
  type: InboxType;
  postId: string;
  postText: string;
  authorName: string;
  authorId: string;
  text: string;
  timestamp: string;

  // Classification (from Claude via N8N)
  category: InboxCategory;
  state: 'TX' | 'CA' | null;
  county: string | null;
  urgency: InboxUrgency;
  sentiment: InboxSentiment;
  draftReply: string;
  leadScore: number;
  reasoning: string;

  // Management
  status: InboxStatus;
  classifiedAt: string;
  repliedAt?: string;
  repliedBy?: string;
  actualReply?: string;
}

export interface InboxSettings {
  metaPageToken: string;
  metaPageId: string;
  instagramBusinessId: string;
  slackWebhookUrl: string;
  googleSheetId: string;
  autoClassify: boolean;
}

export interface InboxStats {
  total: number;
  leads: number;
  questions: number;
  positive: number;
  negative: number;
  spam: number;
  conversational: number;
  pendingReview: number;
  replied: number;
  avgLeadScore: number;
  platformBreakdown: Record<InboxPlatform, number>;
}

// --- Settings ---

export function getInboxSettings(): InboxSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  return {
    metaPageToken: '',
    metaPageId: '',
    instagramBusinessId: '',
    slackWebhookUrl: '',
    googleSheetId: '',
    autoClassify: true,
  };
}

export function saveInboxSettings(settings: Partial<InboxSettings>): void {
  const current = getInboxSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
}

// --- CRUD ---

export function getAllItems(): InboxItem[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as InboxItem[];
  } catch {
    return [];
  }
}

function saveAllItems(items: InboxItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addItem(item: InboxItem): void {
  const items = getAllItems();
  // Dedupe by id
  if (items.some(i => i.id === item.id)) return;
  items.unshift(item);
  saveAllItems(items);
}

export function addItems(newItems: InboxItem[]): number {
  const items = getAllItems();
  const existingIds = new Set(items.map(i => i.id));
  let added = 0;
  for (const item of newItems) {
    if (!existingIds.has(item.id)) {
      items.unshift(item);
      existingIds.add(item.id);
      added++;
    }
  }
  if (added > 0) saveAllItems(items);
  return added;
}

export function updateItemStatus(id: string, status: InboxStatus, extra?: Partial<InboxItem>): void {
  const items = getAllItems();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], status, ...extra };
  saveAllItems(items);
}

export function deleteItem(id: string): void {
  const items = getAllItems().filter(i => i.id !== id);
  saveAllItems(items);
}

export function clearAllItems(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// --- Stats ---

export function getStats(items?: InboxItem[]): InboxStats {
  const all = items || getAllItems();
  const leads = all.filter(i => i.category === 'LEAD');

  return {
    total: all.length,
    leads: leads.length,
    questions: all.filter(i => i.category === 'QUESTION').length,
    positive: all.filter(i => i.category === 'POSITIVE').length,
    negative: all.filter(i => i.category === 'NEGATIVE').length,
    spam: all.filter(i => i.category === 'SPAM').length,
    conversational: all.filter(i => i.category === 'CONVERSATIONAL').length,
    pendingReview: all.filter(i => i.status === 'pending_review').length,
    replied: all.filter(i => i.status === 'replied').length,
    avgLeadScore: leads.length > 0
      ? Math.round((leads.reduce((sum, i) => sum + i.leadScore, 0) / leads.length) * 10) / 10
      : 0,
    platformBreakdown: {
      facebook: all.filter(i => i.platform === 'facebook').length,
      instagram: all.filter(i => i.platform === 'instagram').length,
      twitter: all.filter(i => i.platform === 'twitter').length,
      linkedin: all.filter(i => i.platform === 'linkedin').length,
    },
  };
}

// --- Filtering ---

export interface InboxFilters {
  platform: InboxPlatform | 'all';
  category: InboxCategory | 'all';
  status: InboxStatus | 'all';
  urgency: InboxUrgency | 'all';
  search: string;
}

export function filterItems(items: InboxItem[], filters: InboxFilters): InboxItem[] {
  return items.filter(item => {
    if (filters.platform !== 'all' && item.platform !== filters.platform) return false;
    if (filters.category !== 'all' && item.category !== filters.category) return false;
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.urgency !== 'all' && item.urgency !== filters.urgency) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      return (
        item.text.toLowerCase().includes(q) ||
        item.authorName.toLowerCase().includes(q) ||
        (item.county || '').toLowerCase().includes(q) ||
        item.postText.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

// --- Import from N8N / Google Sheets ---

export function importFromJSON(jsonString: string): { added: number; errors: string[] } {
  const errors: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { added: 0, errors: ['Invalid JSON'] };
  }

  const rawItems = Array.isArray(parsed) ? parsed : [parsed];
  const validItems: InboxItem[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    if (!raw || typeof raw !== 'object') {
      errors.push(`Item ${i}: not an object`);
      continue;
    }
    const r = raw as Record<string, unknown>;
    if (!r.text && !r.Message) {
      errors.push(`Item ${i}: missing text/Message field`);
      continue;
    }

    // Support both direct N8N output format and Google Sheets CSV format
    validItems.push({
      id: String(r.id || r.ID || `import-${Date.now()}-${i}`),
      platform: normalizePlatform(String(r.platform || r.Platform || 'facebook')),
      type: (r.type || r.Type || 'comment') === 'dm' ? 'dm' : 'comment',
      postId: String(r.postId || r.PostID || ''),
      postText: String(r.postText || r['Post Context'] || ''),
      authorName: String(r.authorName || r.Author || 'Unknown'),
      authorId: String(r.authorId || r.AuthorID || ''),
      text: String(r.text || r.Message || ''),
      timestamp: String(r.timestamp || r.Timestamp || new Date().toISOString()),
      category: normalizeCategory(String(r.category || r.Category || 'CONVERSATIONAL')),
      state: normalizeState(r.state || r.State),
      county: r.county || r.County ? String(r.county || r.County) : null,
      urgency: normalizeUrgency(String(r.urgency || r.Urgency || 'low')),
      sentiment: normalizeSentiment(String(r.sentiment || r.Sentiment || 'neutral')),
      draftReply: String(r.draftReply || r['Draft Reply'] || ''),
      leadScore: Number(r.leadScore || r['Lead Score'] || 0),
      reasoning: String(r.reasoning || r.Reasoning || ''),
      status: normalizeStatus(String(r.status || r.Status || 'pending_review')),
      classifiedAt: String(r.classifiedAt || r['Classified At'] || new Date().toISOString()),
    });
  }

  const added = addItems(validItems);
  return { added, errors };
}

// --- Demo Data ---

export function loadDemoData(): number {
  const demoItems: InboxItem[] = [
    {
      id: 'demo-1',
      platform: 'instagram',
      type: 'comment',
      postId: 'ig-post-001',
      postText: '80-90% of TX property tax protests succeed. Only 5% of homeowners file one.',
      authorName: '@sarah_htx',
      authorId: 'sarah_htx',
      text: 'Just got my appraisal notice and my value went up 22%!! Is it too late to protest in Harris County?',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      category: 'LEAD',
      state: 'TX',
      county: 'Harris',
      urgency: 'high',
      sentiment: 'frustrated',
      draftReply: 'Not too late at all! You have until May 15 to file your protest in Harris County. A 22% jump is exactly the kind of increase worth challenging. We can check your potential savings in under 2 minutes at taxdrop.com',
      leadScore: 9,
      reasoning: 'Mentions specific county, shares increase percentage, has Notice of Appraised Value in hand',
      status: 'pending_review',
      classifiedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-2',
      platform: 'facebook',
      type: 'comment',
      postId: 'fb-post-002',
      postText: 'How to Protest Your Property Taxes in Texas — Step by Step Guide',
      authorName: 'Mike Richardson',
      authorId: 'mike.r.123',
      text: 'What\'s the deadline for this? And does it work for rental properties too?',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      category: 'QUESTION',
      state: 'TX',
      county: null,
      urgency: 'medium',
      sentiment: 'neutral',
      draftReply: 'Great questions! The deadline is May 15 in Texas (or 30 days after your Notice of Appraised Value, whichever is later). And yes, property tax protests work for rental properties, commercial buildings — any property type. The process is the same.',
      leadScore: 6,
      reasoning: 'Asking about deadline and rental properties — could be a landlord with multiple properties',
      status: 'pending_review',
      classifiedAt: new Date(Date.now() - 4.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-3',
      platform: 'instagram',
      type: 'dm',
      postId: 'ig-dm-003',
      postText: '',
      authorName: '@collin_county_mom',
      authorId: 'collin_county_mom',
      text: 'Hi! I saw your post about property tax protests. We just bought our house in Collin County last year and the assessed value seems way higher than what we paid. Can you help? Is it worth protesting on a new purchase?',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      category: 'LEAD',
      state: 'TX',
      county: 'Collin',
      urgency: 'high',
      sentiment: 'positive',
      draftReply: 'Absolutely! If your assessed value is higher than your purchase price, you actually have one of the strongest cases for a protest. Your closing documents serve as direct evidence of market value. Collin County has been aggressive with appraisals lately. We can pull your property data and show you exactly what you could save — takes about 2 minutes at taxdrop.com',
      leadScore: 10,
      reasoning: 'DM with specific county, recent buyer, assessed above purchase price — ideal candidate',
      status: 'pending_review',
      classifiedAt: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-4',
      platform: 'facebook',
      type: 'comment',
      postId: 'fb-post-004',
      postText: 'Abbott\'s 5-Point Property Tax Plan: What It Means for Your Tax Bill',
      authorName: 'Jennifer Watson',
      authorId: 'jen.watson.456',
      text: 'Used TaxDrop last year and saved $1,847 on our Tarrant County home. Already signed up again for this year. Highly recommend!',
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      category: 'POSITIVE',
      state: 'TX',
      county: 'Tarrant',
      urgency: 'low',
      sentiment: 'positive',
      draftReply: 'That\'s amazing, Jennifer! $1,847 is a great result. Glad we could help with your Tarrant County protest. We\'ll make sure this year\'s protest is just as strong.',
      leadScore: 2,
      reasoning: 'Existing customer expressing satisfaction — great social proof, worth a thank you reply',
      status: 'pending_review',
      classifiedAt: new Date(Date.now() - 7.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-5',
      platform: 'instagram',
      type: 'comment',
      postId: 'ig-post-005',
      postText: 'Stop paying more property tax than you need to. 30-60% of homes are over-assessed.',
      authorName: '@dfw_real_estate_guy',
      authorId: 'dfw_real_estate_guy',
      text: 'How is this different from me just filing the protest myself? Seems like something I can do without paying 25%',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      category: 'QUESTION',
      state: 'TX',
      county: null,
      urgency: 'medium',
      sentiment: 'negative',
      draftReply: 'Fair question! You can absolutely file yourself — and we encourage it if you have the time. The difference is our licensed consultants analyze 30,000+ data points to build your evidence package, handle the filing, and represent you at the hearing. Most people save more with professional representation than on their own, and you only pay if we actually reduce your bill. Zero risk either way.',
      leadScore: 5,
      reasoning: 'Skeptical but engaged — addressing their concern builds trust and could convert',
      status: 'pending_review',
      classifiedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-6',
      platform: 'facebook',
      type: 'dm',
      postId: 'fb-dm-006',
      postText: '',
      authorName: 'Carlos Mendez',
      authorId: 'carlos.m.789',
      text: 'Is this available in California? I have a property in Orange County and my assessment just went up significantly.',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      category: 'LEAD',
      state: 'CA',
      county: 'Orange',
      urgency: 'high',
      sentiment: 'neutral',
      draftReply: 'Yes! We handle property tax appeals in California too. Orange County assessments have been climbing — a significant increase is definitely worth challenging. The appeal process is different from Texas but we handle everything for you. Check your potential savings at taxdrop.com — takes under 2 minutes.',
      leadScore: 8,
      reasoning: 'California lead with specific county, property owner with recent assessment increase',
      status: 'pending_review',
      classifiedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-7',
      platform: 'instagram',
      type: 'comment',
      postId: 'ig-post-001',
      postText: '80-90% of TX property tax protests succeed. Only 5% of homeowners file one.',
      authorName: '@spambot_deals_2026',
      authorId: 'spambot_deals_2026',
      text: 'Check out my page for AMAZING deals on home insurance!! DM me now!! 🔥🔥🔥',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      category: 'SPAM',
      state: null,
      county: null,
      urgency: 'low',
      sentiment: 'neutral',
      draftReply: '',
      leadScore: 0,
      reasoning: 'Promotional spam, unrelated to property taxes',
      status: 'ignored',
      classifiedAt: new Date(Date.now() - 5.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-8',
      platform: 'facebook',
      type: 'comment',
      postId: 'fb-post-004',
      postText: 'Abbott\'s 5-Point Property Tax Plan: What It Means for Your Tax Bill',
      authorName: 'David Park',
      authorId: 'david.park.101',
      text: '@Amy Chen you need to see this! Your taxes went up like $3,000 last year right?',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      category: 'LEAD',
      state: 'TX',
      county: null,
      urgency: 'medium',
      sentiment: 'positive',
      draftReply: 'Thanks for sharing, David! A $3,000 increase is definitely worth looking into. Amy, if you want to check your potential savings, it takes about 2 minutes at taxdrop.com. The deadline is May 15.',
      leadScore: 7,
      reasoning: 'Friend tag with specific dollar amount mentioned — referral opportunity, two potential leads',
      status: 'pending_review',
      classifiedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return addItems(demoItems);
}

// --- Helpers ---

function normalizePlatform(s: string): InboxPlatform {
  const lower = s.toLowerCase();
  if (lower.includes('instagram') || lower === 'ig') return 'instagram';
  if (lower.includes('twitter') || lower === 'x') return 'twitter';
  if (lower.includes('linkedin')) return 'linkedin';
  return 'facebook';
}

function normalizeCategory(s: string): InboxCategory {
  const upper = s.toUpperCase();
  if (upper === 'LEAD') return 'LEAD';
  if (upper === 'QUESTION') return 'QUESTION';
  if (upper === 'POSITIVE') return 'POSITIVE';
  if (upper === 'NEGATIVE') return 'NEGATIVE';
  if (upper === 'SPAM') return 'SPAM';
  return 'CONVERSATIONAL';
}

function normalizeState(val: unknown): 'TX' | 'CA' | null {
  if (!val || val === 'null') return null;
  const s = String(val).toUpperCase();
  if (s === 'TX' || s.includes('TEXAS')) return 'TX';
  if (s === 'CA' || s.includes('CALIFORNIA')) return 'CA';
  return null;
}

function normalizeUrgency(s: string): InboxUrgency {
  const lower = s.toLowerCase();
  if (lower === 'high') return 'high';
  if (lower === 'medium') return 'medium';
  return 'low';
}

function normalizeSentiment(s: string): InboxSentiment {
  const lower = s.toLowerCase();
  if (lower === 'positive') return 'positive';
  if (lower === 'negative') return 'negative';
  if (lower === 'frustrated') return 'frustrated';
  return 'neutral';
}

function normalizeStatus(s: string): InboxStatus {
  const lower = s.toLowerCase().replace(/\s+/g, '_');
  if (lower === 'replied') return 'replied';
  if (lower === 'ignored') return 'ignored';
  if (lower === 'escalated') return 'escalated';
  return 'pending_review';
}
