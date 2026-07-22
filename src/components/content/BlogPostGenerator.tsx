import { useState } from 'react';
import type { Brand } from '../../types';
import { CopyIcon, CheckIcon, FileTextIcon } from '../common/Icons';
import {
  hasWebflowToken,
  createBlogPost,
  generateSlug,
  BLOG_CATEGORIES as WF_CATEGORIES,
} from '../../services/webflowService';

interface BlogPostGeneratorProps {
  brands?: Brand[];
}

// State terminology mapping
const STATE_TERMINOLOGY = {
  texas: {
    action: 'protest',
    actionVerb: 'protest',
    office: 'Appraisal District',
    notice: 'Notice of Appraised Value',
    deadline: 'May 15',
  },
  california: {
    action: 'appeal',
    actionVerb: 'appeal',
    office: "Assessor's Office",
    notice: 'Assessment Notice',
    deadline: 'varies by county',
  },
};

// Blog post templates
const BLOG_TEMPLATES = [
  {
    id: 'how-to-guide',
    label: 'How-To Guide',
    description: 'Step-by-step instructions for a process',
    structure: ['Introduction', 'Prerequisites', 'Step-by-Step Process', 'Common Mistakes', 'Conclusion'],
  },
  {
    id: 'explainer',
    label: 'Explainer Article',
    description: 'Explain a complex topic simply',
    structure: ['What It Is', 'Why It Matters', 'How It Works', 'Key Takeaways'],
  },
  {
    id: 'listicle',
    label: 'List Article',
    description: 'Numbered tips or items',
    structure: ['Introduction', 'List Items (5-10)', 'Summary'],
  },
  {
    id: 'comparison',
    label: 'Comparison Post',
    description: 'Compare two options or approaches',
    structure: ['Introduction', 'Option A Overview', 'Option B Overview', 'Key Differences', 'Which Is Right For You'],
  },
  {
    id: 'case-study',
    label: 'Case Study',
    description: 'Real example with results',
    structure: ['The Challenge', 'The Approach', 'The Results', 'Key Lessons'],
  },
  {
    id: 'faq',
    label: 'FAQ Article',
    description: 'Answer common questions',
    structure: ['Introduction', 'Questions & Answers', 'Additional Resources'],
  },
  // TypeShare-style templates
  {
    id: 'future-prediction',
    label: 'Future of [Industry]',
    description: 'Bold prediction with 3 data points',
    structure: ['The Turning Point (Thesis)', 'Data Point #1 + 3 Reasons', 'Data Point #2 + Expansion', 'Data Point #3 + Common Mistakes', 'Call to Action'],
  },
  {
    id: 'what-nobody-tells',
    label: 'What Nobody Tells You',
    description: 'Insider secrets revealed',
    structure: ['Introduction (The Hidden Truth)', 'Secret #1', 'Secret #2', 'Secret #3', 'Secret #4', 'Secret #5', 'What To Do Now'],
  },
  {
    id: 'x-mistakes',
    label: '[X] Mistakes That Cost',
    description: 'Common errors and how to avoid them',
    structure: ['Introduction (The Problem)', 'Mistake #1 + Why It Matters', 'Mistake #2 + Why It Matters', 'Mistake #3 + Why It Matters', 'Mistake #4 + Why It Matters', 'Mistake #5 + Why It Matters', 'The Right Way Forward'],
  },
  {
    id: 'ultimate-guide',
    label: 'The Ultimate Guide',
    description: 'Comprehensive deep-dive resource',
    structure: ['What This Guide Covers', 'Chapter 1: Understanding the Basics', 'Chapter 2: The Process Step-by-Step', 'Chapter 3: Advanced Strategies', 'Chapter 4: Common Pitfalls', 'Chapter 5: Real-World Examples', 'Conclusion + Next Steps'],
  },
  {
    id: 'x-framework',
    label: 'The [X] Framework',
    description: 'Systematic approach to solving a problem',
    structure: ['The Problem Most People Face', 'Introducing the Framework', 'Step 1 (With Details)', 'Step 2 (With Details)', 'Step 3 (With Details)', 'Putting It All Together', 'Results You Can Expect'],
  },
  {
    id: 'contrarian-take',
    label: 'Contrarian Take',
    description: 'Challenge conventional wisdom',
    structure: ['The Popular Belief', 'Why Most People Are Wrong', 'The Evidence Against', 'The Real Truth', 'What This Means For You', 'Action Steps'],
  },
  {
    id: 'before-after',
    label: '[X] Years Ago vs Now',
    description: 'Evolution and transformation story',
    structure: ['How Things Used to Be', 'What Changed', 'The New Reality', 'Key Lessons Learned', 'What This Means For You'],
  },
  {
    id: 'behind-scenes',
    label: 'Behind the Scenes',
    description: 'Reveal the inner workings',
    structure: ['What You See vs What\'s Really Happening', 'How It Actually Works', 'The Players Involved', 'Where Errors Happen', 'How to Use This Knowledge', 'Your Next Move'],
  },
];

