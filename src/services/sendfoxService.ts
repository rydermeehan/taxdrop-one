// SendFox API Service
// For email marketing campaigns and contact management
// Uses Vercel serverless proxy to bypass CORS

import { getFromStorage, saveToStorage } from './storage';

const SENDFOX_PROXY_URL = '/api/sendfox';
const SETTINGS_KEY = 'video-studio-sendfox';

interface SendFoxSettings {
  apiKey: string;
}

export interface SendFoxList {
  id: number;
  name: string;
  subscribers_count?: number;
}

export interface SendFoxContact {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  created_at?: string;
}

export interface SendFoxCampaign {
  id: number;
  name: string;
  subject?: string;
  status?: string;
  created_at?: string;
}

// Settings management
export function getSendFoxSettings(): SendFoxSettings {
  return getFromStorage<SendFoxSettings>(SETTINGS_KEY, {
    apiKey: '',
  });
}

export function saveSendFoxSettings(settings: Partial<SendFoxSettings>): void {
  const current = getSendFoxSettings();
  saveToStorage(SETTINGS_KEY, { ...current, ...settings });
}

export function hasSendFoxApiKey(): boolean {
  const settings = getSendFoxSettings();
  return !!settings.apiKey && settings.apiKey.length > 0;
}

// API request helper - routes through Vercel proxy
async function sendfoxRequest<T>(
  endpoint: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const settings = getSendFoxSettings();

  if (!settings.apiKey) {
    throw new Error('SendFox API key not configured. Go to Settings to add your key.');
  }

  const response = await fetch(SENDFOX_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint,
      apiKey: settings.apiKey,
      method: options.method || 'GET',
      body: options.body,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `API error: ${response.status}`);
  }

  return response.json();
}

// Verify API key is valid - also uses proxy
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(SENDFOX_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: '/me',
        apiKey,
        method: 'GET',
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Get current user info
export async function getCurrentUser(): Promise<{ id: number; name: string; email: string }> {
  return sendfoxRequest('/me');
}

// List Management
export async function getLists(): Promise<SendFoxList[]> {
  const response = await sendfoxRequest<{ data: SendFoxList[] }>('/lists');
  return response.data || [];
}

export async function createList(name: string): Promise<SendFoxList> {
  return sendfoxRequest<SendFoxList>('/lists', {
    method: 'POST',
    body: { name },
  });
}

// Contact Management
export async function getContacts(): Promise<SendFoxContact[]> {
  const response = await sendfoxRequest<{ data: SendFoxContact[] }>('/contacts');
  return response.data || [];
}

export async function createContact(
  email: string,
  options?: {
    firstName?: string;
    lastName?: string;
    lists?: number[];
  }
): Promise<SendFoxContact> {
  return sendfoxRequest<SendFoxContact>('/contacts', {
    method: 'POST',
    body: {
      email,
      first_name: options?.firstName,
      last_name: options?.lastName,
      lists: options?.lists,
    },
  });
}

// Campaign Management
export async function getCampaigns(): Promise<SendFoxCampaign[]> {
  const response = await sendfoxRequest<{ data: SendFoxCampaign[] }>('/campaigns');
  return response.data || [];
}

// Note: SendFox API doesn't support creating campaigns via API directly
// Campaigns must be created in their dashboard
export interface EmailContent {
  subject: string;
  body: string;
  listIds?: number[];
}

// Verify config is working
export async function verifySendFoxConfig(): Promise<boolean> {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}
