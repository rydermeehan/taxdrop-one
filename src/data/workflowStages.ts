import type { WorkflowStage } from '../types';

export interface StageInfo {
  id: WorkflowStage;
  name: string;
  shortName: string;
  description: string;
  color: string;
  order: number;
}

export const workflowStages: StageInfo[] = [
  {
    id: 'script-development',
    name: 'Script Development',
    shortName: 'Script',
    description: 'Write and refine the script, develop shot list',
    color: '#6366F1',
    order: 1,
  },
  {
    id: 'visual-planning',
    name: 'Visual Planning',
    shortName: 'Planning',
    description: 'Create mood boards, style references, color palettes',
    color: '#8B5CF6',
    order: 2,
  },
  {
    id: 'character-consistency',
    name: 'Character Consistency',
    shortName: 'Characters',
    description: 'Generate character sheets, establish @notation references',
    color: '#EC4899',
    order: 3,
  },
  {
    id: 'location-spatial',
    name: 'Location & Spatial',
    shortName: 'Locations',
    description: 'Create location references, 2x2 grid shots for spatial coherence',
    color: '#F97316',
    order: 4,
  },
  {
    id: 'image-generation',
    name: 'Image Generation',
    shortName: 'Images',
    description: 'Generate still frames for each shot',
    color: '#14B8A6',
    order: 5,
  },
  {
    id: 'animation',
    name: 'Animation',
    shortName: 'Animation',
    description: 'Convert images to video with Veo, Kling, or Runway',
    color: '#3B82F6',
    order: 6,
  },
  {
    id: 'post-production',
    name: 'Post-Production',
    shortName: 'Post',
    description: 'Edit, color grade, add music, finalize',
    color: '#22C55E',
    order: 7,
  },
];

export function getStageInfo(stageId: WorkflowStage): StageInfo | undefined {
  return workflowStages.find(s => s.id === stageId);
}

export function getNextStage(currentStage: WorkflowStage): WorkflowStage | null {
  const currentIndex = workflowStages.findIndex(s => s.id === currentStage);
  if (currentIndex === -1 || currentIndex === workflowStages.length - 1) return null;
  return workflowStages[currentIndex + 1].id;
}

export function getPreviousStage(currentStage: WorkflowStage): WorkflowStage | null {
  const currentIndex = workflowStages.findIndex(s => s.id === currentStage);
  if (currentIndex <= 0) return null;
  return workflowStages[currentIndex - 1].id;
}
