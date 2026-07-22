import { useState, useEffect, useCallback } from 'react';
import {
  generateText,
  hasApiKey,
} from '../../services/openrouterService';
import type { TrendIdeaTransfer } from '../../types';
import {
  RefreshIcon,
  CopyIcon,
  CheckIcon,
  SparklesIcon,
  TrendingUpIcon,
  SendIcon,
} from '../common/Icons';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description: string;
}

type ContentFormat = 'meme' | 'educational' | 'commentary' | 'tip' | 'news-reaction' | 'guide' | 'myth-bust';
type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
type Audience = 'homeowners' | 'investors' | 'partners' | 'all';
type Platform = 'Instagram' | 'LinkedIn' | 'Twitter/X' | 'Facebook' | 'All Platforms';
type IdeaStatus = 'idea' | 'drafted';

interface ContentIdea {
  id: string;
  day: DayOfWeek;
  format: ContentFormat;
  platform: Platform;
  audience: Audience;
  topic: string;
  hook: string;
  caption: string;
  hashtags: string[];
  newsSource?: string;
  imagePrompt?: string;
}

type TopicFilter = 'all' | 'texas' | 'california' | 'exemptions' | 'tax-news' | 'investors' | 'partners';

interface SeasonalContext {
  state: 'TX' | 'CA';
  banner: string;
  priority: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const FORMAT_COLORS: Record<ContentFormat, { bg: string; color: string; label: string }> = {
  meme:           { bg: '#FEF3C7', color: '#92400E', label: '😂 Meme' },
  educational:    { bg: '#DBEAFE', color: '#1E40AF', label: '📚 Educational' },
  commentary:     { bg: '#F3E8FF', color: '#6B21A8', label: '💬 Commentary' },
  tip:            { bg: '#DFFFEA', color: '#065F46', label: '💡 Tip' },
  'news-reaction':{ bg: '#FEE2E2', color: '#991B1B', label: '📰 News React' },
  guide:          { bg: '#E0F2FE', color: '#0C4A6E', label: '🗺️ Guide' },
  'myth-bust':    { bg: '#FFF7ED', color: '#9A3412', label: '🔥 Myth Bust' },
};

const PLATFORM_COLORS: Record<Platform, string> = {
  'Instagram':     '#E1306C',
  'LinkedIn':      '#0A66C2',
  'Twitter/X':     '#000000',
  'Facebook':      '#1877F2',
  'All Platforms': '#0C593E',
};

const TOPIC_LABELS: Record<TopicFilter, string> = {
  'all':        '🗞️ All Topics',
  'texas':      '🤠 TX Property Tax',
  'california': '🌴 CA Property Tax',
  'exemptions': '💰 Exemptions & Savings',
  'tax-news':   '📣 Tax News',
  'investors':  '🏢 Investors',
  'partners':   '🤝 Partners',
};

const STORAGE_KEY = 'taxdrop_trend_ideas';
const STORAGE_NEWS_KEY = 'taxdrop_trend_news';
const STORAGE_STATUS_KEY = 'taxdrop_idea_statuses';

// ─── Seasonal Mode ────────────────────────────────────────────────────────────

function getSeasonalContext(): SeasonalContext | null {
  const month = new Date().getMonth() + 1; // 1–12
  if (month >= 3 && month <= 5) {
    return {
      state: 'TX',
      banner: '🤠 Texas protest season is active — May 15 deadline approaching. TX content prioritized this week.',
      priority: `URGENT SEASONAL PRIORITY: It is currently Texas protest season (March–May, deadline May 15).
At least 3 of this week's 5 posts MUST be Texas-focused: protest filing tips, deadline reminders, Appraisal District process, HCAD/DCAD/TCAD specifics, or informal hearing prep.
Use urgency language — homeowners need to act NOW before May 15. Make at least one post a direct deadline warning.`,
    };
  }
  if (month >= 7 && month <= 11) {
    return {
      state: 'CA',
      banner: '🌴 California appeal season is active (July–November). CA content prioritized this week.',
      priority: `SEASONAL PRIORITY: It is currently California appeal season (July–November).
At least 3 of this week's 5 posts MUST be California-focused: appeal process, Assessor's Office, Prop 13, assessment notice deadlines, or CA-specific exemptions.
Help CA homeowners understand they can fight their assessment NOW during the appeal window.`,
    };
  }
  return null;
}

// ─── Week Helpers ─────────────────────────────────────────────────────────────

function getWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function formatWeekLabel(weekKey: string): string {
  const [year, week] = weekKey.split('-W').map(Number);
  const jan4 = new Date(year, 0, 4);
  const startOfWeek = new Date(jan4);
  startOfWeek.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (week - 1) * 7);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(startOfWeek)} – ${fmt(endOfWeek)}, ${year}`;
}

// ─── AI Prompts ───────────────────────────────────────────────────────────────

function buildSystemPrompt(seasonal: SeasonalContext | null): string {
  const seasonalSection = seasonal ? `\n\n⚡ ${seasonal.priority}` : '';
  return `You are a senior social media copywriter for TaxDrop, a property tax appeal service in California and Texas. You write the way a sharp, slightly-irreverent homeowner advocate would — not a marketing department.

