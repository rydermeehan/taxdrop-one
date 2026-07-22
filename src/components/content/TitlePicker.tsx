import { useState } from 'react';
import { CheckIcon } from '../common/Icons';
import type { TitleOption } from '../../services/collections/types';

interface TitlePickerProps {
  options: TitleOption[];
  onSelect: (option: TitleOption) => void;
  onRegenerate: () => void;
  onSkip: () => void;
  loading?: boolean;
}

export function TitlePicker({
  options,
  onSelect,
  onRegenerate,
  onSkip,
  loading,
}: TitlePickerProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{
        padding: '16px 20px',
        background: 'var(--td-mint)',
        border: '1px solid #BBF7D0',
        borderRadius: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--td-emerald-dark)" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--td-emerald-dark)' }}>
            Choose a title angle
          </span>
        </div>
        <span style={{ fontSize: '13px', color: '#166534' }}>
          Pick the title that best fits your content strategy. Each one takes a different approach.
        </span>
      </div>

      {options.map((option, i) => {
        const isSelected = selectedIndex === i;
        return (
          <button
            key={i}
            onClick={() => setSelectedIndex(i)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '16px 20px',
              border: isSelected ? '2px solid var(--td-emerald-dark)' : '1px solid #E5E7EB',
              borderRadius: '10px',
              background: isSelected ? 'var(--td-mint)' : 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: '600',
                  fontSize: '15px',
                  color: '#1A1A1A',
                  marginBottom: '4px',
                }}>
                  {option.title}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--color-gray-500)',
                  marginBottom: '6px',
                  fontFamily: 'monospace',
                }}>
                  /{option.slug}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#374151',
                  lineHeight: '1.4',
                }}>
                  {option.angle}
                </div>
              </div>
              {isSelected && (
                <CheckIcon style={{
                  width: 20,
                  height: 20,
                  color: 'var(--td-emerald-dark)',
                  flexShrink: 0,
                  marginLeft: '12px',
                }} />
              )}
            </div>
          </button>
        );
      })}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
        <button
          onClick={() => {
            if (selectedIndex !== null) {
              onSelect(options[selectedIndex]);
            }
          }}
          disabled={selectedIndex === null || loading}
          style={{
            padding: '10px 24px',
            background: selectedIndex !== null ? 'var(--td-emerald-dark)' : '#D1D5DB',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '14px',
            cursor: selectedIndex !== null ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Generating...' : 'Use This Title'}
        </button>

        <button
          onClick={onRegenerate}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: 'white',
            color: 'var(--color-gray-500)',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            fontWeight: '500',
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          Regenerate Titles
        </button>

        <button
          onClick={onSkip}
          disabled={loading}
          style={{
            padding: '10px 16px',
            background: 'transparent',
            color: 'var(--color-gray-500)',
            border: 'none',
            fontSize: '13px',
            cursor: loading ? 'not-allowed' : 'pointer',
            textDecoration: 'underline',
          }}
        >
          Skip — let AI decide
        </button>
      </div>
    </div>
  );
}
