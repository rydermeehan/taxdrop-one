import type { GeneratedPrompt, PromptTemplate, StyleGuide } from '../types';
import { promptTemplates, getTemplateById } from '../data/promptTemplates';
import { getCharacterByShorthand } from './characterService';
import { STORAGE_KEYS, getFromStorage, saveToStorage, generateId, getCurrentTimestamp } from './storage';

export function getTemplates(): PromptTemplate[] {
  return promptTemplates;
}

export function getPromptHistory(): GeneratedPrompt[] {
  return getFromStorage<GeneratedPrompt[]>(STORAGE_KEYS.PROMPTS, []);
}

export function getPromptHistoryByShot(shotId: string): GeneratedPrompt[] {
  return getPromptHistory()
    .filter(p => p.shotId === shotId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function generatePrompt(
  templateId: string,
  values: Record<string, string>,
  options?: {
    styleGuide?: StyleGuide;
    brandId?: string;
  }
): { prompt: string; negativePrompt?: string } {
  const template = getTemplateById(templateId);
  if (!template) {
    return { prompt: '' };
  }

  let output = template.template;

  for (const variable of template.variables) {
    const value = values[variable.name] || variable.defaultValue || '';
    const placeholder = `{{${variable.name}}}`;

    let processedValue = value;

    if (variable.type === 'character' && value.startsWith('@')) {
      const character = getCharacterByShorthand(value, options?.brandId);
      if (character) {
        processedValue = character.description;
      }
    }

    output = output.replace(placeholder, processedValue);
  }

  output = output.replace(/\{\{[^}]+\}\}/g, '').trim();
  output = output.replace(/\s+/g, ' ').replace(/\s*,\s*,\s*/g, ', ').trim();

  if (options?.styleGuide) {
    const guide = options.styleGuide;

    if (guide.qualityModifiers.length > 0) {
      output += `, ${guide.qualityModifiers.join(', ')}`;
    }

    if (guide.customPromptSuffix) {
      output += `, ${guide.customPromptSuffix}`;
    }
  }

  let negativePrompt = template.negativePrompt;
  if (options?.styleGuide?.avoidKeywords.length) {
    const avoidStr = options.styleGuide.avoidKeywords.join(', ');
    negativePrompt = negativePrompt
      ? `${negativePrompt}, ${avoidStr}`
      : avoidStr;
  }

  return {
    prompt: output,
    negativePrompt,
  };
}

export function saveGeneratedPrompt(data: {
  templateId: string;
  shotId?: string;
  values: Record<string, string>;
  output: string;
  negativePrompt?: string;
}): GeneratedPrompt {
  const prompts = getPromptHistory();

  const generated: GeneratedPrompt = {
    id: generateId(),
    templateId: data.templateId,
    shotId: data.shotId,
    values: data.values,
    output: data.output,
    negativePrompt: data.negativePrompt,
    createdAt: getCurrentTimestamp(),
  };

  prompts.push(generated);
  saveToStorage(STORAGE_KEYS.PROMPTS, prompts);
  return generated;
}

export function deleteGeneratedPrompt(id: string): boolean {
  const prompts = getPromptHistory();
  const filtered = prompts.filter(p => p.id !== id);

  if (filtered.length === prompts.length) return false;

  saveToStorage(STORAGE_KEYS.PROMPTS, filtered);
  return true;
}

export function expandCharacterShorthands(text: string, brandId?: string): string {
  const shorthandPattern = /@\w+/g;
  const matches = text.match(shorthandPattern);

  if (!matches) return text;

  let expanded = text;
  for (const shorthand of matches) {
    const character = getCharacterByShorthand(shorthand, brandId);
    if (character) {
      expanded = expanded.replace(shorthand, character.description);
    }
  }

  return expanded;
}

export function extractShorthandsFromText(text: string): string[] {
  const shorthandPattern = /@\w+/g;
  const matches = text.match(shorthandPattern);
  return matches ? [...new Set(matches)] : [];
}

export function validatePromptValues(
  templateId: string,
  values: Record<string, string>
): { valid: boolean; errors: Record<string, string> } {
  const template = getTemplateById(templateId);
  if (!template) {
    return { valid: false, errors: { _template: 'Template not found' } };
  }

  const errors: Record<string, string> = {};

  for (const variable of template.variables) {
    if (variable.required) {
      const value = values[variable.name];
      if (!value || value.trim() === '') {
        errors[variable.name] = `${variable.label} is required`;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
