import { useState, useEffect, useRef } from 'react';
import {
  generateImage,
  IMAGE_MODELS,
  hasApiKey,
} from '../../services/openrouterService';
import {
  saveCharacterRef,
  getCharacterRefs,
  deleteCharacterRef,
  saveCharacterImage,
  getAllCharacterImages,
  deleteCharacterImage,
  type CharacterRef,
  type StoredCharacterImage,
} from '../../services/imageStorage';

// Scene presets for TaxDrop marketing
const SCENE_PRESETS = [
  { id: 'front-porch', label: 'Front Porch', description: 'Standing on a beautiful home front porch, warm lighting, residential neighborhood' },
  { id: 'living-room', label: 'Living Room', description: 'In a bright, modern living room with comfortable furniture and natural light from large windows' },
  { id: 'kitchen', label: 'Kitchen', description: 'In a clean modern kitchen with natural light, warm and inviting atmosphere' },
  { id: 'home-office', label: 'Home Office', description: 'Sitting at a home office desk with a laptop, organized space, natural light' },
  { id: 'mailbox', label: 'Checking Mailbox', description: 'At the mailbox in front of a beautiful home, checking mail, sunny day' },
  { id: 'backyard', label: 'Backyard', description: 'In a nice backyard garden area, relaxed outdoor setting, green plants and flowers' },
  { id: 'neighborhood', label: 'Walking Neighborhood', description: 'Walking through a beautiful suburban neighborhood, tree-lined street, golden hour light' },
  { id: 'real-estate', label: 'House Exterior', description: 'Standing in front of a beautiful home exterior, well-maintained lawn, curb appeal' },
  { id: 'celebration', label: 'Celebration', description: 'Celebrating good news, happy expression, confetti or party atmosphere, bright colors' },
  { id: 'coffee-shop', label: 'Coffee Shop', description: 'Sitting in a cozy coffee shop, warm ambient lighting, relaxed atmosphere' },
  { id: 'park', label: 'Park / Outdoors', description: 'In a beautiful park setting, green trees, natural sunlight, serene atmosphere' },
  { id: 'downtown', label: 'Downtown / Urban', description: 'In a vibrant downtown area, modern buildings, urban energy, street-level view' },
  { id: 'custom', label: 'Custom Scene', description: '' },
];

const OUTFIT_PRESETS = [
  { id: 'casual', label: 'Casual', description: 'wearing casual everyday clothes, jeans and a nice top' },
  { id: 'casual-texas', label: 'Casual Texas', description: 'wearing a casual Texas-themed t-shirt and jeans' },
  { id: 'business-casual', label: 'Business Casual', description: 'wearing business casual attire, blazer with casual pants' },
  { id: 'professional', label: 'Professional', description: 'wearing professional business attire, well-dressed' },
  { id: 'athleisure', label: 'Athleisure', description: 'wearing comfortable athleisure wear, sporty and casual' },
  { id: 'summer', label: 'Summer', description: 'wearing light summer clothes, sundress or shorts and a light top' },
  { id: 'cozy', label: 'Cozy / Home', description: 'wearing cozy loungewear, comfortable at-home clothes' },
  { id: 'taxdrop-brand', label: 'TaxDrop Branded', description: 'wearing a TaxDrop emerald green branded t-shirt' },
  { id: 'same', label: 'Same as Reference', description: 'wearing the same outfit as in the reference photo' },
  { id: 'custom', label: 'Custom Outfit', description: '' },
];

