import { useState, useCallback } from 'react';
import { generateText, hasApiKey } from '../../services/openrouterService';
import { SparklesIcon, CopyIcon, CheckIcon, RefreshIcon } from '../common/Icons';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TermIdea {
  id: string;
  term: string;
  description: string;
  whyItMatters: string;
  state: 'tx' | 'ca' | 'both';
  tier: '1' | '2' | '3';
  category: string;
}

type IdeaCategory =
  | 'all'
  | 'tx-protest'
  | 'ca-appeal'
  | 'exemptions'
  | 'valuation'
  | 'calculations'
  | 'investor'
  | 'partners'
  | 'legal';

type TermStatus = 'idea' | 'generated';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<IdeaCategory, string> = {
  all:          '🗂️ All Categories',
  'tx-protest': '🤠 TX Protest Process',
  'ca-appeal':  '🌴 CA Appeal Process',
  exemptions:   '💰 Exemptions & Credits',
  valuation:    '🏠 Valuation Methods',
  calculations: '🔢 Tax Calculations',
  investor:     '🏢 Investor / Commercial',
  partners:     '🤝 HOA & Partners',
  legal:        '⚖️ Legal & Administrative',
};

const CATEGORY_CONTEXT: Record<IdeaCategory, string> = {
  all: 'Mix of all property tax topics relevant to California and Texas homeowners.',
  'tx-protest': 'Texas-specific protest process: ARB hearings, appraisal districts, HCAD/DCAD/TCAD specifics, informal hearings, protest deadlines, evidence rules, binding arbitration.',
  'ca-appeal': 'California-specific appeal process: Assessment Appeals Board, Prop 8 decline-in-value, BOE process, assessment notice, base year value, Prop 13/19 transfer rules.',
  exemptions: 'Property tax exemptions and credits: homestead, senior/over-65, veteran, disabled person, agricultural, solar, historic, low-income, religious/nonprofit.',
  valuation: 'Property valuation methods and concepts: mass appraisal, comparable sales, income approach, cost approach, land value, depreciation, highest-and-best-use.',
  calculations: 'Tax calculation mechanics: effective tax rate, mill rate/millage, taxable value, assessed vs market value, tax levy, rollback rate, cap rate for taxes, tax ceiling.',
  investor: 'Commercial and investment property terms: commercial assessment, NOI, cap rate valuation, NNN lease tax clauses, business personal property, depreciation schedules.',
  partners: 'Terms relevant to HOA managers, property managers, and real estate agents: tax prorations, escrow impounds, tax certificates, tax liens, tax sales, assessment appeals for clients.',
  legal: 'Legal and administrative terms: tax lien, tax deed, delinquent taxes, tax sale, redemption period, tax roll, tax certificate, statutory deadlines, hearing procedures.',
};

// Terms already in the TaxDrop glossary (avoid suggesting duplicates)
const EXISTING_TERMS = new Set([
  'Ad Valorem Tax', 'Appraisal District', 'Appraisal Review Board', 'Assessed Value',
  'Assessment Ratio', 'Base Year Value', 'Cap Rate', 'Chief Appraiser',
  'Comparable Sales', 'Cost Approach', 'Effective Tax Rate', 'Equalization',
  'Exemption', 'Fair Market Value', 'Homestead Exemption', 'Income Approach',
  'Just Value', 'Levy', 'Lien', 'Market Value', 'Mill Rate', 'Notice of Appraised Value',
  'Over-65 Exemption', 'Property Tax', 'Proposition 13', 'Protest', 'Reassessment',
  'Sales Comparison Approach', 'Special Assessment', 'Tax Rate', 'Tax Roll',
  'Taxable Value', 'Uniformity', 'Valuation', 'Veterans Exemption',
]);

const TIER_LABELS: Record<string, string> = {
  '1': 'Tier 1 — Core',
  '2': 'Tier 2 — Important',
  '3': 'Tier 3 — Supplemental',
};

const TIER_COLORS: Record<string, { bg: string; color: string }> = {
  '1': { bg: '#DFFFEA', color: '#065F46' },
  '2': { bg: '#DBEAFE', color: '#1E40AF' },
  '3': { bg: '#F3F4F6', color: '#6B7280' },
};

const STATE_LABELS: Record<string, string> = {
  tx: '🤠 Texas',
  ca: '🌴 California',
  both: '🗺️ Both States',
};

const STORAGE_KEY = 'taxdrop_glossary_idea_statuses';

// ─── AI Prompt ────────────────────────────────────────────────────────────────

