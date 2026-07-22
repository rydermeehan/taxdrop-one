import type { Brand, ColorPalette, StyleGuide } from '../types';
import { STORAGE_KEYS, getFromStorage, saveToStorage, generateId, getCurrentTimestamp } from './storage';

export function getBrands(): Brand[] {
  return getFromStorage<Brand[]>(STORAGE_KEYS.BRANDS, []);
}

export function getBrandById(id: string): Brand | null {
  const brands = getBrands();
  return brands.find(b => b.id === id) ?? null;
}

export function createBrand(data: {
  name: string;
  description: string;
}): Brand {
  const brands = getBrands();
  const now = getCurrentTimestamp();

  const brand: Brand = {
    id: generateId(),
    name: data.name,
    description: data.description,
    characterIds: [],
    colorPalettes: [],
    styleGuides: [],
    createdAt: now,
    updatedAt: now,
  };

  brands.push(brand);
  saveToStorage(STORAGE_KEYS.BRANDS, brands);
  return brand;
}

export function updateBrand(id: string, updates: Partial<Brand>): Brand | null {
  const brands = getBrands();
  const index = brands.findIndex(b => b.id === id);

  if (index === -1) return null;

  const updated: Brand = {
    ...brands[index],
    ...updates,
    id: brands[index].id,
    createdAt: brands[index].createdAt,
    updatedAt: getCurrentTimestamp(),
  };

  brands[index] = updated;
  saveToStorage(STORAGE_KEYS.BRANDS, brands);
  return updated;
}

export function deleteBrand(id: string): boolean {
  const brands = getBrands();
  const filtered = brands.filter(b => b.id !== id);

  if (filtered.length === brands.length) return false;

  saveToStorage(STORAGE_KEYS.BRANDS, filtered);
  return true;
}

export function addColorPalette(brandId: string, palette: Omit<ColorPalette, 'id'>): Brand | null {
  const brand = getBrandById(brandId);
  if (!brand) return null;

  const newPalette: ColorPalette = {
    ...palette,
    id: generateId(),
  };

  return updateBrand(brandId, {
    colorPalettes: [...brand.colorPalettes, newPalette],
  });
}

export function updateColorPalette(brandId: string, paletteId: string, updates: Partial<ColorPalette>): Brand | null {
  const brand = getBrandById(brandId);
  if (!brand) return null;

  return updateBrand(brandId, {
    colorPalettes: brand.colorPalettes.map(p =>
      p.id === paletteId ? { ...p, ...updates } : p
    ),
  });
}

export function removeColorPalette(brandId: string, paletteId: string): Brand | null {
  const brand = getBrandById(brandId);
  if (!brand) return null;

  return updateBrand(brandId, {
    colorPalettes: brand.colorPalettes.filter(p => p.id !== paletteId),
  });
}

export function addStyleGuide(brandId: string, guide: Omit<StyleGuide, 'id'>): Brand | null {
  const brand = getBrandById(brandId);
  if (!brand) return null;

  const newGuide: StyleGuide = {
    ...guide,
    id: generateId(),
  };

  return updateBrand(brandId, {
    styleGuides: [...brand.styleGuides, newGuide],
  });
}

export function updateStyleGuide(brandId: string, guideId: string, updates: Partial<StyleGuide>): Brand | null {
  const brand = getBrandById(brandId);
  if (!brand) return null;

  return updateBrand(brandId, {
    styleGuides: brand.styleGuides.map(g =>
      g.id === guideId ? { ...g, ...updates } : g
    ),
  });
}

export function removeStyleGuide(brandId: string, guideId: string): Brand | null {
  const brand = getBrandById(brandId);
  if (!brand) return null;

  return updateBrand(brandId, {
    styleGuides: brand.styleGuides.filter(g => g.id !== guideId),
  });
}

export function setDefaultStyleGuide(brandId: string, guideId: string): Brand | null {
  return updateBrand(brandId, { defaultStyleGuideId: guideId });
}

export function addCharacterToBrand(brandId: string, characterId: string): Brand | null {
  const brand = getBrandById(brandId);
  if (!brand) return null;

  if (!brand.characterIds.includes(characterId)) {
    return updateBrand(brandId, {
      characterIds: [...brand.characterIds, characterId],
    });
  }
  return brand;
}

export function removeCharacterFromBrand(brandId: string, characterId: string): Brand | null {
  const brand = getBrandById(brandId);
  if (!brand) return null;

  return updateBrand(brandId, {
    characterIds: brand.characterIds.filter(id => id !== characterId),
  });
}

export function duplicateBrand(id: string, newName: string): Brand | null {
  const brand = getBrandById(id);
  if (!brand) return null;

  const brands = getBrands();
  const now = getCurrentTimestamp();

  const duplicate: Brand = {
    ...brand,
    id: generateId(),
    name: newName,
    characterIds: [],
    createdAt: now,
    updatedAt: now,
  };

  brands.push(duplicate);
  saveToStorage(STORAGE_KEYS.BRANDS, brands);
  return duplicate;
}