CRITICAL GEOGRAPHIC RULE: State-specific content = California or Texas ONLY. Never name other states. National content speaks broadly to US homeowners.

━━━ BRAND VOICE ━━━
- Short, punchy sentences. Read it aloud — if it sounds stiff, rewrite it.
- Champion the homeowner. The system is rigged against them and they deserve to know it.
- Confident, never preachy. Take stances. Don't hedge.
- Humor is welcome. Dry wit > forced positivity.
- No corporate buzzwords. No inspirational fluff.

━━━ CORRECT STATE TERMINOLOGY ━━━
Texas → "protest" | "Appraisal District" | "Notice of Appraised Value" | "May 15 deadline" | "informal hearing"
California → "appeal" | "Assessor's Office" | "Assessment Notice" | "Prop 13" | "60-day window"

━━━ PROVEN CONTENT ANGLES ━━━
Use these when relevant — they resonate:
• "Your house was assessed by someone who's never been inside it."
• "Only ~5% of over-assessed homeowners ever fight back. The other 95% just pay."
• "In TX, 80-90% of informal protests result in a reduction."
• "Assessment errors compound EVERY year you don't fix them."
• "A $10K reduction in TX assessed value = ~$120-150 saved annually."
• "California's Assessment Notice has a 60-day window. Most people throw it away."
• "30-60% of properties are over-assessed. The odds are not in your favor by default."
• "Your neighbor paid less in property taxes last year. Same neighborhood. Same house size."

━━━ HOOK FORMULAS (pick the best fit) ━━━
① Uncomfortable truth: "Your Appraisal District is counting on you NOT reading this."
② Shocking stat: "1 in 2 Texas homeowners is paying taxes on an inflated assessment."
③ Direct address + deadline: "Texas homeowners: you have 63 days. Here's what to do."
④ Relatable frustration: "The feeling when your property tax bill goes up $400 and your neighbor's didn't 👀"
⑤ Reframe the obvious: "Paying your property tax bill isn't the same as agreeing with it."
⑥ Myth setup: "Everyone says you can't fight your property tax bill. Everyone is wrong."
⑦ News angle: "[What happened] — here's what it means for your tax bill."

━━━ PLATFORM VOICE RULES ━━━
LinkedIn: Start bold (no opening emoji). Use aggressive line breaks — every 1-2 sentences. 150-250 words. Professional but personal, like a smart colleague sharing an insight. 2-3 hashtags max.
Instagram: Emoji-forward. Punchy opener. 60-120 words. Conversational. 5-7 hashtags.
Twitter/X: Under 240 characters. Wit over education. 0-1 hashtags. Every word earns its place.
Facebook: Question or story opener. 100-180 words. Conversational, slight warmth. 2-3 hashtags.

━━━ FORMAT RULES ━━━
Meme: 1 relatable setup + 1 punchline. The punchline lands hard. No explanation needed.
Commentary: Lead with your take, not the news. "Texas just raised appraisals again." (not "Recent reports suggest...")
Educational: One thing, taught well. Not a listicle. Specific over general.
Tip: One action. One benefit. One sentence of proof. That's it.
News-reaction: Hook → what happened → why you should care → what to do.
Guide: Numbered steps. Short. Each step is one action, not a paragraph.
Myth-bust: State the myth in quotes. Then destroy it with one specific fact.

