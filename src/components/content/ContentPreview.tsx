import { CheckIcon } from '../common/Icons';
import type { CollectionSchema, ValidationError } from '../../services/collections/types';

interface ContentPreviewProps {
  schema: CollectionSchema;
  fields: Record<string, unknown>;
  errors: ValidationError[];
  onFieldChange: (slug: string, value: unknown) => void;
  /** Set of field slugs that have been reviewed */
  reviewedFields: Set<string>;
  /** Callback when a field is toggled as reviewed */
  onToggleReviewed: (slug: string) => void;
  /** Whether image is currently being generated */
  imageGenerating?: boolean;
  /** Base64 URL of the generated image */
  generatedImageUrl?: string | null;
  /** Error message from image generation */
  imageError?: string | null;
  /** Callback to regenerate the image */
  onRegenerateImage?: () => void;
}

export function ContentPreview({
  schema,
  fields,
  errors,
  onFieldChange,
  reviewedFields,
  onToggleReviewed,
  imageGenerating,
  generatedImageUrl,
  imageError,
  onRegenerateImage,
}: ContentPreviewProps) {
  const getError = (slug: string) => errors.find(e => e.field === slug);

  // Only show AI-generated fields (user-selected fields are handled in the setup tab)
  const aiFields = schema.fields.filter(f => f.aiGenerated);
  const hasContent = Object.keys(fields).length > 0;

  const reviewedCount = aiFields.filter(f => reviewedFields.has(f.slug)).length;
  const totalFields = aiFields.length;
  const allReviewed = reviewedCount === totalFields;

  if (!hasContent) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '64px 32px',
        color: 'var(--color-gray-500)',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
          No content generated yet
        </div>
        <div style={{ fontSize: '14px' }}>
          Go to the Setup tab to generate your {schema.displayName}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Review Progress Bar */}
      <div style={{
        padding: '16px 20px',
        background: allReviewed ? 'var(--td-mint)' : '#FFFBEB',
        border: allReviewed ? '1px solid #BBF7D0' : '1px solid #FDE68A',
        borderRadius: '10px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {allReviewed ? (
              <CheckIcon style={{ width: 18, height: 18, color: 'var(--td-emerald-dark)' }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <span style={{
              fontWeight: '600',
              fontSize: '14px',
              color: allReviewed ? 'var(--td-emerald-dark)' : '#92400E',
            }}>
              {allReviewed
                ? 'All fields reviewed — ready to publish'
                : `Review each field before publishing (${reviewedCount}/${totalFields})`}
            </span>
          </div>
          {!allReviewed && (
            <span style={{ fontSize: '12px', color: '#92400E' }}>
              Mark each field as reviewed after checking it
            </span>
          )}
        </div>
        {/* Progress bar */}
        <div style={{
          height: '6px',
          background: allReviewed ? '#86EFAC' : '#FDE68A',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${totalFields > 0 ? (reviewedCount / totalFields) * 100 : 0}%`,
            background: allReviewed ? 'var(--td-emerald-dark)' : '#F59E0B',
            borderRadius: '3px',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Validation Summary */}
      {errors.length > 0 && (
        <div style={{
          padding: '12px 16px',
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#991B1B',
        }}>
          <strong>{errors.length} issue{errors.length > 1 ? 's' : ''} to fix:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            {errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Hero Image Preview */}
      {schema.imageFieldSlug && onRegenerateImage && (
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
            <span style={{ fontWeight: '600', fontSize: '14px' }}>
              Hero Image
            </span>
            {generatedImageUrl && !imageGenerating && (
              <button
                onClick={onRegenerateImage}
                style={{
                  padding: '4px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--color-gray-500)',
                }}
              >
                Regenerate Image
              </button>
            )}
          </div>
          <div style={{ padding: '16px' }}>
            {imageGenerating && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '32px 16px',
                justifyContent: 'center',
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  border: '3px solid #E5E7EB',
                  borderTopColor: 'var(--td-emerald-dark)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <span style={{ fontSize: '14px', color: 'var(--color-gray-500)' }}>
                  Generating image from photo prompt...
                </span>
              </div>
            )}
            {!imageGenerating && generatedImageUrl && (
              <div>
                <img
                  src={generatedImageUrl}
                  alt="Generated hero image"
                  style={{
                    width: '100%',
                    borderRadius: '6px',
                    maxHeight: '360px',
                    objectFit: 'cover',
                  }}
                />
                {imageError && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#92400E',
                  }}>
                    {imageError}
                  </div>
                )}
                {!imageError && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: 'var(--td-emerald-dark)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <CheckIcon style={{ width: 14, height: 14 }} />
                    Image generated and uploaded to Webflow
                  </div>
                )}
              </div>
            )}
            {!imageGenerating && !generatedImageUrl && !imageError && (
              <div style={{
                textAlign: 'center',
                padding: '24px',
                color: 'var(--color-gray-500)',
                fontSize: '14px',
              }}>
                Image will generate automatically after content
              </div>
            )}
            {!imageGenerating && !generatedImageUrl && imageError && (
              <div style={{
                textAlign: 'center',
                padding: '16px',
              }}>
                <div style={{ fontSize: '14px', color: '#DC2626', marginBottom: '12px' }}>
                  {imageError}
                </div>
                <button
                  onClick={onRegenerateImage}
                  style={{
                    padding: '6px 16px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Retry Image Generation
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Field Editors */}
      {aiFields.map(fieldDef => {
        const value = fields[fieldDef.slug];
        const error = getError(fieldDef.slug);
        const isRichText = fieldDef.type === 'RichText';
        const isLongText = isRichText || (typeof value === 'string' && value.length > 200);
        const isReviewed = reviewedFields.has(fieldDef.slug);

        return (
          <div key={fieldDef.slug} style={{
            border: error
              ? '1px solid #FCA5A5'
              : isReviewed
              ? '1px solid #86EFAC'
              : '1px solid #E5E7EB',
            borderRadius: '8px',
            overflow: 'hidden',
            transition: 'border-color 0.2s',
          }}>
            {/* Field Header */}
            <div style={{
              padding: '10px 16px',
              background: error ? '#FEF2F2' : isReviewed ? '#F0FDF4' : '#F9FAFB',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: '600', fontSize: '14px' }}>
                  {fieldDef.label}
                </span>
                {fieldDef.required && (
                  <span style={{ color: '#EF4444', marginLeft: 4, fontSize: '12px' }}>Required</span>
                )}
                {fieldDef.helpText && (
                  <div style={{ fontSize: '12px', color: 'var(--color-gray-500)', marginTop: 2 }}>
                    {fieldDef.helpText}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <span style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>
                  {typeof value === 'string' ? `${value.length} chars` : ''}
                  {fieldDef.minLength && typeof value === 'string' ? ` (min ${fieldDef.minLength})` : ''}
                </span>

                {/* Review Toggle */}
                <button
                  onClick={() => onToggleReviewed(fieldDef.slug)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    border: isReviewed ? '1px solid var(--td-emerald-dark)' : '1px solid #D1D5DB',
                    borderRadius: '6px',
                    background: isReviewed ? 'var(--td-emerald-dark)' : 'white',
                    color: isReviewed ? 'white' : 'var(--color-gray-500)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                  }}
                >
                  {isReviewed ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Reviewed
                    </>
                  ) : (
                    'Mark Reviewed'
                  )}
                </button>
              </div>
            </div>

            {/* Field Input */}
            <div style={{ padding: '12px 16px' }}>
              {error && (
                <div style={{
                  fontSize: '12px',
                  color: '#DC2626',
                  marginBottom: '8px',
                }}>
                  {error.message}
                </div>
              )}

              {isLongText ? (
                <textarea
                  className="form-textarea"
                  value={typeof value === 'string' ? value : JSON.stringify(value || '')}
                  onChange={e => {
                    onFieldChange(fieldDef.slug, e.target.value);
                    // Un-review if edited after review
                    if (isReviewed) onToggleReviewed(fieldDef.slug);
                  }}
                  rows={isRichText ? 12 : 4}
                  style={{
                    fontFamily: isRichText ? 'monospace' : 'inherit',
                    fontSize: isRichText ? '13px' : '14px',
                    border: 'none',
                    padding: 0,
                    resize: 'vertical',
                  }}
                />
              ) : (
                <input
                  type="text"
                  className="form-input"
                  value={typeof value === 'string' ? value : String(value || '')}
                  onChange={e => {
                    onFieldChange(fieldDef.slug, e.target.value);
                    if (isReviewed) onToggleReviewed(fieldDef.slug);
                  }}
                  style={{ border: 'none', padding: 0 }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
