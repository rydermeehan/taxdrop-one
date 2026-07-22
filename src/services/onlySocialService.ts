// OnlySocial API Service
// Uses Vercel serverless proxy to bypass CORS restrictions

const STORAGE_KEY_TOKEN = 'onlysocial-api-token';
const STORAGE_KEY_WORKSPACE = 'onlysocial-workspace-uuid';
const ONLYSOCIAL_PROXY_URL = '/api/onlysocial';

// Token management
export function getOnlySocialToken(): string | null {
  return localStorage.getItem(STORAGE_KEY_TOKEN);
}

export function setOnlySocialToken(token: string): void {
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
}

export function getWorkspaceUuid(): string | null {
  return localStorage.getItem(STORAGE_KEY_WORKSPACE);
}

export function setWorkspaceUuid(uuid: string): void {
  localStorage.setItem(STORAGE_KEY_WORKSPACE, uuid);
}

export function hasOnlySocialConfig(): boolean {
  const token = getOnlySocialToken();
  const workspace = getWorkspaceUuid();
  return !!token && token.length > 0 && !!workspace && workspace.length > 0;
}

export function clearOnlySocialConfig(): void {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_WORKSPACE);
}

// API request helper - routes through Vercel proxy to bypass CORS
async function onlySocialRequest<T>(
  endpoint: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = getOnlySocialToken();
  const workspaceUuid = getWorkspaceUuid();

  if (!token) {
    throw new Error('OnlySocial API token not configured');
  }

  if (!workspaceUuid) {
    throw new Error('OnlySocial workspace UUID not configured');
  }

  const response = await fetch(ONLYSOCIAL_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: endpoint.replace(/^\//, ''), // Remove leading slash
      token,
      workspaceUuid,
      method: options.method || 'GET',
      body: options.body,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('OnlySocial API error:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
    });
    throw new Error(
      errorData.message || errorData.error || `API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

// Types
export interface OnlySocialAccount {
  id: number;
  uuid: string;
  name: string;
  username: string;
  provider: string;
  image: string;
}

export interface OnlySocialPost {
  id: number;
  uuid: string;
  status: string;
  scheduled_at?: string;
  published_at?: string;
}

export interface PostVersion {
  account_id: number;
  is_original: boolean;
  content: {
    body: string;
    media: string[];
    url?: string;
  }[];
  options: Record<string, unknown>;
}

export interface CreatePostRequest {
  accounts: string[];
  versions: PostVersion[];
  date: string | null;
  time: string;
  tags?: string[];
}

// Platform option helpers
export function getDefaultPlatformOptions(provider: string): Record<string, unknown> {
  const defaults: Record<string, Record<string, unknown>> = {
    instagram: {
      type: 'feed',
      share_to_feed: true,
    },
    facebook_page: {
      type: 'post',
    },
    twitter: {},
    linkedin: {
      visibility: 'PUBLIC',
    },
    tiktok: {
      privacy_level: 'PUBLIC_TO_EVERYONE',
      allow_comments: true,
      allow_duet: true,
      allow_stitch: true,
    },
    pinterest: {
      board_id: null,
    },
    threads: {},
    bluesky: {},
  };

  return defaults[provider.toLowerCase()] || {};
}

// API Functions

// List connected social accounts
export async function listAccounts(): Promise<OnlySocialAccount[]> {
  const response = await onlySocialRequest<{ data: OnlySocialAccount[] }>('/accounts');
  return response.data || [];
}

// Create a post (draft or scheduled)
export async function createPost(
  accountIds: number[],
  content: string,
  mediaUrls: string[] = [],
  scheduledDate?: Date
): Promise<OnlySocialPost> {
  const accounts = await listAccounts();
  const selectedAccounts = accounts.filter(a => accountIds.includes(a.id));

  if (selectedAccounts.length === 0) {
    throw new Error('No valid accounts selected');
  }

  const versions: PostVersion[] = selectedAccounts.map((account, index) => ({
    account_id: account.id,
    is_original: index === 0,
    content: [{
      body: content,
      media: mediaUrls,
    }],
    options: getDefaultPlatformOptions(account.provider),
  }));

  const request: CreatePostRequest = {
    accounts: selectedAccounts.map(a => a.uuid),
    versions,
    date: scheduledDate ? formatDate(scheduledDate) : null,
    time: scheduledDate ? formatTime(scheduledDate) : '09:00',
    tags: [],
  };

  return onlySocialRequest<OnlySocialPost>('/posts', {
    method: 'POST',
    body: request,
  });
}

// Add post to queue (schedule it)
export async function addToQueue(postUuid: string): Promise<{ success: boolean; scheduled_at: string }> {
  return onlySocialRequest(`/posts/add-to-queue/${postUuid}`, {
    method: 'POST',
  });
}

// Upload media file
export async function uploadMedia(file: File): Promise<{ uuid: string; url: string }> {
  const token = getOnlySocialToken();
  const workspaceUuid = getWorkspaceUuid();

  if (!token || !workspaceUuid) {
    throw new Error('OnlySocial not fully configured (token or workspace missing)');
  }

  // Convert file to base64 for transmission through proxy
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get just the base64 data
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const response = await fetch(ONLYSOCIAL_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: 'media/upload',
      token,
      workspaceUuid,
      method: 'POST',
      body: {
        file: {
          name: file.name,
          type: file.type,
          base64: base64,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to upload media: ${response.statusText}`);
  }

  return response.json();
}

// Verify token and workspace are valid
export async function verifyConfig(): Promise<boolean> {
  try {
    const accounts = await listAccounts();
    console.log('OnlySocial accounts found:', accounts);
    return true;
  } catch (error) {
    console.error('OnlySocial verification failed:', error);
    return false;
  }
}

// Helper functions
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

// Map platform names to OnlySocial providers
export const PLATFORM_PROVIDERS: Record<string, string> = {
  'instagram-square': 'instagram',
  'instagram-story': 'instagram',
  'facebook-post': 'facebook_page',
  'linkedin-post': 'linkedin',
  'twitter-post': 'twitter',
};