━━━ NEVER WRITE THESE ━━━
× "In today's fast-paced world..." × "Exciting news!" × "I'm thrilled to share..."
× "As we navigate..." × "Game-changer" × "At the end of the day..."
× "It's important to note..." × "Don't miss out!" × Opening with "Are you..."
× "Did you know that..." (use a statement instead) × "Save $500 or you pay nothing"
× Vague CTAs like "Learn more" or "Check it out" × Any reference to states other than CA or TX${seasonalSection}`;
}

function buildIdeaPrompt(news: NewsItem[], topic: TopicFilter, weekKey: string, seasonal: SeasonalContext | null): string {
  const newsContext = news.length > 0
    ? `CURRENT NEWS (use relevant headlines as inspiration — don't copy, react):\n${news.slice(0, 12).map((n, i) => `${i + 1}. "${n.title}" (${n.source || 'News'})`).join('\n')}`
    : `No live news — draw from current property tax season context for ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`;

  const topicContext = topic !== 'all'
    ? `TOPIC FOCUS: ${TOPIC_LABELS[topic]}`
    : 'TOPIC MIX: Cover homeowners, investors, and partners across the week. State-specific = CA or TX only.';

  const seasonalNote = seasonal
    ? `\nSEASONAL: ${seasonal.state === 'TX' ? 'TX protest season — May 15 deadline. Urgency matters.' : 'CA appeal season (July–Nov). Act-now messaging.'}`
    : '';

  return `Generate exactly 5 social media content ideas for the week of ${formatWeekLabel(weekKey)}, one per weekday.

${topicContext}${seasonalNote}

${newsContext}

WEEK STRUCTURE:
- Monday: High-shareability. Meme, hot take, or bold commentary. Something people forward.
- Tuesday: Practical value. A tip or educational insight they'll screenshot and save.
- Wednesday: News or controversy. React to a headline or bust a myth. Engagement driver.
- Thursday: How-to guide or step-by-step. The "save this post" content.
- Friday: Light or motivational. Meme, win story, or weekend mindset shift.

PLATFORM MIX: Use all four platforms across the week — Instagram, LinkedIn, Twitter/X, Facebook.
AUDIENCE MIX: Rotate — at least 2 homeowner posts, 1 investor, 1 partner, 1 wildcard.

QUALITY BAR — every idea must pass this test:
✓ Hook: Would a scrolling homeowner stop on this? Is it specific, not generic?
✓ Caption: Does it read like a real person wrote it? Is every sentence earning its place?
✓ Platform fit: Does the length and tone match how that platform actually works?
✓ Value: Does the reader learn something, feel something, or want to share it?

EXAMPLE OF A STRONG IDEA (reference quality, don't copy):
{
  "day": "Monday",
  "format": "commentary",
  "platform": "Instagram",
  "audience": "homeowners",
  "topic": "Texas appraisals went up again — and most homeowners won't fight back",
  "hook": "Your Appraisal District raised your value 12%. They're counting on you to just pay it.",
  "caption": "Here's the thing nobody talks about: you don't have to accept your assessment. In Texas, you have until May 15 to protest — and 80-90% of homeowners who do, win a reduction. Five minutes of paperwork could save you hundreds. The only people who don't protest are the ones who don't know they can.",
  "hashtags": ["#TexasPropertyTax", "#PropertyTaxProtest", "#HomeownerTips", "#HCAD"],
  "newsSource": null,
  "imagePrompt": "Frustrated homeowner at kitchen table looking at a property tax notice, natural morning light, realistic"
}

EXAMPLE OF A STRONG MEME IDEA:
{
  "day": "Friday",
  "format": "meme",
  "platform": "Twitter/X",
  "audience": "homeowners",
  "topic": "Property tax assessment reality check",
  "hook": "Your house: assessed at $750K. An assessor who has never been inside it: ✅ confirmed.",
  "caption": "Mass appraisal is real. Fight your assessment.",
  "hashtags": ["#PropertyTax"],
  "newsSource": null,
  "imagePrompt": "Split image: nice suburban home exterior vs. a generic government office building with a rubber stamp"
}

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  {
    "day": "Monday",
    "format": "meme|educational|commentary|tip|news-reaction|guide|myth-bust",
    "platform": "Instagram|LinkedIn|Twitter/X|Facebook",
    "audience": "homeowners|investors|partners",
    "topic": "specific one-line description of what this post is actually about",
    "hook": "The exact first line — specific, punchy, stops the scroll",
    "caption": "Full caption written for the platform (follow platform voice rules from your instructions)",
    "hashtags": ["#Tag"],
    "newsSource": "exact headline used as inspiration, or null",
    "imagePrompt": "Specific visual description — scene, emotion, setting, style"
  }
]`;
}

