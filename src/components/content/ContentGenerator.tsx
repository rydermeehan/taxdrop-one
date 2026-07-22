// ContentGenerator — Shared 4-tab workflow for all CMS content types
// Setup → Refine → Review → Publish

import { useState, useCallback } from 'react';
import type { CollectionSchema, ContentInput, ValidationError, TitleOption } from '../../services/collections/types';
import { validateContent } from '../../services/collections/types';
import { generateClarifyingQuestions, generateContent, generateAndUploadImage, generateTitleOptions } from '../../services/contentService';
import { ClarificationChat } from './ClarificationChat';
import { ContentPreview } from './ContentPreview';
import { PublishPanel } from './PublishPanel';
import { TitlePicker } from './TitlePicker';
import { GSCKeywordSuggestions } from './GSCKeywordSuggestions';
import { SEOScorePanel } from './SEOScorePanel';
import { TEXT_MODELS, type TextModel } from '../../services/openrouterService';

type Tab = 'setup' | 'refine' | 'review' | 'publish';

interface ContentGeneratorProps {
  schema: CollectionSchema;
  initialConcept?: string;
}

export function ContentGenerator({ schema, initialConcept }: ContentGeneratorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('setup');
  const [concept, setConcept] = useState(initialConcept || '');
  const [model, setModel] = useState<TextModel>('anthropic/claude-sonnet-4-5');

  // Clarification state
  const [showClarification, setShowClarification] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedFields, setGeneratedFields] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<ValidationError[]>([]);

  // Human-in-the-loop review state
  const [reviewedFields, setReviewedFields] = useState<Set<string>>(new Set());

  // Title picker state (blog posts only)
  const [titleOptions, setTitleOptions] = useState<TitleOption[]>([]);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [showTitlePicker, setShowTitlePicker] = useState(false);
  const [pendingInput, setPendingInput] = useState<ContentInput | null>(null);

  // GSC keyword state (blog posts only)
  const [gscSelectedKeywords, setGscSelectedKeywords] = useState<Set<string>>(new Set());

  // NeuronWriter SEO state — set when NW analysis runs before generation
  const [nwQueryId, setNwQueryId] = useState<string | null>(null);
  // Expose setter for future NW integration; suppress unused warning
  void setNwQueryId;

  // Image generation state
  const [imageGenerating, setImageGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Content input (built from setup + clarification)
  const [contentInput, setContentInput] = useState<ContentInput>({
    concept: '',
    staticAnswers: {},
    clarificationAnswers: {},
    userSelections: {},
  });

  // Handle "Generate" button — starts clarification flow
  const handleStartGeneration = useCallback(async () => {
    if (!concept.trim()) return;

    const newInput: ContentInput = {
      concept,
      staticAnswers: {},
      clarificationAnswers: {},
      userSelections: {},
    };
    setContentInput(newInput);

    // If concept is detailed (>200 chars), skip to clarification with just static questions
    if (concept.length > 200 && schema.staticQuestions.length === 0) {
      // Skip clarification entirely — go straight to generation
      await runGeneration(newInput);
      return;
    }

    // Show clarification panel and fetch AI questions
    setShowClarification(true);
    setLoadingQuestions(true);
    setAiQuestions([]);

    try {
      const questions = await generateClarifyingQuestions(schema, concept, model);
      setAiQuestions(questions);
    } catch (err) {
      console.error('Failed to generate clarifying questions:', err);
      // Continue without AI questions — static questions still show
    } finally {
      setLoadingQuestions(false);
    }
  }, [concept, schema, model]);

  // Handle clarification submit
  const handleClarificationSubmit = useCallback(async (
    staticAnswers: Record<string, string>,
    clarificationAnswers: Record<string, string>,
  ) => {
    // Merge GSC keywords into static answers
    const mergedStaticAnswers = { ...staticAnswers };
    if (gscSelectedKeywords.size > 0) {
      const existing = mergedStaticAnswers.keywords || '';
      const gscStr = Array.from(gscSelectedKeywords).join(', ');
      mergedStaticAnswers.keywords = existing ? `${existing}, ${gscStr}` : gscStr;
    }

    const input: ContentInput = {
      ...contentInput,
      concept,
      staticAnswers: mergedStaticAnswers,
      clarificationAnswers,
    };
    setContentInput(input);
    setShowClarification(false);

    // For blog posts, show title picker before generation
    if (schema.contentType === 'blog-post') {
      setPendingInput(input);
      setShowTitlePicker(true);
      setLoadingTitles(true);
      try {
        const titles = await generateTitleOptions(schema, input, model);
        setTitleOptions(titles);
      } catch (err) {
        console.error('Failed to generate titles:', err);
        // Fall back to direct generation
        setShowTitlePicker(false);
        await runGeneration(input);
      } finally {
        setLoadingTitles(false);
      }
    } else {
      await runGeneration(input);
    }
  }, [contentInput, concept, schema, model, gscSelectedKeywords]);

  // Handle skip clarification
  const handleSkipClarification = useCallback(async () => {
    const input: ContentInput = {
      ...contentInput,
      concept,
    };
    setContentInput(input);
    setShowClarification(false);

    if (schema.contentType === 'blog-post') {
      setPendingInput(input);
      setShowTitlePicker(true);
      setLoadingTitles(true);
      try {
        const titles = await generateTitleOptions(schema, input, model);
        setTitleOptions(titles);
      } catch {
        setShowTitlePicker(false);
        await runGeneration(input);
      } finally {
        setLoadingTitles(false);
      }
    } else {
      await runGeneration(input);
    }
  }, [contentInput, concept, schema, model]);

  // Handle title selection
  const handleTitleSelect = useCallback(async (option: TitleOption) => {
    if (!pendingInput) return;
    const input: ContentInput = {
      ...pendingInput,
      userSelections: {
        ...pendingInput.userSelections,
        _selectedTitle: option.title,
        _selectedSlug: option.slug,
        _gscKeywords: Array.from(gscSelectedKeywords).join(', '),
      },
    };
    setContentInput(input);
    setShowTitlePicker(false);
    await runGeneration(input);
  }, [pendingInput, gscSelectedKeywords]);

  // Handle title regeneration
  const handleRegenerateTitles = useCallback(async () => {
    if (!pendingInput) return;
    setLoadingTitles(true);
    try {
      const titles = await generateTitleOptions(schema, pendingInput, model);
      setTitleOptions(titles);
    } catch (err) {
      console.error('Failed to regenerate titles:', err);
    } finally {
      setLoadingTitles(false);
    }
  }, [pendingInput, schema, model]);

  // Handle title skip
  const handleSkipTitles = useCallback(async () => {
    if (!pendingInput) return;
    const input: ContentInput = {
      ...pendingInput,
      userSelections: {
        ...pendingInput.userSelections,
        _gscKeywords: Array.from(gscSelectedKeywords).join(', '),
      },
    };
    setContentInput(input);
    setShowTitlePicker(false);
    await runGeneration(input);
  }, [pendingInput, gscSelectedKeywords]);

  // GSC keyword toggle
  const handleToggleGscKeyword = useCallback((keyword: string) => {
    setGscSelectedKeywords(prev => {
      const next = new Set(prev);
      if (next.has(keyword)) {
        next.delete(keyword);
      } else {
        next.add(keyword);
      }
      return next;
    });
  }, []);

  // Run the actual AI generation
  const runGeneration = async (input: ContentInput) => {
    setGenerating(true);
    setActiveTab('review');
    setReviewedFields(new Set()); // Reset reviews on regeneration
    setGeneratedImageUrl(null);
    setImageError(null);

    try {
      const result = await generateContent(schema, input, model);
      setGeneratedFields(result.fields);

      // Validate
      const validationErrors = validateContent(schema, result.fields);
      setErrors(validationErrors);

      // Auto-trigger image generation if schema has an image field and photo-prompt was generated
      const photoPrompt = result.fields['photo-prompt'];
      if (schema.imageFieldSlug && typeof photoPrompt === 'string' && photoPrompt.trim()) {
        const slug = String(result.fields['slug'] || 'content');
        triggerImageGeneration(photoPrompt, slug);
      }
    } catch (err) {
      console.error('Content generation failed:', err);
      setErrors([{
        field: '_generation',
        message: err instanceof Error ? err.message : 'Generation failed. Please try again.',
      }]);
    } finally {
      setGenerating(false);
    }
  };

  // Image generation (runs in background, non-blocking)
  const triggerImageGeneration = async (photoPrompt: string, slug: string) => {
    setImageGenerating(true);
    setImageError(null);

    try {
      const result = await generateAndUploadImage(photoPrompt, slug);
      setGeneratedImageUrl(result.base64Url);

      // Store asset info in generatedFields so mapToWebflow includes it
      if (result.webflowAsset) {
        setGeneratedFields(prev => ({
          ...prev,
          _imageFileId: result.webflowAsset!.fileId,
          _imageUrl: result.webflowAsset!.url,
        }));
      }

      if (result.error) {
        setImageError(result.error);
      }
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Image generation failed');
    } finally {
      setImageGenerating(false);
    }
  };

  // Regenerate just the image
  const handleRegenerateImage = useCallback(() => {
    const photoPrompt = generatedFields['photo-prompt'];
    const slug = String(generatedFields['slug'] || 'content');
    if (typeof photoPrompt === 'string' && photoPrompt.trim()) {
      triggerImageGeneration(photoPrompt, slug);
    }
  }, [generatedFields]);

  // Handle field edits in the review tab
  const handleFieldChange = (slug: string, value: unknown) => {
    const updated = { ...generatedFields, [slug]: value };
    setGeneratedFields(updated);
    setErrors(validateContent(schema, updated));
  };

  // Toggle a field's reviewed status
  const handleToggleReviewed = useCallback((slug: string) => {
    setReviewedFields(prev => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

  // Regenerate content
  const handleRegenerate = async () => {
    await runGeneration(contentInput);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'setup', label: 'Setup' },
    { id: 'refine', label: 'Refine' },
    { id: 'review', label: 'Review' },
    { id: 'publish', label: 'Publish' },
  ];

  const hasContent = Object.keys(generatedFields).length > 0;
  const aiFields = schema.fields.filter(f => f.aiGenerated);
  const allReviewed = hasContent && aiFields.length > 0 && aiFields.every(f => reviewedFields.has(f.slug));

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
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--td-emerald-dark)' : 'var(--color-gray-500)',
              fontWeight: activeTab === tab.id ? '600' : '400',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--td-emerald-dark)' : '2px solid transparent',
              marginBottom: '-1px',
              fontSize: '14px',
              position: 'relative',
            }}
          >
            {tab.label}
            {tab.id === 'publish' && hasContent && !allReviewed && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px', opacity: 0.6 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
            {tab.id === 'review' && hasContent && errors.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#EF4444',
              }} />
            )}
            {tab.id === 'review' && hasContent && errors.length === 0 && allReviewed && (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--td-emerald-dark)',
              }} />
            )}
            {tab.id === 'review' && hasContent && errors.length === 0 && !allReviewed && (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#F59E0B',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Setup Tab */}
      {activeTab === 'setup' && (
        <div className="card">
          <div className="card-header">
            <h4 style={{ margin: 0 }}>
              Create {schema.displayName}
            </h4>
          </div>
          <div className="card-body">
            <div style={{ fontSize: '14px', color: 'var(--color-gray-500)', marginBottom: '20px' }}>
              {schema.description}
            </div>

            {/* Concept Input */}
            <div className="form-group">
              <label className="form-label">What's the concept?</label>
              <textarea
                className="form-textarea"
                value={concept}
                onChange={e => setConcept(e.target.value)}
                placeholder={`Describe your ${schema.displayName.toLowerCase()} idea. The more detail you give, the better the output.`}
                rows={4}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '4px',
                fontSize: '12px',
                color: 'var(--color-gray-500)',
              }}>
                <span>
                  {concept.length > 200
                    ? 'Detailed concept detected — clarification can be skipped'
                    : 'Add more detail or answer clarifying questions after clicking Generate'}
                </span>
                <span>{concept.length} chars</span>
              </div>
            </div>

            {/* GSC Keyword Suggestions (blog posts only) */}
            {schema.contentType === 'blog-post' && (
              <div className="form-group">
                <GSCKeywordSuggestions
                  selectedKeywords={gscSelectedKeywords}
                  onToggleKeyword={handleToggleGscKeyword}
                />
              </div>
            )}

            {/* Model Selector */}
            <div className="form-group">
              <label className="form-label">AI Model</label>
              <select
                className="form-select"
                value={model}
                onChange={e => setModel(e.target.value as TextModel)}
              >
                {TEXT_MODELS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Title Picker (shown after clarification for blog posts) */}
            {showTitlePicker && (
              <div style={{ marginTop: '24px' }}>
                {loadingTitles && titleOptions.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '32px',
                    color: 'var(--color-gray-500)',
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      border: '3px solid #E5E7EB',
                      borderTopColor: 'var(--td-emerald-dark)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 12px',
                    }} />
                    <div style={{ fontSize: '14px' }}>Generating title options...</div>
                  </div>
                ) : (
                  <TitlePicker
                    options={titleOptions}
                    onSelect={handleTitleSelect}
                    onRegenerate={handleRegenerateTitles}
                    onSkip={handleSkipTitles}
                    loading={loadingTitles}
                  />
                )}
              </div>
            )}

            {/* Generate Button */}
            {!showClarification && !showTitlePicker && (
              <button
                className="btn btn-primary"
                onClick={handleStartGeneration}
                disabled={!concept.trim() || generating}
                style={{ marginTop: 'var(--spacing-md)' }}
              >
                {generating ? 'Generating...' : `Generate ${schema.displayName}`}
              </button>
            )}

            {/* Clarification Chat */}
            {showClarification && (
              <div style={{ marginTop: '24px' }}>
                <ClarificationChat
                  staticQuestions={schema.staticQuestions}
                  aiQuestions={aiQuestions}
                  loadingQuestions={loadingQuestions}
                  onSubmit={handleClarificationSubmit}
                  onSkip={handleSkipClarification}
                  contentType={schema.displayName.toLowerCase()}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refine Tab */}
      {activeTab === 'refine' && (
        <div className="card">
          <div className="card-header">
            <h4 style={{ margin: 0 }}>Refine Input</h4>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: '20px', fontSize: '14px', color: 'var(--color-gray-500)' }}>
              Edit your concept and answers, then regenerate to improve the output.
            </div>

            {/* Editable concept */}
            <div className="form-group">
              <label className="form-label">Concept</label>
              <textarea
                className="form-textarea"
                value={concept}
                onChange={e => setConcept(e.target.value)}
                rows={4}
              />
            </div>

            {/* Show current static answers */}
            {Object.entries(contentInput.staticAnswers).length > 0 && (
              <div className="form-group">
                <label className="form-label">Your Answers</label>
                <div style={{
                  padding: '12px 16px',
                  background: '#F9FAFB',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}>
                  {Object.entries(contentInput.staticAnswers).map(([key, value]) => (
                    <div key={key} style={{ marginBottom: '6px' }}>
                      <strong>{schema.staticQuestions.find(q => q.id === key)?.question || key}:</strong>{' '}
                      {value}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show AI clarification answers */}
            {Object.entries(contentInput.clarificationAnswers).filter(([, v]) => v.trim()).length > 0 && (
              <div className="form-group">
                <label className="form-label">Clarification Answers</label>
                <div style={{
                  padding: '12px 16px',
                  background: '#F9FAFB',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}>
                  {Object.entries(contentInput.clarificationAnswers)
                    .filter(([, v]) => v.trim())
                    .map(([key, value]) => (
                      <div key={key} style={{ marginBottom: '6px' }}>
                        <strong>{aiQuestions[parseInt(key.replace('q', ''))] || key}:</strong>{' '}
                        {value}
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                className="btn btn-primary"
                onClick={handleRegenerate}
                disabled={generating || !concept.trim()}
              >
                {generating ? 'Regenerating...' : 'Regenerate'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={handleStartGeneration}
                disabled={generating}
              >
                Start Over with New Questions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Tab */}
      {activeTab === 'review' && (
        <div>
          {generating ? (
            <div className="card">
              <div className="card-body" style={{
                textAlign: 'center',
                padding: '64px 32px',
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #E5E7EB',
                  borderTopColor: 'var(--td-emerald-dark)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 20px',
                }} />
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                  Generating {schema.displayName}...
                </div>
                <div style={{ fontSize: '14px', color: 'var(--color-gray-500)' }}>
                  Writing {schema.fields.filter(f => f.aiGenerated).length} fields with {TEXT_MODELS.find(m => m.id === model)?.name || model}
                </div>
              </div>
            </div>
          ) : (
            <div>
              {hasContent && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}>
                  <div style={{ fontSize: '14px', color: 'var(--color-gray-500)' }}>
                    Review and edit the generated content below
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleRegenerate}
                    disabled={generating}
                  >
                    Regenerate
                  </button>
                </div>
              )}
              <ContentPreview
                schema={schema}
                fields={generatedFields}
                errors={errors}
                onFieldChange={handleFieldChange}
                reviewedFields={reviewedFields}
                onToggleReviewed={handleToggleReviewed}
                imageGenerating={imageGenerating}
                generatedImageUrl={generatedImageUrl}
                imageError={imageError}
                onRegenerateImage={schema.imageFieldSlug ? handleRegenerateImage : undefined}
              />

              {/* NeuronWriter SEO Score (blog posts only) */}
              {schema.contentType === 'blog-post' && hasContent && (
                <div style={{ marginTop: '20px' }}>
                  <SEOScorePanel
                    nwQueryId={nwQueryId}
                    contentHtml={typeof generatedFields['post---content'] === 'string' ? generatedFields['post---content'] as string : ''}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Publish Tab */}
      {activeTab === 'publish' && (
        <PublishPanel
          schema={schema}
          fields={generatedFields}
          errors={errors}
          input={contentInput}
          allReviewed={allReviewed}
          onGoToReview={() => setActiveTab('review')}
          imageGenerating={imageGenerating}
          imageUploaded={!!generatedFields['_imageFileId']}
        />
      )}
    </div>
  );
}
