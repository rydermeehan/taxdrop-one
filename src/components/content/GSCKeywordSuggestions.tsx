import { useState, useEffect } from 'react';
import { hasClientId, getContentIdeas } from '../../services/gscService';
import type { ContentIdea } from '../../services/gscService';

interface GSCKeywordSuggestionsProps {
  selectedKeywords: Set<string>;
  onToggleKeyword: (keyword: string) => void;
}

export function GSCKeywordSuggestions({
  selectedKeywords,
  onToggleKeyword,
}: GSCKeywordSuggestionsProps) {
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const isConnected = hasClientId() && !!localStorage.getItem('gsc-access-token');

  useEffect(() => {
    if (!isConnected) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getContentIdeas(28)
      .then(results => {
        if (!cancelled) {
          setIdeas(results.slice(0, 15));
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load GSC data');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isConnected]);

  if (!isConnected) {
    return (
      <div style={{
        padding: '12px 16px',
        background: '#F9FAFB',
        borderRadius: '8px',
        fontSize: '13px',
        color: 'var(--color-gray-500)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        Connect Google Search Console in Settings for keyword suggestions
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        padding: '12px 16px',
        background: '#F9FAFB',
        borderRadius: '8px',
        fontSize: '13px',
        color: 'var(--color-gray-500)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          width: '14px',
          height: '14px',
          border: '2px solid #E5E7EB',
          borderTopColor: 'var(--td-emerald-dark)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        Loading GSC keyword data...
      </div>
    );
  }

  if (error || ideas.length === 0) {
    return null;
  }

  return (
    <div style={{
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          width: '100%',
          padding: '10px 16px',
          background: '#F9FAFB',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--td-emerald-dark)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span style={{ fontWeight: '600', fontSize: '13px', color: '#1A1A1A' }}>
            GSC Keyword Opportunities
          </span>
          {selectedKeywords.size > 0 && (
            <span style={{
              padding: '2px 8px',
              background: 'var(--td-emerald-dark)',
              color: 'white',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: '600',
            }}>
              {selectedKeywords.size} selected
            </span>
          )}
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-gray-500)"
          strokeWidth="2"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {!collapsed && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-gray-500)', marginBottom: '10px' }}>
            Click keywords to include them in your blog's SEO targeting
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ideas.map(idea => {
              const isSelected = selectedKeywords.has(idea.query);
              const opportunityColor = idea.opportunity === 'high'
                ? '#059669'
                : idea.opportunity === 'medium'
                ? '#D97706'
                : '#6B7280';

              return (
                <button
                  key={idea.query}
                  onClick={() => onToggleKeyword(idea.query)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    border: isSelected ? '1px solid var(--td-emerald-dark)' : '1px solid #E5E7EB',
                    borderRadius: '16px',
                    background: isSelected ? 'var(--td-mint)' : 'white',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: isSelected ? 'var(--td-emerald-dark)' : '#374151',
                    fontWeight: isSelected ? '600' : '400',
                    transition: 'all 0.15s',
                  }}
                >
                  {idea.query}
                  <span style={{
                    padding: '1px 5px',
                    background: `${opportunityColor}15`,
                    color: opportunityColor,
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontWeight: '600',
                  }}>
                    {idea.impressions >= 1000 ? `${(idea.impressions / 1000).toFixed(1)}K` : idea.impressions}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
