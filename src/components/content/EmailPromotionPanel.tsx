import { useState, useEffect } from 'react';
import { generateText } from '../../services/openrouterService';
import { parseJsonObject } from '../../services/contentService';

interface EmailPromotionPanelProps {
  blogTitle: string;
  blogSlug: string;
  blogDescription: string;
  blogContent: string;
}

interface EmailDraft {
  subject: string;
  preheader: string;
  body: string;
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

export function EmailPromotionPanel({
  blogTitle,
  blogSlug,
  blogDescription,
  blogContent,
}: EmailPromotionPanelProps) {
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const generateEmail = async () => {
    setLoading(true);
    setError(null);

    try {
      const excerpt = stripHtml(blogContent).slice(0, 1500);
      const result = await generateText({
        prompt: `Write a newsletter email promoting this blog post:

Title: "${blogTitle}"
URL: https://taxdrop.com/blog/${blogSlug}
Description: "${blogDescription}"
Excerpt: "${excerpt}"

Generate a JSON object with:
{
  "subject": "Email subject line (compelling, 40-60 chars, no clickbait)",
  "preheader": "Preview text shown after subject in inbox (60-90 chars)",
  "body": "HTML email body with inline styles. TaxDrop brand colors: emerald (#0C593E), mint background (#DFFFEA). Keep it concise — 3-4 short paragraphs max. Tease the best insight from the blog, then CTA to read full article. Include a button-style CTA link. No images needed."
}`,
        systemPrompt: `You are TaxDrop's email writer. Write like a smart friend sharing something useful. Short paragraphs, clear value, one clear CTA. Return only valid JSON.`,
        maxTokens: 2048,
      });

      const parsed = parseJsonObject(result.content) as unknown as EmailDraft;
      setDraft(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate email');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!draft && !loading) {
      generateEmail();
    }
  }, []);

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
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
          <span style={{ fontSize: '18px' }}>📧</span>
          <div>
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#1A1A1A' }}>
              Email Newsletter
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-gray-500)', marginLeft: '8px' }}>
              {draft ? 'Email ready' : loading ? 'Generating...' : 'Generate newsletter email'}
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
                Writing newsletter email...
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
                onClick={generateEmail}
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

          {draft && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Subject Line */}
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{
                  padding: '8px 14px',
                  background: '#F9FAFB',
                  borderBottom: '1px solid #E5E7EB',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontWeight: '600', fontSize: '12px', color: 'var(--color-gray-500)' }}>SUBJECT LINE</span>
                  <button
                    onClick={() => handleCopy('subject', draft.subject)}
                    style={{
                      padding: '2px 8px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '4px',
                      background: copiedField === 'subject' ? 'var(--td-emerald-dark)' : 'white',
                      color: copiedField === 'subject' ? 'white' : 'var(--color-gray-500)',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    {copiedField === 'subject' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div style={{ padding: '10px 14px' }}>
                  <input
                    type="text"
                    value={draft.subject}
                    onChange={e => setDraft({ ...draft, subject: e.target.value })}
                    style={{
                      width: '100%',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: '600',
                      padding: 0,
                    }}
                  />
                </div>
              </div>

              {/* Preheader */}
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{
                  padding: '8px 14px',
                  background: '#F9FAFB',
                  borderBottom: '1px solid #E5E7EB',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontWeight: '600', fontSize: '12px', color: 'var(--color-gray-500)' }}>PREHEADER</span>
                  <button
                    onClick={() => handleCopy('preheader', draft.preheader)}
                    style={{
                      padding: '2px 8px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '4px',
                      background: copiedField === 'preheader' ? 'var(--td-emerald-dark)' : 'white',
                      color: copiedField === 'preheader' ? 'white' : 'var(--color-gray-500)',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    {copiedField === 'preheader' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div style={{ padding: '10px 14px' }}>
                  <input
                    type="text"
                    value={draft.preheader}
                    onChange={e => setDraft({ ...draft, preheader: e.target.value })}
                    style={{
                      width: '100%',
                      border: 'none',
                      fontSize: '13px',
                      color: '#374151',
                      padding: 0,
                    }}
                  />
                </div>
              </div>

              {/* Body Preview */}
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{
                  padding: '8px 14px',
                  background: '#F9FAFB',
                  borderBottom: '1px solid #E5E7EB',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontWeight: '600', fontSize: '12px', color: 'var(--color-gray-500)' }}>EMAIL BODY</span>
                  <button
                    onClick={() => handleCopy('body', draft.body)}
                    style={{
                      padding: '2px 8px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '4px',
                      background: copiedField === 'body' ? 'var(--td-emerald-dark)' : 'white',
                      color: copiedField === 'body' ? 'white' : 'var(--color-gray-500)',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    {copiedField === 'body' ? 'Copied!' : 'Copy HTML'}
                  </button>
                </div>
                <div
                  style={{
                    padding: '16px',
                    maxHeight: '400px',
                    overflow: 'auto',
                    fontSize: '14px',
                    lineHeight: '1.6',
                  }}
                  dangerouslySetInnerHTML={{ __html: draft.body }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button
                  onClick={generateEmail}
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
                  Regenerate Email
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
