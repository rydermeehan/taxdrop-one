import type { VercelRequest, VercelResponse } from '@vercel/node';

const NEUROWRITER_API_URL = 'https://app.neuronwriter.com/neuron-api/0.5/writer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-KEY');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint, apiKey, body } = req.body;

  if (!endpoint || !apiKey) {
    return res.status(400).json({ error: 'Missing endpoint or apiKey' });
  }

  try {
    const url = `${NEUROWRITER_API_URL}${endpoint}`;
    console.log(`NeuronWriter proxy: ${endpoint}`, JSON.stringify(body || {}));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify(body || {}),
    });

    const text = await response.text();
    console.log(`NeuronWriter response (${response.status}):`, text.substring(0, 500));

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: 'Invalid JSON from NeuronWriter',
        raw: text.substring(0, 200),
      });
    }

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('NeuronWriter proxy error:', error);
    return res.status(500).json({
      error: 'Failed to proxy request to NeuronWriter',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
