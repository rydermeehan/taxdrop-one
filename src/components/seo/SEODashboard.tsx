import { useState } from 'react';
import {
  analyzePage,
  type SEOAnalysis,
  type SEOIssue,
  type IssuePriority,
  type CategoryType,
} from '../../services/seoAnalyzerService';

type TabType = 'overview' | 'on-page' | 'technical' | 'content' | 'schema' | 'images';

const TAB_LABELS: { id: TabType; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'on-page', label: 'On-Page' },
  { id: 'technical', label: 'Technical' },
  { id: 'content', label: 'Content' },
  { id: 'schema', label: 'Schema' },
  { id: 'images', label: 'Images' },
];

const PRIORITY_BADGE: Record<IssuePriority, string> = {
  critical: 'badge badge-red',
  high: 'badge badge-orange',
  medium: 'badge badge-yellow',
  low: 'badge badge-gray',
};

const CATEGORY_BADGE: Record<CategoryType, string> = {
  'on-page': 'badge badge-blue',
  technical: 'badge badge-purple',
  content: 'badge badge-teal',
  schema: 'badge badge-pink',
  images: 'badge badge-green',
  geo: 'badge badge-gray',
};

function getScoreColor(score: number): string {
  if (score >= 80) return '#059669';
  if (score >= 60) return '#D97706';
  return '#DC2626';
}

function getScoreBg(score: number): string {
  if (score >= 80) return '#ECFDF5';
  if (score >= 60) return '#FFFBEB';
  return '#FEF2F2';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Needs Work';
  return 'Poor';
}

