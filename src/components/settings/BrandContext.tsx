import { useState } from 'react';
import { CopyIcon, CheckIcon } from '../common/Icons';

// TaxDrop Brand Context for content creation
export function BrandContext() {
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('colors');

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const sections = [
    {
      id: 'colors',
      title: 'Brand Colors',
      content: (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            marginBottom: '16px',
          }}>
            {[
              { name: 'Deep Emerald Dark', hex: '#0C593E', text: 'white' },
              { name: 'Deep Emerald Light', hex: '#0B8F52', text: 'white' },
              { name: 'Mint Background', hex: '#DFFFEA', text: '#1A1A1A' },
              { name: 'Yellow-Green Pop', hex: '#C4FF64', text: '#1A1A1A' },
              { name: 'Sky Blue Accent', hex: '#C6F0FF', text: '#1A1A1A' },
              { name: 'Charcoal', hex: '#1A1A1A', text: 'white' },
              { name: 'Gray 500', hex: '#5C666F', text: 'white' },
              { name: 'White', hex: '#FFFFFF', text: '#1A1A1A' },
            ].map(color => (
              <button
                key={color.hex}
                onClick={() => handleCopy(color.hex, color.hex)}
                style={{
                  padding: '12px 8px',
                  background: color.hex,
                  color: color.text,
                  border: color.hex === '#FFFFFF' ? '1px solid #E5E7EB' : 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>{color.name}</div>
                <div style={{ fontSize: '12px', fontWeight: '600' }}>
                  {copied === color.hex ? 'Copied!' : color.hex}
                </div>
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'voice',
      title: 'Voice & Tone',
      content: (
        <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '12px' }}>
            <strong>TaxDrop sounds like a knowledgeable friend who happens to be an expert in property taxes.</strong>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--td-emerald-dark)' }}>We Are:</div>
              <ul style={{ paddingLeft: '16px', margin: 0 }}>
                <li>Conversational — talk like real people</li>
                <li>Confident — we know our stuff</li>
                <li>Helpful — genuinely want to save money</li>
                <li>Clear — no jargon, no confusion</li>
                <li>Reassuring — ease anxiety about the process</li>
                <li>Transparent — no hidden fees or surprises</li>
              </ul>
            </div>
            <div>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: '#B45309' }}>Never Use:</div>
              <ul style={{ paddingLeft: '16px', margin: 0 }}>
                <li>"Save $500+ or you pay nothing"</li>
                <li>"Slash your taxes" (too salesy)</li>
                <li>"Revolutionary" / "Cutting-edge"</li>
                <li>Corporate jargon (synergy, leverage)</li>
                <li>ALL CAPS or excessive punctuation</li>
                <li>Pressure tactics or false urgency</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'terminology',
      title: 'State Terminology',
      content: (
        <div style={{ fontSize: '14px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}>
            <div style={{
              padding: '12px',
              background: '#FEF3C7',
              borderRadius: '8px',
            }}>
              <div style={{ fontWeight: '700', marginBottom: '8px' }}>Texas</div>
              <ul style={{ paddingLeft: '16px', margin: 0 }}>
                <li><strong>Protest</strong> — action of challenging assessment</li>
                <li><strong>Appraisal District</strong> — determines values</li>
                <li><strong>Notice of Appraised Value</strong> — the document</li>
                <li><strong>Informal hearing</strong> — first level meeting</li>
                <li><strong>ARB hearing</strong> — formal hearing</li>
                <li><strong>Deadline:</strong> May 15</li>
              </ul>
            </div>
            <div style={{
              padding: '12px',
              background: '#DBEAFE',
              borderRadius: '8px',
            }}>
              <div style={{ fontWeight: '700', marginBottom: '8px' }}>California</div>
              <ul style={{ paddingLeft: '16px', margin: 0 }}>
                <li><strong>Appeal</strong> — action of challenging assessment</li>
                <li><strong>Assessor's Office</strong> — determines values</li>
                <li><strong>Assessment Notice</strong> — the document</li>
                <li><strong>Assessment Appeals Board</strong> — formal board</li>
                <li><strong>Deadline:</strong> Varies by county</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'stats',
      title: 'Key Statistics',
      content: (
        <div style={{ fontSize: '14px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginBottom: '16px',
          }}>
            {[
              { stat: '30-60%', label: 'Properties over-assessed' },
              { stat: '~5%', label: 'Owners who protest' },
              { stat: '80-90%', label: 'TX success rate' },
              { stat: '10-15%', label: 'Typical savings' },
            ].map((item, i) => (
              <div key={i} style={{
                padding: '12px',
                background: 'var(--td-mint)',
                borderRadius: '8px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--td-emerald-dark)' }}>
                  {item.stat}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-gray-500)' }}>
            <strong>TaxDrop:</strong> &lt; 2 min for savings estimate | 85% of beta users found $1K+ savings
          </div>
        </div>
      ),
    },
    {
      id: 'phrases',
      title: 'Power Phrases',
      content: (
        <div style={{ fontSize: '14px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}>
            <div>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>Benefit Phrases</div>
              <ul style={{ paddingLeft: '16px', margin: 0 }}>
                <li>"Reduce your property taxes"</li>
                <li>"Save hundreds (or thousands) every year"</li>
                <li>"No upfront cost"</li>
                <li>"You only pay if we save you money"</li>
                <li>"We handle everything"</li>
                <li>"Takes less than 2 minutes"</li>
                <li>"Expert-driven appeals"</li>
              </ul>
            </div>
            <div>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>Trust Phrases</div>
              <ul style={{ paddingLeft: '16px', margin: 0 }}>
                <li>"No fee if savings are under $500"</li>
                <li>"25% of savings — only if we win"</li>
                <li>"Risk-free"</li>
                <li>"Thousands of successful protests"</li>
              </ul>
              <div style={{ fontWeight: '600', marginTop: '12px', marginBottom: '8px' }}>CTAs</div>
              <ul style={{ paddingLeft: '16px', margin: 0 }}>
                <li>"Start your protest"</li>
                <li>"See your potential savings"</li>
                <li>"Get your free estimate"</li>
                <li>"Check your property now"</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'writing',
      title: 'Writing Style',
      content: (
        <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}>
            <div>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>Sentence Structure</div>
              <ul style={{ paddingLeft: '16px', margin: 0 }}>
                <li><strong>Short sentences</strong> — 8-12 words avg</li>
                <li><strong>Active voice</strong> — "We review" not "is reviewed"</li>
                <li><strong>Direct address</strong> — use "you" and "your"</li>
                <li><strong>First person</strong> — "We" for company</li>
              </ul>
            </div>
            <div>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>Headlines</div>
              <ul style={{ paddingLeft: '16px', margin: 0 }}>
                <li>Outcome-driven (what reader gets)</li>
                <li>Include numbers when possible</li>
                <li>Under 10 words</li>
                <li>Sentence case (not Title Case)</li>
              </ul>
            </div>
          </div>
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#F3F4F6',
            borderRadius: '8px',
          }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>Content Structure</div>
            <div style={{ fontSize: '13px' }}>
              Hook → Problem → Solution → Proof → CTA
            </div>
          </div>
        </div>
      ),
    },
  ];

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const copyAllContext = () => {
    const context = `TaxDrop Brand Context

CORE PROMISE: "We reduce your property taxes — or you pay nothing."
BUSINESS MODEL: 25% contingency fee, no upfront cost, no fee if savings < $500

COLORS:
- Deep Emerald Dark: #0C593E (primary)
- Deep Emerald Light: #0B8F52 (secondary)
- Mint Background: #DFFFEA
- Yellow-Green Pop: #C4FF64
- Charcoal: #1A1A1A (text)

VOICE: Conversational, confident, helpful, clear, reassuring, transparent
- Talk like a knowledgeable friend
- No corporate jargon or pressure tactics

TERMINOLOGY:
- Texas: Protest, Appraisal District, May 15 deadline
- California: Appeal, Assessor's Office, varies by county

KEY STATS:
- 30-60% of properties are over-assessed
- Only ~5% of owners protest
- 80-90% success rate in Texas
- 10-15% typical savings

POWER PHRASES:
- "Reduce your property taxes"
- "No upfront cost"
- "You only pay if we save you money"
- "Takes less than 2 minutes"

FONTS: Space Grotesk (headlines), Inter (body)`;

    handleCopy(context, 'all');
  };

  return (
    <div className="card">
      <div className="card-header">
        <h4>TaxDrop Brand Context</h4>
        <button
          className="btn btn-ghost btn-sm"
          onClick={copyAllContext}
        >
          {copied === 'all' ? <CheckIcon /> : <CopyIcon />}
          {copied === 'all' ? 'Copied!' : 'Copy All'}
        </button>
      </div>
      <div className="card-body">
        <p className="text-sm text-gray mb-md">
          Quick reference for TaxDrop brand guidelines when creating content. Click sections to expand.
        </p>

        {/* Core Promise Banner */}
        <div style={{
          padding: '16px',
          background: 'var(--td-emerald-dark)',
          color: 'white',
          borderRadius: '8px',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>CORE PROMISE</div>
          <div style={{ fontSize: '18px', fontWeight: '700' }}>
            "We reduce your property taxes — or you pay nothing."
          </div>
          <div style={{ fontSize: '13px', marginTop: '8px', opacity: 0.9 }}>
            25% contingency | No upfront cost | No fee under $500
          </div>
        </div>

        {/* Accordion Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sections.map(section => (
            <div
              key={section.id}
              style={{
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => toggleSection(section.id)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: expandedSection === section.id ? 'var(--td-mint)' : '#F9FAFB',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                {section.title}
                <span style={{
                  transform: expandedSection === section.id ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}>
                  ▼
                </span>
              </button>
              {expandedSection === section.id && (
                <div style={{ padding: '16px', background: 'white' }}>
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
