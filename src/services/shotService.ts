import type { Shot, WorkflowStage, ShotStatus, ImageRef } from '../types';
import { STORAGE_KEYS, getFromStorage, saveToStorage, generateId, getCurrentTimestamp } from './storage';
import { addShotToProject, removeShotFromProject } from './projectService';

export function getShots(): Shot[] {
  return getFromStorage<Shot[]>(STORAGE_KEYS.SHOTS, []);
}

export function getShotById(id: string): Shot | null {
  const shots = getShots();
  return shots.find(s => s.id === id) ?? null;
}

export function getShotsByProject(projectId: string): Shot[] {
  return getShots()
    .filter(s => s.projectId === projectId)
    .sort((a, b) => a.order - b.order);
}

export function getShotsByStage(projectId: string, stage: WorkflowStage): Shot[] {
  return getShotsByProject(projectId).filter(s => s.stage === stage);
}

export function createShot(data: {
  projectId: string;
  name: string;
  stage?: WorkflowStage;
  shotType?: Shot['shotType'];
  duration?: number;
  action?: string;
  dialogue?: string;
  visualDescription?: string;
}): Shot {
  const shots = getShots();
  const projectShots = getShotsByProject(data.projectId);
  const now = getCurrentTimestamp();

  const shot: Shot = {
    id: generateId(),
    projectId: data.projectId,
    name: data.name,
    stage: data.stage ?? 'script-development',
    shotType: data.shotType ?? 'medium',
    duration: data.duration ?? 3,
    action: data.action ?? '',
    dialogue: data.dialogue ?? '',
    visualDescription: data.visualDescription ?? '',
    characterIds: [],
    imageRefs: [],
    status: 'planned',
    order: projectShots.length,
    createdAt: now,
    updatedAt: now,
  };

  shots.push(shot);
  saveToStorage(STORAGE_KEYS.SHOTS, shots);
  addShotToProject(data.projectId, shot.id);

  return shot;
}

export function updateShot(id: string, updates: Partial<Shot>): Shot | null {
  const shots = getShots();
  const index = shots.findIndex(s => s.id === id);

  if (index === -1) return null;

  const updated: Shot = {
    ...shots[index],
    ...updates,
    id: shots[index].id,
    projectId: shots[index].projectId,
    createdAt: shots[index].createdAt,
    updatedAt: getCurrentTimestamp(),
  };

  shots[index] = updated;
  saveToStorage(STORAGE_KEYS.SHOTS, shots);
  return updated;
}

export function deleteShot(id: string): boolean {
  const shots = getShots();
  const shot = shots.find(s => s.id === id);
  if (!shot) return false;

  const filtered = shots.filter(s => s.id !== id);
  saveToStorage(STORAGE_KEYS.SHOTS, filtered);
  removeShotFromProject(shot.projectId, id);

  return true;
}

export function moveShot(id: string, toStage: WorkflowStage): Shot | null {
  return updateShot(id, { stage: toStage });
}

export function updateShotStatus(id: string, status: ShotStatus): Shot | null {
  return updateShot(id, { status });
}

export function reorderShots(projectId: string, shotIds: string[]): void {
  const shots = getShots();

  shotIds.forEach((shotId, index) => {
    const shotIndex = shots.findIndex(s => s.id === shotId && s.projectId === projectId);
    if (shotIndex !== -1) {
      shots[shotIndex] = { ...shots[shotIndex], order: index, updatedAt: getCurrentTimestamp() };
    }
  });

  saveToStorage(STORAGE_KEYS.SHOTS, shots);
}

export function addImageRef(shotId: string, imageRef: Omit<ImageRef, 'id' | 'createdAt'>): Shot | null {
  const shot = getShotById(shotId);
  if (!shot) return null;

  const newRef: ImageRef = {
    ...imageRef,
    id: generateId(),
    createdAt: getCurrentTimestamp(),
  };

  return updateShot(shotId, {
    imageRefs: [...shot.imageRefs, newRef],
  });
}

export function removeImageRef(shotId: string, imageRefId: string): Shot | null {
  const shot = getShotById(shotId);
  if (!shot) return null;

  return updateShot(shotId, {
    imageRefs: shot.imageRefs.filter(ref => ref.id !== imageRefId),
  });
}

export function setGeneratedPrompt(shotId: string, prompt: string): Shot | null {
  return updateShot(shotId, { generatedPrompt: prompt });
}
