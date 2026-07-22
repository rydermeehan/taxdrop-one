import type { VercelRequest, VercelResponse } from '@vercel/node';

const WEBFLOW_API_BASE = 'https://api.webflow.com/v2';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { webflowToken, endpoint, method, body } = req.body as {
      webflowToken: string;
      endpoint: string;   // e.g. "/collections/xxx/items"
      method: string;     // GET, POST, PATCH, etc.
      body?: unknown;
    };

    if (!webflowToken || !endpoint || !method) {
      return res.status(400).json({
        error: 'Missing required fields: webflowToken, endpoint, method',
      });
    }

    // Prevent path traversal — endpoint must start with /
    if (!endpoint.startsWith('/')) {
      return res.status(400).json({ error: 'endpoint must start with /' });
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(`${WEBFLOW_API_BASE}${endpoint}`, fetchOptions);

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Webflow API error',
        status: response.status,
        statusText: response.statusText,
        message: responseData.message || responseData.msg || response.statusText,
        details: responseData,
      });
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Webflow CMS proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
