// Trend Monitor → Social Media handoff
export interface TrendIdeaTransfer {
  hook: string;
  caption: string;
  hashtags: string[];
  imagePrompt?: string;
  platform: string;   // e.g. 'LinkedIn', 'Instagram', 'All Platforms'
  format: string;     // e.g. 'meme', 'tip', 'commentary'
  topic: string;
  audience: string;
  day: string;
}

// Workflow Stages
export type WorkflowStage =
  | 'script-development'
  | 'visual-planning'
  | 'character-consistency'
  | 'location-spatial'
  | 'image-generation'
  | 'animation'
  | 'post-production';

export type ProjectStatus = 'draft' | 'in-progress' | 'review' | 'completed' | 'archived';

export type ShotType =
  | 'establishing'
  | 'wide'
  | 'medium'
  | 'close-up'
  | 'extreme-close-up'
  | 'over-shoulder'
  | 'pov'
  | 'aerial'
  | 'tracking'
  | 'static';

export type ShotStatus = 'planned' | 'in-progress' | 'review' | 'approved' | 'needs-revision';

export type TeamRole = 'writer' | 'director' | 'cinematographer' | 'animator' | 'editor';

// Project
export interface Project {
  id: string;
  name: string;
  description: string;
  brandId: string | null;
  shotIds: string[];
  teamMemberIds: string[];
  status: ProjectStatus;
  targetDuration: number;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
}

// Shot
export interface ImageRef {
  id: string;
  url: string;
  type: 'reference' | 'generated' | 'animated';
  prompt?: string;
  createdAt: string;
}

export interface Shot {
  id: string;
  projectId: string;
  name: string;
  stage: WorkflowStage;
  shotType: ShotType;
  duration: number;
  action: string;
  dialogue: string;
  visualDescription: string;
  cameraMovement?: string;
  characterIds: string[];
  locationDescription?: string;
  imageRefs: ImageRef[];
  generatedPrompt?: string;
  status: ShotStatus;
  assignedTo?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// Brand
export interface ColorPalette {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  additionalColors: string[];
}

export interface StyleGuide {
  id: string;
  name: string;
  artStyle: string;
  lightingStyle: string;
  moodKeywords: string[];
  avoidKeywords: string[];
  qualityModifiers: string[];
  aspectRatio: string;
  customPromptSuffix?: string;
}

export interface Brand {
  id: string;
  name: string;
  description: string;
  characterIds: string[];
  colorPalettes: ColorPalette[];
  styleGuides: StyleGuide[];
  defaultStyleGuideId?: string;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
}

// Character
export interface CharacterRef {
  id: string;
  type: 'portrait' | 'full-body' | 'expression' | 'pose';
  imageUrl: string;
  description: string;
  createdAt: string;
}

export interface Character {
  id: string;
  brandId: string;
  name: string;
  shorthand: string;
  description: string;
  personality?: string;
  outfit?: string;
  distinguishingFeatures?: string;
  refs: CharacterRef[];
  portraitRefId?: string;
  fullBodyRefId?: string;
  createdAt: string;
  updatedAt: string;
}

// Team
export interface TeamMember {
  id: string;
  name: string;
  email?: string;
  role: TeamRole;
  avatar?: string;
  color: string;
  createdAt: string;
}

// Comment
export interface Comment {
  id: string;
  shotId: string;
  authorId: string;
  text: string;
  timestamp: string;
  resolved: boolean;
  parentId?: string;
}

// Prompt
export interface PromptVariable {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'character' | 'color';
  placeholder?: string;
  options?: string[];
  required: boolean;
  defaultValue?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  category: 'scene' | 'character-portrait' | 'character-fullbody' | 'location' | 'motion';
  description: string;
  template: string;
  variables: PromptVariable[];
  negativePrompt?: string;
  exampleOutput?: string;
}

export interface GeneratedPrompt {
  id: string;
  templateId: string;
  shotId?: string;
  values: Record<string, string>;
  output: string;
  negativePrompt?: string;
  createdAt: string;
}

// Blog Image
export type BlogImageType = 'hero' | 'thumbnail' | 'social-og' | 'social-square' | 'social-mobile' | 'inline';

export interface BlogImage {
  id: string;
  title: string;
  type: BlogImageType;
  prompt: string;
  negativePrompt?: string;
  imageUrl?: string;
  aspectRatio: '16:9' | '1:1' | '4:3' | '1.91:1' | '9:16';
  brandId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BlogImageTemplate {
  id: string;
  name: string;
  type: BlogImageType;
  description: string;
  aspectRatio: '16:9' | '1:1' | '4:3' | '1.91:1' | '9:16';
  promptTemplate: string;
  variables: PromptVariable[];
  styleHints: string[];
}

// Export Data
export interface ExportData {
  version: string;
  exportedAt: string;
  projects: Project[];
  shots: Shot[];
  brands: Brand[];
  characters: Character[];
  team: TeamMember[];
  comments: Comment[];
  prompts: GeneratedPrompt[];
  blogImages?: BlogImage[];
}
