import { useState } from 'react';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      border: '1px solid #E5E7EB',
      borderRadius: '12px',
      background: 'white',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          border: 'none',
          background: 'white',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: '600',
          color: 'var(--td-charcoal)',
          textAlign: 'left',
        }}
      >
        {title}
        <svg
          width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-gray-500)" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px', fontSize: '14px', lineHeight: '1.7', color: '#374151' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Badge({ children, color = '#0C593E' }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '100px',
      background: color + '15',
      color,
      fontSize: '12px',
      fontWeight: '600',
    }}>
      {children}
    </span>
  );
}

export function UserGuide() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Hero */}
      <div style={{
        padding: '32px',
        background: 'linear-gradient(135deg, var(--td-emerald-dark), var(--td-emerald-light))',
        borderRadius: '16px',
        color: 'white',
      }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontFamily: '"Space Grotesk", sans-serif' }}>
          Content Studio Guide
        </h2>
        <p style={{ margin: 0, fontSize: '15px', opacity: 0.9 }}>
          Everything you need to know about generating, reviewing, and publishing content with this tool.
        </p>
      </div>

      {/* Quick Start */}
      <Section title="What Is This Tool?" defaultOpen>
        <p>
          Content Studio is TaxDrop's internal content production platform. It generates, reviews,
          and publishes CMS content directly to TaxDrop.com (Webflow), creates social media posts with images,
          manages SEO analysis, and handles email promotion — all from one dashboard.
        </p>
        <div style={{
          marginTop: '12px',
          padding: '14px 16px',
          background: 'var(--td-mint)',
          borderRadius: '8px',
          fontSize: '13px',
        }}>
          <strong>Only OpenRouter is required</strong> to start generating content. Everything else
          (Webflow, GSC, NeuronWriter, OnlySocial, SendFox, Meta) adds features but degrades gracefully
          if not configured.
        </div>
      </Section>

      {/* First-Time Setup */}
      <Section title="First-Time Setup">
        <p>Go to <strong>Settings</strong> (bottom of the left sidebar) and configure these integrations:</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E5E7EB', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>Integration</th>
              <th style={{ padding: '8px 12px' }}>Required For</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['OpenRouter', 'All AI generation'],
              ['Webflow', 'Publishing to CMS'],
              ['Google Search Console', 'SEO keyword data'],
              ['NeuronWriter', 'SEO content scoring'],
              ['OnlySocial', 'Scheduling social posts'],
              ['SendFox', 'Email marketing'],
              ['Meta', 'Social inbox (FB/IG)'],
            ].map(([name, use]) => (
              <tr key={name} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '8px 12px', fontWeight: '600' }}>{name}</td>
                <td style={{ padding: '8px 12px' }}>{use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Content Types */}
      <Section title="Content Types">
        <p style={{ marginBottom: '16px' }}>
          The left sidebar lists six content types. Each follows the same <strong>Setup &rarr; Refine &rarr; Review &rarr; Publish</strong> workflow.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { name: 'Blog Posts', desc: 'Full SEO blog articles (1,200-2,000 words). 15 fields including post content, SEO title, meta description, FAQs, key fact bullets, and a photo prompt.', badge: '15 fields' },
            { name: 'Glossary Terms', desc: 'Property tax terminology definitions. 17 fields including short definition, full definition, example, why-it-matters section, and 3 FAQ pairs.', badge: '17 fields' },
            { name: 'Partner Pages', desc: 'Landing pages for referral partners (real estate agents, mortgage brokers, etc.). 44 fields across 3 AI calls.', badge: '44 fields' },
            { name: 'Property Type Pages', desc: 'Pages for specific property types (single family homes, office buildings, ranch land). 25 fields covering assessment issues, appeal strategies, and valuation methods.', badge: '25 fields' },
            { name: 'Help Center Articles', desc: 'Support/FAQ articles for the TaxDrop help center. 7 fields with a focused, practical tone.', badge: '7 fields' },
            { name: 'County Pages', desc: 'County-specific landing pages with local property tax details. 20 fields. Automatically uses correct terminology — "protest" for Texas, "appeal" for California.', badge: '20 fields' },
          ].map(ct => (
            <div key={ct.name} style={{
              padding: '12px 16px',
              background: '#F9FAFB',
              borderRadius: '8px',
              borderLeft: '3px solid var(--td-emerald-dark)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <strong>{ct.name}</strong>
                <Badge>{ct.badge}</Badge>
              </div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>{ct.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* The 4-Tab Workflow */}
      <Section title="The 4-Tab Workflow">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tab 1 */}
          <div>
            <h4 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge color="#0C593E">Tab 1</Badge> Setup
            </h4>
            <ol style={{ margin: 0, paddingLeft: '20px' }}>
              <li><strong>Enter your concept</strong> — Describe what you want to create. More detail = better output.</li>
              <li><strong>Answer setup questions</strong> — Each content type has required questions (state, category, keywords, etc.).</li>
              <li><strong>GSC Keywords</strong> <em>(Blog posts only)</em> — If Google Search Console is connected, keyword opportunities appear as clickable chips. Click to add them to the generation prompt.</li>
              <li><strong>Choose your AI model</strong> — Default is Claude Sonnet 4.5. Use Opus for higher quality, Haiku for quick drafts.</li>
              <li><strong>Click Generate</strong> — This opens the clarification chat.</li>
            </ol>
          </div>

          {/* Tab 2 */}
          <div>
            <h4 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge color="#0C593E">Tab 2</Badge> Refine
            </h4>
            <p style={{ margin: '0 0 8px' }}>
              The AI generates 3-5 clarifying questions about your concept. Answer them or click <strong>Skip</strong> to generate immediately.
            </p>
            <div style={{
              padding: '12px 16px',
              background: '#FEF3C7',
              borderRadius: '8px',
              fontSize: '13px',
            }}>
              <strong>Blog posts get an extra step:</strong> After clarification, you'll see <strong>3 title options</strong> with
              different angles (data-driven, benefit-focused, curiosity hook). Pick the title that fits your strategy.
            </div>
          </div>

          {/* Tab 3 */}
          <div>
            <h4 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge color="#0C593E">Tab 3</Badge> Review
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li><strong>Review progress bar</strong> — Shows how many fields you've marked as reviewed. All fields must be reviewed before publishing.</li>
              <li>Read each field, edit if needed, then click <strong>Mark Reviewed</strong>.</li>
              <li>Editing a reviewed field resets it to unreviewed.</li>
              <li><strong>Hero image</strong> generates automatically from the photo-prompt field.</li>
              <li><strong>SEO Score</strong> <em>(Blog posts)</em> — If NeuronWriter is configured, check your content score (0-100) and optimize.</li>
              <li><strong>Validation</strong> — Red badges flag issues. Fix them before publishing.</li>
            </ul>
          </div>

          {/* Tab 4 */}
          <div>
            <h4 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge color="#0C593E">Tab 4</Badge> Publish
            </h4>
            <p style={{ margin: '0 0 8px' }}>Pre-publish checklist ensures everything is ready:</p>
            <ul style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
              <li>Content generated</li>
              <li>All required fields valid</li>
              <li>All fields reviewed by human</li>
              <li>Webflow API connected</li>
              <li>Hero image uploaded (optional)</li>
            </ul>
            <p style={{ margin: '0 0 8px' }}><strong>Publishing options:</strong></p>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li><strong>Save as Draft</strong> — Creates the item in Webflow CMS but doesn't make it live.</li>
              <li><strong>Publish Live</strong> — Creates and publishes immediately to TaxDrop.com.</li>
              <li><strong>Copy JSON</strong> — Copies all field data to clipboard for manual use.</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Blog Post Promotion */}
      <Section title="Blog Post Promotion Pipeline">
        <p>After successfully publishing a blog post, a promotion pipeline appears automatically:</p>

        <h4 style={{ margin: '16px 0 8px' }}>Social Media Promotion</h4>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Auto-generates posts for LinkedIn, Instagram, Facebook, and Twitter/X.</li>
          <li>Each post is editable and has a Copy button.</li>
          <li>Click <strong>Generate Platform Images</strong> for optimized images (1:1 for Instagram, 16:9 for others).</li>
          <li>If OnlySocial is connected, you can schedule directly from the tool.</li>
        </ul>

        <h4 style={{ margin: '16px 0 8px' }}>Email Newsletter</h4>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Auto-generates a subject line, preheader, and HTML email body.</li>
          <li>Shows a rendered preview of the email.</li>
          <li>Copy buttons for subject, preheader, and full HTML body.</li>
          <li>Paste into SendFox or your email tool.</li>
        </ul>
      </Section>

      {/* Other Tools */}
      <Section title="Other Tools">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h4 style={{ margin: '0 0 6px' }}>Image Studio</h4>
            <p style={{ margin: 0 }}>
              Generate AI images for blog posts, social media, and other uses. Supports Hero (16:9),
              Thumbnail, Square (1:1), Story (9:16), and OG Image (1.91:1). Add TaxDrop logo overlays.
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px' }}>Social Media Generator</h4>
            <p style={{ margin: 0 }}>
              Standalone tool for creating social media content. 17+ scene templates, style presets,
              and a "Promote a Link" mode that auto-fetches page content to generate platform-specific posts.
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px' }}>Character Generator</h4>
            <p style={{ margin: 0 }}>
              Create consistent AI-generated characters. Upload a reference photo, then generate new images
              in different scenes (13 presets), outfits (10 presets), and poses (12 presets).
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px' }}>Prompt Library</h4>
            <p style={{ margin: 0 }}>
              Reusable prompt templates with variable substitution. Includes SEO Blog Post Generator,
              Social Media Post Batch, and Email Sequence Builder.
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px' }}>Search Console Dashboard</h4>
            <p style={{ margin: 0 }}>
              View Google Search Console data directly. Overview metrics, top queries table,
              AI-analyzed content ideas, and URL inspection.
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px' }}>NeuronWriter Dashboard</h4>
            <p style={{ margin: 0 }}>
              SEO content analysis. Browse NeuronWriter projects, analyze content against keyword queries,
              view recommended terms and competitor data.
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px' }}>Engagement / Social Inbox</h4>
            <p style={{ margin: 0 }}>
              Triage social media comments and DMs. Categorize as Lead, Question, Positive, Negative, Spam,
              or Conversational. Track status: Pending Review &rarr; Replied / Ignored / Escalated.
            </p>
          </div>
        </div>
      </Section>

      {/* Tips */}
      <Section title="Tips for Best Results">
        <h4 style={{ margin: '0 0 8px' }}>Writing Better Concepts</h4>
        <ul style={{ margin: '0 0 16px', paddingLeft: '20px' }}>
          <li>Be specific: "Property tax protest tips for Harris County, Texas homeowners in 2026" beats "property tax tips".</li>
          <li>Include the target audience: homeowners vs. landlords, new buyers vs. long-time owners.</li>
          <li>Mention any specific stats, data points, or angles you want included.</li>
          <li>For blog posts, specify whether it's a how-to guide, news article, or opinion piece.</li>
        </ul>

        <h4 style={{ margin: '0 0 8px' }}>State Terminology</h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          marginBottom: '16px',
        }}>
          <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '8px', fontSize: '13px' }}>
            <strong>Texas:</strong> protest, Appraisal District, Notice of Appraised Value, May 15 deadline
          </div>
          <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '8px', fontSize: '13px' }}>
            <strong>California:</strong> appeal, Assessor's Office, Assessment Notice, varies by county
          </div>
        </div>

        <h4 style={{ margin: '0 0 8px' }}>SEO Workflow (Blog Posts)</h4>
        <ol style={{ margin: '0 0 16px', paddingLeft: '20px' }}>
          <li>Check GSC keyword suggestions on the Setup tab — select relevant keywords.</li>
          <li>Choose a title from the 3 options that best targets your primary keyword.</li>
          <li>After generation, check the NeuronWriter SEO score in the Review tab.</li>
          <li>Edit content to include missing recommended terms.</li>
          <li>Recheck the score until you're satisfied.</li>
        </ol>

        <h4 style={{ margin: '0 0 8px' }}>Reviewing Content</h4>
        <ul style={{ margin: '0 0 16px', paddingLeft: '20px' }}>
          <li>Read every field — AI-generated content can have factual errors.</li>
          <li>Check all statistics and numbers for plausibility.</li>
          <li>Verify links and URLs are real.</li>
          <li>Ensure CTAs match the current TaxDrop offering.</li>
          <li>Check that state terminology is consistent throughout.</li>
        </ul>

        <h4 style={{ margin: '0 0 8px' }}>Publishing Workflow</h4>
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Always <strong>Save as Draft</strong> first for important content.</li>
          <li>Preview in Webflow before publishing live.</li>
          <li>Use the post-publish checklist to verify everything.</li>
          <li>For blog posts, use the promotion pipeline to create social and email content immediately.</li>
        </ol>
      </Section>

      {/* Footer */}
      <div style={{
        padding: '16px 20px',
        background: '#F9FAFB',
        borderRadius: '12px',
        fontSize: '13px',
        color: 'var(--color-gray-500)',
        textAlign: 'center',
      }}>
        TaxDrop Content Studio &mdash; Internal Tool &mdash; Questions? Contact Ryder Meehan
      </div>
    </div>
  );
}
