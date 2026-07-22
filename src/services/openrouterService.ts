import { getFromStorage, saveToStorage } from './storage';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Available image generation models on OpenRouter
export const IMAGE_MODELS = [
  {
    id: 'google/gemini-3-pro-image-preview',
    name: 'Nano Banana Pro (Gemini 3 Pro)',
    description: 'Most advanced - better text rendering, identity preservation, multi-image',
    provider: 'Google',
  },
] as const;

export type ImageModel = typeof IMAGE_MODELS[number]['id'];

export interface ImageGenerationOptions {
  model: ImageModel;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  imageSize?: '1K' | '2K' | '4K';
  referenceImages?: string[]; // base64 data URLs for character/style reference
}

export interface GeneratedImage {
  url: string; // base64 data URL
  prompt: string;
  model: string;
  timestamp: string;
}

interface OpenRouterSettings {
  apiKey: string;
  defaultModel: ImageModel;
}

const SETTINGS_KEY = 'video-studio-openrouter';

export function getOpenRouterSettings(): OpenRouterSettings {
  const settings = getFromStorage<OpenRouterSettings>(SETTINGS_KEY, {
    apiKey: '',
    defaultModel: 'google/gemini-3-pro-image-preview',
  });

  // Migration: fix invalid model IDs from older versions
  const validModelIds = IMAGE_MODELS.map(m => m.id);
  if (!validModelIds.includes(settings.defaultModel as typeof IMAGE_MODELS[number]['id'])) {
    settings.defaultModel = 'google/gemini-3-pro-image-preview';
    saveToStorage(SETTINGS_KEY, settings);
  }

  return settings;
}

export function saveOpenRouterSettings(settings: Partial<OpenRouterSettings>): void {
  const current = getOpenRouterSettings();
  saveToStorage(SETTINGS_KEY, { ...current, ...settings });
}

export function hasApiKey(): boolean {
  const settings = getOpenRouterSettings();
  return !!settings.apiKey;
}

