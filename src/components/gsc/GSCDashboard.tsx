import { useState, useEffect } from 'react';
import {
  hasGSCConfig,
  getPerformanceSummary,
  getTopQueries,
  getContentIdeas,
  inspectURL,
  type SearchPerformanceRow,
  type ContentIdea,
  type URLInspectionResult,
} from '../../services/gscService';

interface GSCDashboardProps {
  onNavigateToSettings?: () => void;
}

type TabType = 'overview' | 'queries' | 'ideas' | 'inspect';

export function GSCDashboard({ onNavigateToSettings }: GSCDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(28);

  // Data states
  const [summary, setSummary] = useState<{
    totalClicks: number;
    totalImpressions: number;
    avgCTR: number;
    avgPosition: number;
    topQueries: SearchPerformanceRow[];
    topPages: SearchPerformanceRow[];
  } | null>(null);
  const [queries, setQueries] = useState<SearchPerformanceRow[]>([]);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);

  // URL inspection
  const [inspectUrl, setInspectUrl] = useState('');
  const [inspectResult, setInspectResult] = useState<URLInspectionResult | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const isConfigured = hasGSCConfig();

  useEffect(() => {
    if (isConfigured && activeTab === 'overview') {
      loadOverview();
    }
  }, [isConfigured, dateRange]);

  useEffect(() => {
    if (isConfigured && activeTab === 'queries' && queries.length === 0) {
      loadQueries();
    }
  }, [activeTab, isConfigured]);

  useEffect(() => {
    if (isConfigured && activeTab === 'ideas' && ideas.length === 0) {
      loadIdeas();
    }
  }, [activeTab, isConfigured]);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPerformanceSummary(dateRange);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadQueries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTopQueries(dateRange, 100);
      setQueries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queries');
    } finally {
      setLoading(false);
    }
  };

  const loadIdeas = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getContentIdeas(dateRange);
      setIdeas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content ideas');
    } finally {
      setLoading(false);
    }
  };

  const handleInspect = async () => {
    if (!inspectUrl.trim()) return;
    setInspecting(true);
    setError(null);
    try {
      const result = await inspectURL(inspectUrl);
      setInspectResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to inspect URL');
    } finally {
      setInspecting(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 'var(--spacing-3xl)' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--spacing-lg)' }}>📊</div>
            <h2>Connect Google Search Console</h2>
            <p className="text-gray" style={{ marginBottom: 'var(--spacing-xl)', maxWidth: 500, margin: '0 auto var(--spacing-xl)' }}>
              View your search performance, discover content opportunities, and check URL indexing status.
            </p>
            <button className="btn btn-primary" onClick={onNavigateToSettings}>
              Configure in Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>Search Console</h1>
          <p className="text-gray">Monitor your search performance and find content opportunities</p>
        </div>
        <div className="flex items-center gap-md">
          <select
            className="form-select"
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            style={{ width: 'auto' }}
          >
            <option value={7}>Last 7 days</option>
            <option value={28}>Last 28 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button className="btn btn-secondary" onClick={loadOverview} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'queries' ? 'active' : ''}`}
          onClick={() => setActiveTab('queries')}
        >
          Top Queries
        </button>
        <button
          className={`tab ${activeTab === 'ideas' ? 'active' : ''}`}
          onClick={() => setActiveTab('ideas')}
        >
          Content Ideas
        </button>
        <button
          className={`tab ${activeTab === 'inspect' ? 'active' : ''}`}
          onClick={() => setActiveTab('inspect')}
        >
          URL Inspection
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-lg)' }}>
          {error}
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Cards */}
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)' }}>
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center' }}>
                  <div className="text-sm text-gray" style={{ marginBottom: 4 }}>Total Clicks</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--td-emerald-dark)' }}>
                    {summary.totalClicks.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center' }}>
                  <div className="text-sm text-gray" style={{ marginBottom: 4 }}>Total Impressions</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                    {summary.totalImpressions.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center' }}>
                  <div className="text-sm text-gray" style={{ marginBottom: 4 }}>Avg CTR</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-info)' }}>
                    {(summary.avgCTR * 100).toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center' }}>
                  <div className="text-sm text-gray" style={{ marginBottom: 4 }}>Avg Position</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-warning)' }}>
                    {summary.avgPosition.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top Queries & Pages */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
            <div className="card">
              <div className="card-header">
                <h4>Top Queries</h4>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {loading ? (
                  <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>Loading...</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>Query</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>Clicks</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.topQueries.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{row.query}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>{row.clicks}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>{(row.ctr * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h4>Top Pages</h4>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {loading ? (
                  <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>Loading...</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>Page</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.topPages.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '12px 16px', fontSize: '13px', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.page?.replace(/^https?:\/\/[^/]+/, '') || row.query}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>{row.clicks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Queries Tab */}
      {activeTab === 'queries' && (
        <div className="card">
          <div className="card-header">
            <h4>All Queries ({queries.length})</h4>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>Loading...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-secondary)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>Query</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>Clicks</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>Impressions</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>CTR</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{row.query}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>{row.clicks}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>{row.impressions.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>{(row.ctr * 100).toFixed(2)}%</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span style={{
                          background: row.position <= 3 ? 'var(--color-success-bg)' : row.position <= 10 ? 'var(--color-info-bg)' : 'var(--bg-secondary)',
                          color: row.position <= 3 ? 'var(--color-success)' : row.position <= 10 ? 'var(--color-info)' : 'var(--text-muted)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '12px',
                        }}>
                          {row.position.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Content Ideas Tab */}
      {activeTab === 'ideas' && (
        <div className="card">
          <div className="card-header">
            <h4>Content Opportunities ({ideas.length})</h4>
            <p className="text-sm text-gray" style={{ margin: 0 }}>
              Based on your search data - opportunities to improve traffic
            </p>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>Loading...</div>
            ) : ideas.length === 0 ? (
              <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-muted)' }}>
                No content ideas found. Try adjusting the date range.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-secondary)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>Query</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>Opportunity</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>Recommendation</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>Impressions</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {ideas.map((idea, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{idea.query}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span className={`badge badge-${idea.opportunity === 'high' ? 'green' : idea.opportunity === 'medium' ? 'yellow' : 'gray'}`}>
                          {idea.opportunity}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: 300 }}>
                        {idea.reason}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>{idea.impressions.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>{idea.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* URL Inspection Tab */}
      {activeTab === 'inspect' && (
        <div className="card">
          <div className="card-header">
            <h4>URL Inspection</h4>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Enter URL to inspect</label>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <input
                  type="url"
                  className="form-input"
                  value={inspectUrl}
                  onChange={(e) => setInspectUrl(e.target.value)}
                  placeholder="https://taxdrop.com/blog/..."
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleInspect}
                  disabled={inspecting || !inspectUrl.trim()}
                >
                  {inspecting ? 'Inspecting...' : 'Inspect'}
                </button>
              </div>
            </div>

            {inspectResult && (
              <div style={{ marginTop: 'var(--spacing-xl)' }}>
                <h5 style={{ marginBottom: 'var(--spacing-md)' }}>Results for: {inspectResult.url}</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
                  <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                    <div className="text-sm text-gray" style={{ marginBottom: 4 }}>Indexing State</div>
                    <div style={{ fontWeight: 600 }}>
                      <span style={{
                        color: inspectResult.indexingState === 'INDEXED' ? 'var(--color-success)' : 'var(--color-error)',
                      }}>
                        {inspectResult.indexingState}
                      </span>
                    </div>
                  </div>
                  {inspectResult.lastCrawlTime && (
                    <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                      <div className="text-sm text-gray" style={{ marginBottom: 4 }}>Last Crawled</div>
                      <div style={{ fontWeight: 600 }}>{new Date(inspectResult.lastCrawlTime).toLocaleDateString()}</div>
                    </div>
                  )}
                  {inspectResult.verdict && (
                    <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                      <div className="text-sm text-gray" style={{ marginBottom: 4 }}>Verdict</div>
                      <div style={{ fontWeight: 600 }}>{inspectResult.verdict}</div>
                    </div>
                  )}
                  {inspectResult.coverageState && (
                    <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                      <div className="text-sm text-gray" style={{ marginBottom: 4 }}>Coverage</div>
                      <div style={{ fontWeight: 600 }}>{inspectResult.coverageState}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
