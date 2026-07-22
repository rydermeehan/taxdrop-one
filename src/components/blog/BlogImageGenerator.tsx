import { useState, useEffect } from 'react';
import type { BlogImage, BlogImageType, Brand } from '../../types';
import {
  generateImage,
  hasApiKey,
  getOpenRouterSettings,
  IMAGE_MODELS,
  type ImageModel,
} from '../../services/openrouterService';
import {
  saveBlogImage,
  getAllBlogImages,
  deleteBlogImage,
  clearAllBlogImages,
  getBlogStorageStats,
  migrateBlogImagesFromLocalStorage,
  type StoredBlogImage,
} from '../../services/imageStorage';
import { CopyIcon, CheckIcon, ImageIcon, DownloadIcon } from '../common/Icons';

// Pre-defined TaxDrop logos
const TAXDROP_LOGOS = [
  {
    id: 'horizontal-color',
    label: 'Horizontal (Color)',
    description: 'Full color logo for light backgrounds',
    url: '/logos/taxdrop-horizontal-color.png',
    forBackground: 'light',
  },
  {
    id: 'stacked-color',
    label: 'Stacked (Color)',
    description: 'Stacked color logo for light backgrounds',
    url: '/logos/taxdrop-stacked-color.png',
    forBackground: 'light',
  },
  {
    id: 'stacked-white',
    label: 'Stacked (White)',
    description: 'White logo for dark backgrounds',
    url: '/logos/taxdrop-stacked-white.png',
    forBackground: 'dark',
  },
  {
    id: 'horizontal-gray',
    label: 'Horizontal (Gray)',
    description: 'Light gray logo for subtle branding',
    url: '/logos/taxdrop-horizontal-gray.png',
    forBackground: 'light',
  },
];

interface BlogImageGeneratorProps {
  brands?: Brand[];
  onSaveImage?: (image: BlogImage) => void;
  onNavigate?: (view: string) => void;
}

interface ImageTypeOption {
  id: BlogImageType;
  label: string;
  aspectRatio: '16:9' | '1:1' | '4:3' | '1.91:1' | '9:16';
  dimensions: string;
  description: string;
}

const IMAGE_TYPES: ImageTypeOption[] = [
  {
    id: 'hero',
    label: 'Hero Image',
    aspectRatio: '16:9',
    dimensions: '1920x1080',
    description: 'Full-width banner for blog post headers',
  },
  {
    id: 'thumbnail',
    label: 'Thumbnail',
    aspectRatio: '16:9',
    dimensions: '1280x720',
    description: 'Preview image for blog listings and cards',
  },
  {
    id: 'social-og',
    label: 'Social OG Image',
    aspectRatio: '1.91:1',
    dimensions: '1200x630',
    description: 'Open Graph image for Facebook/LinkedIn sharing',
  },
  {
    id: 'social-square',
    label: 'Social Square',
    aspectRatio: '1:1',
    dimensions: '1080x1080',
    description: 'Square format for Instagram and social feeds',
  },
  {
    id: 'social-mobile',
    label: 'Social Mobile',
    aspectRatio: '9:16',
    dimensions: '1080x1920',
    description: 'Vertical format for Stories, Reels, TikTok',
  },
  {
    id: 'inline',
    label: 'Inline Image',
    aspectRatio: '4:3',
    dimensions: '1200x900',
    description: 'Image to embed within blog content',
  },
];

// Lighting presets for consistent look
const LIGHTING_PRESETS = [
  { id: 'golden-hour', label: 'Golden Hour', description: 'Warm sunset lighting with long shadows', suffix: 'golden hour lighting, warm orange and amber tones, soft directional light from low angle, long gentle shadows, magic hour glow' },
  { id: 'soft-natural', label: 'Soft Natural', description: 'Overcast diffused daylight', suffix: 'soft natural lighting, overcast sky diffusion, even illumination without harsh shadows, flattering skin tones, professional portrait lighting' },
  { id: 'bright-airy', label: 'Bright & Airy', description: 'High-key with soft shadows', suffix: 'bright airy lighting, high-key exposure, minimal shadows, clean and fresh feel, window light aesthetic, lifestyle photography lighting' },
  { id: 'dramatic', label: 'Dramatic', description: 'Strong contrast with mood', suffix: 'dramatic lighting, strong directional light source, defined shadows, cinematic contrast, Rembrandt lighting style' },
  { id: 'studio', label: 'Studio Professional', description: 'Controlled studio setup', suffix: 'professional studio lighting, three-point lighting setup, clean catchlights, controlled shadows, commercial photography quality' },
];

// Color grading presets
const COLOR_GRADING_PRESETS = [
  { id: 'warm-natural', label: 'Warm Natural', description: 'Inviting warm tones', suffix: 'warm color grading, slightly lifted shadows, orange highlights, teal shadows, skin-flattering tones, magazine editorial color' },
  { id: 'clean-neutral', label: 'Clean Neutral', description: 'True-to-life colors', suffix: 'neutral color grading, accurate white balance, natural skin tones, balanced exposure, professional color correction' },
  { id: 'emerald-brand', label: 'Emerald Brand', description: 'Emerald and mint palette', suffix: 'color grading with emerald green (#0B8F52) accents, mint (#DFFFEA) highlights, warm skin tones, fresh and trustworthy color palette, green and white dominant' },
  { id: 'cool-professional', label: 'Cool Professional', description: 'Corporate blue tones', suffix: 'cool color grading, blue shadows, neutral highlights, professional corporate feel, desaturated warm tones' },
  { id: 'high-contrast', label: 'High Contrast', description: 'Bold and punchy', suffix: 'high contrast color grading, deep blacks, bright highlights, saturated colors, bold visual impact' },
];

// Mood/atmosphere presets
const MOOD_PRESETS = [
  { id: 'optimistic', label: 'Optimistic', description: 'Hopeful and positive', suffix: 'optimistic mood, hopeful atmosphere, subjects showing genuine happiness, uplifting feeling, success and relief emotions' },
  { id: 'trustworthy', label: 'Trustworthy', description: 'Professional and reliable', suffix: 'trustworthy mood, professional atmosphere, confident body language, competent and reliable feeling, expert guidance tone' },
  { id: 'relieved', label: 'Relieved', description: 'Weight lifted feeling', suffix: 'relieved mood, weight lifted atmosphere, relaxed posture, stress-free expression, problem solved feeling' },
  { id: 'empowered', label: 'Empowered', description: 'Taking control', suffix: 'empowered mood, taking control atmosphere, confident stance, determined expression, self-assured feeling' },
  { id: 'welcoming', label: 'Welcoming', description: 'Approachable and friendly', suffix: 'welcoming mood, approachable atmosphere, friendly expressions, inviting body language, accessible and relatable' },
];

// Brand Signature Style - consistent across all images
// IMPORTANT: Never mention brand names in image prompts — AI generators will render them as visible text/logos
const TAXDROP_BRAND_STYLE = `
CAMERA: Shot on Sony A7R IV with 35mm f/1.4 lens, shallow depth of field f/2.0, eye-level or slightly below angle.
LIGHTING: Bright and airy, soft natural window light or golden hour outdoors, high-key exposure, minimal harsh shadows, clean and optimistic feeling.
COLOR PALETTE: Emerald green (#0B8F52) in clothing, plants, doors, or decor; soft mint (#DFFFEA) in walls or soft backgrounds; occasional yellow-green (#C4FF64) pop in small accents; sky blue (#C6F0FF) in sky or subtle details; clean whites and warm wood tones.
COLOR GRADING: Warm and inviting, lifted shadows, slightly desaturated blacks, warm skin tones, fresh green tones enhanced, overall bright and hopeful feel.
SUBJECTS: Authentic diverse American homeowners aged 30-55, genuine expressions, relatable and aspirational, professional but approachable styling. Plain unbranded clothing only.
COMPOSITION: Clean uncluttered frames, strong single subject focus, rule of thirds, environmental context showing home/neighborhood, negative space for potential text overlay.
MOOD: Optimistic, relieved, empowered, trustworthy - the feeling of a weight being lifted or taking control.
CONSISTENCY: Every image should feel like part of the same photo series - same lighting quality, same color temperature, same level of polish.
CRITICAL: Absolutely no logos, brand names, text, watermarks, writing on clothing, signs with words, or any visible branding of any kind. All clothing must be plain and unbranded. All surfaces must be free of text. The image must look like authentic editorial photography, not an advertisement.
`.trim().replace(/\n/g, ' ');

// Premium editorial style presets inspired by NYT, WSJ, WalletHub
const STYLE_PRESETS = [
  {
    id: 'taxdrop-brand',
    label: 'Brand Style',
    isPhotorealistic: true,
    isBrandStyle: true,
    suffix: TAXDROP_BRAND_STYLE
  },
  {
    id: 'photorealistic',
    label: 'Photorealistic Premium',
    isPhotorealistic: true,
    isBrandStyle: false,
    suffix: 'ultra photorealistic, shot on Sony A7R IV with 24-70mm f/2.8 GM lens, natural lighting with soft diffusion, shallow depth of field f/2.8, color graded with warm highlights and cool shadows, magazine cover quality, Getty Images premium stock style, authentic and relatable, no artificial or CGI elements, real-world setting, professional commercial photography, diverse authentic people'
  },
  {
    id: 'lifestyle-authentic',
    label: 'Lifestyle Authentic',
    isPhotorealistic: true,
    isBrandStyle: false,
    suffix: 'authentic lifestyle photography, candid natural moments, real people in real situations, documentary style but polished, warm inviting tones, shallow depth of field, environmental context, storytelling composition, relatable and aspirational, Instagram-worthy quality'
  },
  {
    id: 'nyt-editorial',
    label: 'NYT Editorial',
    isPhotorealistic: false,
    suffix: 'New York Times editorial style, sophisticated conceptual photography, muted color palette with one accent color, dramatic chiaroscuro lighting, strong single focal point, elegant negative space, photojournalistic quality'
  },
  {
    id: 'wsj-financial',
    label: 'WSJ Financial',
    isPhotorealistic: false,
    suffix: 'Wall Street Journal style, clean financial infographic aesthetic, navy and gold accents, sharp geometric shapes, data-driven visual metaphor, premium stock photography look, authoritative and trustworthy'
  },
  {
    id: 'bloomberg',
    label: 'Bloomberg Markets',
    isPhotorealistic: false,
    suffix: 'Bloomberg style, bold graphic design, high contrast black background with vibrant accent colors, abstract geometric representation, modern financial visualization, sleek and contemporary'
  },
  {
    id: 'economist',
    label: 'The Economist',
    isPhotorealistic: false,
    suffix: 'The Economist cover style, clever visual metaphor, witty conceptual illustration, red accent color, symbolic representation of complex ideas, editorial cartoon sophistication, thought-provoking imagery'
  },
  {
    id: 'architectural',
    label: 'Architectural Digest',
    isPhotorealistic: true,
    suffix: 'Architectural Digest style, dramatic real estate photography, golden hour lighting, luxury interior/exterior, cinematic wide angle, aspirational lifestyle, warm tones with cool shadows'
  },
  {
    id: 'infographic',
    label: 'Data Visualization',
    isPhotorealistic: false,
    suffix: 'premium infographic style, abstract data visualization, flowing lines and gradients, emerald green and gold color scheme, clean white background, modern minimalist, information design aesthetic'
  },
];

