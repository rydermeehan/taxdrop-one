import { useState } from 'react';
import { CopyIcon, CheckIcon, FileTextIcon } from '../common/Icons';
import {
  hasWebflowToken,
  createGlossaryTerm,
  generateSlug,
  getStateRelevanceId,
} from '../../services/webflowService';

// Common property tax glossary terms
const EXISTING_TERMS = [
  'Ad Valorem Tax', 'Appraisal District', 'Appraisal Review Board', 'Assessed Value',
  'Assessment Ratio', 'Base Year Value', 'Cap Rate', 'Chief Appraiser',
  'Comparable Sales', 'Cost Approach', 'Effective Tax Rate', 'Equalization',
  'Exemption', 'Fair Market Value', 'Homestead Exemption', 'Income Approach',
  'Just Value', 'Levy', 'Lien', 'Market Value', 'Mill Rate', 'Notice of Appraised Value',
  'Over-65 Exemption', 'Property Tax', 'Proposition 13', 'Protest', 'Reassessment',
  'Sales Comparison Approach', 'Special Assessment', 'Tax Rate', 'Tax Roll',
  'Taxable Value', 'Uniformity', 'Valuation', 'Veterans Exemption'
];

// Category options for glossary terms
const TERM_CATEGORIES = [
  { id: 'general', label: 'General Property Tax' },
  { id: 'valuation', label: 'Valuation & Assessment' },
  { id: 'exemptions', label: 'Exemptions & Deductions' },
  { id: 'appeals', label: 'Appeals & Protests' },
  { id: 'texas', label: 'Texas-Specific' },
  { id: 'california', label: 'California-Specific' },
  { id: 'calculations', label: 'Tax Calculations' },
  { id: 'legal', label: 'Legal & Administrative' },
];

interface GlossaryTerm {
  term: string;
  definition: string;
  shortDefinition: string;
  relatedTerms: string[];
  category: string;
  state?: 'texas' | 'california' | 'both';
  seoTitle: string;
  seoDescription: string;
}

