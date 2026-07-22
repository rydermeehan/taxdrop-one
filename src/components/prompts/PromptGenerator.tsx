import { useState, useEffect } from 'react';
import type { PromptTemplate, StyleGuide, Character } from '../../types';
import { promptTemplates } from '../../data/promptTemplates';
import { generatePrompt } from '../../services/promptService';
import {
  generateImage,
  hasApiKey,
  getOpenRouterSettings,
  IMAGE_MODELS,
  type ImageModel,
  type GeneratedImage,
} from '../../services/openrouterService';
import { CopyIcon, CheckIcon, SparklesIcon, ImageIcon } from '../common/Icons';

interface PromptGeneratorProps {
  characters?: Character[];
  styleGuide?: StyleGuide;
  brandId?: string;
  onSavePrompt?: (prompt: string, negativePrompt?: string) => void;
  onSaveImage?: (imageUrl: string, prompt: string) => void;
}

export function PromptGenerator({ characters = [], styleGuide, brandId, onSavePrompt, onSaveImage }: PromptGeneratorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate>(promptTemplates[0]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [copied, setCopied] = useState(false);

  // Image generation state
  const [selectedModel, setSelectedModel] = useState<ImageModel>('google/gemini-3-pro-image-preview');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('16:9');
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const settings = getOpenRouterSettings();
    if (settings.defaultModel) {
      setSelectedModel(settings.defaultModel);
    }
  }, []);

  useEffect(() => {
    const initialValues: Record<string, string> = {};
    selectedTemplate.variables.forEach(v => {
      initialValues[v.name] = v.defaultValue ?? '';
    });
    setValues(initialValues);
  }, [selectedTemplate]);

  useEffect(() => {
    const result = generatePrompt(selectedTemplate.id, values, { styleGuide, brandId });
    setGeneratedPrompt(result.prompt);
    setNegativePrompt(result.negativePrompt ?? '');
  }, [values, selectedTemplate, styleGuide, brandId]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleValueChange = (name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerateImage = async () => {
    if (!generatedPrompt) return;

    setGenerating(true);
    setError(null);

    try {
      const image = await generateImage({
        model: selectedModel,
        prompt: generatedPrompt,
        negativePrompt: negativePrompt || undefined,
        aspectRatio,
      });

      setGeneratedImages(prev => [image, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
    } finally {
      setGenerating(false);
    }
  };

  const categories = [
    { id: 'scene', label: 'Scenes' },
    { id: 'character-portrait', label: 'Portraits' },
    { id: 'character-fullbody', label: 'Full Body' },
    { id: 'location', label: 'Locations' },
    { id: 'motion', label: 'Motion' },
  ] as const;

  const apiKeyConfigured = hasApiKey();

  return (
    <div>
      {/* Template Selection */}
      <div className="mb-lg">
        <label className="form-label">Template Category</label>
        <div className="tabs" style={{ marginBottom: 'var(--spacing-md)' }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`tab ${selectedTemplate.category === cat.id ? 'active' : ''}`}
              onClick={() => {
                const template = promptTemplates.find(t => t.category === cat.id);
                if (template) setSelectedTemplate(template);
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray">{selectedTemplate.description}</p>
      </div>

      {/* Variable Inputs */}
      <div className="card mb-lg">
        <div className="card-header">
          <h4>Fill in the details</h4>
        </div>
        <div className="card-body">
          {selectedTemplate.variables.map(variable => (
            <div key={variable.name} className="form-group">
              <label className="form-label">
                {variable.label}
                {variable.required && ' *'}
              </label>
              {variable.type === 'select' && variable.options ? (
                <select
                  className="form-select"
                  value={values[variable.name] ?? ''}
                  onChange={e => handleValueChange(variable.name, e.target.value)}
                >
                  <option value="">Select...</option>
                  {variable.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : variable.type === 'textarea' ? (
                <textarea
                  className="form-textarea"
                  value={values[variable.name] ?? ''}
                  onChange={e => handleValueChange(variable.name, e.target.value)}
                  placeholder={variable.placeholder}
                  rows={2}
                />
              ) : variable.type === 'character' ? (
                <div>
                  <select
                    className="form-select"
                    value={values[variable.name] ?? ''}
                    onChange={e => handleValueChange(variable.name, e.target.value)}
                    style={{ marginBottom: 'var(--spacing-xs)' }}
                  >
                    <option value="">Select character or type below...</option>
                    {characters.map(char => (
                      <option key={char.id} value={char.shorthand}>
                        {char.shorthand} - {char.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="form-input"
                    value={values[variable.name] ?? ''}
                    onChange={e => handleValueChange(variable.name, e.target.value)}
                    placeholder={variable.placeholder ?? 'Or describe character...'}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  value={values[variable.name] ?? ''}
                  onChange={e => handleValueChange(variable.name, e.target.value)}
                  placeholder={variable.placeholder}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Generated Prompt Preview */}
      <div className="card mb-lg">
        <div className="card-header">
          <h4 className="flex items-center gap-sm">
            <SparklesIcon style={{ width: 16, height: 16 }} />
            Generated Prompt
          </h4>
          <div className="flex gap-sm">
            <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {onSavePrompt && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onSavePrompt(generatedPrompt, negativePrompt)}
              >
                Save to Shot
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
          <div className="prompt-preview">
            {generatedPrompt || 'Fill in the fields above to generate a prompt...'}
          </div>
          {negativePrompt && (
            <div className="prompt-negative">
              <strong>Negative prompt:</strong><br />
              {negativePrompt}
            </div>
          )}
        </div>
      </div>

      {/* Image Generation */}
      <div className="card mb-lg">
        <div className="card-header">
          <h4 className="flex items-center gap-sm">
            <ImageIcon style={{ width: 16, height: 16 }} />
            Generate Image
          </h4>
        </div>
        <div className="card-body">
          {!apiKeyConfigured ? (
            <div className="text-center" style={{ padding: 'var(--spacing-lg)' }}>
              <p className="text-gray mb-md">
                To generate images, add your OpenRouter API key in Settings.
              </p>
              <a href="#" onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'settings' }))} className="btn btn-secondary">
                Go to Settings
              </a>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Model</label>
                  <select
                    className="form-select"
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value as ImageModel)}
                  >
                    {IMAGE_MODELS.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Aspect Ratio</label>
                  <select
                    className="form-select"
                    value={aspectRatio}
                    onChange={e => setAspectRatio(e.target.value as '1:1' | '16:9' | '9:16')}
                  >
                    <option value="16:9">16:9 (Landscape)</option>
                    <option value="9:16">9:16 (Portrait/Social)</option>
                    <option value="1:1">1:1 (Square)</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleGenerateImage}
                    disabled={generating || !generatedPrompt}
                    style={{ width: '100%' }}
                  >
                    {generating ? 'Generating...' : 'Generate Image'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="form-error mb-md">{error}</div>
              )}

              {/* Generated Images Gallery */}
              {generatedImages.length > 0 && (
                <div>
                  <label className="form-label">Generated Images</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
                    {generatedImages.map((img, i) => (
                      <div
                        key={i}
                        style={{
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          border: '1px solid #E5E7EB',
                          background: '#F9FAFB',
                        }}
                      >
                        <img
                          src={img.url}
                          alt={`Generated: ${img.prompt.substring(0, 50)}...`}
                          style={{ width: '100%', display: 'block' }}
                        />
                        <div style={{ padding: 'var(--spacing-sm)' }}>
                          <div className="flex gap-sm">
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = img.url;
                                link.download = `generated-${Date.now()}.png`;
                                link.click();
                              }}
                            >
                              Download
                            </button>
                            {onSaveImage && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => onSaveImage(img.url, img.prompt)}
                              >
                                Add to Shot
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
