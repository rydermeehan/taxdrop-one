import type { Project, ProjectStatus } from '../types';
import { STORAGE_KEYS, getFromStorage, saveToStorage, generateId, getCurrentTimestamp } from './storage';

export function getProjects(): Project[] {
  return getFromStorage<Project[]>(STORAGE_KEYS.PROJECTS, []);
}

export function getProjectById(id: string): Project | null {
  const projects = getProjects();
  return projects.find(p => p.id === id) ?? null;
}

export function createProject(data: {
  name: string;
  description: string;
  brandId?: string | null;
  targetDuration?: number;
}): Project {
  const projects = getProjects();
  const now = getCurrentTimestamp();

  const project: Project = {
    id: generateId(),
    name: data.name,
    description: data.description,
    brandId: data.brandId ?? null,
    shotIds: [],
    teamMemberIds: [],
    status: 'draft',
    targetDuration: data.targetDuration ?? 30,
    createdAt: now,
    updatedAt: now,
  };

  projects.push(project);
  saveToStorage(STORAGE_KEYS.PROJECTS, projects);
  return project;
}

export function updateProject(id: string, updates: Partial<Project>): Project | null {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === id);

  if (index === -1) return null;

  const updated: Project = {
    ...projects[index],
    ...updates,
    id: projects[index].id,
    createdAt: projects[index].createdAt,
    updatedAt: getCurrentTimestamp(),
  };

  projects[index] = updated;
  saveToStorage(STORAGE_KEYS.PROJECTS, projects);
  return updated;
}

export function deleteProject(id: string): boolean {
  const projects = getProjects();
  const filtered = projects.filter(p => p.id !== id);

  if (filtered.length === projects.length) return false;

  saveToStorage(STORAGE_KEYS.PROJECTS, filtered);
  return true;
}

export function addShotToProject(projectId: string, shotId: string): Project | null {
  const project = getProjectById(projectId);
  if (!project) return null;

  if (!project.shotIds.includes(shotId)) {
    return updateProject(projectId, {
      shotIds: [...project.shotIds, shotId],
    });
  }
  return project;
}

export function removeShotFromProject(projectId: string, shotId: string): Project | null {
  const project = getProjectById(projectId);
  if (!project) return null;

  return updateProject(projectId, {
    shotIds: project.shotIds.filter(id => id !== shotId),
  });
}

export function addTeamMemberToProject(projectId: string, memberId: string): Project | null {
  const project = getProjectById(projectId);
  if (!project) return null;

  if (!project.teamMemberIds.includes(memberId)) {
    return updateProject(projectId, {
      teamMemberIds: [...project.teamMemberIds, memberId],
    });
  }
  return project;
}

export function removeTeamMemberFromProject(projectId: string, memberId: string): Project | null {
  const project = getProjectById(projectId);
  if (!project) return null;

  return updateProject(projectId, {
    teamMemberIds: project.teamMemberIds.filter(id => id !== memberId),
  });
}

export function updateProjectStatus(projectId: string, status: ProjectStatus): Project | null {
  return updateProject(projectId, { status });
}

export function getProjectsByStatus(status: ProjectStatus): Project[] {
  return getProjects().filter(p => p.status === status);
}
