import { useState } from 'react';
import { CheckIcon, CopyIcon } from '../common/Icons';
import type { CollectionSchema, ValidationError, PublishResult } from '../../services/collections/types';
import { hasWebflowToken } from '../../services/webflowService';
import { publishToWebflow } from '../../services/contentService';
import type { ContentInput } from '../../services/collections/types';
import { PromotionPipeline } from './PromotionPipeline';

interface PublishPanelProps {
  schema: CollectionSchema;
  fields: Record<string, unknown>;
  errors: ValidationError[];
  input: ContentInput;
  /** Whether all AI-generated fields have been reviewed by the human */
  allReviewed: boolean;
  /** Navigate back to the Review tab */
  onGoToReview: () => void;
  /** Whether image is currently generating */
  imageGenerating?: boolean;
  /** Whether image was successfully uploaded to Webflow */
  imageUploaded?: boolean;
}

export function PublishPanel({ schema, fields, errors, input, allReviewed, onGoToReview, imageGenerating, imageUploaded }: PublishPanelProps) {
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState<'draft' | 'live' | null>(null);
  const [showPostPublish, setShowPostPublish] = useState(false);

  const webflowConfigured = hasWebflowToken();
  const hasContent = Object.keys(fields).length > 0;
  const hasErrors = errors.length > 0;
  const canPublish = hasContent && !hasErrors && webflowConfigured && allReviewed;

  const handlePublish = async (publishLive: boolean) => {
    setShowConfirmation(null);
    setPublishing(true);
    setPublishResult(null);

    try {
      const result = await publishToWebflow(schema, fields, input, publishLive);
      setPublishResult(result);
      if (result.success) {
        setShowPostPublish(true);
      }
    } catch (err) {
      setPublishResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to publish',
        publishedLive: false,
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyJSON = () => {
    const mapped = schema.mapToWebflow(fields, input);
    navigator.clipboard.writeText(JSON.stringify(mapped, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Review Gate Warning */}
      {!allReviewed && hasContent && (
        <div style={{
          padding: '16px 20px',
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" style={{ flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: '14px', color: '#92400E' }}>
              Review required before publishing
            </div>
            <div style={{ fontSize: '13px', color: '#92400E', marginTop: '2px' }}>
              All AI-generated fields must be marked as reviewed before you can publish to Webflow.
              Go to the Review tab and mark each field as reviewed after checking it.
            </div>
          </div>
          <button
            onClick={onGoToReview}
            style={{
              padding: '8px 16px',
              background: '#F59E0B',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              whiteSpace: 'nowrap',
            }}
          >
            Go to Review
          </button>
        </div>
      )}

      {/* Status Card */}
      <div style={{
        padding: '20px',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        background: 'white',
      }}>
        <h4 style={{ margin: '0 0 16px', fontSize: '16px' }}>
          Publish {schema.displayName}
        </h4>

        {/* Readiness Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <ChecklistItem
            label="Content generated"
            passed={hasContent}
          />
          <ChecklistItem
            label="All required fields valid"
            passed={!hasErrors}
            detail={hasErrors ? `${errors.length} issue${errors.length > 1 ? 's' : ''} remaining` : undefined}
          />
          <ChecklistItem
            label="All fields reviewed by human"
            passed={allReviewed}
            detail={!allReviewed && hasContent ? 'Review each field in the Review tab' : undefined}
          />
          <ChecklistItem
            label="Webflow API connected"
            passed={webflowConfigured}
            detail={!webflowConfigured ? 'Go to Settings to connect' : undefined}
          />
          {schema.imageFieldSlug && (
            <ChecklistItem
              label="Hero image generated and uploaded"
              passed={!!imageUploaded}
              detail={
                imageGenerating
                  ? 'Generating...'
                  : !imageUploaded && hasContent
                  ? 'Optional — does not block publishing'
                  : undefined
              }
              soft
            />
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={handleCopyJSON}
            disabled={!hasContent}
            style={{
              padding: '10px 20px',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              background: 'white',
              cursor: hasContent ? 'pointer' : 'not-allowed',
              opacity: hasContent ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
            }}
          >
            {copied ? (
              <><CheckIcon style={{ width: 16, height: 16 }} /> Copied!</>
            ) : (
              <><CopyIcon style={{ width: 16, height: 16 }} /> Copy JSON</>
            )}
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setShowConfirmation('draft')}
            disabled={!canPublish || publishing}
            style={{ padding: '10px 20px' }}
          >
            {publishing ? 'Creating...' : 'Save as Draft'}
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setShowConfirmation('live')}
            disabled={!canPublish || publishing}
            style={{ padding: '10px 20px' }}
          >
            {publishing ? 'Publishing...' : 'Publish Live'}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div style={{
          padding: '20px',
          border: showConfirmation === 'live' ? '2px solid #F59E0B' : '2px solid var(--td-emerald-dark)',
          borderRadius: '12px',
          background: showConfirmation === 'live' ? '#FFFBEB' : 'var(--td-mint)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={showConfirmation === 'live' ? '#92400E' : 'var(--td-emerald-dark)'} strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{
              fontWeight: '700',
              fontSize: '15px',
              color: showConfirmation === 'live' ? '#92400E' : 'var(--td-emerald-dark)',
            }}>
              {showConfirmation === 'live'
                ? 'Confirm: Publish this content live?'
                : 'Confirm: Save as draft?'}
            </span>
          </div>
          <div style={{ fontSize: '14px', marginBottom: '16px', color: showConfirmation === 'live' ? '#78350F' : '#1A1A1A' }}>
            {showConfirmation === 'live' ? (
              <>
                This will create a <strong>published {schema.displayName}</strong> in the Webflow CMS.
                It will be <strong>immediately visible on TaxDrop.com</strong>.
                <br /><br />
                Make sure you've thoroughly reviewed all content for accuracy, brand voice, and correct state terminology.
              </>
            ) : (
              <>
                This will create a <strong>draft {schema.displayName}</strong> in the Webflow CMS.
                It will <strong>not</strong> be visible on the live site until manually published in Webflow.
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className={showConfirmation === 'live' ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => handlePublish(showConfirmation === 'live')}
              disabled={publishing}
              style={{ padding: '10px 20px' }}
            >
              {publishing
                ? (showConfirmation === 'live' ? 'Publishing...' : 'Saving...')
                : (showConfirmation === 'live' ? 'Yes, Publish Live' : 'Yes, Save Draft')}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setShowConfirmation(null)}
              disabled={publishing}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {publishResult && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: publishResult.success ? 'var(--td-mint)' : '#FEE2E2',
          border: publishResult.success ? '1px solid #BBF7D0' : '1px solid #FECACA',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '14px',
        }}>
          {publishResult.success ? (
            <CheckIcon style={{ width: 20, height: 20, color: 'var(--td-emerald-dark)', flexShrink: 0 }} />
          ) : (
            <span style={{ fontSize: '20px', flexShrink: 0 }}>&#x274C;</span>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600' }}>
              {publishResult.success ? 'Success' : 'Error'}
            </div>
            <div style={{ marginTop: 2 }}>{publishResult.message}</div>
          </div>
          {publishResult.itemId && (
            <a
              href={`https://webflow.com/design/taxdrop`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '6px 16px',
                background: 'white',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                color: 'var(--td-emerald-dark)',
                textDecoration: 'none',
                fontSize: '13px',
                whiteSpace: 'nowrap',
              }}
            >
              View in Webflow
            </a>
          )}
        </div>
      )}

      {/* Post-Publish Verification Prompt */}
      {showPostPublish && publishResult?.success && (
        <div style={{
          padding: '20px',
          border: '1px solid #BBF7D0',
          borderRadius: '12px',
          background: 'white',
        }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: 'var(--td-emerald-dark)' }}>
            Post-Publish Checklist
          </h4>
          <div style={{ fontSize: '14px', color: 'var(--color-gray-500)', marginBottom: '16px' }}>
            Before moving on, verify the published content in Webflow:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <VerificationStep label="Open the item in Webflow CMS and check all fields look correct" />
            <VerificationStep label="Preview the live page — check formatting, images, and links" />
            <VerificationStep label="Verify state terminology is correct (protest for TX, appeal for CA)" />
            <VerificationStep label="Check SEO title and description appear in the page settings" />
            <VerificationStep label="Confirm the page URL/slug is correct" />
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => setShowPostPublish(false)}
            style={{ marginTop: '16px' }}
          >
            Done — Dismiss
          </button>
        </div>
      )}

      {/* Promotion Pipeline (blog posts only, after successful publish) */}
      {schema.contentType === 'blog-post' && publishResult?.success && (
        <PromotionPipeline fields={fields} input={input} />
      )}

      {/* Field Preview */}
      {hasContent && (
        <div style={{
          padding: '20px',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          background: 'white',
        }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--color-gray-500)' }}>
            Webflow Field Data Preview
          </h4>
          <pre style={{
            background: '#F9FAFB',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '12px',
            overflow: 'auto',
            maxHeight: '400px',
            margin: 0,
          }}>
            {JSON.stringify(schema.mapToWebflow(fields, input), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ChecklistItem({ label, passed, detail, soft }: {
  label: string;
  passed: boolean;
  detail?: string;
  soft?: boolean;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '14px',
    }}>
      <div style={{
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: passed ? 'var(--td-emerald-dark)' : '#E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {passed && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span style={{ color: passed ? '#1A1A1A' : 'var(--color-gray-500)' }}>
        {label}
      </span>
      {detail && (
        <span style={{ fontSize: '12px', color: soft ? 'var(--color-gray-500)' : '#DC2626' }}>
          {detail}
        </span>
      )}
    </div>
  );
}

function VerificationStep({ label }: { label: string }) {
  const [checked, setChecked] = useState(false);

  return (
    <button
      onClick={() => setChecked(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '14px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        padding: '4px 0',
      }}
    >
      <div style={{
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        border: checked ? '2px solid var(--td-emerald-dark)' : '2px solid #D1D5DB',
        background: checked ? 'var(--td-emerald-dark)' : 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s',
      }}>
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span style={{
        color: checked ? 'var(--color-gray-500)' : '#1A1A1A',
        textDecoration: checked ? 'line-through' : 'none',
      }}>
        {label}
      </span>
    </button>
  );
}
