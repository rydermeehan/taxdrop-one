import { useState, useEffect } from 'react';
import { generateText, generateImage } from '../../services/openrouterService';
import {
  buildPromotePrompt,
  parseDraftResponse,
  SOCIAL_POST_SYSTEM_PROMPT,
  PLATFORM_INFO,
} from '../../services/socialPostService';
import type { SocialPlatformKey, GeneratedDraft } from '../../services/socialPostService';
import type { PageContent } from '../../services/socialPostService';
import { hasOnlySocialConfig } from '../../services/onlySocialService';

interface SocialPromotionPanelProps {
  blogTitle: string;
  blogSlug: string;
  blogDescription: string;
  blogContent: string;
  state: 'texas' | 'california' | 'general';
}

const ALL_PLATFORMS: SocialPlatformKey[] = ['linkedin', 'instagram', 'facebook', 'twitter'];

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

export function SocialPromotionPanel({
  blogTitle,
  blogSlug,
  blogDescription,
  blogContent,
  state,
}: SocialPromotionPanelProps) {
  const [drafts, setDrafts] = useState<GeneratedDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [generatingImages, setGeneratingImages] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const pageContent: PageContent = {
    url: `https://taxdrop.com/blog/${blogSlug}`,
    title: blogTitle,
    description: blogDescription,
    ogImage: '',
    bodyText: stripHtml(blogContent).slice(0, 2000),
  };

  const generatePosts = async () => {
    setLoading(true);
    setError(null);

    try {
      const prompt = buildPromotePrompt(pageContent, ALL_PLATFORMS, state, 'freeform');
      const result = await generateText({
        prompt,
        systemPrompt: SOCIAL_POST_SYSTEM_PROMPT + '\n\nReturn a JSON object with keys: linkedin, instagram, facebook, twitter. Each value is the complete post text for that platform.',
        maxTokens: 2048,
      });
      const parsed = parseDraftResponse(result.content);
      setDrafts(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate social posts');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate on mount
  useEffect(() => {
    if (!drafts && !loading) {
      generatePosts();
    }
  }, []);

  const handleGenerateImages = async () => {
    setGeneratingImages(true);
    try {
      const imagePrompt = `Professional hero image for a blog post titled "${blogTitle}". Clean, modern design with warm natural lighting. Property tax or homeowner theme. No text overlays, no watermarks.`;

      // Generate images for different aspect ratios in parallel
      const [squareImg, landscapeImg] = await Promise.all([
        generateImage({ model: 'google/gemini-3-pro-image-preview', prompt: imagePrompt, aspectRatio: '1:1', imageSize: '1K' }),
        generateImage({ model: 'google/gemini-3-pro-image-preview', prompt: imagePrompt, aspectRatio: '16:9', imageSize: '1K' }),
      ]);

      setImageUrls({
        instagram: squareImg.url,
        linkedin: landscapeImg.url,
        facebook: landscapeImg.url,
        twitter: landscapeImg.url,
      });
    } catch (err) {
      console.error('Failed to generate social images:', err);
    } finally {
      setGeneratingImages(false);
    }
  };

  const handleCopy = (platform: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(platform);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleEditDraft = (platform: SocialPlatformKey, value: string) => {
    if (drafts) {
      setDrafts({ ...drafts, [platform]: value });
    }
  };

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
          padding: '14px 20px',
          background: '#F9FAFB',
          border: 'none',
          borderBottom: collapsed ? 'none' : '1px solid #E5E7EB',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>📱</span>
          <div>
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#1A1A1A' }}>
              Social Media Promotion
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-gray-500)', marginLeft: '8px' }}>
              {drafts ? '4 posts ready' : loading ? 'Generating...' : 'Generate posts for all platforms'}
            </span>
          </div>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-gray-500)" strokeWidth="2"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {!collapsed && (
        <div style={{ padding: '16px 20px' }}>
          {loading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '24px',
            }}>
              <div style={{
                width: '20px', height: '20px',
                border: '3px solid #E5E7EB',
                borderTopColor: 'var(--td-emerald-dark)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <span style={{ fontSize: '13px', color: 'var(--color-gray-500)' }}>
                Writing social posts for all platforms...
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
              marginBottom: '12px',
            }}>
              {error}
              <button
                onClick={generatePosts}
                style={{
                  marginLeft: '10px',
                  padding: '2px 8px',
                  border: '1px solid #FECACA',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {drafts && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {ALL_PLATFORMS.map(platform => {
                const text = drafts[platform] || '';
                const info = PLATFORM_INFO[platform];
                return (
                  <div key={platform} style={{
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '8px 14px',
                      background: '#F9FAFB',
                      borderBottom: '1px solid #E5E7EB',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontWeight: '600', fontSize: '13px' }}>
                        {info.icon} {info.label}
                      </span>
                      <button
                        onClick={() => handleCopy(platform, text)}
                        style={{
                          padding: '2px 10px',
                          border: '1px solid #D1D5DB',
                          borderRadius: '4px',
                          background: copied === platform ? 'var(--td-emerald-dark)' : 'white',
                          color: copied === platform ? 'white' : 'var(--color-gray-500)',
                          cursor: 'pointer',
                          fontSize: '11px',
                          transition: 'all 0.2s',
                        }}
                      >
                        {copied === platform ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div style={{ padding: '10px 14px' }}>
                      <textarea
                        value={text}
                        onChange={e => handleEditDraft(platform, e.target.value)}
                        rows={4}
                        style={{
                          width: '100%',
                          border: 'none',
                          resize: 'vertical',
                          fontSize: '13px',
                          fontFamily: 'inherit',
                          lineHeight: '1.5',
                          padding: 0,
                          background: 'transparent',
                        }}
                      />
                      {info.charLimit && text.length > info.charLimit && (
                        <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px' }}>
                          {text.length}/{info.charLimit} chars — over limit
                        </div>
                      )}
                      {imageUrls[platform] && (
                        <img
                          src={imageUrls[platform]}
                          alt={`${info.label} preview`}
                          style={{
                            width: '100%',
                            maxHeight: '200px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            marginTop: '8px',
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button
                  onClick={handleGenerateImages}
                  disabled={generatingImages}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: generatingImages ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    opacity: generatingImages ? 0.6 : 1,
                  }}
                >
                  {generatingImages
                    ? 'Generating Images...'
                    : Object.keys(imageUrls).length > 0
                    ? 'Regenerate Images'
                    : 'Generate Platform Images'}
                </button>
                <button
                  onClick={generatePosts}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--color-gray-500)',
                  }}
                >
                  Regenerate Posts
                </button>
                {hasOnlySocialConfig() && (
                  <span style={{ fontSize: '12px', color: 'var(--color-gray-500)', alignSelf: 'center' }}>
                    OnlySocial connected — schedule from your dashboard
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