const POSE_PRESETS = [
  { id: 'reading-letter', label: 'Reading a Letter', description: 'holding and reading a letter or document, looking down at it with interest' },
  { id: 'smiling-camera', label: 'Smiling at Camera', description: 'looking directly at the camera with a warm, genuine smile' },
  { id: 'thumbs-up', label: 'Thumbs Up', description: 'giving a thumbs up with a happy expression, positive energy' },
  { id: 'phone-happy', label: 'Happy on Phone', description: 'looking at a smartphone screen with a happy, surprised expression' },
  { id: 'laptop-working', label: 'Working on Laptop', description: 'sitting and working on a laptop computer, focused but pleasant' },
  { id: 'arms-crossed', label: 'Arms Crossed (Confident)', description: 'standing with arms crossed confidently, slight smile, empowered' },
  { id: 'pointing', label: 'Pointing / Presenting', description: 'gesturing or pointing as if presenting information, engaged expression' },
  { id: 'relaxed-sitting', label: 'Relaxed Sitting', description: 'sitting comfortably in a relaxed position, at ease' },
  { id: 'walking', label: 'Walking', description: 'walking naturally, mid-stride, casual and confident' },
  { id: 'celebrating', label: 'Celebrating', description: 'celebrating with raised arms or fist pump, excited and joyful expression' },
  { id: 'thinking', label: 'Thinking / Considering', description: 'in a thoughtful pose, hand on chin or looking contemplative' },
  { id: 'custom', label: 'Custom Pose', description: '' },
];

const ASPECT_RATIOS = [
  { id: '1:1' as const, label: 'Square (1:1)', use: 'Instagram, Facebook' },
  { id: '16:9' as const, label: 'Landscape (16:9)', use: 'Blog hero, YouTube' },
  { id: '9:16' as const, label: 'Portrait (9:16)', use: 'Stories, TikTok' },
  { id: '4:3' as const, label: 'Standard (4:3)', use: 'General use' },
];

