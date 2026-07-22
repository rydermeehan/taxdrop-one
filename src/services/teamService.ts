import type { TeamMember, TeamRole } from '../types';
import { STORAGE_KEYS, getFromStorage, saveToStorage, generateId, getCurrentTimestamp } from './storage';

const ROLE_COLORS: Record<TeamRole, string> = {
  writer: '#6366F1',
  director: '#EC4899',
  cinematographer: '#F97316',
  animator: '#3B82F6',
  editor: '#22C55E',
};

export function getTeamMembers(): TeamMember[] {
  return getFromStorage<TeamMember[]>(STORAGE_KEYS.TEAM, []);
}

export function getMemberById(id: string): TeamMember | null {
  const members = getTeamMembers();
  return members.find(m => m.id === id) ?? null;
}

export function getMembersByRole(role: TeamRole): TeamMember[] {
  return getTeamMembers().filter(m => m.role === role);
}

export function createMember(data: {
  name: string;
  email?: string;
  role: TeamRole;
  avatar?: string;
}): TeamMember {
  const members = getTeamMembers();
  const now = getCurrentTimestamp();

  const member: TeamMember = {
    id: generateId(),
    name: data.name,
    email: data.email,
    role: data.role,
    avatar: data.avatar,
    color: ROLE_COLORS[data.role],
    createdAt: now,
  };

  members.push(member);
  saveToStorage(STORAGE_KEYS.TEAM, members);
  return member;
}

export function updateMember(id: string, updates: Partial<TeamMember>): TeamMember | null {
  const members = getTeamMembers();
  const index = members.findIndex(m => m.id === id);

  if (index === -1) return null;

  if (updates.role && updates.role !== members[index].role) {
    updates.color = ROLE_COLORS[updates.role];
  }

  const updated: TeamMember = {
    ...members[index],
    ...updates,
    id: members[index].id,
    createdAt: members[index].createdAt,
  };

  members[index] = updated;
  saveToStorage(STORAGE_KEYS.TEAM, members);
  return updated;
}

export function deleteMember(id: string): boolean {
  const members = getTeamMembers();
  const filtered = members.filter(m => m.id !== id);

  if (filtered.length === members.length) return false;

  saveToStorage(STORAGE_KEYS.TEAM, filtered);
  return true;
}

export function getMemberInitials(member: TeamMember): string {
  const parts = member.name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
