import type { Character, CharacterRef } from '../types';
import { STORAGE_KEYS, getFromStorage, saveToStorage, generateId, getCurrentTimestamp } from './storage';
import { addCharacterToBrand, removeCharacterFromBrand } from './brandService';

export function getCharacters(): Character[] {
  return getFromStorage<Character[]>(STORAGE_KEYS.CHARACTERS, []);
}

export function getCharacterById(id: string): Character | null {
  const characters = getCharacters();
  return characters.find(c => c.id === id) ?? null;
}

export function getCharactersByBrand(brandId: string): Character[] {
  return getCharacters().filter(c => c.brandId === brandId);
}

export function getCharacterByShorthand(shorthand: string, brandId?: string): Character | null {
  const characters = brandId ? getCharactersByBrand(brandId) : getCharacters();
  return characters.find(c => c.shorthand.toLowerCase() === shorthand.toLowerCase()) ?? null;
}

export function createCharacter(data: {
  brandId: string;
  name: string;
  shorthand: string;
  description: string;
  personality?: string;
  outfit?: string;
  distinguishingFeatures?: string;
}): Character {
  const characters = getCharacters();
  const now = getCurrentTimestamp();

  const shorthand = data.shorthand.startsWith('@') ? data.shorthand : `@${data.shorthand}`;

  const character: Character = {
    id: generateId(),
    brandId: data.brandId,
    name: data.name,
    shorthand,
    description: data.description,
    personality: data.personality,
    outfit: data.outfit,
    distinguishingFeatures: data.distinguishingFeatures,
    refs: [],
    createdAt: now,
    updatedAt: now,
  };

  characters.push(character);
  saveToStorage(STORAGE_KEYS.CHARACTERS, characters);
  addCharacterToBrand(data.brandId, character.id);

  return character;
}

export function updateCharacter(id: string, updates: Partial<Character>): Character | null {
  const characters = getCharacters();
  const index = characters.findIndex(c => c.id === id);

  if (index === -1) return null;

  if (updates.shorthand && !updates.shorthand.startsWith('@')) {
    updates.shorthand = `@${updates.shorthand}`;
  }

  const updated: Character = {
    ...characters[index],
    ...updates,
    id: characters[index].id,
    brandId: characters[index].brandId,
    createdAt: characters[index].createdAt,
    updatedAt: getCurrentTimestamp(),
  };

  characters[index] = updated;
  saveToStorage(STORAGE_KEYS.CHARACTERS, characters);
  return updated;
}

export function deleteCharacter(id: string): boolean {
  const characters = getCharacters();
  const character = characters.find(c => c.id === id);
  if (!character) return false;

  const filtered = characters.filter(c => c.id !== id);
  saveToStorage(STORAGE_KEYS.CHARACTERS, filtered);
  removeCharacterFromBrand(character.brandId, id);

  return true;
}

export function addCharacterRef(characterId: string, ref: Omit<CharacterRef, 'id' | 'createdAt'>): Character | null {
  const character = getCharacterById(characterId);
  if (!character) return null;

  const newRef: CharacterRef = {
    ...ref,
    id: generateId(),
    createdAt: getCurrentTimestamp(),
  };

  const updates: Partial<Character> = {
    refs: [...character.refs, newRef],
  };

  if (ref.type === 'portrait' && !character.portraitRefId) {
    updates.portraitRefId = newRef.id;
  } else if (ref.type === 'full-body' && !character.fullBodyRefId) {
    updates.fullBodyRefId = newRef.id;
  }

  return updateCharacter(characterId, updates);
}

export function removeCharacterRef(characterId: string, refId: string): Character | null {
  const character = getCharacterById(characterId);
  if (!character) return null;

  const updates: Partial<Character> = {
    refs: character.refs.filter(r => r.id !== refId),
  };

  if (character.portraitRefId === refId) {
    const nextPortrait = character.refs.find(r => r.id !== refId && r.type === 'portrait');
    updates.portraitRefId = nextPortrait?.id;
  }

  if (character.fullBodyRefId === refId) {
    const nextFullBody = character.refs.find(r => r.id !== refId && r.type === 'full-body');
    updates.fullBodyRefId = nextFullBody?.id;
  }

  return updateCharacter(characterId, updates);
}

export function setPortraitRef(characterId: string, refId: string): Character | null {
  return updateCharacter(characterId, { portraitRefId: refId });
}

export function setFullBodyRef(characterId: string, refId: string): Character | null {
  return updateCharacter(characterId, { fullBodyRefId: refId });
}

export function getAllShorthands(brandId?: string): string[] {
  const characters = brandId ? getCharactersByBrand(brandId) : getCharacters();
  return characters.map(c => c.shorthand);
}