export function ConsistentCharacterGenerator() {
  // Character reference state
  const [characters, setCharacters] = useState<CharacterRef[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterRef | null>(null);
  const [newCharName, setNewCharName] = useState('');
  const [newCharDescription, setNewCharDescription] = useState('');
  const [newCharImage, setNewCharImage] = useState<string | null>(null);
  const [showAddCharacter, setShowAddCharacter] = useState(false);

  // Generation options
  const [selectedScene, setSelectedScene] = useState(SCENE_PRESETS[0].id);
  const [customScene, setCustomScene] = useState('');
  const [selectedOutfit, setSelectedOutfit] = useState(OUTFIT_PRESETS[0].id);
  const [customOutfit, setCustomOutfit] = useState('');
  const [selectedPose, setSelectedPose] = useState(POSE_PRESETS[0].id);
  const [customPose, setCustomPose] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('1:1');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<StoredCharacterImage[]>([]);

  // Gallery
  const [showGallery, setShowGallery] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data on mount
  useEffect(() => {
    setCharacters(getCharacterRefs());
    getAllCharacterImages().then(setGeneratedImages).catch(console.error);
  }, []);

  // Auto-select first character
  useEffect(() => {
    if (characters.length > 0 && !selectedCharacter) {
      setSelectedCharacter(characters[0]);
    }
  }, [characters, selectedCharacter]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setNewCharImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCharacter = () => {
    if (!newCharName.trim() || !newCharImage) {
      setError('Please provide a name and upload a reference photo');
      return;
    }

    const ref = saveCharacterRef({
      name: newCharName.trim(),
      referenceUrl: newCharImage,
      description: newCharDescription.trim(),
    });

    setCharacters(getCharacterRefs());
    setSelectedCharacter(ref);
    setNewCharName('');
    setNewCharDescription('');
    setNewCharImage(null);
    setShowAddCharacter(false);
    setError(null);
  };

  const handleDeleteCharacter = (id: string) => {
    deleteCharacterRef(id);
    const updated = getCharacterRefs();
    setCharacters(updated);
    if (selectedCharacter?.id === id) {
      setSelectedCharacter(updated[0] || null);
    }
  };

  const buildPrompt = (): string => {
    if (!selectedCharacter) return '';

    const scene = SCENE_PRESETS.find(s => s.id === selectedScene);
    const outfit = OUTFIT_PRESETS.find(o => o.id === selectedOutfit);
    const pose = POSE_PRESETS.find(p => p.id === selectedPose);

    const sceneDesc = selectedScene === 'custom' ? customScene : scene?.description || '';
    const outfitDesc = selectedOutfit === 'custom' ? customOutfit : outfit?.description || '';
    const poseDesc = selectedPose === 'custom' ? customPose : pose?.description || '';

    let prompt = `Generate a photorealistic image of the EXACT SAME person shown in the reference photo. `;
    prompt += `Maintain the same face, skin tone, hair style, and body type exactly as shown in the reference image. `;

    if (selectedCharacter.description) {
      prompt += `The person is: ${selectedCharacter.description}. `;
    }

    prompt += `\n\nScene: ${sceneDesc}. `;
    prompt += `\nOutfit: ${outfitDesc}. `;
    prompt += `\nPose: ${poseDesc}. `;

    if (additionalNotes) {
      prompt += `\n\nAdditional details: ${additionalNotes}. `;
    }

    prompt += `\n\nIMPORTANT: The person must look IDENTICAL to the reference photo - same face, same features, same identity. `;
    prompt += `Professional photography quality, sharp focus, natural lighting, 8K resolution.`;
    prompt += `\n\nAvoid: distorted features, extra limbs, unnatural anatomy, blurry face, different person, different ethnicity, different face shape, cartoon, illustration, anime, 3D render.`;

    return prompt;
  };

  const handleGenerate = async () => {
    if (!selectedCharacter) {
      setError('Please select a character first');
      return;
    }

    if (!hasApiKey()) {
      setError('OpenRouter API key not configured. Go to Settings to add your key.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const prompt = buildPrompt();
      const result = await generateImage({
        model: IMAGE_MODELS[0].id,
        prompt,
        aspectRatio,
        imageSize: '2K',
        referenceImages: [selectedCharacter.referenceUrl],
      });

      const scene = SCENE_PRESETS.find(s => s.id === selectedScene);
      const outfit = OUTFIT_PRESETS.find(o => o.id === selectedOutfit);
      const pose = POSE_PRESETS.find(p => p.id === selectedPose);

      const stored = await saveCharacterImage({
        url: result.url,
        characterId: selectedCharacter.id,
        scene: selectedScene === 'custom' ? customScene : (scene?.label || selectedScene),
        outfit: selectedOutfit === 'custom' ? customOutfit : (outfit?.label || selectedOutfit),
        pose: selectedPose === 'custom' ? customPose : (pose?.label || selectedPose),
        prompt,
      });

      setGeneratedImages(prev => [stored, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteImage = async (id: string) => {
    await deleteCharacterImage(id);
    setGeneratedImages(prev => prev.filter(img => img.id !== id));
  };

  const handleDownload = (img: StoredCharacterImage) => {
    const link = document.createElement('a');
    link.href = img.url;
    link.download = `character-${img.scene}-${img.pose}-${Date.now()}.png`;
    link.click();
  };

  const characterImages = selectedCharacter
    ? generatedImages.filter(img => img.characterId === selectedCharacter.id)
    : generatedImages;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', fontFamily: '"Space Grotesk", sans-serif' }}>
          Consistent Character Generator
        </h3>
        <p style={{ margin: 0, color: '#6B7280', fontSize: '14px' }}>
          Generate images of the same person in different scenes, outfits, and poses. Upload a reference photo to maintain consistency.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
        {/* Left Panel - Character & Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Character Selection */}
          <div className="card">
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Character</h4>
                <button
                  onClick={() => setShowAddCharacter(!showAddCharacter)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    background: 'var(--td-emerald-light)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  {showAddCharacter ? 'Cancel' : '+ Add'}
                </button>
              </div>

              {/* Add New Character Form */}
              {showAddCharacter && (
                <div style={{
                  padding: '12px',
                  background: '#F9FAFB',
                  borderRadius: '8px',
                  marginBottom: '12px',
                }}>
                  <input
                    type="text"
                    placeholder="Character name (e.g., TaxDrop Model)"
                    value={newCharName}
                    onChange={(e) => setNewCharName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '13px',
                      marginBottom: '8px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <textarea
                    placeholder="Physical description (helps with consistency): e.g., young woman, brown skin, dark hair in a top bun, medium build"
                    value={newCharDescription}
                    onChange={(e) => setNewCharDescription(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '13px',
                      marginBottom: '8px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />

                  {/* Image Upload */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #D1D5DB',
                      borderRadius: '8px',
                      padding: newCharImage ? '0' : '20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: '#FAFAFA',
                      overflow: 'hidden',
                    }}
                  >
                    {newCharImage ? (
                      <img
                        src={newCharImage}
                        alt="Reference"
                        style={{ width: '100%', display: 'block', borderRadius: '6px' }}
                      />
                    ) : (
                      <div>
                        <div style={{ fontSize: '24px', marginBottom: '4px' }}>+</div>
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>Upload reference photo</div>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />

                  <button
                    onClick={handleSaveCharacter}
                    disabled={!newCharName.trim() || !newCharImage}
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginTop: '8px',
                      background: newCharName.trim() && newCharImage ? 'var(--td-emerald-dark)' : '#D1D5DB',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: newCharName.trim() && newCharImage ? 'pointer' : 'default',
                      fontSize: '13px',
                      fontWeight: '600',
                    }}
                  >
                    Save Character
                  </button>
                </div>
              )}

              {/* Character List */}
              {characters.length === 0 && !showAddCharacter && (
                <div style={{
                  padding: '24px 12px',
                  textAlign: 'center',
                  color: '#9CA3AF',
                  fontSize: '13px',
                }}>
                  No characters yet. Click "+ Add" to upload a reference photo.
                </div>
              )}

              {characters.map(char => (
                <div
                  key={char.id}
                  onClick={() => setSelectedCharacter(char)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selectedCharacter?.id === char.id ? 'var(--td-mint)' : 'transparent',
                    border: selectedCharacter?.id === char.id ? '2px solid var(--td-emerald-light)' : '2px solid transparent',
                    marginBottom: '4px',
                    transition: 'all 0.15s',
                  }}
                >
                  <img
                    src={char.referenceUrl}
                    alt={char.name}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {char.name}
                    </div>
                    {char.description && (
                      <div style={{ fontSize: '11px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {char.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(char.id); }}
                    style={{
                      padding: '4px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#9CA3AF',
                      fontSize: '16px',
                      flexShrink: 0,
                    }}
                    title="Delete character"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Scene Selection */}
          <div className="card">
            <div className="card-body">
              <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600' }}>Scene</h4>
              <select
                value={selectedScene}
                onChange={(e) => setSelectedScene(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '13px',
                  background: 'white',
                }}
              >
                {SCENE_PRESETS.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              {selectedScene === 'custom' && (
                <textarea
                  placeholder="Describe the scene in detail..."
                  value={customScene}
                  onChange={(e) => setCustomScene(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '13px',
                    marginTop: '8px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              )}
            </div>
          </div>

          {/* Outfit Selection */}
          <div className="card">
            <div className="card-body">
              <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600' }}>Outfit</h4>
              <select
                value={selectedOutfit}
                onChange={(e) => setSelectedOutfit(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '13px',
                  background: 'white',
                }}
              >
                {OUTFIT_PRESETS.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              {selectedOutfit === 'custom' && (
                <textarea
                  placeholder="Describe the outfit in detail..."
                  value={customOutfit}
                  onChange={(e) => setCustomOutfit(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '13px',
                    marginTop: '8px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              )}
            </div>
          </div>

          {/* Pose Selection */}
          <div className="card">
            <div className="card-body">
              <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600' }}>Pose</h4>
              <select
                value={selectedPose}
                onChange={(e) => setSelectedPose(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '13px',
                  background: 'white',
                }}
              >
                {POSE_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              {selectedPose === 'custom' && (
                <textarea
                  placeholder="Describe the pose in detail..."
                  value={customPose}
                  onChange={(e) => setCustomPose(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '13px',
                    marginTop: '8px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              )}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div className="card">
            <div className="card-body">
              <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600' }}>Aspect Ratio</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {ASPECT_RATIOS.map(ar => (
                  <button
                    key={ar.id}
                    onClick={() => setAspectRatio(ar.id)}
                    style={{
                      padding: '8px 6px',
                      border: aspectRatio === ar.id ? '2px solid var(--td-emerald-light)' : '1px solid #D1D5DB',
                      borderRadius: '6px',
                      background: aspectRatio === ar.id ? 'var(--td-mint)' : 'white',
                      cursor: 'pointer',
                      fontSize: '11px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '2px' }}>{ar.label}</div>
                    <div style={{ color: '#9CA3AF', fontSize: '10px' }}>{ar.use}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="card">
            <div className="card-body">
              <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600' }}>Additional Notes</h4>
              <textarea
                placeholder="Any extra details: lighting, mood, props, brand elements..."
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '13px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!selectedCharacter || isGenerating}
            style={{
              width: '100%',
              padding: '14px',
              background: !selectedCharacter || isGenerating ? '#D1D5DB' : 'var(--td-emerald-dark)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: !selectedCharacter || isGenerating ? 'default' : 'pointer',
              fontFamily: '"Space Grotesk", sans-serif',
            }}
          >
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </button>
        </div>

        {/* Right Panel - Preview & Gallery */}
        <div>
          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px',
              background: '#FEE2E2',
              color: '#DC2626',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          {/* Generation Progress */}
          {isGenerating && (
            <div style={{
              padding: '48px',
              textAlign: 'center',
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              marginBottom: '16px',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '3px solid #E5E7EB',
                borderTop: '3px solid var(--td-emerald-light)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Generating your image...</div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>
                Using reference photo for character consistency
              </div>
            </div>
          )}

          {/* Prompt Preview */}
          {selectedCharacter && !isGenerating && (
            <div style={{
              padding: '12px 16px',
              background: '#F0FDF4',
              borderRadius: '8px',
              border: '1px solid #BBF7D0',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#166534',
            }}>
              <strong>Prompt Preview:</strong>
              <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap', opacity: 0.8, maxHeight: '100px', overflow: 'auto' }}>
                {buildPrompt().slice(0, 300)}...
              </div>
            </div>
          )}

          {/* Gallery Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              Generated Images ({characterImages.length})
            </h4>
            {generatedImages.length > 0 && selectedCharacter && (
              <button
                onClick={() => setShowGallery(!showGallery)}
                style={{
                  padding: '6px 12px',
                  background: 'none',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#6B7280',
                }}
              >
                {showGallery ? 'Show This Character' : 'Show All Characters'}
              </button>
            )}
          </div>

          {/* Image Grid */}
          {(showGallery ? generatedImages : characterImages).length === 0 ? (
            <div style={{
              padding: '64px 24px',
              textAlign: 'center',
              background: 'white',
              borderRadius: '12px',
              border: '2px dashed #E5E7EB',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>+</div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>No images generated yet</div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>
                {selectedCharacter
                  ? 'Select a scene, outfit, and pose, then click Generate.'
                  : 'Upload a reference photo to get started.'}
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '16px',
            }}>
              {(showGallery ? generatedImages : characterImages).map(img => (
                <div
                  key={img.id}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={img.url}
                    alt={`${img.scene} - ${img.pose}`}
                    style={{ width: '100%', display: 'block', aspectRatio: '1', objectFit: 'cover' }}
                  />
                  <div style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <span style={{
                        padding: '2px 8px',
                        background: 'var(--td-mint)',
                        color: 'var(--td-emerald-dark)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                      }}>
                        {img.scene}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        background: '#EFF6FF',
                        color: '#1D4ED8',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                      }}>
                        {img.outfit}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        background: '#FEF3C7',
                        color: '#92400E',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                      }}>
                        {img.pose}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleDownload(img)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          background: 'var(--td-emerald-light)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                        }}
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleDeleteImage(img.id)}
                        style={{
                          padding: '6px 10px',
                          background: 'none',
                          border: '1px solid #EF4444',
                          color: '#EF4444',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