// Photorealistic scene templates - real people in real situations
// Photorealistic scene templates - designed for brand consistency as a collection
const PHOTOREALISTIC_TEMPLATES = [
  {
    id: 'front-porch-pride',
    label: 'Front Porch Pride',
    concept: 'Confident homeowner on porch',
    keywords: 'single homeowner standing relaxed on front porch of suburban home, arms crossed confidently or leaning on railing, genuine warm smile, emerald green plants or green front door visible, bright airy natural light'
  },
  {
    id: 'kitchen-relief',
    label: 'Kitchen Table Moment',
    concept: 'Relief reviewing paperwork',
    keywords: 'homeowner at bright kitchen table with paperwork, expression of relief and satisfaction, mint green or white kitchen background, natural window light streaming in, coffee mug nearby, clean modern interior'
  },
  {
    id: 'couple-front-yard',
    label: 'Couple in Front Yard',
    concept: 'Happy couple with home',
    keywords: 'couple standing together in front yard, one wearing emerald green shirt, genuine happy expressions, well-maintained lawn, bright sunny day, suburban home in background'
  },
  {
    id: 'mailbox-good-news',
    label: 'Good News at Mailbox',
    concept: 'Positive news arrives',
    keywords: 'person at mailbox holding opened letter with pleasantly surprised smile, suburban street background, bright daylight, green landscaping visible, relatable everyday moment'
  },
  {
    id: 'living-room-laptop',
    label: 'Cozy Research Time',
    concept: 'Researching comfortably',
    keywords: 'person on couch with laptop in bright living room, houseplants adding green accents, engaged interested expression, large window with natural light, clean modern decor with white and mint tones'
  },
  {
    id: 'doorway-welcome',
    label: 'Welcoming Doorway',
    concept: 'Homeowner at front door',
    keywords: 'homeowner standing in open doorway, welcoming smile, emerald green front door or green potted plants at entrance, bright exterior light, inviting home entrance'
  },
  {
    id: 'backyard-relaxed',
    label: 'Backyard Ease',
    concept: 'Relaxed enjoying property',
    keywords: 'homeowner relaxed in backyard patio area, stress-free content expression, green lawn and plants surrounding, bright airy outdoor light, enjoying their home'
  },
  {
    id: 'phone-celebration',
    label: 'Great News Call',
    concept: 'Celebrating on phone',
    keywords: 'person on phone with delighted expression, standing in bright home interior with plants, natural happy gesture, clean background with green accent plant or decor'
  },
  {
    id: 'texas-home',
    label: 'Texas Home',
    concept: 'Texas setting',
    keywords: 'homeowner in front of Texas suburban home, modern architecture, warm golden light, blue sky, confident relaxed pose, green lawn, Texas neighborhood feel'
  },
  {
    id: 'california-home',
    label: 'California Home',
    concept: 'California setting',
    keywords: 'homeowner in front of California craftsman home, palm or succulent plants visible, bright sunshine, relaxed confident expression, well-landscaped with green plants'
  },
  {
    id: 'partner-handshake',
    label: 'Partnership Handshake',
    concept: 'Business partnership moment',
    keywords: 'two professionals shaking hands in bright modern office or home setting, warm genuine smiles, one person wearing emerald green, natural window light, clean professional but approachable atmosphere, successful collaboration feeling'
  },
  {
    id: 'agent-client-meeting',
    label: 'Agent & Client Meeting',
    concept: 'Professional consultation',
    keywords: 'real estate agent or advisor meeting with homeowner client at kitchen table, reviewing documents together, collaborative positive body language, bright natural light, professional but friendly interaction'
  },
  {
    id: 'family-home',
    label: 'Family at Home',
    concept: 'Family enjoying their home',
    keywords: 'family of three or four in bright living room, children playing, parents relaxed and happy, houseplants adding green accents, warm natural light through windows, authentic joyful moment'
  },
  {
    id: 'senior-homeowner',
    label: 'Senior Homeowner',
    concept: 'Experienced homeowner',
    keywords: 'senior homeowner aged 60-70 standing proudly in front of well-maintained home, warm smile, emerald green cardigan or plants nearby, bright natural light, sense of accomplishment and security'
  },
  {
    id: 'first-time-buyer',
    label: 'First-Time Buyer',
    concept: 'New homeowner excitement',
    keywords: 'young adult or couple holding keys excitedly in front of new home, genuine joy and pride, casual modern clothing with green accents, bright sunny day, milestone celebration moment'
  },
  {
    id: 'document-success',
    label: 'Paperwork Success',
    concept: 'Signing or reviewing documents',
    keywords: 'person at desk reviewing or signing important documents with satisfied expression, pen in hand, organized papers, bright home office with plant, natural window light, accomplishment feeling'
  },
  {
    id: 'neighborhood-walk',
    label: 'Neighborhood Stroll',
    concept: 'Walking through neighborhood',
    keywords: 'person or couple walking on sidewalk through beautiful suburban neighborhood, tree-lined street, well-maintained homes in background, bright sunny day, relaxed content expressions, sense of community'
  },
  {
    id: 'home-office',
    label: 'Home Office',
    concept: 'Working from home',
    keywords: 'person at clean modern home office desk with computer, productive focused expression, houseplant on desk, bright natural window light, organized space with mint or white tones'
  },
  {
    id: 'moving-day',
    label: 'Moving Day Joy',
    concept: 'New home move-in',
    keywords: 'person carrying moving box into new home with excited expression, open front door, bright daylight, green plants at entrance, fresh start feeling, casual comfortable clothing'
  },
  {
    id: 'curb-appeal',
    label: 'Admiring Curb Appeal',
    concept: 'Viewing home from street',
    keywords: 'homeowner standing at curb looking back at their beautiful home with pride, well-landscaped front yard, emerald green lawn, bright afternoon light, sense of ownership and satisfaction'
  },
  {
    id: 'coffee-morning',
    label: 'Morning Coffee',
    concept: 'Peaceful morning routine',
    keywords: 'person enjoying coffee on front porch or in bright kitchen, relaxed peaceful expression, morning light streaming in, houseplants visible, cozy comfortable feeling, starting the day right'
  },
  {
    id: 'diverse-homeowners',
    label: 'Diverse Neighbors',
    concept: 'Community diversity',
    keywords: 'diverse group of neighbors chatting friendly on suburban street, mixed ages and backgrounds, genuine warm smiles, green landscaping around, bright natural light, sense of community connection'
  },
  {
    id: 'thumbs-up-success',
    label: 'Success Thumbs Up',
    concept: 'Celebration gesture',
    keywords: 'homeowner giving enthusiastic thumbs up in front of home, big genuine smile, casual clothing with green accents, bright sunny day, celebratory confident energy, relatable victory moment'
  },
  // Educational / Guide Content Templates
  {
    id: 'document-discovery',
    label: 'Document Discovery',
    concept: 'Examining important paperwork',
    keywords: 'person at bright home office desk examining official documents with focused curious expression, reading glasses nearby, natural window light, organized papers spread out, discovering important information, professional but relatable'
  },
  {
    id: 'aha-moment',
    label: 'Aha Moment',
    concept: 'Surprising discovery',
    keywords: 'person looking at laptop screen or documents with pleasantly surprised expression, eyes widened slightly, hand gesture of realization, bright clean background, lightbulb moment feeling, discovering unexpected good news'
  },
  {
    id: 'expert-desk',
    label: 'Expert at Work',
    concept: 'Professional authority',
    keywords: 'professional person at organized modern desk with laptop and neatly arranged folders, confident knowledgeable expression, emerald green plant on desk, bright natural light, authoritative but approachable, comprehensive guide feeling'
  },
  {
    id: 'county-building',
    label: 'County Building',
    concept: 'Government office exterior',
    keywords: 'county assessor office or government building exterior, official but welcoming architecture, American flag visible, clear blue sky, well-maintained landscaping, approachable civic building, bright daylight'
  },
  {
    id: 'document-comparison',
    label: 'Comparison Analysis',
    concept: 'Side-by-side review',
    keywords: 'overhead view of desk with two documents side by side, red pen for annotations, hands pointing at key differences, organized comparison layout, bright even lighting, analytical review process'
  },
  {
    id: 'research-session',
    label: 'Research Deep Dive',
    concept: 'Thorough investigation',
    keywords: 'person engaged with laptop surrounded by reference documents and notes, focused determined expression, coffee cup nearby, houseplant adding green accent, natural light from window, comprehensive research in progress'
  },
  {
    id: 'pointing-at-data',
    label: 'Key Finding',
    concept: 'Highlighting important info',
    keywords: 'close-up of hand pointing at specific line on printed document or screen, important data highlighted, sharp focus on the key information, clean professional setting, decisive moment of identification'
  },
  {
    id: 'calculator-review',
    label: 'Number Crunching',
    concept: 'Financial analysis',
    keywords: 'person reviewing numbers with calculator and documents on bright desk, thoughtful concentrated expression, neat organized workspace, natural light, making sense of financial data, emerald green accent item visible'
  },
];

