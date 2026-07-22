import type { VercelRequest, VercelResponse } from '@vercel/node';

// This proxy handles the OAuth token exchange for Google Search Console
// Required because web applications need to use client_secret which can't be exposed in frontend

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, clientId, clientSecret, code, codeVerifier, refreshToken, redirectUri } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: 'Missing clientId' });
  }

  try {
    if (action === 'exchange') {
      // Exchange authorization code for tokens
      if (!code || !redirectUri) {
        return res.status(400).json({ error: 'Missing code or redirectUri' });
      }

      const params: Record<string, string> = {
        client_id: clientId,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      };

      // Add client_secret if provided (required for web apps)
      if (clientSecret) {
        params.client_secret = clientSecret;
      }

      // Add code_verifier for PKCE flow
      if (codeVerifier) {
        params.code_verifier = codeVerifier;
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Token exchange failed:', data);
        return res.status(response.status).json(data);
      }

      return res.status(200).json(data);

    } else if (action === 'refresh') {
      // Refresh access token
      if (!refreshToken) {
        return res.status(400).json({ error: 'Missing refreshToken' });
      }

      const params: Record<string, string> = {
        client_id: clientId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      };

      if (clientSecret) {
        params.client_secret = clientSecret;
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Token refresh failed:', data);
        return res.status(response.status).json(data);
      }

      return res.status(200).json(data);

    } else {
      return res.status(400).json({ error: 'Invalid action. Use "exchange" or "refresh"' });
    }
  } catch (error) {
    console.error('GSC OAuth proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
