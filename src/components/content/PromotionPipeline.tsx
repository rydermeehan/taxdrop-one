import { SocialPromotionPanel } from './SocialPromotionPanel';
import { EmailPromotionPanel } from './EmailPromotionPanel';
import type { ContentInput } from '../../services/collections/types';

interface PromotionPipelineProps {
  fields: Record<string, unknown>;
  input: ContentInput;
}

export function PromotionPipeline({ fields, input }: PromotionPipelineProps) {
  const blogTitle = String(fields['name'] || '');
  const blogSlug = String(fields['slug'] || '');
  const blogDescription = String(fields['seo-meta-description'] || fields['post---short-description-card'] || '');
  const blogContent = String(fields['post---content'] || '');
  const state = (input.staticAnswers.state || 'general') as 'texas' | 'california' | 'general';

  if (!blogTitle || !blogContent) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{
        padding: '16px 20px',
        background: 'var(--td-mint)',
        border: '1px solid #BBF7D0',
        borderRadius: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--td-emerald-dark)" strokeWidth="2">
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
          <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--td-emerald-dark)' }}>
            Promote This Blog Post
          </span>
        </div>
        <span style={{ fontSize: '13px', color: '#166534' }}>
          Auto-generated social posts and newsletter email from your published content.
        </span>
      </div>

      <SocialPromotionPanel
        blogTitle={blogTitle}
        blogSlug={blogSlug}
        blogDescription={blogDescription}
        blogContent={blogContent}
        state={state}
      />

      <EmailPromotionPanel
        blogTitle={blogTitle}
        blogSlug={blogSlug}
        blogDescription={blogDescription}
        blogContent={blogContent}
      />
    </div>
  );
}