function buildSingleIdeaPrompt(day: DayOfWeek, news: NewsItem[], topic: TopicFilter): string {
  const newsContext = news.length > 0
    ? `Current news for inspiration:\n${news.slice(0, 8).map((n, i) => `${i + 1}. "${n.title}" (${n.source || 'News'})`).join('\n')}`
    : `No live news — draw from current property tax season.`;

  const dayGuidance: Record<DayOfWeek, string> = {
    Monday: 'High-shareability: meme, hot take, or bold commentary — something people forward',
    Tuesday: 'Practical value: tip or educational insight they screenshot and save',
    Wednesday: 'News reaction or myth-bust — controversy and engagement driver',
    Thursday: 'How-to or step-by-step guide — "save this post" content',
    Friday: 'Light or fun: meme, win story, or weekend mindset shift',
  };

  return `Generate exactly 1 social media content idea for ${day}.
Day goal: ${dayGuidance[day]}
Topic focus: ${TOPIC_LABELS[topic]}

${newsContext}

Quality bar: Hook must be specific and scroll-stopping (not generic). Caption must sound human, not AI. Match the platform's real voice and length norms. Every sentence earns its place.

Respond ONLY with a valid JSON array containing exactly 1 object:
[{"day":"${day}","format":"meme|educational|commentary|tip|news-reaction|guide|myth-bust","platform":"Instagram|LinkedIn|Twitter/X|Facebook","audience":"homeowners|investors|partners","topic":"specific one-line description","hook":"exact first line — specific and punchy","caption":"full platform-appropriate caption","hashtags":["#Tag1","#Tag2","#Tag3"],"newsSource":null,"imagePrompt":"specific visual description with scene, emotion, setting"}]`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TrendMonitorProps {
  onCreatePost?: (idea: TrendIdeaTransfer) => void;
  onQueueAll?: (ideas: TrendIdeaTransfer[]) => void;
}

export function TrendMonitor({ onCreatePost, onQueueAll }: TrendMonitorProps) {
  const seasonal = getSeasonalContext();

  const [topic, setTopic] = useState<TopicFilter>('all');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [weekKey, setWeekKey] = useState(getWeekKey());
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [regeneratingDay, setRegeneratingDay] = useState<DayOfWeek | null>(null);
  const [newsError, setNewsError] = useState('');
  const [ideasError, setIdeasError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNews, setShowNews] = useState(false);
  const [queueing, setQueueing] = useState(false);

  // Idea statuses persisted across sessions
  const [ideaStatuses, setIdeaStatuses] = useState<Record<string, IdeaStatus>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_STATUS_KEY) || '{}'); } catch { return {}; }
  });

  const markDrafted = (ideaId: string) => {
    const updated = { ...ideaStatuses, [ideaId]: 'drafted' as IdeaStatus };
    setIdeaStatuses(updated);
    localStorage.setItem(STORAGE_STATUS_KEY, JSON.stringify(updated));
  };

  // Load persisted ideas on mount / week+topic change
  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${weekKey}_${topic}`);
    if (stored) {
      try { setIdeas(JSON.parse(stored)); } catch {}
    } else {
      setIdeas([]);
    }

    const storedNews = localStorage.getItem(`${STORAGE_NEWS_KEY}_${topic}`);
    if (storedNews) {
      try {
        const parsed = JSON.parse(storedNews);
        const age = Date.now() - (parsed.fetchedAt || 0);
        if (age < 4 * 60 * 60 * 1000) {
          setNews(parsed.items || []);
          return;
        }
      } catch {}
    }
    fetchNews();
  }, [weekKey, topic]);

  const fetchNews = useCallback(async () => {
    setLoadingNews(true);
    setNewsError('');
    try {
      const res = await fetch(`/api/fetch-news?topic=${topic}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setNews(data.items || []);
      localStorage.setItem(`${STORAGE_NEWS_KEY}_${topic}`, JSON.stringify({
        items: data.items || [],
        fetchedAt: Date.now(),
      }));
    } catch {
      setNewsError('Could not load news feed. Ideas will be generated from seasonal context.');
      setNews([]);
    } finally {
      setLoadingNews(false);
    }
  }, [topic]);

  const generateIdeas = useCallback(async () => {
    if (!hasApiKey()) {
      setIdeasError('OpenRouter API key required. Go to Settings to add it.');
      return;
    }
    setLoadingIdeas(true);
    setIdeasError('');

    try {
      const result = await generateText({
        prompt: buildIdeaPrompt(news, topic, weekKey, seasonal),
        systemPrompt: buildSystemPrompt(seasonal),
        model: 'anthropic/claude-opus-4-6',
        maxTokens: 3500,
      });

      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found in response');

      const parsed: Omit<ContentIdea, 'id'>[] = JSON.parse(jsonMatch[0]);
      const withIds: ContentIdea[] = parsed.map((idea, i) => ({
        ...idea,
        id: `${weekKey}-${topic}-${i}`,
      }));

      setIdeas(withIds);
      localStorage.setItem(`${STORAGE_KEY}_${weekKey}_${topic}`, JSON.stringify(withIds));
    } catch (err) {
      setIdeasError(err instanceof Error ? err.message : 'Failed to generate ideas. Try again.');
    } finally {
      setLoadingIdeas(false);
    }
  }, [news, topic, weekKey, seasonal]);

  // Regenerate a single day without touching the others
  const regenerateSingleIdea = useCallback(async (day: DayOfWeek) => {
    if (!hasApiKey()) return;
    setRegeneratingDay(day);
    try {
      const result = await generateText({
        prompt: buildSingleIdeaPrompt(day, news, topic),
        systemPrompt: buildSystemPrompt(seasonal),
        model: 'anthropic/claude-sonnet-4-5',
        maxTokens: 900,
      });

      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON');
      const parsed: Omit<ContentIdea, 'id'>[] = JSON.parse(jsonMatch[0]);
      if (parsed.length > 0) {
        const newIdea: ContentIdea = {
          ...parsed[0],
          day, // always enforce the correct day
          id: `${weekKey}-${topic}-regen-${day}-${Date.now()}`,
        };
        const exists = ideas.some(i => i.day === day);
        const updated = exists
          ? ideas.map(i => i.day === day ? newIdea : i)
          : [...ideas, newIdea];
        setIdeas(updated);
        localStorage.setItem(`${STORAGE_KEY}_${weekKey}_${topic}`, JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Single regen error:', err);
    } finally {
      setRegeneratingDay(null);
    }
  }, [news, topic, weekKey, ideas, seasonal]);

  const copyIdea = async (idea: ContentIdea) => {
    const text = `${idea.hook}\n\n${idea.caption}\n\n${idea.hashtags.join(' ')}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(idea.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreatePost = (idea: ContentIdea) => {
    markDrafted(idea.id);
    onCreatePost?.({
      hook: idea.hook,
      caption: idea.caption,
      hashtags: idea.hashtags,
      imagePrompt: idea.imagePrompt,
      platform: idea.platform,
      format: idea.format,
      topic: idea.topic,
      audience: idea.audience,
      day: idea.day,
    });
  };

  const handleQueueAll = () => {
    if (!onQueueAll || ideas.length === 0) return;
    setQueueing(true);
    // Mark all as drafted
    const statusUpdate = { ...ideaStatuses };
    ideas.forEach(i => { statusUpdate[i.id] = 'drafted'; });
    setIdeaStatuses(statusUpdate);
    localStorage.setItem(STORAGE_STATUS_KEY, JSON.stringify(statusUpdate));

    const transfers: TrendIdeaTransfer[] = DAYS
      .map(day => ideas.find(i => i.day === day))
      .filter((i): i is ContentIdea => !!i)
      .map(idea => ({
        hook: idea.hook,
        caption: idea.caption,
        hashtags: idea.hashtags,
        imagePrompt: idea.imagePrompt,
        platform: idea.platform,
        format: idea.format,
        topic: idea.topic,
        audience: idea.audience,
        day: idea.day,
      }));

    onQueueAll(transfers);
    setQueueing(false);
  };

  const prevWeek = () => {
    const [year, week] = weekKey.split('-W').map(Number);
    const d = new Date(year, 0, 1 + (week - 2) * 7);
    setWeekKey(getWeekKey(d));
  };

  const nextWeek = () => {
    const [year, week] = weekKey.split('-W').map(Number);
    const d = new Date(year, 0, 1 + week * 7);
    setWeekKey(getWeekKey(d));
  };

  const ideasByDay = DAYS.reduce<Record<DayOfWeek, ContentIdea | undefined>>((acc, day) => {
    acc[day] = ideas.find(i => i.day === day);
    return acc;
  }, {} as Record<DayOfWeek, ContentIdea | undefined>);

  const draftedCount = ideas.filter(i => ideaStatuses[i.id] === 'drafted').length;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '1200px' }}>

      {/* Seasonal Banner */}
      {seasonal && (
        <div style={{
          background: seasonal.state === 'TX' ? '#FEF3C7' : '#DFFFEA',
          border: `1px solid ${seasonal.state === 'TX' ? '#F59E0B' : '#0B8F52'}`,
          borderRadius: '8px',
          padding: '10px 16px',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: '600',
          color: seasonal.state === 'TX' ? '#92400E' : '#065F46',
        }}>
          {seasonal.banner}
        </div>
      )}

      {/* Top Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '24px',
      }}>
        {/* Week Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={prevWeek} style={navBtnStyle} title="Previous week">←</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#1A1A1A' }}>
              {weekKey === getWeekKey() ? 'This Week' : formatWeekLabel(weekKey)}
            </div>
            {weekKey !== getWeekKey() && (
              <div style={{ fontSize: '12px', color: '#5C666F' }}>{weekKey}</div>
            )}
          </div>
          <button onClick={nextWeek} style={navBtnStyle} title="Next week">→</button>
          {weekKey !== getWeekKey() && (
            <button
              onClick={() => setWeekKey(getWeekKey())}
              style={{ ...navBtnStyle, fontSize: '12px', padding: '4px 10px' }}
            >Today</button>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowNews(v => !v)}
            style={{
              ...secondaryBtnStyle,
              background: showNews ? '#DFFFEA' : 'white',
              color: showNews ? '#0C593E' : '#5C666F',
            }}
          >
            {loadingNews ? '⟳ Loading...' : `📰 News (${news.length})`}
          </button>
          <button
            onClick={fetchNews}
            disabled={loadingNews}
            style={secondaryBtnStyle}
            title="Refresh news"
          >
            <span style={{ display: 'inline-block', ...(loadingNews ? { animation: 'spin 1s linear infinite' } : {}) }}>
              <RefreshIcon style={{ width: '14px', height: '14px' }} />
            </span>
          </button>
          {ideas.length > 0 && onQueueAll && (
            <button
              onClick={handleQueueAll}
              disabled={queueing}
              style={{
                ...secondaryBtnStyle,
                background: '#FFF7ED',
                color: '#C2410C',
                borderColor: '#FED7AA',
                fontWeight: '600',
              }}
              title="Send all 5 ideas to Social Media editor as a drafting queue"
            >
              ⚡ {queueing ? 'Queuing...' : `Auto-Draft All ${ideas.length}`}
            </button>
          )}
          <button
            onClick={generateIdeas}
            disabled={loadingIdeas}
            style={primaryBtnStyle}
          >
            <SparklesIcon style={{ width: '16px', height: '16px' }} />
            {loadingIdeas ? 'Generating...' : ideas.length > 0 ? 'Regenerate Week' : 'Generate This Week'}
          </button>
        </div>
      </div>

      {/* Topic Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {(Object.entries(TOPIC_LABELS) as [TopicFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTopic(key)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1.5px solid',
              borderColor: topic === key ? '#0C593E' : '#E5E7EB',
              background: topic === key ? '#0C593E' : 'white',
              color: topic === key ? 'white' : '#5C666F',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: topic === key ? '600' : '400',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* News Feed Panel */}
      {showNews && (
        <div style={{
          background: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '700' }}>
            📰 Latest News — {TOPIC_LABELS[topic]}
          </h3>
          {newsError && (
            <div style={{ color: '#991B1B', background: '#FEE2E2', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>
              {newsError}
            </div>
          )}
          {news.length === 0 && !loadingNews && (
            <p style={{ color: '#5C666F', fontSize: '14px', margin: 0 }}>
              No news loaded. Click the refresh button to fetch headlines.
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {news.map((item, i) => (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  padding: '12px',
                  background: '#F9FAFB',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#0C593E')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
              >
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A1A', lineHeight: '1.4', marginBottom: '4px' }}>
                  {item.title}
                </div>
                {item.description && (
                  <div style={{ fontSize: '12px', color: '#5C666F', lineHeight: '1.4' }}>
                    {item.description.slice(0, 120)}{item.description.length > 120 ? '...' : ''}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>
                  {item.source} {item.pubDate && `· ${new Date(item.pubDate).toLocaleDateString()}`}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {ideasError && (
        <div style={{
          background: '#FEE2E2',
          border: '1px solid #FECACA',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#991B1B',
          fontSize: '14px',
          marginBottom: '20px',
        }}>
          {ideasError}
        </div>
      )}

      {/* Empty State */}
      {ideas.length === 0 && !loadingIdeas && (
        <div style={{
          textAlign: 'center',
          padding: '60px 32px',
          background: 'white',
          borderRadius: '12px',
          border: '2px dashed #E5E7EB',
        }}>
          <TrendingUpIcon style={{ width: '40px', height: '40px', color: '#9CA3AF', margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#1A1A1A' }}>
            Generate Your M–F Content Ideas
          </h3>
          <p style={{ color: '#5C666F', fontSize: '14px', margin: '0 0 24px', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            Click "Generate This Week" to create 5 AI-powered post ideas based on the latest property tax news — one for each weekday.
            {seasonal && ` ${seasonal.state === 'TX' ? '🤠 TX protest season' : '🌴 CA appeal season'} content will be prioritized.`}
          </p>
          <button onClick={generateIdeas} style={primaryBtnStyle}>
            <SparklesIcon style={{ width: '16px', height: '16px' }} />
            Generate This Week's Ideas
          </button>
        </div>
      )}

      {/* Loading State */}
      {loadingIdeas && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
          {DAYS.map(day => (
            <div key={day} style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              padding: '20px',
              animation: 'pulse 1.5s ease-in-out infinite',
              minHeight: '280px',
            }}>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#5C666F', marginBottom: '12px' }}>{day}</div>
              <div style={{ background: '#F3F4F6', borderRadius: '6px', height: '20px', marginBottom: '8px' }} />
              <div style={{ background: '#F3F4F6', borderRadius: '6px', height: '16px', marginBottom: '8px', width: '80%' }} />
              <div style={{ background: '#F3F4F6', borderRadius: '6px', height: '16px', marginBottom: '8px', width: '60%' }} />
              <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                ✨ Scanning news & crafting ideas...
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content Ideas Grid */}
      {!loadingIdeas && ideas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
          {DAYS.map(day => {
            const idea = ideasByDay[day];
            const isRegenerating = regeneratingDay === day;
            const status = idea ? (ideaStatuses[idea.id] || 'idea') : null;

            return (
              <div key={day} style={{
                background: 'white',
                borderRadius: '12px',
                border: `1px solid ${status === 'drafted' ? '#86EFAC' : '#E5E7EB'}`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'box-shadow 0.15s, border-color 0.15s',
                opacity: isRegenerating ? 0.6 : 1,
              }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)')}
              >
                {/* Day Header */}
                <div style={{
                  padding: '10px 12px 8px',
                  borderBottom: '1px solid #F3F4F6',
                  background: '#FAFAFA',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: idea ? '6px' : 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1A1A1A' }}>{day}</div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {/* Status badge */}
                      {status && (
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: '10px',
                          fontSize: '10px',
                          fontWeight: '700',
                          background: status === 'drafted' ? '#DCFCE7' : '#F3F4F6',
                          color: status === 'drafted' ? '#15803D' : '#6B7280',
                        }}>
                          {status === 'drafted' ? '✓ Drafted' : '💡 Idea'}
                        </span>
                      )}
                      {/* Per-card regenerate button */}
                      {idea && (
                        <button
                          onClick={() => regenerateSingleIdea(day)}
                          disabled={isRegenerating || loadingIdeas || !hasApiKey()}
                          title={`Regenerate ${day}'s idea`}
                          style={{
                            background: 'none',
                            border: '1px solid #E5E7EB',
                            borderRadius: '6px',
                            padding: '2px 6px',
                            cursor: isRegenerating ? 'wait' : 'pointer',
                            fontSize: '13px',
                            lineHeight: 1,
                            color: '#9CA3AF',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ display: 'inline-block', animation: isRegenerating ? 'spin 1s linear infinite' : 'none' }}>↻</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {idea && (
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '2px 7px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        background: FORMAT_COLORS[idea.format]?.bg || '#F3F4F6',
                        color: FORMAT_COLORS[idea.format]?.color || '#374151',
                      }}>
                        {FORMAT_COLORS[idea.format]?.label || idea.format}
                      </span>
                      <span style={{
                        padding: '2px 7px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        background: PLATFORM_COLORS[idea.platform] + '18',
                        color: PLATFORM_COLORS[idea.platform],
                      }}>
                        {idea.platform}
                      </span>
                    </div>
                  )}
                </div>

                {/* Idea Content */}
                {isRegenerating ? (
                  <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '13px', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✨ Crafting new idea...
                  </div>
                ) : idea ? (
                  <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Audience */}
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '7px', textTransform: 'capitalize' }}>
                      → {idea.audience}
                    </div>

                    {/* Hook */}
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A1A1A', lineHeight: '1.4', marginBottom: '7px' }}>
                      {idea.hook}
                    </div>

                    {/* Topic pill */}
                    <div style={{
                      fontSize: '11px',
                      color: '#0B8F52',
                      background: '#DFFFEA',
                      padding: '3px 7px',
                      borderRadius: '4px',
                      marginBottom: '9px',
                      lineHeight: '1.4',
                    }}>
                      {idea.topic}
                    </div>

                    {/* Caption — expandable */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '12px',
                        color: '#5C666F',
                        lineHeight: '1.5',
                        overflow: expandedId === idea.id ? 'visible' : 'hidden',
                        display: expandedId === idea.id ? 'block' : '-webkit-box',
                        WebkitLineClamp: expandedId === idea.id ? undefined : 3,
                        WebkitBoxOrient: 'vertical' as const,
                      }}>
                        {idea.caption}
                      </div>
                      <button
                        onClick={() => setExpandedId(v => v === idea.id ? null : idea.id)}
                        style={{ background: 'none', border: 'none', color: '#0B8F52', cursor: 'pointer', fontSize: '12px', padding: '2px 0', fontWeight: '500' }}
                      >
                        {expandedId === idea.id ? 'Show less' : 'Read more'}
                      </button>
                    </div>

                    {/* Hashtags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '9px' }}>
                      {idea.hashtags.map(tag => (
                        <span key={tag} style={{ fontSize: '11px', color: '#0C593E', background: '#DFFFEA', padding: '2px 5px', borderRadius: '4px' }}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Image prompt hint */}
                    {idea.imagePrompt && (
                      <div style={{ marginTop: '9px', fontSize: '11px', color: '#9CA3AF', borderTop: '1px solid #F3F4F6', paddingTop: '7px' }}>
                        🖼️ {idea.imagePrompt}
                      </div>
                    )}

                    {/* News source */}
                    {idea.newsSource && idea.newsSource !== 'null' && (
                      <div style={{ marginTop: '5px', fontSize: '11px', color: '#9CA3AF', fontStyle: 'italic' }}>
                        📰 "{idea.newsSource}"
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '12px', borderTop: '1px solid #F3F4F6', paddingTop: '10px' }}>
                      <button
                        onClick={() => copyIdea(idea)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '7px',
                          borderRadius: '7px',
                          border: '1px solid #E5E7EB',
                          background: copiedId === idea.id ? '#DFFFEA' : 'white',
                          color: copiedId === idea.id ? '#0C593E' : '#5C666F',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          transition: 'all 0.15s',
                        }}
                      >
                        {copiedId === idea.id
                          ? <><CheckIcon style={{ width: '11px', height: '11px' }} /> Copied!</>
                          : <><CopyIcon style={{ width: '11px', height: '11px' }} /> Copy</>
                        }
                      </button>
                      {onCreatePost && (
                        <button
                          onClick={() => handleCreatePost(idea)}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            padding: '7px',
                            borderRadius: '7px',
                            border: 'none',
                            background: status === 'drafted' ? '#15803D' : '#0C593E',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#0B8F52')}
                          onMouseLeave={e => (e.currentTarget.style.background = status === 'drafted' ? '#15803D' : '#0C593E')}
                          title="Open in Social Media editor"
                        >
                          <SendIcon style={{ width: '11px', height: '11px' }} />
                          {status === 'drafted' ? 'Re-draft' : 'Create Post'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '13px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <div>No idea yet</div>
                    <button
                      onClick={() => regenerateSingleIdea(day)}
                      disabled={!hasApiKey() || loadingIdeas}
                      style={{ ...secondaryBtnStyle, fontSize: '11px', padding: '5px 10px' }}
                    >
                      ✨ Generate {day}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom bar */}
      {ideas.length > 0 && (
        <div style={{
          marginTop: '20px',
          padding: '12px 16px',
          background: '#DFFFEA',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#065F46',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <span>
            💡 <strong>↻</strong> regenerates any single day. <strong>Create Post</strong> opens in Social Media pre-filled. <strong>⚡ Auto-Draft All</strong> queues the whole week.
          </span>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0B8F52' }}>
            {draftedCount}/{ideas.length} drafted
          </span>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Button Styles ────────────────────────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 18px',
  borderRadius: '8px',
  border: 'none',
  background: '#0C593E',
  color: 'white',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600',
  transition: 'background 0.15s',
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  background: 'white',
  color: '#5C666F',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '500',
  transition: 'all 0.15s',
};

const navBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  background: 'white',
  color: '#1A1A1A',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: 1,
};