export function GlossaryGenerator() {
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState(TERM_CATEGORIES[0]);
  const [state, setState] = useState<'texas' | 'california' | 'both'>('both');
  const [generatedTerm, setGeneratedTerm] = useState<GlossaryTerm | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [savedTerms, setSavedTerms] = useState<GlossaryTerm[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; message: string } | null>(null);

  const webflowConfigured = hasWebflowToken();

  const handleGenerate = async () => {
    if (!term.trim()) return;

    setGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate a glossary entry (would integrate with AI)
    const stateContext = state === 'texas' ? 'In Texas, ' :
                         state === 'california' ? 'In California, ' : '';

    const generated: GlossaryTerm = {
      term: term.trim(),
      definition: `${stateContext}${term} refers to [comprehensive definition that explains the concept in detail, including how it affects property owners and their tax obligations. This definition should be 2-3 sentences and provide clear, actionable information].

For homeowners, understanding ${term.toLowerCase()} is important because [explanation of practical impact]. This concept directly relates to how your property taxes are calculated and what options you have for [relevant action like appealing or claiming exemptions].`,
      shortDefinition: `[One-sentence definition of ${term} for quick reference]`,
      relatedTerms: EXISTING_TERMS.filter(() => Math.random() > 0.85).slice(0, 4),
      category: category.id,
      state: state,
      seoTitle: `What is ${term}? Property Tax Definition | TaxDrop Glossary`,
      seoDescription: `Learn what ${term} means for your property taxes. Clear explanation of ${term.toLowerCase()} and how it affects homeowners in ${state === 'both' ? 'Texas and California' : state === 'texas' ? 'Texas' : 'California'}.`,
    };

    setGeneratedTerm(generated);
    setGenerating(false);
  };

  const handleSave = () => {
    if (generatedTerm) {
      setSavedTerms(prev => [...prev, generatedTerm]);
      setTerm('');
      setGeneratedTerm(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const exportAllTerms = () => {
    const markdown = savedTerms.map(t => `
## ${t.term}

**Category:** ${TERM_CATEGORIES.find(c => c.id === t.category)?.label}
**Applicable to:** ${t.state === 'both' ? 'All States' : t.state === 'texas' ? 'Texas' : 'California'}

### Definition
${t.definition}

### Quick Definition
${t.shortDefinition}

### Related Terms
${t.relatedTerms.map(rt => `- ${rt}`).join('\n')}

### SEO
- **Title:** ${t.seoTitle}
- **Description:** ${t.seoDescription}

---
`).join('\n');

    navigator.clipboard.writeText(markdown);
    setCopied('export');
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePushToWebflow = async () => {
    if (savedTerms.length === 0) {
      setPublishResult({ success: false, message: 'No terms to publish' });
      return;
    }

    if (!webflowConfigured) {
      setPublishResult({ success: false, message: 'Please configure your Webflow token in Settings' });
      return;
    }

    setPublishing(true);
    setPublishResult(null);

    let successCount = 0;
    let failCount = 0;

    const errors: string[] = [];

    for (const term of savedTerms) {
      try {
        // Map state to Webflow state-relevance option ID
        const stateKey = term.state === 'texas' ? 'tx' : term.state === 'california' ? 'ca' : 'all';

        await createGlossaryTerm({
          name: term.term,
          slug: generateSlug(term.term),
          term: term.term,
          'short-definition': term.shortDefinition,
          'full-definition': term.definition,
          'state-relevance': getStateRelevanceId(stateKey),
        }, false); // Create as draft

        successCount++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Failed to create term "${term.term}":`, err);
        errors.push(`"${term.term}": ${errorMsg}`);
        failCount++;
      }
    }

    setPublishing(false);

    if (failCount === 0) {
      setPublishResult({
        success: true,
        message: `Successfully created ${successCount} glossary term${successCount > 1 ? 's' : ''} as drafts in Webflow`,
      });
      // Clear saved terms after successful publish
      setSavedTerms([]);
    } else {
      setPublishResult({
        success: false,
        message: `Created ${successCount} terms, ${failCount} failed: ${errors.join('; ')}`,
      });
    }
  };

  return (
    <div>
      {/* Generator Card */}
      <div className="card">
        <div className="card-header">
          <h4 className="flex items-center gap-sm">
            <FileTextIcon />
            Generate Glossary Term
          </h4>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Term to Define</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                value={term}
                onChange={e => setTerm(e.target.value)}
                placeholder="e.g., Appraisal District, Homestead Exemption"
                list="term-suggestions"
              />
              <datalist id="term-suggestions">
                {EXISTING_TERMS.filter(t =>
                  !savedTerms.some(s => s.term.toLowerCase() === t.toLowerCase())
                ).map(t => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <p className="text-xs text-gray" style={{ marginTop: 4 }}>
              Type to see suggestions from common property tax terms
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={category.id}
                onChange={e => setCategory(TERM_CATEGORIES.find(c => c.id === e.target.value) || TERM_CATEGORIES[0])}
              >
                {TERM_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Applicable State(s)</label>
              <select
                className="form-select"
                value={state}
                onChange={e => setState(e.target.value as 'texas' | 'california' | 'both')}
              >
                <option value="both">Both States</option>
                <option value="texas">Texas Only</option>
                <option value="california">California Only</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating || !term.trim()}
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            {generating ? 'Generating...' : 'Generate Definition'}
          </button>
        </div>
      </div>

      {/* Generated Term Preview */}
      {generatedTerm && (
        <div className="card mt-lg">
          <div className="card-header">
            <h4>Generated: {generatedTerm.term}</h4>
            <div className="flex gap-sm">
              <button className="btn btn-ghost btn-sm" onClick={() => setGeneratedTerm(null)}>
                Discard
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>
                Save Term
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Full Definition</label>
              <textarea
                className="form-textarea"
                value={generatedTerm.definition}
                onChange={e => setGeneratedTerm({ ...generatedTerm, definition: e.target.value })}
                rows={5}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Short Definition (for tooltips/cards)</label>
              <input
                type="text"
                className="form-input"
                value={generatedTerm.shortDefinition}
                onChange={e => setGeneratedTerm({ ...generatedTerm, shortDefinition: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Related Terms</label>
              <input
                type="text"
                className="form-input"
                value={generatedTerm.relatedTerms.join(', ')}
                onChange={e => setGeneratedTerm({
                  ...generatedTerm,
                  relatedTerms: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                })}
              />
              <p className="text-xs text-gray" style={{ marginTop: 4 }}>
                Comma-separated list of related glossary terms
              </p>
            </div>

            <div style={{
              marginTop: 'var(--spacing-lg)',
              padding: 'var(--spacing-md)',
              background: '#F9FAFB',
              borderRadius: '8px',
            }}>
              <div className="flex justify-between items-center mb-sm">
                <strong>SEO Meta</strong>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleCopy(
                    `Title: ${generatedTerm.seoTitle}\nDescription: ${generatedTerm.seoDescription}`,
                    'seo'
                  )}
                >
                  {copied === 'seo' ? <CheckIcon /> : <CopyIcon />}
                  Copy
                </button>
              </div>
              <div className="text-sm mb-sm">
                <strong>Title:</strong> {generatedTerm.seoTitle}
              </div>
              <div className="text-sm">
                <strong>Description:</strong> {generatedTerm.seoDescription}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Terms */}
      {savedTerms.length > 0 && (
        <div className="card mt-lg">
          <div className="card-header">
            <div className="flex items-center gap-md">
              <h4>Saved Terms</h4>
              <span className="badge">{savedTerms.length} terms</span>
              {!webflowConfigured && (
                <span style={{ fontSize: '12px', color: '#B45309' }}>
                  ⚠️ Configure Webflow in Settings
                </span>
              )}
            </div>
            <div className="flex gap-sm">
              <button
                className="btn btn-ghost btn-sm"
                onClick={exportAllTerms}
              >
                {copied === 'export' ? <CheckIcon /> : <CopyIcon />}
                {copied === 'export' ? 'Copied!' : 'Export All'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handlePushToWebflow}
                disabled={!webflowConfigured || savedTerms.length === 0 || publishing}
              >
                {publishing ? 'Publishing...' : 'Push to Webflow'}
              </button>
            </div>
          </div>
          <div className="card-body">
            {publishResult && (
              <div style={{
                marginBottom: 'var(--spacing-md)',
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
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: 'var(--spacing-md)',
            }}>
              {savedTerms.map((t, i) => (
                <div
                  key={i}
                  style={{
                    padding: 'var(--spacing-md)',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    background: 'white',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 8,
                  }}>
                    <strong>{t.term}</strong>
                    <button
                      onClick={() => setSavedTerms(prev => prev.filter((_, idx) => idx !== i))}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#666',
                        padding: '2px 6px',
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="text-sm text-gray" style={{ marginBottom: 8 }}>
                    {TERM_CATEGORIES.find(c => c.id === t.category)?.label}
                  </div>
                  <div className="text-sm" style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {t.shortDefinition}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="card mt-lg">
        <div className="card-body">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--spacing-lg)',
            textAlign: 'center',
          }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--td-emerald-dark)' }}>
                102
              </div>
              <div className="text-sm text-gray">Existing Terms</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--td-emerald-dark)' }}>
                {savedTerms.length}
              </div>
              <div className="text-sm text-gray">New Terms</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--td-emerald-dark)' }}>
                8
              </div>
              <div className="text-sm text-gray">Categories</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