// Conceptual topic templates - sophisticated editorial visuals (no cheesy stock elements)
const CONCEPTUAL_TEMPLATES = [
  {
    id: 'neighborhood-aerial',
    label: 'Neighborhood Aerial',
    concept: 'Birds-eye view of community',
    keywords: 'stunning aerial drone photograph of suburban neighborhood at golden hour, tree-lined streets, well-maintained homes, sense of community and value, warm natural lighting'
  },
  {
    id: 'home-exterior-detail',
    label: 'Architectural Detail',
    concept: 'Focus on home craftsmanship',
    keywords: 'close-up architectural detail of beautiful home exterior, front door with character, quality craftmanship, warm inviting light, shallow depth of field, editorial real estate photography'
  },
  {
    id: 'street-perspective',
    label: 'Street Scene',
    concept: 'Neighborhood street view',
    keywords: 'charming residential street with mature trees, dappled sunlight, mix of home styles, peaceful suburban atmosphere, magazine-quality real estate photography'
  },
  {
    id: 'window-light',
    label: 'Home Interior Light',
    concept: 'Warm interior moment',
    keywords: 'beautiful natural light streaming through home window, cozy interior space, sense of comfort and security, soft warm tones, lifestyle interior photography'
  },
  {
    id: 'front-yard-morning',
    label: 'Morning Curb Appeal',
    concept: 'Home at its best',
    keywords: 'pristine home exterior in soft morning light, manicured lawn with dew, fresh and optimistic feeling, real estate photography style, no people'
  },
  {
    id: 'texas-landscape',
    label: 'Texas Setting',
    concept: 'Texas residential context',
    keywords: 'Texas suburban home with characteristic architecture, big sky, warm golden light, native landscaping, authentic Texas residential neighborhood feel'
  },
  {
    id: 'california-landscape',
    label: 'California Setting',
    concept: 'California residential context',
    keywords: 'California home with distinctive architecture, palm trees or drought-resistant landscaping, bright blue sky, Mediterranean or craftsman style, authentic California residential feel'
  },
  {
    id: 'seasonal-home',
    label: 'Seasonal Beauty',
    concept: 'Home through seasons',
    keywords: 'beautiful home exterior with seasonal elements, spring blooms or autumn colors, natural beauty enhancing property value, editorial lifestyle photography'
  },
];

// Helper to get the right templates based on style
const getTopicTemplates = (styleId: string) => {
  const style = STYLE_PRESETS.find(s => s.id === styleId);
  return style?.isPhotorealistic ? PHOTOREALISTIC_TEMPLATES : CONCEPTUAL_TEMPLATES;
};

// LADBible-style story graphic presets
const STORY_FORMATS = [
  { id: 'vertical', label: 'Vertical (9:16)', dimensions: '1080x1920', width: 1080, height: 1920, description: 'Instagram Stories, TikTok, Reels' },
  { id: 'square', label: 'Square (1:1)', dimensions: '1080x1080', width: 1080, height: 1080, description: 'Instagram Feed, Facebook' },
  { id: 'landscape', label: 'Landscape (16:9)', dimensions: '1920x1080', width: 1920, height: 1080, description: 'Twitter, LinkedIn, YouTube thumbnails' },
];

// Pre-made headline hook templates
const HEADLINE_HOOKS = [
  { id: 'full-list', template: 'FULL LIST OF {number} {subject} {action}', example: 'FULL LIST OF 59 CARS FACING £5,690 CAR TAX THIS YEAR FOLLOWING INCREASE' },
  { id: 'woman-man-update', template: '{person} ISSUES UPDATE AFTER {event}', example: 'WOMAN ISSUES UPDATE AFTER BEING STUNNED AT ROYAL MAIL LETTER WHEN MCDONALD\'S MONOPOLY PRIZE ARRIVED' },
  { id: 'shocking', template: '{person} {action} OVER {reason}', example: 'PENSIONER EVICTED FROM £420K HOME OVER 1FT STRIP OF LAND' },
  { id: 'warning', template: 'WARNING TO ALL {audience} AS {event}', example: 'WARNING TO ALL HOMEOWNERS AS PROPERTY TAX DEADLINE APPROACHES' },
  { id: 'breaking', template: 'BREAKING: {event} {consequence}', example: 'BREAKING: CALIFORNIA LOSES FEDERAL FUNDING - WHAT IT MEANS FOR YOUR TAXES' },
  { id: 'how-much', template: 'HOW MUCH {subject} WILL ACTUALLY {action}', example: 'HOW MUCH YOUR PROPERTY TAXES WILL ACTUALLY INCREASE IN 2026' },
  { id: 'revealed', template: '{subject} REVEALED AS {revelation}', example: 'TRUE COST OF PROPERTY TAX ERRORS REVEALED AS HOMEOWNERS OVERPAY BILLIONS' },
  { id: 'why', template: 'WHY YOUR {subject} {action} (EVEN {exception})', example: 'WHY YOUR PROPERTY TAXES WENT UP 10% (EVEN WITH THE HOMESTEAD CAP)' },
];

type StudioMode = 'ai-generator' | 'story-graphics';

