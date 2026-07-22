import { useState } from 'react';
import {
  hasNeurowriterConfig,
  evaluateContent,
} from '../../services/neurowriterService';
import type { NWEvaluationResult } from '../../services/neurowriterService';

interface SEOScorePanelProps {
  /** NeuronWriter query ID (from pre-generation analysis) */
  nwQueryId: string | null;
  /** The HTML content to evaluate */
  contentHtml: string;
}

export function SEOScorePanel({ nwQueryId, contentHtml }: SEOScorePanelProps) {
  const [score, setScore] = useState<NWEvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasNeurowriterConfig() || !nwQueryId) {
    return null;
  }

  const handleCheckScore = async () => {
    if (!nwQueryId || !contentHtml) return;
    setLoading(true);
    setError(null);

    try {
      const result = await evaluateContent({
        query: nwQueryId,
        html: contentHtml,
      });
      setScore(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check SEO score');
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (s: number) =>
    s >= 70 ? '#059669' : s >= 40 ? '#D97706' : '#DC2626';

  return (
    <div style={{
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 16px',
        background: '#F9FAFB',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--td-emerald-dark)" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span style={{ fontWeight: '600', fontSize: '14px' }}>
            NeuronWriter SEO Score
          </span>
        </div>
        <button
          onClick={handleCheckScore}
          disabled={loading}
          style={{
            padding: '4px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            background: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            color: 'var(--color-gray-500)',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Checking...' : score ? 'Recheck Score' : 'Check SEO Score'}
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        {!score && !loading && !error && (
          <div style={{
            textAlign: 'center',
            padding: '16px',
            color: 'var(--color-gray-500)',
            fontSize: '13px',
          }}>
            Click "Check SEO Score" to analyze your content against NeuronWriter recommendations
          </div>
        )}

        {loading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '20px',
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '3px solid #E5E7EB',
              borderTopColor: 'var(--td-emerald-dark)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ fontSize: '13px', color: 'var(--color-gray-500)' }}>
              Evaluating content...
            </span>
          </div>
        )}

        {error && (
          <div style={{
            padding: '10px 14px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#DC2626',
          }}>
            {error}
          </div>
        )}

        {score && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Score circle */}
            <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                {/* Background circle */}
                <circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="6"
                />
                {/* Score arc */}
                <circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke={scoreColor(score.score)}
                  strokeWidth="6"
                  strokeDasharray={`${(score.score / 100) * 213.6} 213.6`}
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                />
              </svg>
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: '22px',
                  fontWeight: '700',
                  color: scoreColor(score.score),
                  lineHeight: 1,
                }}>
                  {score.score}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--color-gray-500)' }}>
                  /100
                </span>
              </div>
            </div>

            {/* Score details */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: scoreColor(score.score),
                marginBottom: '4px',
              }}>
                {score.score >= 70 ? 'Great SEO score' : score.score >= 40 ? 'Room for improvement' : 'Needs optimization'}
              </div>

              {score.terms_used !== undefined && score.terms_total !== undefined && (
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  <strong>{score.terms_used}</strong> of <strong>{score.terms_total}</strong> recommended terms used
                </div>
              )}

              <div style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>
                {score.score >= 70
                  ? 'Content is well-optimized for your target keyword.'
                  : 'Edit the content in the Review tab to include more recommended terms, then recheck.'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