// Content categories
const CATEGORIES = [
  { id: 'property-tax-basics', label: 'Property Tax Basics' },
  { id: 'appeals-protests', label: 'Appeals & Protests' },
  { id: 'assessment-process', label: 'Assessment Process' },
  { id: 'saving-money', label: 'Saving Money' },
  { id: 'deadlines-timing', label: 'Deadlines & Timing' },
  { id: 'county-specific', label: 'County-Specific' },
  { id: 'homeowner-tips', label: 'Homeowner Tips' },
  { id: 'landlord-guide', label: 'Landlord Guide' },
];

export function BlogPostGenerator({ brands = [] }: BlogPostGeneratorProps) {
  void brands; // Reserved for brand-specific content

  const [title, setTitle] = useState('');
  const [state, setState] = useState<'texas' | 'california'>('texas');
  const [template, setTemplate] = useState(BLOG_TEMPLATES[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [targetKeywords, setTargetKeywords] = useState('');
  const [outline, setOutline] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'setup' | 'outline' | 'draft' | 'seo'>('setup');
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; message: string; itemId?: string } | null>(null);

  const terminology = STATE_TERMINOLOGY[state];
  const webflowConfigured = hasWebflowToken();

  // Map internal category to Webflow category ID
  const getWebflowCategoryId = (): string => {
    // Map our categories to Webflow's
    const categoryMap: Record<string, string> = {
      'property-tax-basics': WF_CATEGORIES.ARTICLES,
      'appeals-protests': WF_CATEGORIES.GUIDE,
      'assessment-process': WF_CATEGORIES.ARTICLES,
      'saving-money': WF_CATEGORIES.GUIDE,
      'deadlines-timing': WF_CATEGORIES.MARKET_NEWS,
      'county-specific': WF_CATEGORIES.RESOURCES,
      'homeowner-tips': WF_CATEGORIES.GUIDE,
      'landlord-guide': WF_CATEGORIES.GUIDE,
    };
    return categoryMap[category.id] || WF_CATEGORIES.ARTICLES;
  };

  const handleGenerateOutline = async () => {
    setGenerating(true);
    // Simulate outline generation (would integrate with AI)
    await new Promise(resolve => setTimeout(resolve, 1500));

    const generatedOutline = `# ${title || 'Blog Post Title'}

## Introduction
- Hook: [Compelling opening that addresses the reader's pain point]
- Context: Brief overview of ${terminology.action} process in ${state === 'texas' ? 'Texas' : 'California'}
- Promise: What the reader will learn

${template.structure.slice(1, -1).map((section, i) => `## ${i + 2}. ${section}
- Key point 1
- Key point 2
- Key point 3
- [Include relevant stat or example]
`).join('\n')}

## Conclusion
- Recap key takeaways
- CTA: "Start your ${terminology.action} with TaxDrop"
- Deadline reminder: ${terminology.deadline}

---
**Target Keywords:** ${targetKeywords || 'property tax ' + terminology.action}
**Category:** ${category.label}
**Word Count Target:** 1,200-1,500 words`;

    setOutline(generatedOutline);
    setActiveTab('outline');
    setGenerating(false);
  };

  const handleGenerateDraft = async () => {
    setGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const draft = `# ${title || 'How to ' + terminology.actionVerb.charAt(0).toUpperCase() + terminology.actionVerb.slice(1) + ' Your Property Taxes'}

If you're a ${state === 'texas' ? 'Texas' : 'California'} homeowner, there's a good chance you're paying too much in property taxes. Studies show that **30-60% of properties are over-assessed**, yet only about 5% of homeowners actually ${terminology.actionVerb} their assessment.

The good news? The ${terminology.action} process is more straightforward than most people think—and the potential savings are significant.

## Why Most Properties Are Over-Assessed

Your local ${terminology.office} determines your property's assessed value, which directly impacts how much you pay in taxes. But assessors are working with limited data, often relying on:

- Mass appraisal techniques that miss property-specific issues
- Outdated comparable sales data
- Incorrect property information (square footage, room count, etc.)

This creates opportunities for homeowners who take the time to review their assessment.

## The ${terminology.action.charAt(0).toUpperCase() + terminology.action.slice(1)} Process: Step by Step

### Step 1: Review Your ${terminology.notice}

When you receive your ${terminology.notice}, don't just file it away. Check for:
- **Correct property details** (bedrooms, bathrooms, square footage)
- **Accurate property classification**
- **Reasonable market value estimate**

### Step 2: Gather Evidence

Strong ${terminology.action}s are built on solid evidence:
- Recent comparable sales in your area
- Photos of property condition issues
- Professional appraisals (if available)
- Documentation of any value-affecting factors

### Step 3: File Before the Deadline

In ${state === 'texas' ? 'Texas' : 'California'}, you typically need to file by **${terminology.deadline}**. Missing this deadline means waiting another year.

### Step 4: Present Your Case

Whether it's an informal hearing or formal ${terminology.action}, present your evidence clearly and professionally. Focus on facts, not emotions.

## What You Can Expect

The success rate for property tax ${terminology.action}s is surprisingly high:
- **80-90%** of ${state === 'texas' ? 'Texas informal protests' : 'California appeals'} result in some reduction
- Average savings of **10-15%** annually
- Potential for **multi-year tax savings**

## The TaxDrop Advantage

Not sure where to start? TaxDrop handles the entire ${terminology.action} process for you:
- Free savings estimate in under 2 minutes
- Expert-driven ${terminology.action}s
- **25% contingency fee**—you only pay if we save you money
- No fee if savings are less than $500

---

**Ready to lower your property taxes?**

[Start your free savings estimate →](https://taxdrop.com)

*Don't wait—the ${terminology.deadline} deadline is approaching.*`;

    setDraftContent(draft);
    setMetaDescription(`Learn how to ${terminology.actionVerb} your property taxes in ${state === 'texas' ? 'Texas' : 'California'}. Step-by-step guide to reducing your tax bill through the ${terminology.office}.`);
    setActiveTab('draft');
    setGenerating(false);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePublishToWebflow = async (publishImmediately: boolean) => {
    if (!title || !draftContent) {
      setPublishResult({ success: false, message: 'Please generate a title and draft content first' });
      return;
    }

    if (!webflowConfigured) {
      setPublishResult({ success: false, message: 'Please configure your Webflow token in Settings' });
      return;
    }

    // Validate SEO fields
    const seoTitle = `${title} | TaxDrop`;
    if (seoTitle.length < 40) {
      setPublishResult({ success: false, message: 'SEO title must be at least 40 characters' });
      return;
    }

    if (metaDescription.length < 80) {
      setPublishResult({ success: false, message: 'Meta description must be at least 80 characters' });
      return;
    }

    setPublishing(true);
    setPublishResult(null);

    try {
      const result = await createBlogPost({
        name: title,
        slug: generateSlug(title),
        'seo-page-title': seoTitle,
        'seo-meta-description': metaDescription,
        'post---content': draftContent,
        'post---short-description-card': metaDescription.substring(0, 200),
        'post---category': getWebflowCategoryId(),
        'primary-keyword': targetKeywords.split(',')[0]?.trim() || '',
      }, publishImmediately);

      setPublishResult({
        success: true,
        message: publishImmediately
          ? `Blog post published successfully!`
          : `Blog post created as draft in Webflow`,
        itemId: result.id,
      });
    } catch (err) {
      setPublishResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to publish to Webflow',
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        borderBottom: '1px solid #E5E7EB',
        paddingBottom: '0',
      }}>
        {(['setup', 'outline', 'draft', 'seo'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'transparent',
              color: activeTab === tab ? 'var(--td-emerald-dark)' : 'var(--color-gray-500)',
              fontWeight: activeTab === tab ? '600' : '400',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid var(--td-emerald-dark)' : '2px solid transparent',
              marginBottom: '-1px',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'seo' ? 'SEO & Meta' : tab}
          </button>
        ))}
      </div>

      {/* Setup Tab */}
      {activeTab === 'setup' && (
        <div className="card">
          <div className="card-header">
            <h4 className="flex items-center gap-sm">
              <FileTextIcon />
              Blog Post Setup
            </h4>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Post Title</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., How to Protest Your Property Taxes in Texas"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
              <div className="form-group">
                <label className="form-label">Target State</label>
                <select
                  className="form-select"
                  value={state}
                  onChange={e => setState(e.target.value as 'texas' | 'california')}
                >
                  <option value="texas">Texas (Protest)</option>
                  <option value="california">California (Appeal)</option>
                </select>
                <p className="text-xs text-gray" style={{ marginTop: 4 }}>
                  Uses "{terminology.action}" terminology, {terminology.office}
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={category.id}
                  onChange={e => setCategory(CATEGORIES.find(c => c.id === e.target.value) || CATEGORIES[0])}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Content Template</label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--spacing-sm)',
              }}>
                {BLOG_TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => setTemplate(tmpl)}
                    style={{
                      padding: '12px',
                      border: template.id === tmpl.id ? '2px solid var(--td-emerald-dark)' : '1px solid #E5E7EB',
                      borderRadius: '8px',
                      background: template.id === tmpl.id ? 'var(--td-mint)' : 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: 4 }}>{tmpl.label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>{tmpl.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Target Keywords</label>
              <input
                type="text"
                className="form-input"
                value={targetKeywords}
                onChange={e => setTargetKeywords(e.target.value)}
                placeholder="e.g., property tax protest texas, reduce property taxes"
              />
              <p className="text-xs text-gray" style={{ marginTop: 4 }}>
                Comma-separated primary and secondary keywords
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleGenerateOutline}
              disabled={generating}
              style={{ marginTop: 'var(--spacing-md)' }}
            >
              {generating ? 'Generating...' : 'Generate Outline'}
            </button>
          </div>
        </div>
      )}

      {/* Outline Tab */}
      {activeTab === 'outline' && (
        <div className="card">
          <div className="card-header">
            <h4>Content Outline</h4>
            <div className="flex gap-sm">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleCopy(outline, 'outline')}
              >
                {copied === 'outline' ? <CheckIcon /> : <CopyIcon />}
                {copied === 'outline' ? 'Copied' : 'Copy'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleGenerateDraft}
                disabled={generating || !outline}
              >
                {generating ? 'Generating...' : 'Generate Draft'}
              </button>
            </div>
          </div>
          <div className="card-body">
            {outline ? (
              <textarea
                className="form-textarea"
                value={outline}
                onChange={e => setOutline(e.target.value)}
                rows={20}
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-gray-500)' }}>
                Generate an outline first from the Setup tab
              </div>
            )}
          </div>
        </div>
      )}

      {/* Draft Tab */}
      {activeTab === 'draft' && (
        <div className="card">
          <div className="card-header">
            <h4>Draft Content</h4>
            <div className="flex gap-sm">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleCopy(draftContent, 'draft')}
              >
                {copied === 'draft' ? <CheckIcon /> : <CopyIcon />}
                {copied === 'draft' ? 'Copied' : 'Copy Markdown'}
              </button>
            </div>
          </div>
          <div className="card-body">
            {draftContent ? (
              <textarea
                className="form-textarea"
                value={draftContent}
                onChange={e => setDraftContent(e.target.value)}
                rows={30}
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-gray-500)' }}>
                Generate an outline first, then create a draft
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEO Tab */}
      {activeTab === 'seo' && (
        <div className="card">
          <div className="card-header">
            <h4>SEO & Meta</h4>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Meta Title</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="SEO-optimized title (50-60 characters)"
              />
              <p className="text-xs text-gray" style={{ marginTop: 4 }}>
                {title.length}/60 characters
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Meta Description</label>
              <textarea
                className="form-textarea"
                value={metaDescription}
                onChange={e => setMetaDescription(e.target.value)}
                rows={3}
                placeholder="Compelling description for search results (150-160 characters)"
              />
              <p className="text-xs text-gray" style={{ marginTop: 4 }}>
                {metaDescription.length}/160 characters
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">URL Slug</label>
              <input
                type="text"
                className="form-input"
                value={title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
                readOnly
                style={{ background: '#F9FAFB' }}
              />
            </div>

            {/* Preview */}
            <div style={{
              marginTop: 'var(--spacing-lg)',
              padding: 'var(--spacing-md)',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              background: 'white',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--color-gray-500)', marginBottom: 4 }}>
                Search Result Preview
              </div>
              <div style={{ color: '#1a0dab', fontSize: '18px', marginBottom: 4 }}>
                {title || 'Your Blog Post Title'} | TaxDrop
              </div>
              <div style={{ color: '#006621', fontSize: '13px', marginBottom: 4 }}>
                https://taxdrop.com/blog/{title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'your-post-slug'}
              </div>
              <div style={{ color: '#545454', fontSize: '13px' }}>
                {metaDescription || 'Your meta description will appear here...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card mt-lg">
        <div className="card-header">
          <h4>Publishing Options</h4>
        </div>
        <div className="card-body">
          {!webflowConfigured && (
            <div style={{
              padding: 'var(--spacing-md)',
              background: '#FEF3C7',
              borderRadius: '8px',
              marginBottom: 'var(--spacing-md)',
              fontSize: '14px',
            }}>
              ⚠️ Connect your Webflow API token in Settings to enable publishing
            </div>
          )}

          <p className="text-gray mb-md">
            Once your content is ready, you can publish directly to Webflow CMS.
          </p>

          <div className="flex gap-md">
            <button
              className="btn btn-ghost"
              onClick={() => handleCopy(draftContent, 'export')}
              disabled={!draftContent}
            >
              {copied === 'export' ? <CheckIcon /> : <CopyIcon />}
              {copied === 'export' ? 'Copied!' : 'Copy Content'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handlePublishToWebflow(false)}
              disabled={!webflowConfigured || !draftContent || publishing}
            >
              {publishing ? 'Creating...' : 'Create Draft in Webflow'}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handlePublishToWebflow(true)}
              disabled={!webflowConfigured || !draftContent || publishing}
            >
              {publishing ? 'Publishing...' : 'Publish to Webflow'}
            </button>
          </div>

          {publishResult && (
            <div style={{
              marginTop: 'var(--spacing-md)',
              padding: 'var(--spacing-md)',
              background: publishResult.success ? 'var(--td-mint)' : '#FEE2E2',
              borderRadius: '8px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              {publishResult.success ? <CheckIcon style={{ color: 'var(--td-emerald-dark)' }} /> : '❌'}
              <span>{publishResult.message}</span>
              {publishResult.itemId && (
                <a
                  href={`https://webflow.com/design/taxdrop?pageId=${publishResult.itemId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginLeft: 'auto', color: 'var(--td-emerald-dark)' }}
                >
                  View in Webflow →
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
