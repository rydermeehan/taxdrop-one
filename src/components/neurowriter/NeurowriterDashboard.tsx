import { useState, useEffect } from 'react';
import {
  hasNeurowriterConfig,
  listProjects,
  listQueries,
  createQuery,
  getQuery,
  evaluateContent,
  queryResultToScore,
  type NWProject,
  type NWQuery,
  type NWQueryResult,
  type ContentScore,
} from '../../services/neurowriterService';

interface NeurowriterDashboardProps {
  onNavigateToSettings?: () => void;
}

type TabType = 'projects' | 'analyze' | 'new-query';

export function NeurowriterDashboard({ onNavigateToSettings }: NeurowriterDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Projects state
  const [projects, setProjects] = useState<NWProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<NWProject | null>(null);
  const [queries, setQueries] = useState<NWQuery[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<NWQuery | null>(null);
  const [queryResult, setQueryResult] = useState<NWQueryResult | null>(null);

  // New query state
  const [newKeyword, setNewKeyword] = useState('');
  const [newEngine, setNewEngine] = useState('google.com');
  const [newLanguage, setNewLanguage] = useState('en');

  // Analyze state
  const [analyzeContent, setAnalyzeContent] = useState('');
  const [contentScore, setContentScore] = useState<ContentScore | null>(null);

  const isConfigured = hasNeurowriterConfig();

  // Load projects on mount
  useEffect(() => {
    if (isConfigured) {
      loadProjects();
    }
  }, [isConfigured]);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const projectList = await listProjects();
      setProjects(projectList);
      if (projectList.length > 0 && !selectedProject) {
        const firstProject = projectList[0];
        setSelectedProject(firstProject);
        // Also load queries for the auto-selected project
        loadQueries(firstProject.project);
      } else if (projectList.length === 0) {
        setError('No projects found. Create a project in NeuronWriter first.');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to load projects';
      setError(`Failed to load projects: ${errMsg}`);
      console.error('NeuronWriter loadProjects error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadQueries = async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const queryList = await listQueries({ project: projectId });
      setQueries(queryList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queries');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProject = (project: NWProject) => {
    setSelectedProject(project);
    setSelectedQuery(null);
    setQueryResult(null);
    loadQueries(project.project);
  };

  const handleSelectQuery = async (query: NWQuery) => {
    setSelectedQuery(query);
    setLoading(true);
    setError(null);
    try {
      const result = await getQuery(query.query);
      setQueryResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load query');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuery = async () => {
    if (!selectedProject || !newKeyword.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const newQuery = await createQuery({
        project: selectedProject.project,
        keyword: newKeyword,
        engine: newEngine,
        language: newLanguage,
      });
      setQueries(prev => [newQuery, ...prev]);
      setNewKeyword('');
      setActiveTab('projects');
      // Show success message
      alert(`Query created! ID: ${newQuery.query}\n\nNeuronWriter will analyze "${newKeyword}" in the background. Check back in a few minutes for results.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create query');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluateContent = async () => {
    if (!selectedQuery || !analyzeContent.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await evaluateContent({
        query: selectedQuery.query,
        html: analyzeContent,
      });
      // Convert to content score format
      const score = queryResultToScore({
        status: 'ready',
        ...queryResult,
        score: result.score,
      });
      setContentScore(score);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate content');
    } finally {
      setLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 'var(--spacing-3xl)' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--spacing-lg)' }}>✍️</div>
            <h2>Connect NeuronWriter</h2>
            <p className="text-gray" style={{ marginBottom: 'var(--spacing-xl)', maxWidth: 500, margin: '0 auto var(--spacing-xl)' }}>
              Analyze content for SEO, get keyword recommendations, and optimize your content with NeuronWriter.
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
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>NeuronWriter</h1>
        <p className="text-gray">AI-powered content optimization and SEO analysis</p>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <button
          className={`tab ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          Projects & Queries
        </button>
        <button
          className={`tab ${activeTab === 'new-query' ? 'active' : ''}`}
          onClick={() => setActiveTab('new-query')}
        >
          New Analysis
        </button>
        <button
          className={`tab ${activeTab === 'analyze' ? 'active' : ''}`}
          onClick={() => setActiveTab('analyze')}
          disabled={!selectedQuery}
        >
          Evaluate Content
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-lg)' }}>
          {error}
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--spacing-xl)' }}>
          {/* Projects sidebar */}
          <div>
            <div className="card">
              <div className="card-header">
                <h4>Projects</h4>
                <button className="btn btn-ghost btn-sm" onClick={loadProjects} disabled={loading}>
                  ↻
                </button>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {loading && projects.length === 0 ? (
                  <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading projects...
                  </div>
                ) : projects.length === 0 ? (
                  <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ marginBottom: 8 }}>No projects found</p>
                    <a
                      href="https://app.neuronwriter.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      Create in NeuronWriter →
                    </a>
                  </div>
                ) : (
                  <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                    {projects.map(project => (
                      <div
                        key={project.project}
                        onClick={() => handleSelectProject(project)}
                        style={{
                          padding: 'var(--spacing-md)',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-light)',
                          background: selectedProject?.project === project.project ? 'var(--td-mint)' : 'transparent',
                        }}
                      >
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>{project.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {project.language} • {project.engine}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Queries list */}
            {selectedProject && (
              <div className="card" style={{ marginTop: 'var(--spacing-lg)' }}>
                <div className="card-header">
                  <h4>Queries</h4>
                  <span className="badge">{queries.length}</span>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {queries.length === 0 ? (
                    <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {loading ? 'Loading...' : 'No queries yet'}
                    </div>
                  ) : (
                    <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                      {queries.map(query => (
                        <div
                          key={query.query}
                          onClick={() => handleSelectQuery(query)}
                          style={{
                            padding: 'var(--spacing-md)',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-light)',
                            background: selectedQuery?.query === query.query ? 'var(--td-mint)' : 'transparent',
                          }}
                        >
                          <div style={{ fontWeight: 500, marginBottom: 4 }}>{query.keyword}</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span
                              className="badge"
                              style={{
                                background: query.status === 'ready' ? 'var(--td-emerald-light)' : query.status === 'error' ? '#ef4444' : '#f59e0b',
                                color: 'white',
                              }}
                            >
                              {query.status}
                            </span>
                            {query.score !== undefined && (
                              <span style={{ fontSize: '12px', fontWeight: 600, color: getScoreColor(query.score) }}>
                                {query.score}/100
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Query details */}
          <div className="card">
            <div className="card-header">
              <h4>{selectedQuery ? `Analysis: ${selectedQuery.keyword}` : 'Select a Query'}</h4>
              {selectedQuery?.share_url && (
                <a
                  href={selectedQuery.share_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  Open in NeuronWriter ↗
                </a>
              )}
            </div>
            <div className="card-body">
              {!selectedQuery ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--spacing-xl)' }}>
                  Select a project and query to view analysis
                </div>
              ) : loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>Loading...</div>
              ) : !queryResult ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--spacing-xl)' }}>
                  {selectedQuery.status === 'pending' ? 'Analysis in progress...' : 'No results available'}
                </div>
              ) : (
                <>
                  {/* Score */}
                  {queryResult.score !== undefined && (
                    <div style={{ marginBottom: 'var(--spacing-xl)', textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', fontWeight: 700, color: getScoreColor(queryResult.score) }}>
                        {queryResult.score}
                      </div>
                      <div className="text-gray">Content Score</div>
                    </div>
                  )}

                  {/* Recommended length */}
                  {queryResult.recommended_length && (
                    <div style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                      <strong>Recommended length:</strong> ~{queryResult.recommended_length} words
                    </div>
                  )}

                  {/* Terms */}
                  {queryResult.terms && queryResult.terms.length > 0 && (
                    <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                      <h5 style={{ marginBottom: 'var(--spacing-sm)' }}>Key Terms ({queryResult.terms.length})</h5>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                        {queryResult.terms.slice(0, 30).map((term, i) => (
                          <span
                            key={i}
                            className="badge"
                            style={{
                              background: term.importance > 0.7 ? 'var(--td-emerald-light)' : term.importance > 0.4 ? 'var(--td-mint)' : 'var(--bg-secondary)',
                              color: term.importance > 0.7 ? 'white' : 'inherit',
                            }}
                          >
                            {term.term}
                            {term.count_min !== undefined && ` (${term.count_min}-${term.count_max})`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Questions */}
                  {queryResult.questions && queryResult.questions.length > 0 && (
                    <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                      <h5 style={{ marginBottom: 'var(--spacing-sm)' }}>Questions to Answer</h5>
                      <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--text-secondary)' }}>
                        {queryResult.questions.slice(0, 10).map((q, i) => (
                          <li key={i} style={{ marginBottom: 'var(--spacing-xs)' }}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Competitors */}
                  {queryResult.competitors && queryResult.competitors.length > 0 && (
                    <div>
                      <h5 style={{ marginBottom: 'var(--spacing-sm)' }}>Top Competitors</h5>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-secondary)' }}>
                            <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>Title</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.competitors.slice(0, 10).map((comp, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '8px' }}>{comp.position}</td>
                              <td style={{ padding: '8px' }}>
                                <a href={comp.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--td-emerald-dark)' }}>
                                  {comp.title || comp.url}
                                </a>
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: getScoreColor(comp.score) }}>
                                {comp.score}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Query Tab */}
      {activeTab === 'new-query' && (
        <div className="card" style={{ maxWidth: 600 }}>
          <div className="card-header">
            <h4>Create New Analysis</h4>
          </div>
          <div className="card-body">
            {projects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                  You need to create a project in NeuronWriter first before you can create a new analysis.
                </p>
                <a
                  href="https://app.neuronwriter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  Open NeuronWriter →
                </a>
              </div>
            ) : (
              <>
            <div className="form-group">
              <label className="form-label">Project</label>
              <select
                className="form-select"
                value={selectedProject?.project || ''}
                onChange={(e) => {
                  const proj = projects.find(p => p.project === e.target.value);
                  if (proj) setSelectedProject(proj);
                }}
              >
                <option value="">Select a project...</option>
                {projects.map(p => (
                  <option key={p.project} value={p.project}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Keyword / Topic</label>
              <input
                type="text"
                className="form-input"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="e.g., property tax appeal California"
              />
              <p className="text-xs text-gray" style={{ marginTop: 4 }}>
                Enter the primary keyword you want to rank for
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
              <div className="form-group">
                <label className="form-label">Search Engine</label>
                <select
                  className="form-select"
                  value={newEngine}
                  onChange={(e) => setNewEngine(e.target.value)}
                >
                  <option value="google.com">Google (US)</option>
                  <option value="google.co.uk">Google (UK)</option>
                  <option value="google.ca">Google (Canada)</option>
                  <option value="google.com.au">Google (Australia)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Language</label>
                <select
                  className="form-select"
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCreateQuery}
              disabled={loading || !selectedProject || !newKeyword.trim()}
            >
              {loading ? 'Creating...' : 'Create Analysis'}
            </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Analyze Tab */}
      {activeTab === 'analyze' && selectedQuery && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 'var(--spacing-xl)' }}>
          <div className="card">
            <div className="card-header">
              <h4>Evaluate Content</h4>
            </div>
            <div className="card-body">
              <p className="text-sm text-gray" style={{ marginBottom: 'var(--spacing-md)' }}>
                Paste your content below to evaluate it against the keyword "{selectedQuery.keyword}"
              </p>
              <div className="form-group">
                <textarea
                  className="form-textarea"
                  value={analyzeContent}
                  onChange={(e) => setAnalyzeContent(e.target.value)}
                  placeholder="Paste your article content here (HTML or plain text)..."
                  rows={15}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleEvaluateContent}
                disabled={loading || !analyzeContent.trim()}
              >
                {loading ? 'Evaluating...' : 'Evaluate Content'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h4>Score</h4>
            </div>
            <div className="card-body">
              {!contentScore ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--spacing-xl)' }}>
                  Paste content and click evaluate to see your score
                </div>
              ) : (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
                    <div style={{ fontSize: '4rem', fontWeight: 700, color: getScoreColor(contentScore.overall) }}>
                      {contentScore.overall}
                    </div>
                    <div className="text-gray">Content Score</div>
                  </div>

                  {contentScore.suggestions.length > 0 && (
                    <>
                      <h5 style={{ marginBottom: 'var(--spacing-sm)' }}>Suggestions</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                        {contentScore.suggestions.map((s, i) => (
                          <div
                            key={i}
                            style={{
                              padding: 'var(--spacing-sm)',
                              background: s.severity === 'high' ? '#fef2f2' : s.severity === 'medium' ? '#fffbeb' : 'var(--bg-secondary)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '13px',
                            }}
                          >
                            <span
                              className="badge"
                              style={{
                                background: s.severity === 'high' ? '#ef4444' : s.severity === 'medium' ? '#f59e0b' : '#9ca3af',
                                color: 'white',
                                marginRight: 8,
                              }}
                            >
                              {s.type}
                            </span>
                            {s.message}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}