export function SEODashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [analysis, setAnalysis] = useState<SEOAnalysis | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setActiveTab('overview');

    try {
      const result = await analyzePage(url.trim());
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const issuesByPriority = (priority: IssuePriority) =>
    analysis?.issues.filter(i => i.priority === priority).length || 0;

  const issuesByCategory = (category: CategoryType) =>
    analysis?.issues.filter(i => i.category === category) || [];

  return (
    <div className="page-container">
      {/* URL Input */}
      <div className="card">
        <div className="card-body">
          <form onSubmit={handleAnalyze} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--td-charcoal)' }}>
                URL to Analyze
              </label>
              <input
                className="form-input"
                type="text"
                placeholder="https://taxdrop.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || !url.trim()}
              style={{ whiteSpace: 'nowrap', height: '42px' }}
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </form>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ marginTop: '16px' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card" style={{ marginTop: '16px' }}>
          <div className="card-body" style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--td-charcoal)' }}>
              Analyzing {url}...
            </div>
            <div style={{ fontSize: '13px', color: '#5C666F', marginTop: '8px' }}>
              Fetching page, parsing HTML, checking robots.txt, running 6 analysis modules
            </div>
            <div style={{ marginTop: '24px', height: '4px', background: '#E5E7EB', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: '60%',
                background: 'var(--td-emerald-light)',
                borderRadius: '2px',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {analysis && !loading && (
        <>
          {/* Health Score + Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', marginTop: '16px' }}>
            {/* Health Score */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="card-body" style={{ textAlign: 'center' }}>
                <div style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  border: `6px solid ${getScoreColor(analysis.healthScore)}`,
                  background: getScoreBg(analysis.healthScore),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  margin: '0 auto 12px',
                }}>
                  <span style={{ fontSize: '32px', fontWeight: 700, color: getScoreColor(analysis.healthScore), fontFamily: '"Space Grotesk", sans-serif' }}>
                    {analysis.healthScore}
                  </span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: getScoreColor(analysis.healthScore) }}>
                  {getScoreLabel(analysis.healthScore)}
                </div>
                <div style={{ fontSize: '12px', color: '#5C666F', marginTop: '4px' }}>
                  Health Score
                </div>
              </div>
            </div>

            {/* Issue Counts + Score Breakdown */}
            <div className="card">
              <div className="card-body">
                {/* Issue count row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  <StatCard label="Critical" value={issuesByPriority('critical')} color="#DC2626" bg="#FEF2F2" />
                  <StatCard label="High" value={issuesByPriority('high')} color="#EA580C" bg="#FFF7ED" />
                  <StatCard label="Medium" value={issuesByPriority('medium')} color="#D97706" bg="#FFFBEB" />
                  <StatCard label="Low" value={issuesByPriority('low')} color="#5E6670" bg="#F4F6F8" />
                </div>

                {/* Score breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <ScoreBar label="On-Page" score={analysis.scores.onPage} weight="20%" />
                  <ScoreBar label="Technical" score={analysis.scores.technical} weight="30%" />
                  <ScoreBar label="Content" score={analysis.scores.content} weight="30%" />
                  <ScoreBar label="Schema" score={analysis.scores.schema} weight="10%" />
                  <ScoreBar label="Images" score={analysis.scores.images} weight="5%" />
                  <ScoreBar label="AI/GEO" score={analysis.scores.geo} weight="5%" />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ marginTop: '16px' }}>
            {TAB_LABELS.map(tab => (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.id !== 'overview' && analysis && (
                  <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.7 }}>
                    {analysis.scores[tab.id === 'on-page' ? 'onPage' : tab.id as keyof typeof analysis.scores]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ marginTop: '16px' }}>
            {activeTab === 'overview' && <OverviewTab analysis={analysis} />}
            {activeTab === 'on-page' && <OnPageTab analysis={analysis} issues={issuesByCategory('on-page')} />}
            {activeTab === 'technical' && <TechnicalTab analysis={analysis} issues={issuesByCategory('technical')} />}
            {activeTab === 'content' && <ContentTab analysis={analysis} issues={issuesByCategory('content')} />}
            {activeTab === 'schema' && <SchemaTab analysis={analysis} issues={issuesByCategory('schema')} />}
            {activeTab === 'images' && <ImagesTab analysis={analysis} issues={issuesByCategory('images')} />}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ padding: '12px', borderRadius: '8px', background: bg, textAlign: 'center' }}>
      <div style={{ fontSize: '24px', fontWeight: 700, color, fontFamily: '"Space Grotesk", sans-serif' }}>{value}</div>
      <div style={{ fontSize: '12px', color, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function ScoreBar({ label, score, weight }: { label: string; score: number; weight: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
        <span style={{ fontWeight: 500, color: 'var(--td-charcoal)' }}>{label}</span>
        <span style={{ color: getScoreColor(score), fontWeight: 600 }}>{score}</span>
      </div>
      <div style={{ height: '6px', background: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: getScoreColor(score), borderRadius: '3px', transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>{weight} weight</div>
    </div>
  );
}

function IssuesList({ issues }: { issues: SEOIssue[] }) {
  if (issues.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#059669' }}>
        No issues found. Great job!
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {issues.map((issue, i) => (
        <div key={i} style={{ padding: '12px 16px', background: '#FAFAFA', borderRadius: '8px', border: '1px solid #F0F0F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className={PRIORITY_BADGE[issue.priority]}>{issue.priority}</span>
            <span className={CATEGORY_BADGE[issue.category]}>{issue.category}</span>
            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--td-charcoal)' }}>{issue.title}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#5C666F', marginBottom: '4px' }}>{issue.description}</div>
          <div style={{ fontSize: '12px', color: 'var(--td-emerald-dark)', fontWeight: 500 }}>{issue.recommendation}</div>
        </div>
      ))}
    </div>
  );
}

function CheckItem({ label, passed, detail }: { label: string; passed: boolean; detail?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{
        width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: passed ? '#ECFDF5' : '#FEF2F2', color: passed ? '#059669' : '#DC2626', fontSize: '12px', fontWeight: 700, flexShrink: 0,
      }}>
        {passed ? '\u2713' : '\u2717'}
      </span>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--td-charcoal)' }}>{label}</span>
        {detail && <span style={{ fontSize: '12px', color: '#5C666F', marginLeft: '8px' }}>{detail}</span>}
      </div>
    </div>
  );
}

function MetaCard({ label, value, length, min, max }: { label: string; value: string | null; length: number; min: number; max: number }) {
  const inRange = length >= min && length <= max;
  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>{label}</span>
          <span className={`badge ${inRange ? 'badge-green' : length === 0 ? 'badge-red' : 'badge-yellow'}`}>
            {length === 0 ? 'Missing' : `${length} chars`}
          </span>
        </div>
        {value ? (
          <div style={{ fontSize: '13px', color: '#374151', padding: '8px 12px', background: '#F9FAFB', borderRadius: '6px', wordBreak: 'break-word' }}>
            {value}
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: '#DC2626', fontStyle: 'italic' }}>Not found</div>
        )}
        <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>Target: {min}-{max} characters</div>
      </div>
    </div>
  );
}

// ─── Tab Components ──────────────────────────────────────────────────────────

function OverviewTab({ analysis }: { analysis: SEOAnalysis }) {
  return (
    <div>
      {/* Analyzed URL */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#5C666F' }}>Analyzed URL</span>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--td-charcoal)', wordBreak: 'break-all' }}>{analysis.url}</div>
          </div>
          <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
            {new Date(analysis.analyzedAt).toLocaleString()}
          </div>
        </div>
      </div>

      {/* GEO / AI Readiness */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <h3 style={{ margin: 0, fontSize: '15px' }}>AI Search Readiness</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <StatCard label="GEO Score" value={analysis.geo.score} color={getScoreColor(analysis.geo.score)} bg={getScoreBg(analysis.geo.score)} />
            <StatCard label="llms.txt" value={analysis.geo.llmsTxtExists ? 1 : 0} color={analysis.geo.llmsTxtExists ? '#059669' : '#DC2626'} bg={analysis.geo.llmsTxtExists ? '#ECFDF5' : '#FEF2F2'} />
            <StatCard label="SSR Detected" value={analysis.geo.ssrDetected ? 1 : 0} color={analysis.geo.ssrDetected ? '#059669' : '#DC2626'} bg={analysis.geo.ssrDetected ? '#ECFDF5' : '#FEF2F2'} />
          </div>
          {analysis.geo.aiCrawlerAccess.length > 0 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>AI Crawler Access</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {analysis.geo.aiCrawlerAccess.map(c => (
                  <span key={c.name} className={`badge ${c.allowed ? 'badge-green' : 'badge-red'}`}>
                    {c.name}: {c.allowed ? 'Allowed' : 'Blocked'}
                  </span>
                ))}
              </div>
            </div>
          )}
          {analysis.geo.citabilitySignals.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Citability Signals</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {analysis.geo.citabilitySignals.map(s => (
                  <span key={s} className="badge badge-blue">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* All Issues */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ margin: 0, fontSize: '15px' }}>All Issues ({analysis.issues.length})</h3>
        </div>
        <div className="card-body">
          <IssuesList issues={analysis.issues} />
        </div>
      </div>
    </div>
  );
}

function OnPageTab({ analysis, issues }: { analysis: SEOAnalysis; issues: SEOIssue[] }) {
  const { onPage } = analysis;
  return (
    <div>
      <MetaCard label="Title Tag" value={onPage.title.value} length={onPage.title.length} min={30} max={60} />
      <MetaCard label="Meta Description" value={onPage.metaDescription.value} length={onPage.metaDescription.length} min={120} max={160} />

      {/* Headings */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="card-header">
          <h3 style={{ margin: 0, fontSize: '15px' }}>Headings</h3>
        </div>
        <div className="card-body">
          <CheckItem label="H1 tag" passed={onPage.h1Tags.length === 1} detail={onPage.h1Tags.length === 0 ? 'Missing' : onPage.h1Tags.length === 1 ? onPage.h1Tags[0] : `${onPage.h1Tags.length} found (should be 1)`} />
          {onPage.headingHierarchy.slice(0, 15).map((h, i) => (
            <div key={i} style={{ padding: '4px 0', paddingLeft: `${(parseInt(h.tag.replace('h', '')) - 1) * 20}px`, fontSize: '13px', color: '#374151' }}>
              <span style={{ fontWeight: 600, color: '#6B7280', marginRight: '8px' }}>{h.tag.toUpperCase()}</span>
              {h.text}
            </div>
          ))}
          {onPage.headingHierarchy.length > 15 && (
            <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '8px' }}>
              +{onPage.headingHierarchy.length - 15} more headings
            </div>
          )}
        </div>
      </div>

      {/* Links & Social */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div className="card">
          <div className="card-body">
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Links</div>
            <CheckItem label="Internal links" passed={onPage.internalLinkCount > 0} detail={`${onPage.internalLinkCount} found`} />
            <CheckItem label="External links" passed={onPage.externalLinkCount > 0} detail={`${onPage.externalLinkCount} found`} />
            <CheckItem label="Canonical tag" passed={!!onPage.canonical} detail={onPage.canonical || 'Missing'} />
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Social Tags</div>
            <CheckItem label="og:title" passed={!!onPage.ogTags['og:title']} />
            <CheckItem label="og:description" passed={!!onPage.ogTags['og:description']} />
            <CheckItem label="og:image" passed={!!onPage.ogTags['og:image']} />
            <CheckItem label="Twitter Card" passed={!!onPage.twitterCard['twitter:card']} />
          </div>
        </div>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>Issues ({issues.length})</h3>
          </div>
          <div className="card-body">
            <IssuesList issues={issues} />
          </div>
        </div>
      )}
    </div>
  );
}

