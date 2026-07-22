// N8N Studio Publish Service
// Posts social content from the studio to OnlySocial via N8N webhook

const N8N_WEBHOOK_URL_KEY = 'n8n-publish-webhook-url';

export function getN8nWebhookUrl(): string | null {
  return localStorage.getItem(N8N_WEBHOOK_URL_KEY);
}

export function setN8nWebhookUrl(url: string): void {
  localStorage.setItem(N8N_WEBHOOK_URL_KEY, url);
}

export function hasN8nWebhookUrl(): boolean {
  const url = getN8nWebhookUrl();
  return !!url && url.length > 0;
}

export function clearN8nWebhookUrl(): void {
  localStorage.removeItem(N8N_WEBHOOK_URL_KEY);
}

export type PublishMode = 'now' | 'schedule' | 'draft';

export interface PublishRequest {
  platforms: Record<string, string>;
  imageUrl?: string;
  mode: PublishMode;
  scheduleDate?: string;
  scheduleTime?: string;
}

export interface PlatformResult {
  success: boolean;
  postId?: string;
  status?: string;
  error?: string;
}

export interface PublishResult {
  success: boolean;
  platforms: Record<string, PlatformResult>;
  count: number;
  timestamp: string;
  error?: string;
}

export async function publishViaN8n(request: PublishRequest): Promise<PublishResult> {
  const webhookUrl = getN8nWebhookUrl();
  if (!webhookUrl) {
    throw new Error('N8N webhook URL not configured. Go to Settings to add it.');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const text = await response.text();

  if (!response.ok) {
    let errorMsg = `N8N webhook failed: ${response.status} ${response.statusText}`;
    if (text) {
      try {
        const errorData = JSON.parse(text);
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch {
        errorMsg = text.slice(0, 200) || errorMsg;
      }
    }
    throw new Error(errorMsg);
  }

  // Handle empty response (workflow accepted but returned no body)
  if (!text || text.trim() === '') {
    return {
      success: true,
      platforms: Object.fromEntries(
        Object.keys(request.platforms).map(p => [p, { success: true, status: 'sent' }])
      ),
      count: Object.keys(request.platforms).length,
      timestamp: new Date().toISOString(),
    };
  }

  // Handle N8N returning "Workflow was started" text instead of JSON
  try {
    return JSON.parse(text);
  } catch {
    // Non-JSON response — treat as success if status was 200
    return {
      success: true,
      platforms: Object.fromEntries(
        Object.keys(request.platforms).map(p => [p, { success: true, status: 'sent' }])
      ),
      count: Object.keys(request.platforms).length,
      timestamp: new Date().toISOString(),
    };
  }
}
