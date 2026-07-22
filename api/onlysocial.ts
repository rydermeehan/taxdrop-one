import type { VercelRequest, VercelResponse } from '@vercel/node';

const ONLYSOCIAL_API_URL = 'https://app.onlysocial.io/os/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { endpoint, token, workspaceUuid, method = 'GET', body } = req.body as {
      endpoint: string;
      token: string;
      workspaceUuid: string;
      method?: string;
      body?: unknown;
    };

    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    if (!token) {
      return res.status(400).json({ error: 'Missing token parameter' });
    }

    if (!workspaceUuid) {
      return res.status(400).json({ error: 'Missing workspaceUuid parameter' });
    }

    // Build the full URL with workspace UUID
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${ONLYSOCIAL_API_URL}/${workspaceUuid}/${cleanEndpoint}`;

    console.log('OnlySocial proxy request:', { url, method });

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    // Try to parse as JSON, fallback to text
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!response.ok) {
      console.error('OnlySocial API error:', { status: response.status, data });
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('OnlySocial proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