export function BlogImageGenerator({ brands = [], onSaveImage, onNavigate }: BlogImageGeneratorProps) {
  // Studio mode toggle
  const [studioMode, setStudioMode] = useState<StudioMode>('ai-generator');

  // Story Graphics state
  const [storyFormat, setStoryFormat] = useState(STORY_FORMATS[0]);
  const [storyBackgroundUrl, setStoryBackgroundUrl] = useState<string>('');
  const [storyHeadline, setStoryHeadline] = useState('');
  const [storyInsetUrl, setStoryInsetUrl] = useState<string>('');
  const [storyLogoUrl, setStoryLogoUrl] = useState<string>('/logos/taxdrop-stacked-white.png');
  const [storyGradientOpacity, setStoryGradientOpacity] = useState(70);
  const [storyTextSize, setStoryTextSize] = useState(5); // percentage of canvas height
  const [storyInsetSize, setStoryInsetSize] = useState(25); // percentage of canvas width
  const [storyInsetX, setStoryInsetX] = useState(80); // percentage position
  const [storyInsetY, setStoryInsetY] = useState(55); // percentage position
  const [generatingStory, setGeneratingStory] = useState(false);
  const [storyPreviewUrl, setStoryPreviewUrl] = useState<string>('');
  const [isDraggingStoryInset, setIsDraggingStoryInset] = useState(false);
  // AI generation for story graphics
  const [bgPrompt, setBgPrompt] = useState('');
  const [insetPrompt, setInsetPrompt] = useState('');
  const [generatingBg, setGeneratingBg] = useState(false);
  const [generatingInset, setGeneratingInset] = useState(false);
  const [bgInputMode, setBgInputMode] = useState<'upload' | 'generate'>('upload');
  const [insetInputMode, setInsetInputMode] = useState<'upload' | 'generate'>('upload');
  const [title, setTitle] = useState('');
  const [imageType, setImageType] = useState<ImageTypeOption>(IMAGE_TYPES[0]);
  const [stylePreset, setStylePreset] = useState(STYLE_PRESETS[0]);
  const [topic, setTopic] = useState(getTopicTemplates(STYLE_PRESETS[0].id)[0]);
  const [negativePrompt, setNegativePrompt] = useState('text, words, letters, numbers, watermark, logo, brand name, branded clothing, branded apron, branded merchandise, company name, signage with text, writing on clothing, printed text on any surface, advertisement, promotional material, blurry, low quality, distorted, generic stock photo, cliche imagery, cluttered composition, multiple focal points, cartoonish, amateur, overexposed, underexposed, artificial looking, plastic texture, unrealistic lighting, deformed hands, extra fingers, mutated faces');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  // Advanced styling options (for photorealistic styles)
  const [lightingPreset, setLightingPreset] = useState(LIGHTING_PRESETS[0]);
  const [colorGrading, setColorGrading] = useState(COLOR_GRADING_PRESETS[2]); // Default to emerald brand
  const [moodPreset, setMoodPreset] = useState(MOOD_PRESETS[0]);
  const [showAdvancedStyling, setShowAdvancedStyling] = useState(false);

  // Editable prompt state
  const [editedPrompt, setEditedPrompt] = useState('');
  const [promptManuallyEdited, setPromptManuallyEdited] = useState(false);

  // Logo overlay options
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoX, setLogoX] = useState(85); // percentage from left (0-100)
  const [logoY, setLogoY] = useState(85); // percentage from top (0-100)
  const [logoSize, setLogoSize] = useState(15); // percentage of image width
  const [logoOpacity, setLogoOpacity] = useState(90); // percentage

  // Text overlay options
  const [textOverlay, setTextOverlay] = useState('');
  const [textX, setTextX] = useState(50); // percentage from left (0-100), center of text
  const [textY, setTextY] = useState(85); // percentage from top (0-100)
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textSize, setTextSize] = useState(5); // percentage of image height
  const [textFont, setTextFont] = useState<'space-grotesk' | 'inter' | 'georgia' | 'system'>('space-grotesk');
  const [textBackground, setTextBackground] = useState(true);
  const [textBackgroundColor, setTextBackgroundColor] = useState('#000000');
  const [textBackgroundOpacity, setTextBackgroundOpacity] = useState(50);

  // Preview state
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isResizingLogo, setIsResizingLogo] = useState(false);
  const [isResizingText, setIsResizingText] = useState(false);
  const [resizeStartData, setResizeStartData] = useState<{ startX: number; startY: number; startSize: number } | null>(null);

  // Text wrapping option
  const [textWrap, setTextWrap] = useState(true);

  // Generation state
  const [selectedModel, setSelectedModel] = useState<ImageModel>('google/gemini-3-pro-image-preview');
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<StoredBlogImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState<{ count: number; estimatedSize: string } | null>(null);

  // Load saved images from IndexedDB on mount
  useEffect(() => {
    const loadImages = async () => {
      try {
        // First migrate any legacy localStorage images
        await migrateBlogImagesFromLocalStorage();

        // Load all images from IndexedDB
        const images = await getAllBlogImages();
        setGeneratedImages(images);

        // Update storage stats
        const stats = await getBlogStorageStats();
        setStorageStats(stats);
      } catch (err) {
        console.error('Failed to load saved images:', err);
      }
    };

    loadImages();
  }, []);

  // Update storage stats helper
  const updateStorageStats = async () => {
    try {
      const stats = await getBlogStorageStats();
      setStorageStats(stats);
    } catch (err) {
      console.error('Failed to update storage stats:', err);
    }
  };

  useEffect(() => {
    const settings = getOpenRouterSettings();
    if (settings.defaultModel) {
      setSelectedModel(settings.defaultModel);
    }
  }, []);

  // Delete a saved image
  const handleDeleteImage = async (id: string) => {
    if (confirm('Delete this image?')) {
      try {
        await deleteBlogImage(id);
        setGeneratedImages(prev => prev.filter(img => img.id !== id));
        await updateStorageStats();
      } catch (err) {
        console.error('Failed to delete image:', err);
      }
    }
  };

  // Clear all saved images
  const handleClearAllImages = async () => {
    if (confirm('Delete all saved images? This cannot be undone.')) {
      try {
        await clearAllBlogImages();
        setGeneratedImages([]);
        await updateStorageStats();
      } catch (err) {
        console.error('Failed to clear images:', err);
      }
    }
  };

  const buildPrompt = (): string => {
    const brand = brands.find(b => b.id === selectedBrand);
    let brandStyle = '';
    if (brand && brand.styleGuides.length > 0) {
      const guide = brand.styleGuides[0];
      brandStyle = `Brand style: ${guide.artStyle}, ${guide.lightingStyle}`;
    }

    // Build a structured, editorial-quality prompt
    const promptParts: string[] = [];

    // 1. Core visual concept - be specific about what to show
    if (title) {
      promptParts.push(`Create a sophisticated editorial hero image for an article titled "${title}".`);
    } else {
      promptParts.push('Create a sophisticated editorial hero image for a professional finance publication.');
    }

    // 2. Visual approach from topic
    promptParts.push(`Visual concept: ${topic.keywords}.`);

    // 3. Style direction
    promptParts.push(`Style: ${stylePreset.suffix}.`);

    // 4. Advanced styling for photorealistic styles (skip for brand styles - they're comprehensive)
    if (stylePreset.isPhotorealistic && showAdvancedStyling && !stylePreset.isBrandStyle) {
      promptParts.push(`Lighting: ${lightingPreset.suffix}.`);
      promptParts.push(`Color: ${colorGrading.suffix}.`);
      promptParts.push(`Mood: ${moodPreset.suffix}.`);
    }

    // 5. Brand if specified
    if (brandStyle) {
      promptParts.push(brandStyle);
    }

    // 6. Technical requirements for quality
    promptParts.push('Technical: Single strong focal point, deliberate composition with rule of thirds, professional color grading, cinematic depth of field, shot at eye level or slightly below for empowering perspective.');

    // 7. Quality markers
    promptParts.push('Render in ultra high quality, 8K resolution, sharp focus, professional photography quality, no artificial elements.');

    // 8. Aspect ratio
    promptParts.push(`Aspect ratio: ${imageType.aspectRatio}.`);

    return promptParts.join(' ');
  };

  const generatedPrompt = buildPrompt();

  // Sync editedPrompt with generated prompt when inputs change (unless manually edited)
  useEffect(() => {
    if (!promptManuallyEdited) {
      setEditedPrompt(generatedPrompt);
    }
  }, [generatedPrompt, promptManuallyEdited]);

  const handlePromptChange = (value: string) => {
    setEditedPrompt(value);
    setPromptManuallyEdited(true);
  };

  const handleResetPrompt = () => {
    setEditedPrompt(generatedPrompt);
    setPromptManuallyEdited(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async () => {
    if (!editedPrompt) return;

    setGenerating(true);
    setError(null);

    try {
      // Map aspect ratio to OpenRouter format
      const aspectMap: Record<string, '1:1' | '16:9' | '9:16'> = {
        '16:9': '16:9',
        '1:1': '1:1',
        '4:3': '16:9', // Closest available
        '1.91:1': '16:9', // Closest available
        '9:16': '9:16',
      };

      const image = await generateImage({
        model: selectedModel,
        prompt: editedPrompt,
        negativePrompt: negativePrompt || undefined,
        aspectRatio: aspectMap[imageType.aspectRatio],
      });

      // Save to IndexedDB
      const storedImage = await saveBlogImage({
        url: image.url,
        title: title || 'Untitled',
        type: imageType.id,
        prompt: image.prompt,
      });

      setGeneratedImages(prev => [storedImage, ...prev]);
      await updateStorageStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = (img: StoredBlogImage) => {
    if (!onSaveImage) return;

    const blogImage: BlogImage = {
      id: img.id,
      title: img.title,
      type: img.type as BlogImageType,
      prompt: img.prompt || '',
      imageUrl: img.url,
      aspectRatio: imageType.aspectRatio,
      brandId: selectedBrand || undefined,
      tags: [],
      createdAt: new Date(img.createdAt).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveImage(blogImage);
  };

  const handleDownload = async (img: StoredBlogImage, filename: string) => {
    const downloadFilename = `${filename.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.png`;
    const hasOverlays = !!(logoDataUrl || textOverlay.trim());

    // Set loading state for this image
    const imgId = img.url.slice(-20); // Use last 20 chars of URL as ID
    setDownloadingId(imgId);

    // If no logo and no text, download directly
    if (!hasOverlays) {
      const link = document.createElement('a');
      link.href = img.url;
      link.download = downloadFilename;
      link.click();
      setDownloadingId(null);
      return;
    }

    // Composite overlays onto image using Canvas
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Load the main image - need to convert to data URL to avoid CORS issues with canvas export
      let imageDataUrl: string;

      if (img.url.startsWith('data:')) {
        // Already a data URL, use directly
        imageDataUrl = img.url;
      } else {
        // Try to fetch and convert to data URL
        try {
          const response = await fetch(img.url, { mode: 'cors' });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const blob = await response.blob();
          imageDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read blob'));
            reader.readAsDataURL(blob);
          });
        } catch (fetchErr) {
          // CORS blocked - try using a hidden image with crossOrigin attribute
          // This works if the server sends proper CORS headers
          console.warn('Fetch blocked, trying crossOrigin approach:', fetchErr);

          try {
            const tempImg = new Image();
            tempImg.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
              tempImg.onload = () => resolve();
              tempImg.onerror = () => reject(new Error('CORS image load failed'));
              tempImg.src = img.url;
            });

            // Draw to temp canvas and export
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = tempImg.width;
            tempCanvas.height = tempImg.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) throw new Error('Could not get temp canvas context');
            tempCtx.drawImage(tempImg, 0, 0);
            imageDataUrl = tempCanvas.toDataURL('image/png');
          } catch (corsErr) {
            throw new Error(
              'Cannot add overlays to this image due to CORS restrictions. ' +
              'The image server does not allow cross-origin processing. ' +
              'Try downloading the image first, then re-uploading it, or use the image without overlays.'
            );
          }
        }
      }

      const mainImg = new Image();
      await new Promise<void>((resolve, reject) => {
        mainImg.onload = () => resolve();
        mainImg.onerror = () => reject(new Error('Failed to load converted image'));
        mainImg.src = imageDataUrl;
      });

      canvas.width = mainImg.width;
      canvas.height = mainImg.height;
      ctx.drawImage(mainImg, 0, 0);

      // Test that canvas isn't tainted
      try {
        canvas.toDataURL();
      } catch (taintErr) {
        throw new Error('Canvas is tainted - cannot export with overlays');
      }

      // Draw text overlay if present
      if (textOverlay.trim()) {
        const fontSize = (textSize / 100) * canvas.height;
        const padding = fontSize * 0.5;
        const lineHeight = fontSize * 1.3;

        // Set font
        const fontFamily = {
          'space-grotesk': '"Space Grotesk", sans-serif',
          'inter': '"Inter", sans-serif',
          'georgia': 'Georgia, serif',
          'system': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }[textFont];
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.textAlign = textAlign;

        // Word wrap text
        const maxWidth = canvas.width - padding * 4;
        const words = textOverlay.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        // Calculate text block height
        const textBlockHeight = lines.length * lineHeight + padding * 2;

        // Calculate position from percentages
        // textY is the center of the text block
        const textYPos = (textY / 100) * canvas.height - textBlockHeight / 2;
        const textXPos = (textX / 100) * canvas.width;

        // Draw background if enabled
        if (textBackground) {
          ctx.fillStyle = textBackgroundColor;
          ctx.globalAlpha = textBackgroundOpacity / 100;
          // Background spans full width for cleaner look
          ctx.fillRect(0, textYPos, canvas.width, textBlockHeight);
          ctx.globalAlpha = 1;
        }

        // Draw text
        ctx.fillStyle = textColor;
        // Adjust X based on alignment
        let drawX = textXPos;
        if (textAlign === 'left') drawX = padding * 2;
        if (textAlign === 'right') drawX = canvas.width - padding * 2;

        lines.forEach((line, i) => {
          ctx.fillText(line, drawX, textYPos + padding + fontSize + i * lineHeight);
        });
      }

      // Draw logo if present
      if (logoDataUrl) {
        const logoImg = new Image();
        await new Promise<void>((resolve, reject) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => reject(new Error('Failed to load logo'));
          logoImg.src = logoDataUrl;
        });

        // Calculate logo dimensions
        const logoWidth = (logoSize / 100) * canvas.width;
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;

        // Calculate position from percentages (logoX/logoY are center points)
        const x = (logoX / 100) * canvas.width - logoWidth / 2;
        const y = (logoY / 100) * canvas.height - logoHeight / 2;

        // Draw logo with opacity
        ctx.globalAlpha = logoOpacity / 100;
        ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);
        ctx.globalAlpha = 1;
      }

      // Download the composited image
      const finalDataUrl = canvas.toDataURL('image/png');
      if (!finalDataUrl || finalDataUrl === 'data:,') {
        throw new Error('Canvas export produced empty result');
      }

      const link = document.createElement('a');
      link.href = finalDataUrl;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('Download with overlays successful');
      setDownloadingId(null);
    } catch (err) {
      console.error('Error compositing overlays:', err);
      setDownloadingId(null);

      // Show detailed error and offer fallback
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const shouldDownloadWithout = window.confirm(
        `Could not add overlays to image.\n\nError: ${errorMessage}\n\nWould you like to download the image without overlays instead?`
      );

      if (shouldDownloadWithout) {
        const link = document.createElement('a');
        link.href = img.url;
        link.download = downloadFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  // Story Graphics handlers
  const handleStoryBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setStoryBackgroundUrl(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStoryInsetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setStoryInsetUrl(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // AI generate background image
  const handleGenerateBackground = async () => {
    if (!bgPrompt.trim() || !hasApiKey()) return;
    setGeneratingBg(true);
    setError(null);
    try {
      const aspectMap: Record<string, '16:9' | '1:1' | '9:16'> = {
        'vertical': '9:16',
        'square': '1:1',
        'landscape': '16:9',
      };
      const fullPrompt = `${bgPrompt}. Photorealistic, high quality, professional photography, no text, no watermarks, suitable as news story background.`;
      const image = await generateImage({
        model: selectedModel,
        prompt: fullPrompt,
        aspectRatio: aspectMap[storyFormat.id] || '16:9',
      });
      setStoryBackgroundUrl(image.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate background');
    } finally {
      setGeneratingBg(false);
    }
  };

  // AI generate inset image
  const handleGenerateInset = async () => {
    if (!insetPrompt.trim() || !hasApiKey()) return;
    setGeneratingInset(true);
    setError(null);
    try {
      const fullPrompt = `${insetPrompt}. Photorealistic, high quality, professional photography, no text, no watermarks, square composition, suitable for circular crop.`;
      const image = await generateImage({
        model: selectedModel,
        prompt: fullPrompt,
        aspectRatio: '1:1',
      });
      setStoryInsetUrl(image.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate inset image');
    } finally {
      setGeneratingInset(false);
    }
  };

  const generateStoryGraphic = async () => {
    if (!storyBackgroundUrl || !storyHeadline.trim()) return;

    setGeneratingStory(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      canvas.width = storyFormat.width;
      canvas.height = storyFormat.height;

      // Load and draw background
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        bgImg.onload = () => resolve();
        bgImg.onerror = () => reject(new Error('Failed to load background'));
        bgImg.src = storyBackgroundUrl;
      });

      // Cover the canvas with the background
      const bgRatio = bgImg.width / bgImg.height;
      const canvasRatio = canvas.width / canvas.height;
      let drawWidth, drawHeight, drawX, drawY;

      if (bgRatio > canvasRatio) {
        drawHeight = canvas.height;
        drawWidth = drawHeight * bgRatio;
        drawX = (canvas.width - drawWidth) / 2;
        drawY = 0;
      } else {
        drawWidth = canvas.width;
        drawHeight = drawWidth / bgRatio;
        drawX = 0;
        drawY = (canvas.height - drawHeight) / 2;
      }
      ctx.drawImage(bgImg, drawX, drawY, drawWidth, drawHeight);

      // Draw gradient overlay at bottom
      const gradientHeight = canvas.height * 0.5;
      const gradient = ctx.createLinearGradient(0, canvas.height - gradientHeight, 0, canvas.height);
      gradient.addColorStop(0, `rgba(0, 0, 0, 0)`);
      gradient.addColorStop(0.4, `rgba(0, 0, 0, ${storyGradientOpacity / 100 * 0.5})`);
      gradient.addColorStop(1, `rgba(0, 0, 0, ${storyGradientOpacity / 100})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, canvas.height - gradientHeight, canvas.width, gradientHeight);

      // Draw inset circular image if present
      if (storyInsetUrl) {
        const insetImg = new Image();
        insetImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          insetImg.onload = () => resolve();
          insetImg.onerror = () => reject(new Error('Failed to load inset image'));
          insetImg.src = storyInsetUrl;
        });

        const insetDiameter = (storyInsetSize / 100) * canvas.width;
        const insetX = (storyInsetX / 100) * canvas.width;
        const insetY = (storyInsetY / 100) * canvas.height;

        // Draw white border circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(insetX, insetY, insetDiameter / 2 + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();

        // Clip to circle and draw inset image
        ctx.beginPath();
        ctx.arc(insetX, insetY, insetDiameter / 2, 0, Math.PI * 2);
        ctx.clip();

        // Cover the circle with the inset image
        const insetRatio = insetImg.width / insetImg.height;
        let iDrawWidth, iDrawHeight, iDrawX, iDrawY;
        if (insetRatio > 1) {
          iDrawHeight = insetDiameter;
          iDrawWidth = iDrawHeight * insetRatio;
          iDrawX = insetX - iDrawWidth / 2;
          iDrawY = insetY - iDrawHeight / 2;
        } else {
          iDrawWidth = insetDiameter;
          iDrawHeight = iDrawWidth / insetRatio;
          iDrawX = insetX - iDrawWidth / 2;
          iDrawY = insetY - iDrawHeight / 2;
        }
        ctx.drawImage(insetImg, iDrawX, iDrawY, iDrawWidth, iDrawHeight);
        ctx.restore();
      }

      // Draw logo if present
      if (storyLogoUrl) {
        try {
          const logoImg = new Image();
          logoImg.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            logoImg.onload = () => resolve();
            logoImg.onerror = () => reject(new Error('Failed to load logo'));
            logoImg.src = storyLogoUrl;
          });

          const logoWidth = canvas.width * 0.15;
          const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
          const logoX = canvas.width - logoWidth - 30;
          const logoY = 30;

          ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
        } catch {
          // Logo failed to load, continue without it
        }
      }

      // Draw headline text - LADBible style (bold white, all caps)
      const fontSize = (storyTextSize / 100) * canvas.height;
      ctx.font = `900 ${fontSize}px "Impact", "Arial Black", sans-serif`;
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      // Word wrap the headline
      const maxWidth = canvas.width - 60;
      const words = storyHeadline.toUpperCase().split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      // Draw text with slight shadow for readability
      const lineHeight = fontSize * 1.1;
      const textStartY = canvas.height - 40 - (lines.length - 1) * lineHeight;

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      lines.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2 + 3, textStartY + i * lineHeight + 3);
      });

      // Main text
      ctx.fillStyle = 'white';
      lines.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, textStartY + i * lineHeight);
      });

      // Set preview
      setStoryPreviewUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error('Failed to generate story graphic:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate story graphic');
    } finally {
      setGeneratingStory(false);
    }
  };

  const handleDownloadStory = () => {
    if (!storyPreviewUrl) return;
    const link = document.createElement('a');
    link.href = storyPreviewUrl;
    link.download = `story-graphic-${storyFormat.id}-${Date.now()}.png`;
    link.click();
  };

  const apiKeyConfigured = hasApiKey();

  return (
    <div>
      {/* Studio Mode Toggle */}
      <div className="card mb-lg">
        <div className="card-body" style={{ padding: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              className={`btn ${studioMode === 'ai-generator' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStudioMode('ai-generator')}
              style={{ flex: 1 }}
            >
              AI Image Generator
            </button>
            <button
              className={`btn ${studioMode === 'story-graphics' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStudioMode('story-graphics')}
              style={{ flex: 1 }}
            >
              Story Graphics (LADBible Style)
            </button>
          </div>
        </div>
      </div>

      {/* Story Graphics Mode */}
      {studioMode === 'story-graphics' && (
        <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
          {/* Left: Live Preview */}
          <div style={{ flex: '0 0 400px' }}>
            <div className="card" style={{ position: 'sticky', top: 'var(--spacing-md)' }}>
              <div className="card-header">
                <h4>Live Preview</h4>
                <span className="text-xs text-gray">Drag the inset to position</span>
              </div>
              <div className="card-body" style={{ padding: 'var(--spacing-sm)', background: '#1a1a1a' }}>
                {storyBackgroundUrl ? (
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: storyFormat.id === 'vertical' ? '9/16' : storyFormat.id === 'square' ? '1/1' : '16/9',
                      overflow: 'hidden',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    onMouseMove={(e) => {
                      if (!isDraggingStoryInset) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      setStoryInsetX(Math.max(10, Math.min(90, x)));
                      setStoryInsetY(Math.max(10, Math.min(90, y)));
                    }}
                    onMouseUp={() => setIsDraggingStoryInset(false)}
                    onMouseLeave={() => setIsDraggingStoryInset(false)}
                  >
                    {/* Background */}
                    <img
                      src={storyBackgroundUrl}
                      alt="Background"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      draggable={false}
                    />

                    {/* Gradient overlay */}
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '50%',
                      background: `linear-gradient(to bottom, transparent 0%, rgba(0,0,0,${storyGradientOpacity / 100}) 100%)`,
                      pointerEvents: 'none',
                    }} />

                    {/* Headline text */}
                    {storyHeadline && (
                      <div style={{
                        position: 'absolute',
                        bottom: '5%',
                        left: '5%',
                        right: '5%',
                        color: 'white',
                        fontFamily: 'Impact, "Arial Black", sans-serif',
                        fontSize: `${storyTextSize * 2.5}px`,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                        lineHeight: 1.1,
                        pointerEvents: 'none',
                      }}>
                        {storyHeadline}
                      </div>
                    )}

                    {/* Inset image - draggable */}
                    {storyInsetUrl && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${storyInsetX}%`,
                          top: `${storyInsetY}%`,
                          transform: 'translate(-50%, -50%)',
                          width: `${storyInsetSize}%`,
                          aspectRatio: '1/1',
                          borderRadius: '50%',
                          border: '4px solid white',
                          overflow: 'hidden',
                          cursor: isDraggingStoryInset ? 'grabbing' : 'grab',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setIsDraggingStoryInset(true);
                        }}
                      >
                        <img
                          src={storyInsetUrl}
                          alt="Inset"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          draggable={false}
                        />
                      </div>
                    )}

                    {/* Logo placeholder */}
                    {storyLogoUrl && (
                      <div style={{
                        position: 'absolute',
                        top: '3%',
                        right: '3%',
                        width: '15%',
                        pointerEvents: 'none',
                      }}>
                        <img src={storyLogoUrl} alt="Logo" style={{ width: '100%' }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    aspectRatio: storyFormat.id === 'vertical' ? '9/16' : storyFormat.id === 'square' ? '1/1' : '16/9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#2a2a2a',
                    borderRadius: 'var(--radius-sm)',
                    color: '#666',
                    fontSize: '14px',
                  }}>
                    Upload a background image
                  </div>
                )}
              </div>
              <div className="card-body" style={{ borderTop: '1px solid #E5E7EB' }}>
                <button
                  className="btn btn-primary"
                  onClick={generateStoryGraphic}
                  disabled={generatingStory || !storyBackgroundUrl || !storyHeadline.trim()}
                  style={{ width: '100%', marginBottom: 'var(--spacing-sm)' }}
                >
                  {generatingStory ? 'Generating...' : 'Generate Final Image'}
                </button>
                {storyPreviewUrl && (
                  <button className="btn btn-secondary" onClick={handleDownloadStory} style={{ width: '100%' }}>
                    <DownloadIcon /> Download
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div style={{ flex: 1 }}>
            {/* Format Selection */}
            <div className="card mb-md">
              <div className="card-header">
                <h4>Format</h4>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                  {STORY_FORMATS.map(format => (
                    <button
                      key={format.id}
                      onClick={() => setStoryFormat(format)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: storyFormat.id === format.id ? '2px solid var(--td-emerald-dark)' : '1px solid #E5E7EB',
                        borderRadius: 'var(--radius-sm)',
                        background: storyFormat.id === format.id ? 'var(--td-mint)' : 'white',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      <div className="font-medium">{format.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Background Image */}
            <div className="card mb-md">
              <div className="card-header">
                <h4>Background Image</h4>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setBgInputMode('upload')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      border: bgInputMode === 'upload' ? '1px solid var(--td-emerald-dark)' : '1px solid #ddd',
                      borderRadius: '4px',
                      background: bgInputMode === 'upload' ? 'var(--td-mint)' : 'white',
                      cursor: 'pointer',
                    }}
                  >
                    Upload
                  </button>
                  <button
                    onClick={() => setBgInputMode('generate')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      border: bgInputMode === 'generate' ? '1px solid var(--td-emerald-dark)' : '1px solid #ddd',
                      borderRadius: '4px',
                      background: bgInputMode === 'generate' ? 'var(--td-mint)' : 'white',
                      cursor: 'pointer',
                    }}
                  >
                    AI Generate
                  </button>
                </div>
              </div>
              <div className="card-body">
                {bgInputMode === 'upload' ? (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleStoryBackgroundUpload}
                    style={{ width: '100%' }}
                  />
                ) : (
                  <div>
                    <textarea
                      className="form-textarea"
                      value={bgPrompt}
                      onChange={(e) => setBgPrompt(e.target.value)}
                      rows={2}
                      placeholder="Describe the background image... e.g., 'Aerial view of suburban neighborhood with houses'"
                      style={{ fontSize: '13px', marginBottom: '8px' }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleGenerateBackground}
                      disabled={generatingBg || !bgPrompt.trim() || !hasApiKey()}
                      style={{ width: '100%' }}
                    >
                      {generatingBg ? 'Generating...' : 'Generate Background'}
                    </button>
                    {!hasApiKey() && (
                      <p className="text-xs text-gray" style={{ marginTop: '4px' }}>Add OpenRouter API key in Settings</p>
                    )}
                  </div>
                )}
                {storyBackgroundUrl && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '4px', overflow: 'hidden', border: '1px solid #ddd' }}>
                      <img src={storyBackgroundUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <span className="text-xs text-gray">Background loaded</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setStoryBackgroundUrl('')}
                      style={{ marginLeft: 'auto', color: 'var(--color-error)', padding: '2px 6px' }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Inset Image */}
            <div className="card mb-md">
              <div className="card-header">
                <h4>Circular Inset</h4>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setInsetInputMode('upload')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      border: insetInputMode === 'upload' ? '1px solid var(--td-emerald-dark)' : '1px solid #ddd',
                      borderRadius: '4px',
                      background: insetInputMode === 'upload' ? 'var(--td-mint)' : 'white',
                      cursor: 'pointer',
                    }}
                  >
                    Upload
                  </button>
                  <button
                    onClick={() => setInsetInputMode('generate')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      border: insetInputMode === 'generate' ? '1px solid var(--td-emerald-dark)' : '1px solid #ddd',
                      borderRadius: '4px',
                      background: insetInputMode === 'generate' ? 'var(--td-mint)' : 'white',
                      cursor: 'pointer',
                    }}
                  >
                    AI Generate
                  </button>
                </div>
              </div>
              <div className="card-body">
                <p className="text-xs text-gray" style={{ marginBottom: '8px' }}>Drag the inset in the preview to position it</p>
                {insetInputMode === 'upload' ? (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleStoryInsetUpload}
                    style={{ width: '100%' }}
                  />
                ) : (
                  <div>
                    <textarea
                      className="form-textarea"
                      value={insetPrompt}
                      onChange={(e) => setInsetPrompt(e.target.value)}
                      rows={2}
                      placeholder="Describe the inset image... e.g., 'Stack of money and coins on table'"
                      style={{ fontSize: '13px', marginBottom: '8px' }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleGenerateInset}
                      disabled={generatingInset || !insetPrompt.trim() || !hasApiKey()}
                      style={{ width: '100%' }}
                    >
                      {generatingInset ? 'Generating...' : 'Generate Inset'}
                    </button>
                  </div>
                )}
                {storyInsetUrl && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                        <img src={storyInsetUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span className="text-xs text-gray">Inset loaded</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setStoryInsetUrl('')}
                        style={{ marginLeft: 'auto', color: 'var(--color-error)', padding: '2px 6px' }}
                      >
                        ×
                      </button>
                    </div>
                    <label className="form-label text-xs">Size: {storyInsetSize}%</label>
                    <input type="range" min="15" max="40" value={storyInsetSize} onChange={(e) => setStoryInsetSize(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                )}
              </div>
            </div>

            {/* Headline */}
            <div className="card mb-md">
              <div className="card-header">
                <h4>Headline</h4>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <textarea
                    className="form-textarea"
                    value={storyHeadline}
                    onChange={(e) => setStoryHeadline(e.target.value)}
                    rows={3}
                    placeholder="TYPE YOUR HEADLINE HERE..."
                    style={{
                      textTransform: 'uppercase',
                      fontWeight: 'bold',
                      fontFamily: 'Impact, "Arial Black", sans-serif',
                      fontSize: '16px',
                    }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label text-xs">Text Size: {storyTextSize}</label>
                  <input
                    type="range"
                    min="3"
                    max="8"
                    step="0.5"
                    value={storyTextSize}
                    onChange={(e) => setStoryTextSize(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

            {/* Style */}
            <div className="card mb-md">
              <div className="card-header">
                <h4>Style</h4>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label text-xs">Gradient Darkness: {storyGradientOpacity}%</label>
                  <input
                    type="range"
                    min="30"
                    max="95"
                    value={storyGradientOpacity}
                    onChange={(e) => setStoryGradientOpacity(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Logo</label>
                  <select
                    className="form-select"
                    value={storyLogoUrl}
                    onChange={(e) => setStoryLogoUrl(e.target.value)}
                  >
                    <option value="">No Logo</option>
                    {TAXDROP_LOGOS.filter(l => l.forBackground === 'dark').map(logo => (
                      <option key={logo.id} value={logo.url}>{logo.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Headline Templates */}
            <div className="card">
              <div className="card-header">
                <h4>Headline Templates</h4>
                <span className="text-xs text-gray">Click to use</span>
              </div>
              <div className="card-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                  {HEADLINE_HOOKS.map(hook => (
                    <button
                      key={hook.id}
                      onClick={() => setStoryHeadline(hook.example)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #E5E7EB',
                        borderRadius: 'var(--radius-sm)',
                        background: 'white',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '11px',
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 2, color: 'var(--td-emerald-dark)' }}>{hook.template}</div>
                      <div style={{ color: '#666', textTransform: 'uppercase' }}>{hook.example.slice(0, 60)}...</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Generator Mode */}
      {studioMode === 'ai-generator' && (
        <>
      {/* Image Type Selection */}
      <div className="card mb-lg">
        <div className="card-header">
          <h4>Image Type</h4>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--spacing-sm)' }}>
            {IMAGE_TYPES.map(type => (
              <button
                key={type.id}
                className={`card ${imageType.id === type.id ? 'selected' : ''}`}
                onClick={() => setImageType(type)}
                style={{
                  cursor: 'pointer',
                  border: imageType.id === type.id ? '2px solid var(--td-emerald-light)' : '1px solid #E5E7EB',
                  background: imageType.id === type.id ? 'var(--td-mint)' : 'white',
                  textAlign: 'left',
                }}
              >
                <div style={{ padding: 'var(--spacing-sm)' }}>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-sm text-gray">{type.dimensions}</div>
                  <div className="text-xs text-gray" style={{ marginTop: 4 }}>{type.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Details */}
      <div className="card mb-lg">
        <div className="card-header">
          <h4>Content Details</h4>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Blog Post Title</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., How to Appeal Your Property Tax Assessment in Texas"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
            <div className="form-group">
              <label className="form-label">Style Preset</label>
              <select
                className="form-select"
                value={stylePreset.id}
                onChange={e => {
                  const newStyle = STYLE_PRESETS.find(s => s.id === e.target.value) || STYLE_PRESETS[0];
                  setStylePreset(newStyle);
                  // Switch to appropriate topic templates when style changes
                  const newTemplates = getTopicTemplates(newStyle.id);
                  setTopic(newTemplates[0]);
                }}
              >
                {STYLE_PRESETS.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <div className="text-xs text-gray" style={{ marginTop: 4 }}>
                {stylePreset.isBrandStyle
                  ? '✓ Includes brand colors, lighting & composition'
                  : stylePreset.isPhotorealistic
                    ? 'Real people in authentic scenarios'
                    : 'Conceptual visual metaphors'}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Scene / Concept</label>
              <select
                className="form-select"
                value={topic.id}
                onChange={e => {
                  const templates = getTopicTemplates(stylePreset.id);
                  setTopic(templates.find(t => t.id === e.target.value) || templates[0]);
                }}
              >
                {getTopicTemplates(stylePreset.id).map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <div className="text-xs text-gray" style={{ marginTop: 4 }}>{topic.concept}</div>
            </div>
          </div>

          {/* Advanced Styling Options for Photorealistic Styles (not for brand styles - they're comprehensive) */}
          {stylePreset.isPhotorealistic && !stylePreset.isBrandStyle && (
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAdvancedStyling(!showAdvancedStyling)}
                style={{ marginBottom: 'var(--spacing-sm)' }}
              >
                {showAdvancedStyling ? '− Hide' : '+ Show'} Advanced Styling
              </button>

              {showAdvancedStyling && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 'var(--spacing-md)',
                  padding: 'var(--spacing-md)',
                  background: 'var(--td-mint)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--td-emerald-light)'
                }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Lighting</label>
                    <select
                      className="form-select"
                      value={lightingPreset.id}
                      onChange={e => setLightingPreset(LIGHTING_PRESETS.find(l => l.id === e.target.value) || LIGHTING_PRESETS[0])}
                    >
                      {LIGHTING_PRESETS.map(l => (
                        <option key={l.id} value={l.id}>{l.label}</option>
                      ))}
                    </select>
                    <div className="text-xs text-gray" style={{ marginTop: 4 }}>{lightingPreset.description}</div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Color Grading</label>
                    <select
                      className="form-select"
                      value={colorGrading.id}
                      onChange={e => setColorGrading(COLOR_GRADING_PRESETS.find(c => c.id === e.target.value) || COLOR_GRADING_PRESETS[0])}
                    >
                      {COLOR_GRADING_PRESETS.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <div className="text-xs text-gray" style={{ marginTop: 4 }}>{colorGrading.description}</div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Mood</label>
                    <select
                      className="form-select"
                      value={moodPreset.id}
                      onChange={e => setMoodPreset(MOOD_PRESETS.find(m => m.id === e.target.value) || MOOD_PRESETS[0])}
                    >
                      {MOOD_PRESETS.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                    <div className="text-xs text-gray" style={{ marginTop: 4 }}>{moodPreset.description}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {brands.length > 0 && (
            <div className="form-group">
              <label className="form-label">Brand (Optional)</label>
              <select
                className="form-select"
                value={selectedBrand}
                onChange={e => setSelectedBrand(e.target.value)}
              >
                <option value="">No brand style</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

        </div>
      </div>

      {/* Prompt Section */}
      <div className="card mb-lg">
        <div className="card-header">
          <h4>Prompt</h4>
          {promptManuallyEdited && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleResetPrompt}
              style={{ fontSize: '0.75rem' }}
            >
              Reset to Generated
            </button>
          )}
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">
              Image Prompt
              {promptManuallyEdited && (
                <span className="text-xs text-gray" style={{ marginLeft: 8 }}>(edited)</span>
              )}
            </label>
            <textarea
              className="form-textarea"
              value={editedPrompt}
              onChange={e => handlePromptChange(e.target.value)}
              rows={5}
              placeholder="Fill in the details above to generate a prompt..."
            />
            <div className="text-xs text-gray" style={{ marginTop: 4 }}>
              Edit the prompt above to make adjustments before generating
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Negative Prompt</label>
            <input
              type="text"
              className="form-input"
              value={negativePrompt}
              onChange={e => setNegativePrompt(e.target.value)}
            />
          </div>

          <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>
        </div>
      </div>

      {/* Overlay Info - controls moved to preview modal */}
      {(selectedLogo || textOverlay.trim()) && (
        <div className="card mb-lg" style={{ background: 'var(--td-mint)', border: '1px solid var(--td-emerald-light)' }}>
          <div className="card-body" style={{ padding: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                <strong style={{ color: 'var(--td-emerald-dark)' }}>Overlays Ready:</strong>
                {selectedLogo && <span className="badge">Logo</span>}
                {textOverlay.trim() && <span className="badge">Text: {textOverlay.slice(0, 30)}{textOverlay.length > 30 ? '...' : ''}</span>}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSelectedLogo(null);
                  setLogoDataUrl(null);
                  setTextOverlay('');
                }}
                style={{ color: 'var(--color-error)' }}
              >
                Clear All
              </button>
            </div>
            <p className="text-xs text-gray" style={{ marginTop: 8 }}>
              Click "Edit Overlays" on any generated image to add logo, text, and adjust positioning
            </p>
          </div>
        </div>
      )}

      {/* Generation Controls */}
      <div className="card mb-lg">
        <div className="card-header">
          <h4 className="flex items-center gap-sm">
            <ImageIcon />
            Generate Image
          </h4>
        </div>
        <div className="card-body">
          {!apiKeyConfigured ? (
            <div className="text-center" style={{ padding: 'var(--spacing-lg)' }}>
              <p className="text-gray mb-md">
                To generate images, add your OpenRouter API key in Settings.
              </p>
              <button onClick={() => onNavigate?.('settings')} className="btn btn-secondary">
                Go to Settings
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--spacing-md)', alignItems: 'end' }}>
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
                <button
                  className="btn btn-primary"
                  onClick={handleGenerate}
                  disabled={generating || !editedPrompt}
                  style={{ height: 42 }}
                >
                  {generating ? 'Generating...' : 'Generate Image'}
                </button>
              </div>

              {error && (
                <div className="form-error mt-md">{error}</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Generated Images Gallery */}
      {generatedImages.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-md">
              <h4>Saved Blog Images</h4>
              <span className="badge">{generatedImages.length} images</span>
              {storageStats && (
                <span style={{ fontSize: '11px', color: 'var(--color-gray-500)' }}>
                  ({storageStats.estimatedSize})
                </span>
              )}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleClearAllImages}
              style={{ color: 'var(--color-error)' }}
            >
              Clear All
            </button>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-md)' }}>
              {generatedImages.map((img, i) => (
                <div
                  key={img.id}
                  style={{
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    border: '1px solid #E5E7EB',
                    background: '#F9FAFB',
                  }}
                >
                  <img
                    src={img.url}
                    alt={img.title}
                    style={{ width: '100%', display: 'block' }}
                  />
                  <div style={{ padding: 'var(--spacing-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div className="font-medium">{img.title}</div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDeleteImage(img.id)}
                        title="Delete image"
                        style={{ padding: '2px 6px', minWidth: 'auto', color: '#666' }}
                      >
                        ×
                      </button>
                    </div>
                    <div className="text-sm text-gray" style={{ marginBottom: 4 }}>
                      {IMAGE_TYPES.find(t => t.id === img.type)?.label}
                    </div>
                    {img.createdAt && (
                      <div className="text-xs text-gray" style={{ marginBottom: 8 }}>
                        {new Date(img.createdAt).toLocaleDateString()} {new Date(img.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    <div className="flex gap-sm flex-wrap">
                      {(() => {
                        const isDownloading = downloadingId === img.id;
                        const hasOverlays = !!(logoDataUrl || textOverlay.trim());
                        return (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setPreviewImageIndex(i)}
                              title="Add logo, text, and position overlays"
                            >
                              Edit Overlays
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleDownload(img, img.title)}
                              disabled={isDownloading}
                              title={hasOverlays ? 'Download with logo/text overlay' : 'Download image'}
                            >
                              <DownloadIcon />
                              {isDownloading ? 'Processing...' : hasOverlays ? 'Download +' : 'Download'}
                            </button>
                          </>
                        );
                      })()}
                      {onSaveImage && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSave(img)}
                        >
                          Save
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Visual Preview & Overlay Editor Modal */}
      {previewImageIndex !== null && generatedImages[previewImageIndex] && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-md)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewImageIndex(null);
          }}
        >
          <div style={{
            background: 'white',
            borderRadius: 'var(--radius-lg)',
            width: '95vw',
            maxWidth: '1400px',
            maxHeight: '95vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              padding: 'var(--spacing-md)',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h4 style={{ margin: 0 }}>Edit Overlays</h4>
                <p className="text-sm text-gray" style={{ margin: 0 }}>
                  Add logo & text, then drag to position • Drag corner to resize
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setPreviewImageIndex(null)}
              >
                Done
              </button>
            </div>

            {/* Main Content - Side by Side */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Left: Preview Image */}
              <div style={{ flex: 1, padding: 'var(--spacing-md)', background: '#f5f5f5', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    cursor: 'default',
                  }}
                  onMouseMove={(e) => {
                    if (!isDraggingLogo && !isDraggingText && !isResizingLogo && !isResizingText) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;

                    if (isDraggingLogo) {
                      setLogoX(Math.max(5, Math.min(95, x)));
                      setLogoY(Math.max(5, Math.min(95, y)));
                    }
                    if (isDraggingText) {
                      setTextX(Math.max(5, Math.min(95, x)));
                      setTextY(Math.max(5, Math.min(95, y)));
                    }
                    if (isResizingLogo && resizeStartData) {
                      const deltaX = e.clientX - resizeStartData.startX;
                      const scaleFactor = deltaX / 3;
                      setLogoSize(Math.max(5, Math.min(40, resizeStartData.startSize + scaleFactor)));
                    }
                    if (isResizingText && resizeStartData) {
                      const deltaX = e.clientX - resizeStartData.startX;
                      const scaleFactor = deltaX / 20;
                      setTextSize(Math.max(2, Math.min(15, resizeStartData.startSize + scaleFactor)));
                    }
                  }}
                  onMouseUp={() => {
                    setIsDraggingLogo(false);
                    setIsDraggingText(false);
                    setIsResizingLogo(false);
                    setIsResizingText(false);
                    setResizeStartData(null);
                  }}
                  onMouseLeave={() => {
                    setIsDraggingLogo(false);
                    setIsDraggingText(false);
                    setIsResizingLogo(false);
                    setIsResizingText(false);
                    setResizeStartData(null);
                  }}
                >
                  <img
                    src={generatedImages[previewImageIndex].url}
                    alt="Preview"
                    style={{
                      display: 'block',
                      maxWidth: '100%',
                      maxHeight: '70vh',
                      userSelect: 'none',
                      pointerEvents: 'none',
                    }}
                    draggable={false}
                  />

                  {/* Text Overlay */}
                  {textOverlay.trim() && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${textX}%`,
                        top: `${textY}%`,
                        transform: 'translate(-50%, -50%)',
                        cursor: isDraggingText ? 'grabbing' : 'grab',
                        padding: '8px 16px',
                        maxWidth: textWrap ? '80%' : 'none',
                        background: textBackground
                          ? `${textBackgroundColor}${Math.round(textBackgroundOpacity * 2.55).toString(16).padStart(2, '0')}`
                          : 'transparent',
                        color: textColor,
                        fontFamily: {
                          'space-grotesk': '"Space Grotesk", sans-serif',
                          'inter': '"Inter", sans-serif',
                          'georgia': 'Georgia, serif',
                          'system': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        }[textFont],
                        fontSize: `${textSize * 3}px`,
                        fontWeight: 'bold',
                        textAlign: textAlign,
                        whiteSpace: textWrap ? 'pre-wrap' : 'nowrap',
                        wordBreak: textWrap ? 'break-word' : 'normal',
                        userSelect: 'none',
                        border: '2px dashed rgba(11, 143, 82, 0.5)',
                        borderRadius: '4px',
                        zIndex: 10,
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsDraggingText(true);
                      }}
                    >
                      {textWrap ? textOverlay : (textOverlay.length > 50 ? textOverlay.slice(0, 50) + '...' : textOverlay)}
                      <div
                        style={{
                          position: 'absolute',
                          right: -6,
                          bottom: -6,
                          width: 14,
                          height: 14,
                          background: 'var(--td-emerald-dark)',
                          borderRadius: '50%',
                          cursor: 'se-resize',
                          border: '2px solid white',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsResizingText(true);
                          setResizeStartData({ startX: e.clientX, startY: e.clientY, startSize: textSize });
                        }}
                        title="Drag to resize"
                      />
                    </div>
                  )}

                  {/* Logo Overlay */}
                  {logoDataUrl && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${logoX}%`,
                        top: `${logoY}%`,
                        transform: 'translate(-50%, -50%)',
                        cursor: isDraggingLogo ? 'grabbing' : 'grab',
                        opacity: logoOpacity / 100,
                        border: '2px dashed rgba(11, 143, 82, 0.5)',
                        borderRadius: '4px',
                        padding: '4px',
                        background: 'rgba(255,255,255,0.3)',
                        userSelect: 'none',
                        zIndex: 20,
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsDraggingLogo(true);
                      }}
                    >
                      <img
                        src={logoDataUrl}
                        alt="Logo"
                        style={{
                          width: `${logoSize * 5}px`,
                          height: 'auto',
                          display: 'block',
                          pointerEvents: 'none',
                        }}
                        draggable={false}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          right: -6,
                          bottom: -6,
                          width: 14,
                          height: 14,
                          background: 'var(--td-emerald-dark)',
                          borderRadius: '50%',
                          cursor: 'se-resize',
                          border: '2px solid white',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsResizingLogo(true);
                          setResizeStartData({ startX: e.clientX, startY: e.clientY, startSize: logoSize });
                        }}
                        title="Drag to resize"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Controls Panel */}
              <div style={{ width: '360px', borderLeft: '1px solid #E5E7EB', overflow: 'auto', padding: 'var(--spacing-md)' }}>
                {/* Logo Section */}
                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                    <h5 style={{ margin: 0 }}>Logo</h5>
                    {selectedLogo && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setSelectedLogo(null); setLogoDataUrl(null); }}
                        style={{ color: 'var(--color-error)', padding: '2px 8px' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: 'var(--spacing-sm)' }}>
                    <button
                      onClick={() => { setSelectedLogo(null); setLogoDataUrl(null); }}
                      style={{
                        padding: '8px 4px',
                        border: !selectedLogo ? '2px solid var(--td-emerald-dark)' : '1px solid #E5E7EB',
                        borderRadius: '6px',
                        background: !selectedLogo ? 'var(--td-mint)' : 'white',
                        cursor: 'pointer',
                        fontSize: '10px',
                      }}
                    >
                      None
                    </button>
                    {TAXDROP_LOGOS.map(logo => (
                      <button
                        key={logo.id}
                        onClick={() => { setSelectedLogo(logo.id); setLogoDataUrl(logo.url); }}
                        style={{
                          padding: '4px',
                          border: selectedLogo === logo.id ? '2px solid var(--td-emerald-dark)' : '1px solid #E5E7EB',
                          borderRadius: '6px',
                          background: selectedLogo === logo.id ? 'var(--td-mint)' : logo.forBackground === 'dark' ? '#1A1A1A' : 'white',
                          cursor: 'pointer',
                        }}
                      >
                        <img src={logo.url} alt={logo.label} style={{ width: '100%', height: '24px', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </button>
                    ))}
                  </div>
                  {selectedLogo && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '11px' }}>Size: {Math.round(logoSize)}%</label>
                        <input type="range" min="5" max="40" value={logoSize} onChange={e => setLogoSize(Number(e.target.value))} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '11px' }}>Opacity: {logoOpacity}%</label>
                        <input type="range" min="20" max="100" value={logoOpacity} onChange={e => setLogoOpacity(Number(e.target.value))} style={{ width: '100%' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Text Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                    <h5 style={{ margin: 0 }}>Text</h5>
                    {textOverlay.trim() && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setTextOverlay('')}
                        style={{ color: 'var(--color-error)', padding: '2px 8px' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <textarea
                    className="form-textarea"
                    value={textOverlay}
                    onChange={e => setTextOverlay(e.target.value)}
                    rows={3}
                    placeholder="Enter headline or caption..."
                    style={{ resize: 'vertical', fontSize: '13px', marginBottom: 'var(--spacing-sm)' }}
                  />

                  {textOverlay.trim() && (
                    <>
                      {/* Text Options Row 1 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '11px' }}>Align</label>
                          <select className="form-select" value={textAlign} onChange={e => setTextAlign(e.target.value as typeof textAlign)} style={{ fontSize: '12px', padding: '4px 8px' }}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '11px' }}>Font</label>
                          <select className="form-select" value={textFont} onChange={e => setTextFont(e.target.value as typeof textFont)} style={{ fontSize: '12px', padding: '4px 8px' }}>
                            <option value="space-grotesk">Space Grotesk</option>
                            <option value="inter">Inter</option>
                            <option value="georgia">Georgia</option>
                            <option value="system">System</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '11px' }}>Size: {textSize.toFixed(1)}%</label>
                          <input type="range" min="2" max="12" step="0.5" value={textSize} onChange={e => setTextSize(Number(e.target.value))} style={{ width: '100%' }} />
                        </div>
                      </div>

                      {/* Text Options Row 2 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '11px' }}>Text Color</label>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} style={{ width: 32, height: 28, padding: 0, border: '1px solid #E5E7EB', borderRadius: '4px' }} />
                            <input type="text" className="form-input" value={textColor} onChange={e => setTextColor(e.target.value)} style={{ flex: 1, fontSize: '11px', padding: '4px 6px' }} />
                          </div>
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input type="checkbox" checked={textWrap} onChange={e => setTextWrap(e.target.checked)} />
                            Multi-line wrap
                          </label>
                        </div>
                      </div>

                      {/* Background Options */}
                      <div style={{ padding: 'var(--spacing-sm)', background: '#f5f5f5', borderRadius: '6px' }}>
                        <label className="form-label" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--spacing-xs)' }}>
                          <input type="checkbox" checked={textBackground} onChange={e => setTextBackground(e.target.checked)} />
                          Background bar
                        </label>
                        {textBackground && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                            <input type="color" value={textBackgroundColor} onChange={e => setTextBackgroundColor(e.target.value)} style={{ width: 28, height: 24, padding: 0, border: '1px solid #E5E7EB', borderRadius: '4px' }} />
                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--color-gray-500)' }}>Opacity: {textBackgroundOpacity}%</label>
                              <input type="range" min="10" max="90" value={textBackgroundOpacity} onChange={e => setTextBackgroundOpacity(Number(e.target.value))} style={{ width: '100%' }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Status Bar */}
                <div style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-sm)', background: 'var(--td-mint)', borderRadius: '6px', fontSize: '11px' }}>
                  {logoDataUrl && <div><strong>Logo:</strong> {Math.round(logoX)}%, {Math.round(logoY)}% • {Math.round(logoSize)}%</div>}
                  {textOverlay.trim() && <div><strong>Text:</strong> {Math.round(textX)}%, {Math.round(textY)}% • {textSize.toFixed(1)}%</div>}
                  {!logoDataUrl && !textOverlay.trim() && <div className="text-gray">No overlays added yet</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
