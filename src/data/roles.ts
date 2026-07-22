import type { TeamRole } from '../types';

export interface RoleInfo {
  id: TeamRole;
  name: string;
  description: string;
  color: string;
  responsibilities: string[];
}

export const teamRoles: RoleInfo[] = [
  {
    id: 'writer',
    name: 'Writer',
    description: 'Script and concept development',
    color: '#6366F1',
    responsibilities: [
      'Develop scripts and concepts',
      'Create shot lists',
      'Write dialogue',
      'Generate script variations',
    ],
  },
  {
    id: 'director',
    name: 'Director',
    description: 'Creative vision and shot decisions',
    color: '#EC4899',
    responsibilities: [
      'Set creative direction',
      'Approve shot compositions',
      'Guide overall style',
      'Make final creative decisions',
    ],
  },
  {
    id: 'cinematographer',
    name: 'Cinematographer',
    description: 'Visual composition and lighting direction',
    color: '#F97316',
    responsibilities: [
      'Plan camera angles and movements',
      'Define lighting styles',
      'Create visual references',
      'Ensure visual consistency',
    ],
  },
  {
    id: 'animator',
    name: 'Animator',
    description: 'Image-to-video generation and motion',
    color: '#3B82F6',
    responsibilities: [
      'Generate still images',
      'Animate images to video',
      'Refine motion and transitions',
      'Manage AI generation tools',
    ],
  },
  {
    id: 'editor',
    name: 'Editor',
    description: 'Assembly, pacing, sound design',
    color: '#22C55E',
    responsibilities: [
      'Assemble final video',
      'Add music and sound effects',
      'Color grading',
      'Apply text overlays and CTAs',
    ],
  },
];

export function getRoleInfo(roleId: TeamRole): RoleInfo | undefined {
  return teamRoles.find(r => r.id === roleId);
}

export function getRoleColor(roleId: TeamRole): string {
  return getRoleInfo(roleId)?.color ?? '#5C666F';
}
