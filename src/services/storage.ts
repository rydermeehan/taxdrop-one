export const STORAGE_KEYS = {
  PROJECTS: 'video-studio-projects',
  SHOTS: 'video-studio-shots',
  BRANDS: 'video-studio-brands',
  CHARACTERS: 'video-studio-characters',
  TEAM: 'video-studio-team',
  COMMENTS: 'video-studio-comments',
  PROMPTS: 'video-studio-prompts',
  SETTINGS: 'video-studio-settings',
} as const;

export function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to save to localStorage: ${key}`, error);
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove from localStorage: ${key}`, error);
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