function buildGlossaryIdeaPrompt(category: IdeaCategory, existingTerms: string[]): string {
  const categoryContext = CATEGORY_CONTEXT[category];
  const existingList = existingTerms.slice(0, 50).join(', ');

  return `Generate 12 property tax glossary term ideas for TaxDrop's glossary (California and Texas only).

CATEGORY FOCUS: ${categoryContext}

TERMS ALREADY IN THE GLOSSARY (do NOT suggest these or close variants):
${existingList}

For each term, provide:
- term: The exact term name (properly capitalized, 1-5 words)
- description: One sentence defining what it is (plain English, no jargon)
- whyItMatters: One sentence on why a homeowner, investor, or partner should know this
- state: "tx" (Texas only) | "ca" (California only) | "both" (applies to both states)
- tier: "1" (core term every homeowner should know) | "2" (important for anyone appealing/protesting) | "3" (supplemental/advanced)
- category: one of: general | valuation | exemptions | appeals | investor | legal | calculations

Prioritize terms that:
- Homeowners regularly encounter but don't understand
- Have different meanings in TX vs CA (note state-specific ones)
- Are commonly searched on Google ("what is [term] property tax")
- Create confusion that costs people money when they don't understand them

Respond ONLY with a valid JSON array, no markdown:
[
  {
    "term": "Informal Hearing",
    "description": "A meeting with an appraisal district staff appraiser where homeowners can negotiate their assessed value before a formal ARB hearing.",
    "whyItMatters": "Most Texas protest reductions happen here — 80-90% of informal protests result in a value reduction, often without ever needing a formal hearing.",
    "state": "tx",
    "tier": "1",
    "category": "appeals"
  }
]`;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface GlossaryIdeaGeneratorProps {
  onGenerateTerm?: (term: string) => void;
}

export function GlossaryIdeaGenerator({ onGenerateTerm }: GlossaryIdeaGeneratorProps) {
  const [category, setCategory] = useState<IdeaCategory>('all');
  const [ideas, setIdeas] = useState<TermIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Persist which terms have been sent to generator
  const [termStatuses, setTermStatuses] = useState<Record<string, TermStatus>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  });

  const markGenerated = (ideaId: string) => {
    const updated = { ...termStatuses, [ideaId]: 'generated' as TermStatus };
    setTermStatuses(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const generateIdeas = useCallback(async () => {
    if (!hasApiKey()) {
      setError('OpenRouter API key required. Go to Settings to add it.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const result = await generateText({
        prompt: buildGlossaryIdeaPrompt(category, Array.from(EXISTING_TERMS)),
        systemPrompt: `You are a property tax education specialist helping TaxDrop build the most comprehensive, homeowner-friendly property tax glossary in California and Texas. You know which terms confuse people, which save them money when understood, and which are unique to each state's system.`,
        model: 'anthropic/claude-sonnet-4-5',
        maxTokens: 2500,
      });

      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array in response');

      const parsed = JSON.parse(jsonMatch[0]) as Omit<TermIdea, 'id'>[];
      const withIds: TermIdea[] = parsed.map((idea, i) => ({
        ...idea,
        id: `${category}-${i}-${Date.now()}`,
      }));

      setIdeas(withIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate ideas. Try again.');
    } finally {
      setLoading(false);
    }
  }, [category]);

  const copyTerm = async (term: string, ideaId: string) => {
    await navigator.clipboard.writeText(term);
    setCopiedId(ideaId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerateFull = (idea: TermIdea) => {
    markGenerated(idea.id);
    onGenerateTerm?.(idea.term);
  };

  const generatedCount = ideas.filter(i => termStatuses[i.id] === 'generated').length;

  return (
    <div style={{ maxWidth: '1100px' }}>

      {/* Header */}
      <div style={{
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: '#1A1A1A' }}>
            💡 Glossary Idea Generator
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#5C666F' }}>
            Discover property tax terms to add to the TaxDrop glossary. Select a category, generate ideas, then send any term directly to the full term generator.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {ideas.length > 0 && (
            <button
              onClick={generateIdeas}
              disabled={loading}
              style={secondaryBtnStyle}
              title="Generate fresh ideas"
            >
              <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                <RefreshIcon style={{ width: '14px', height: '14px' }} />
              </span>
              Refresh
            </button>
          )}
          <button
            onClick={generateIdeas}
            disabled={loading || !hasApiKey()}
            style={primaryBtnStyle}
          >
            <SparklesIcon style={{ width: '16px', height: '16px' }} />
            {loading ? 'Generating...' : ideas.length > 0 ? 'Regenerate Ideas' : 'Generate Term Ideas'}
          </button>
        </div>
      </div>

      {/* Category Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {(Object.entries(CATEGORY_LABELS) as [IdeaCategory, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setCategory(key); setIdeas([]); setError(''); }}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1.5px solid',
              borderColor: category === key ? '#0C593E' : '#E5E7EB',
              background: category === key ? '#0C593E' : 'white',
              color: category === key ? 'white' : '#5C666F',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: category === key ? '600' : '400',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px',
          padding: '12px 16px', color: '#991B1B', fontSize: '14px', marginBottom: '20px',
        }}>
          {error}
        </div>
      )}

      {/* Empty State */}
      {ideas.length === 0 && !loading && (
        <div style={{
          textAlign: 'center', padding: '60px 32px', background: 'white',
          borderRadius: '12px', border: '2px dashed #E5E7EB',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📖</div>
          <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#1A1A1A' }}>
            Find Your Next Glossary Terms
          </h3>
          <p style={{ color: '#5C666F', fontSize: '14px', margin: '0 0 24px', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            Select a category above and click Generate to get 12 AI-suggested terms. Each term is vetted for homeowner relevance and cross-checked against your existing 100+ term glossary.
          </p>
          <button onClick={generateIdeas} disabled={!hasApiKey()} style={primaryBtnStyle}>
            <SparklesIcon style={{ width: '16px', height: '16px' }} />
            Generate Term Ideas
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{
              background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB',
              padding: '18px', animation: 'pulse 1.5s ease-in-out infinite', minHeight: '160px',
            }}>
              <div style={{ background: '#F3F4F6', borderRadius: '6px', height: '18px', marginBottom: '10px', width: '70%' }} />
              <div style={{ background: '#F3F4F6', borderRadius: '6px', height: '14px', marginBottom: '6px' }} />
              <div style={{ background: '#F3F4F6', borderRadius: '6px', height: '14px', marginBottom: '6px', width: '85%' }} />
              <div style={{ background: '#F3F4F6', borderRadius: '6px', height: '14px', width: '60%' }} />
            </div>
          ))}
        </div>
      )}

      {/* Ideas Grid */}
      {!loading && ideas.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {ideas.map(idea => {
              const status = termStatuses[idea.id] || 'idea';
              const tierColor = TIER_COLORS[idea.tier] || TIER_COLORS['2'];
              return (
                <div key={idea.id} style={{
                  background: 'white',
                  borderRadius: '12px',
                  border: `1px solid ${status === 'generated' ? '#86EFAC' : '#E5E7EB'}`,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'box-shadow 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)')}
                >
                  {/* Term header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A1A', lineHeight: '1.3', flex: 1 }}>
                      {idea.term}
                    </div>
                    {status === 'generated' && (
                      <span style={{
                        flexShrink: 0, padding: '2px 7px', borderRadius: '10px',
                        fontSize: '10px', fontWeight: '700', background: '#DCFCE7', color: '#15803D',
                      }}>
                        ✓ Generated
                      </span>
                    )}
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600',
                      background: tierColor.bg, color: tierColor.color,
                    }}>
                      {TIER_LABELS[idea.tier]}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600',
                      background: '#F3F4F6', color: '#5C666F',
                    }}>
                      {STATE_LABELS[idea.state]}
                    </span>
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>
                    {idea.description}
                  </div>

                  {/* Why it matters */}
                  <div style={{
                    fontSize: '12px', color: '#0B8F52', background: '#DFFFEA',
                    padding: '8px 10px', borderRadius: '6px', lineHeight: '1.4',
                  }}>
                    💡 {idea.whyItMatters}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '4px' }}>
                    <button
                      onClick={() => copyTerm(idea.term, idea.id)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '4px', padding: '8px', borderRadius: '7px', border: '1px solid #E5E7EB',
                        background: copiedId === idea.id ? '#DFFFEA' : 'white',
                        color: copiedId === idea.id ? '#0C593E' : '#5C666F',
                        cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                      }}
                    >
                      {copiedId === idea.id
                        ? <><CheckIcon style={{ width: '11px', height: '11px' }} /> Copied!</>
                        : <><CopyIcon style={{ width: '11px', height: '11px' }} /> Copy Term</>
                      }
                    </button>
                    {onGenerateTerm && (
                      <button
                        onClick={() => handleGenerateFull(idea)}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: '4px', padding: '8px', borderRadius: '7px', border: 'none',
                          background: status === 'generated' ? '#15803D' : '#0C593E',
                          color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#0B8F52')}
                        onMouseLeave={e => (e.currentTarget.style.background = status === 'generated' ? '#15803D' : '#0C593E')}
                      >
                        <SparklesIcon style={{ width: '11px', height: '11px' }} />
                        {status === 'generated' ? 'Re-generate' : 'Generate Term'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom bar */}
          <div style={{
            marginTop: '20px', padding: '12px 16px', background: '#DFFFEA',
            borderRadius: '8px', fontSize: '13px', color: '#065F46',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>
              💡 Click <strong>Generate Term</strong> to open the full glossary writer pre-filled with that term — or <strong>Copy Term</strong> to paste it manually.
            </span>
            {generatedCount > 0 && (
              <span style={{ fontWeight: '700', color: '#0B8F52', fontSize: '12px' }}>
                {generatedCount}/{ideas.length} sent to generator
              </span>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '10px 18px', borderRadius: '8px', border: 'none',
  background: '#0C593E', color: 'white', cursor: 'pointer',
  fontSize: '14px', fontWeight: '600', transition: 'background 0.15s',
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '8px 14px', borderRadius: '8px', border: '1px solid #E5E7EB',
  background: 'white', color: '#5C666F', cursor: 'pointer',
  fontSize: '13px', fontWeight: '500', transition: 'all 0.15s',
};