export async function generateImage(options: ImageGenerationOptions): Promise<GeneratedImage> {
  const settings = getOpenRouterSettings();

  if (!settings.apiKey) {
    throw new Error('OpenRouter API key not configured. Go to Settings to add your key.');
  }

  // Build the prompt with negative prompt if provided
  let fullPrompt = options.prompt;
  if (options.negativePrompt) {
    fullPrompt += `\n\nAvoid: ${options.negativePrompt}`;
  }

  // Build message content - multimodal if reference images provided
  let messageContent: string | Array<Record<string, unknown>> = fullPrompt;

  if (options.referenceImages && options.referenceImages.length > 0) {
    const parts: Array<Record<string, unknown>> = [];

    // Add reference images first
    for (const refImage of options.referenceImages) {
      // Extract mime type and base64 data from data URL
      const match = refImage.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (match) {
        parts.push({
          type: 'image_url',
          image_url: { url: refImage },
        });
      }
    }

    // Add text prompt
    parts.push({
      type: 'text',
      text: fullPrompt,
    });

    messageContent = parts;
  }

  const requestBody: Record<string, unknown> = {
    model: options.model,
    messages: [
      {
        role: 'user',
        content: messageContent,
      },
    ],
    modalities: ['image', 'text'],
  };

  // Add Gemini-specific parameters
  if (options.model.startsWith('google/')) {
    requestBody.image_generation = {
      aspect_ratio: options.aspectRatio ?? '16:9',
      image_size: options.imageSize ?? '1K',
    };
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Video Studio',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message ?? `API error: ${response.status}`);
  }

  const data = await response.json();

  // Log response for debugging
  console.log('OpenRouter response:', JSON.stringify(data, null, 2));

  // Extract image from response
  const message = data.choices?.[0]?.message;

  if (!message) {
    throw new Error('No response from model');
  }

  // Check for images in the response
  let imageUrl: string | null = null;

  // Log message structure for debugging
  console.log('Message images:', message.images);
  console.log('Message images type:', typeof message.images);
  if (message.images) {
    console.log('First image:', message.images[0]);
    console.log('First image type:', typeof message.images[0]);
    if (typeof message.images[0] === 'object') {
      console.log('First image keys:', Object.keys(message.images[0]));
    }
  }

  // Format 1: images array in message (common format)
  if (message.images && message.images.length > 0) {
    const img = message.images[0];
    if (typeof img === 'string') {
      // Could be base64 string or data URL
      imageUrl = img.startsWith('data:') ? img : `data:image/png;base64,${img}`;
    } else if (typeof img === 'object') {
      // Could be an object with url or data property
      if (img.url) {
        imageUrl = img.url;
      } else if (img.data) {
        const mimeType = img.mime_type || img.mimeType || 'image/png';
        imageUrl = `data:${mimeType};base64,${img.data}`;
      } else if (img.b64_json) {
        imageUrl = `data:image/png;base64,${img.b64_json}`;
      } else if (img.image_url?.url) {
        // Nested image_url format
        const url = img.image_url.url;
        imageUrl = url.startsWith('data:') ? url : `data:image/png;base64,${url}`;
      }
    }
  }

  // Format 2: content array with image parts (OpenAI-style / Gemini format)
  if (!imageUrl && Array.isArray(message.content)) {
    for (const part of message.content) {
      // Check for image_url type (Gemini returns this format)
      if (part.type === 'image_url' && part.image_url?.url) {
        const url = part.image_url.url;
        // Check if it's already a data URL or needs to be converted
        if (url.startsWith('data:')) {
          imageUrl = url;
        } else if (url.startsWith('http')) {
          // It's a regular URL, use as-is
          imageUrl = url;
        } else {
          // Assume it's base64 without the data: prefix
          imageUrl = `data:image/png;base64,${url}`;
        }
        break;
      }
      // Check for image type with base64
      if (part.type === 'image' && part.data) {
        imageUrl = `data:image/${part.mime_type || 'png'};base64,${part.data}`;
        break;
      }
      // Check for inline_data (Gemini format)
      if (part.inline_data?.data) {
        const mimeType = part.inline_data.mime_type || 'image/png';
        imageUrl = `data:${mimeType};base64,${part.inline_data.data}`;
        break;
      }
    }
  }

  // Format 3: Check for inline base64 in content string
  if (!imageUrl && typeof message.content === 'string') {
    // Match data URL
    const dataUrlMatch = message.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
    if (dataUrlMatch) {
      imageUrl = dataUrlMatch[0];
    }
  }

  // Format 4: Direct base64 in content (raw)
  if (!imageUrl && typeof message.content === 'string' && message.content.length > 1000) {
    // Check if it looks like base64 (long string with base64 chars)
    if (/^[A-Za-z0-9+/=]+$/.test(message.content.trim())) {
      imageUrl = `data:image/png;base64,${message.content.trim()}`;
    }
  }

  if (!imageUrl) {
    console.error('Unexpected response format:', data);
    console.error('Message content type:', typeof message.content);
    console.error('Message keys:', Object.keys(message));
    throw new Error('No image in response. The model may not support image generation. Check console for details.');
  }

  return {
    url: imageUrl,
    prompt: options.prompt,
    model: options.model,
    timestamp: new Date().toISOString(),
  };
}

export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Text generation models
export const TEXT_MODELS = [
  {
    id: 'anthropic/claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: 'Latest and most capable — best for nuanced, high-quality writing',
  },
  {
    id: 'anthropic/claude-opus-4-5',
    name: 'Claude Opus 4.5',
    description: 'Powerful reasoning and creativity',
  },
  {
    id: 'anthropic/claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    description: 'Latest Sonnet — fast with strong reasoning',
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    description: 'Fast and capable — great balance of speed and quality',
  },
  {
    id: 'anthropic/claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    description: 'Fast and affordable — good for quick drafts',
  },
] as const;

export type TextModel = typeof TEXT_MODELS[number]['id'];

export interface TextGenerationOptions {
  model?: TextModel;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
}

export interface GeneratedText {
  content: string;
  model: string;
  timestamp: string;
}

export async function generateText(options: TextGenerationOptions): Promise<GeneratedText> {
  const settings = getOpenRouterSettings();

  if (!settings.apiKey) {
    throw new Error('OpenRouter API key not configured. Go to Settings to add your key.');
  }

  const model = options.model || 'anthropic/claude-sonnet-4-5';

  const messages: Array<{ role: string; content: string }> = [];

  if (options.systemPrompt) {
    messages.push({
      role: 'system',
      content: options.systemPrompt,
    });
  }

  messages.push({
    role: 'user',
    content: options.prompt,
  });

  const requestBody = {
    model,
    messages,
    max_tokens: options.maxTokens || 4096,
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'TaxDrop Content Studio',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message ?? `API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from model');
  }

  return {
    content,
    model,
    timestamp: new Date().toISOString(),
  };
}
