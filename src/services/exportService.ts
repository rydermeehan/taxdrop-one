import type { ExportData, Project, Shot, Brand, Character, TeamMember, Comment, GeneratedPrompt } from '../types';
import { STORAGE_KEYS, getFromStorage, saveToStorage, getCurrentTimestamp } from './storage';

const EXPORT_VERSION = '1.0.0';

export function exportAllData(): ExportData {
  return {
    version: EXPORT_VERSION,
    exportedAt: getCurrentTimestamp(),
    projects: getFromStorage<Project[]>(STORAGE_KEYS.PROJECTS, []),
    shots: getFromStorage<Shot[]>(STORAGE_KEYS.SHOTS, []),
    brands: getFromStorage<Brand[]>(STORAGE_KEYS.BRANDS, []),
    characters: getFromStorage<Character[]>(STORAGE_KEYS.CHARACTERS, []),
    team: getFromStorage<TeamMember[]>(STORAGE_KEYS.TEAM, []),
    comments: getFromStorage<Comment[]>(STORAGE_KEYS.COMMENTS, []),
    prompts: getFromStorage<GeneratedPrompt[]>(STORAGE_KEYS.PROMPTS, []),
  };
}

export function exportProject(projectId: string): ExportData | null {
  const projects = getFromStorage<Project[]>(STORAGE_KEYS.PROJECTS, []);
  const project = projects.find(p => p.id === projectId);

  if (!project) return null;

  const shots = getFromStorage<Shot[]>(STORAGE_KEYS.SHOTS, [])
    .filter(s => s.projectId === projectId);

  const shotIds = new Set(shots.map(s => s.id));
  const characterIds = new Set(shots.flatMap(s => s.characterIds));

  const comments = getFromStorage<Comment[]>(STORAGE_KEYS.COMMENTS, [])
    .filter(c => shotIds.has(c.shotId));

  const prompts = getFromStorage<GeneratedPrompt[]>(STORAGE_KEYS.PROMPTS, [])
    .filter(p => p.shotId && shotIds.has(p.shotId));

  const characters = getFromStorage<Character[]>(STORAGE_KEYS.CHARACTERS, [])
    .filter(c => characterIds.has(c.id));

  const brandIds = new Set([project.brandId, ...characters.map(c => c.brandId)].filter(Boolean));
  const brands = getFromStorage<Brand[]>(STORAGE_KEYS.BRANDS, [])
    .filter(b => brandIds.has(b.id));

  const teamMemberIds = new Set([
    ...project.teamMemberIds,
    ...shots.map(s => s.assignedTo).filter(Boolean),
    ...comments.map(c => c.authorId),
  ]);
  const team = getFromStorage<TeamMember[]>(STORAGE_KEYS.TEAM, [])
    .filter(m => teamMemberIds.has(m.id));

  return {
    version: EXPORT_VERSION,
    exportedAt: getCurrentTimestamp(),
    projects: [project],
    shots,
    brands,
    characters,
    team,
    comments,
    prompts,
  };
}

export function importData(
  data: ExportData,
  options?: { merge?: boolean }
): { success: boolean; errors: string[]; imported: Record<string, number> } {
  const errors: string[] = [];
  const imported: Record<string, number> = {
    projects: 0,
    shots: 0,
    brands: 0,
    characters: 0,
    team: 0,
    comments: 0,
    prompts: 0,
  };

  if (!data.version) {
    errors.push('Invalid export file: missing version');
    return { success: false, errors, imported };
  }

  const merge = options?.merge ?? false;

  try {
    if (data.projects) {
      const existing = merge ? getFromStorage<Project[]>(STORAGE_KEYS.PROJECTS, []) : [];
      const existingIds = new Set(existing.map(p => p.id));
      const newProjects = data.projects.filter(p => !existingIds.has(p.id));
      saveToStorage(STORAGE_KEYS.PROJECTS, [...existing, ...newProjects]);
      imported.projects = newProjects.length;
    }

    if (data.shots) {
      const existing = merge ? getFromStorage<Shot[]>(STORAGE_KEYS.SHOTS, []) : [];
      const existingIds = new Set(existing.map(s => s.id));
      const newShots = data.shots.filter(s => !existingIds.has(s.id));
      saveToStorage(STORAGE_KEYS.SHOTS, [...existing, ...newShots]);
      imported.shots = newShots.length;
    }

    if (data.brands) {
      const existing = merge ? getFromStorage<Brand[]>(STORAGE_KEYS.BRANDS, []) : [];
      const existingIds = new Set(existing.map(b => b.id));
      const newBrands = data.brands.filter(b => !existingIds.has(b.id));
      saveToStorage(STORAGE_KEYS.BRANDS, [...existing, ...newBrands]);
      imported.brands = newBrands.length;
    }

    if (data.characters) {
      const existing = merge ? getFromStorage<Character[]>(STORAGE_KEYS.CHARACTERS, []) : [];
      const existingIds = new Set(existing.map(c => c.id));
      const newCharacters = data.characters.filter(c => !existingIds.has(c.id));
      saveToStorage(STORAGE_KEYS.CHARACTERS, [...existing, ...newCharacters]);
      imported.characters = newCharacters.length;
    }

    if (data.team) {
      const existing = merge ? getFromStorage<TeamMember[]>(STORAGE_KEYS.TEAM, []) : [];
      const existingIds = new Set(existing.map(m => m.id));
      const newTeam = data.team.filter(m => !existingIds.has(m.id));
      saveToStorage(STORAGE_KEYS.TEAM, [...existing, ...newTeam]);
      imported.team = newTeam.length;
    }

    if (data.comments) {
      const existing = merge ? getFromStorage<Comment[]>(STORAGE_KEYS.COMMENTS, []) : [];
      const existingIds = new Set(existing.map(c => c.id));
      const newComments = data.comments.filter(c => !existingIds.has(c.id));
      saveToStorage(STORAGE_KEYS.COMMENTS, [...existing, ...newComments]);
      imported.comments = newComments.length;
    }

    if (data.prompts) {
      const existing = merge ? getFromStorage<GeneratedPrompt[]>(STORAGE_KEYS.PROMPTS, []) : [];
      const existingIds = new Set(existing.map(p => p.id));
      const newPrompts = data.prompts.filter(p => !existingIds.has(p.id));
      saveToStorage(STORAGE_KEYS.PROMPTS, [...existing, ...newPrompts]);
      imported.prompts = newPrompts.length;
    }

    return { success: true, errors, imported };
  } catch (error) {
    errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, errors, imported };
  }
}

export function downloadAsJson(data: ExportData, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}