function TechnicalTab({ analysis, issues }: { analysis: SEOAnalysis; issues: SEOIssue[] }) {
  const { technical } = analysis;
  return (
    <div>
      {/* Core checks */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="card-header">
          <h3 style={{ margin: 0, fontSize: '15px' }}>Core Technical Checks</h3>
        </div>
        <div className="card-body">
          <CheckItem label="HTTPS" passed={technical.https} detail={technical.https ? 'Secure connection' : 'Not using HTTPS'} />
          <CheckItem label="Status Code" passed={technical.statusCode === 200} detail={`HTTP ${technical.statusCode}`} />
          <CheckItem label="Viewport Meta" passed={technical.viewport} detail={technical.viewport ? 'Present' : 'Missing'} />
          <CheckItem label="robots.txt" passed={technical.robotsTxt.exists} detail={technical.robotsTxt.exists ? 'Found' : 'Not found'} />
          <CheckItem label="Meta Robots" passed={!technical.metaRobots?.includes('noindex')} detail={technical.metaRobots || 'Not set (defaults to index, follow)'} />
          <CheckItem label="Redirect Chain" passed={technical.redirectChain.length <= 1} detail={technical.redirectChain.length === 0 ? 'No redirects' : `${technical.redirectChain.length} hop${technical.redirectChain.length > 1 ? 's' : ''}`} />
        </div>
      </div>

      {/* Security Headers */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="card-header">
          <h3 style={{ margin: 0, fontSize: '15px' }}>Security Headers</h3>
        </div>
        <div className="card-body">
          {technical.securityHeaders.map(h => (
            <CheckItem key={h.name} label={h.name} passed={h.present} detail={h.present ? h.value?.slice(0, 60) : 'Missing'} />
          ))}
        </div>
      </div>

      {/* AI Crawler Access */}
      {technical.robotsTxt.aiCrawlers.length > 0 && (
        <div className="card" style={{ marginBottom: '12px' }}>
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>AI Crawler Access</h3>
          </div>
          <div className="card-body">
            {technical.robotsTxt.aiCrawlers.map(c => (
              <CheckItem key={c.name} label={c.name} passed={c.allowed} detail={c.allowed ? 'Allowed' : 'Blocked in robots.txt'} />
            ))}
          </div>
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>Issues ({issues.length})</h3>
          </div>
          <div className="card-body">
            <IssuesList issues={issues} />
          </div>
        </div>
      )}
    </div>
  );
}

function ContentTab({ analysis, issues }: { analysis: SEOAnalysis; issues: SEOIssue[] }) {
  const { content } = analysis;
  const wordPercent = Math.min(100, Math.round((content.wordCount / content.minWordsForType) * 100));

  return (
    <div>
      {/* Word Count */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="card-header">
          <h3 style={{ margin: 0, fontSize: '15px' }}>Word Count</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 700, color: getScoreColor(wordPercent), fontFamily: '"Space Grotesk", sans-serif' }}>
              {content.wordCount.toLocaleString()}
            </span>
            <span className={`badge ${wordPercent >= 100 ? 'badge-green' : wordPercent >= 50 ? 'badge-yellow' : 'badge-red'}`}>
              {wordPercent >= 100 ? 'Meets minimum' : `${content.minWordsForType - content.wordCount} words short`}
            </span>
          </div>
          <div style={{ height: '8px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
            <div style={{ height: '100%', width: `${Math.min(100, wordPercent)}%`, background: getScoreColor(wordPercent), borderRadius: '4px' }} />
          </div>
          <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
            Minimum for {content.pageType} pages: {content.minWordsForType} words
          </div>
        </div>
      </div>

      {/* E-E-A-T Signals */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="card-header">
          <h3 style={{ margin: 0, fontSize: '15px' }}>E-E-A-T Signals</h3>
        </div>
        <div className="card-body">
          <CheckItem label="Author byline" passed={content.hasAuthorByline} detail={content.hasAuthorByline ? 'Found' : 'No author attribution detected'} />
          <CheckItem label="Publication date" passed={content.hasDates} detail={content.hasDates ? 'Found' : 'No dates detected'} />
        </div>
      </div>

      {/* Readability */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="card-header">
          <h3 style={{ margin: 0, fontSize: '15px' }}>Readability</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ textAlign: 'center', padding: '12px', background: '#F9FAFB', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--td-charcoal)', fontFamily: '"Space Grotesk", sans-serif' }}>
                {content.readability.avgSentenceLength}
              </div>
              <div style={{ fontSize: '12px', color: '#5C666F' }}>Avg sentence length</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Target: 15-20 words</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#F9FAFB', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--td-charcoal)', fontFamily: '"Space Grotesk", sans-serif' }}>
                {content.readability.avgParagraphLength}
              </div>
              <div style={{ fontSize: '12px', color: '#5C666F' }}>Avg paragraph length</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Target: 2-4 sentences</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#F9FAFB', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: getScoreColor(content.readability.score === 'Good' ? 80 : content.readability.score === 'Fair' ? 60 : 40), fontFamily: '"Space Grotesk", sans-serif' }}>
                {content.readability.score}
              </div>
              <div style={{ fontSize: '12px', color: '#5C666F' }}>Readability</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Based on sentence length</div>
            </div>
          </div>
        </div>
      </div>

      {/* Internal Linking */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="card-body">
          <CheckItem
            label="Internal link density"
            passed={content.internalLinkDensity >= 3}
            detail={`${content.internalLinkDensity} per 1,000 words (target: 3-5)`}
          />
        </div>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>Issues ({issues.length})</h3>
          </div>
          <div className="card-body">
            <IssuesList issues={issues} />
          </div>
        </div>
      )}
    </div>
  );
}

function SchemaTab({ analysis, issues }: { analysis: SEOAnalysis; issues: SEOIssue[] }) {
  const { schema } = analysis;
  return (
    <div>
      {/* Detected Schema */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="card-header">
          <h3 style={{ margin: 0, fontSize: '15px' }}>Detected Schema Markup ({schema.blocks.length})</h3>
        </div>
        <div className="card-body">
          {schema.blocks.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#DC2626' }}>
              No JSON-LD schema markup detected.
            </div>
          ) : (
            schema.blocks.map((block, i) => (
              <div key={i} style={{ padding: '12px', background: '#F9FAFB', borderRadius: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span className={`badge ${block.valid ? 'badge-green' : 'badge-red'}`}>
                    {block.type}
                  </span>
                  {!block.valid && <span style={{ fontSize: '12px', color: '#DC2626' }}>Deprecated</span>}
                </div>
                <div style={{ fontSize: '12px', color: '#5C666F' }}>
                  Properties: {block.properties.join(', ')}
                </div>
                {block.issues.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>
                    {block.issues.join('; ')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recommendations */}
      {schema.recommendations.length > 0 && (
        <div className="card" style={{ marginBottom: '12px' }}>
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>Recommendations</h3>
          </div>
          <div className="card-body">
            {schema.recommendations.map((rec, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < schema.recommendations.length - 1 ? '1px solid #F3F4F6' : 'none', fontSize: '13px', color: 'var(--td-emerald-dark)', fontWeight: 500 }}>
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>Issues ({issues.length})</h3>
          </div>
          <div className="card-body">
            <IssuesList issues={issues} />
          </div>
        </div>
      )}
    </div>
  );
}

function ImagesTab({ analysis, issues }: { analysis: SEOAnalysis; issues: SEOIssue[] }) {
  const { images } = analysis;
  return (
    <div>
      {/* Summary Stats */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            <StatCard label="Total" value={images.totalImages} color="#374151" bg="#F9FAFB" />
            <StatCard label="Missing Alt" value={images.missingAlt} color={images.missingAlt > 0 ? '#DC2626' : '#059669'} bg={images.missingAlt > 0 ? '#FEF2F2' : '#ECFDF5'} />
            <StatCard label="No Dimensions" value={images.missingDimensions} color={images.missingDimensions > 0 ? '#D97706' : '#059669'} bg={images.missingDimensions > 0 ? '#FFFBEB' : '#ECFDF5'} />
            <StatCard label="No Lazy Load" value={images.missingLazyLoading} color={images.missingLazyLoading > 0 ? '#D97706' : '#059669'} bg={images.missingLazyLoading > 0 ? '#FFFBEB' : '#ECFDF5'} />
            <StatCard label="Non-Optimal" value={images.nonOptimalFormat} color={images.nonOptimalFormat > 0 ? '#D97706' : '#059669'} bg={images.nonOptimalFormat > 0 ? '#FFFBEB' : '#ECFDF5'} />
          </div>
        </div>
      </div>

      {/* Image Table */}
      {images.images.length > 0 && (
        <div className="card" style={{ marginBottom: '12px' }}>
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>Image Details</h3>
          </div>
          <div className="card-body" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: '#5C666F' }}>Source</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: '#5C666F' }}>Alt</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontWeight: 600, color: '#5C666F' }}>Size</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontWeight: 600, color: '#5C666F' }}>Lazy</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontWeight: 600, color: '#5C666F' }}>Format</th>
                </tr>
              </thead>
              <tbody>
                {images.images.map((img, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }}>
                      {img.src.split('/').pop() || img.src}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span className={`badge ${img.alt ? 'badge-green' : 'badge-red'}`}>
                        {img.alt ? (img.alt.length > 30 ? img.alt.slice(0, 30) + '...' : img.alt) : 'Missing'}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span className={`badge ${img.width && img.height ? 'badge-green' : 'badge-yellow'}`}>
                        {img.width && img.height ? `${img.width}x${img.height}` : 'Not set'}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span className={`badge ${img.loading === 'lazy' ? 'badge-green' : 'badge-gray'}`}>
                        {img.loading || 'eager'}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span className={`badge ${['webp', 'avif', 'svg'].includes(img.format) ? 'badge-green' : 'badge-yellow'}`}>
                        {img.format || '?'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>Issues ({issues.length})</h3>
          </div>
          <div className="card-body">
            <IssuesList issues={issues} />
          </div>
        </div>
      )}
    </div>
  );
}
