import { useState } from 'react';
import type { StaticQuestion } from '../../services/collections/types';

interface ClarificationChatProps {
  /** Static questions defined by the schema */
  staticQuestions: StaticQuestion[];
  /** AI-generated clarifying questions */
  aiQuestions: string[];
  /** Whether AI questions are still loading */
  loadingQuestions: boolean;
  /** Callback when user submits all answers */
  onSubmit: (staticAnswers: Record<string, string>, clarificationAnswers: Record<string, string>) => void;
  /** Callback to skip clarification */
  onSkip: () => void;
  /** Content type name for display */
  contentType: string;
}

export function ClarificationChat({
  staticQuestions,
  aiQuestions,
  loadingQuestions,
  onSubmit,
  onSkip,
  contentType,
}: ClarificationChatProps) {
  const [staticAnswers, setStaticAnswers] = useState<Record<string, string>>({});
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});

  const handleStaticChange = (id: string, value: string) => {
    setStaticAnswers(prev => ({ ...prev, [id]: value }));
  };

  const handleClarificationChange = (index: number, value: string) => {
    setClarificationAnswers(prev => ({ ...prev, [`q${index}`]: value }));
  };

  const allStaticAnswered = staticQuestions
    .filter(q => q.required)
    .every(q => (staticAnswers[q.id] || '').trim().length > 0);

  const handleSubmit = () => {
    onSubmit(staticAnswers, clarificationAnswers);
  };

  return (
    <div style={{
      border: '1px solid #E5E7EB',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        background: 'var(--td-mint)',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontWeight: '600', fontSize: '15px' }}>
            Let's refine your {contentType}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-gray-500)', marginTop: 2 }}>
            Answer a few questions to generate better content
          </div>
        </div>
        <button
          onClick={onSkip}
          style={{
            padding: '6px 16px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            background: 'white',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--color-gray-500)',
          }}
        >
          Skip & Generate
        </button>
      </div>

      {/* Questions */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Static Questions */}
        {staticQuestions.length > 0 && (
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-gray-500)',
              marginBottom: '12px',
            }}>
              Required Info
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {staticQuestions.map(q => (
                <div key={q.id}>
                  <label style={{
                    display: 'block',
                    fontWeight: '500',
                    fontSize: '14px',
                    marginBottom: '6px',
                  }}>
                    {q.question}
                    {q.required && <span style={{ color: '#EF4444', marginLeft: 4 }}>*</span>}
                  </label>
                  {q.inputType === 'select' && q.options ? (
                    <select
                      className="form-select"
                      value={staticAnswers[q.id] || ''}
                      onChange={e => handleStaticChange(q.id, e.target.value)}
                    >
                      <option value="">Select...</option>
                      {q.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : q.inputType === 'textarea' ? (
                    <textarea
                      className="form-textarea"
                      value={staticAnswers[q.id] || ''}
                      onChange={e => handleStaticChange(q.id, e.target.value)}
                      placeholder={q.placeholder}
                      rows={3}
                    />
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      value={staticAnswers[q.id] || ''}
                      onChange={e => handleStaticChange(q.id, e.target.value)}
                      placeholder={q.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Clarifying Questions */}
        {(aiQuestions.length > 0 || loadingQuestions) && (
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-gray-500)',
              marginBottom: '12px',
            }}>
              Clarifying Questions
              {loadingQuestions && (
                <span style={{ fontWeight: '400', textTransform: 'none', marginLeft: 8 }}>
                  Thinking...
                </span>
              )}
            </div>

            {loadingQuestions && aiQuestions.length === 0 && (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--color-gray-500)',
                fontSize: '14px',
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  border: '3px solid #E5E7EB',
                  borderTopColor: 'var(--td-emerald-dark)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 12px',
                }} />
                Generating questions based on your concept...
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {aiQuestions.map((question, i) => (
                <div key={i}>
                  <label style={{
                    display: 'block',
                    fontWeight: '500',
                    fontSize: '14px',
                    marginBottom: '6px',
                  }}>
                    {question}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={clarificationAnswers[`q${i}`] || ''}
                    onChange={e => handleClarificationChange(i, e.target.value)}
                    placeholder="Type your answer (optional)..."
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid #E5E7EB',
        background: '#F9FAFB',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
      }}>
        <button
          onClick={onSkip}
          style={{
            padding: '10px 20px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            background: 'white',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Skip Questions
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!allStaticAnswered}
          style={{ padding: '10px 24px' }}
        >
          Generate Content
        </button>
      </div>
    </div>
  );
}
