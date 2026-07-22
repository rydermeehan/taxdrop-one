import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';

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
    const { webflowToken, siteId, fileName, base64Data } = req.body as {
      webflowToken: string;
      siteId: string;
      fileName: string;
      base64Data: string; // raw base64 (no data: prefix)
    };

    if (!webflowToken || !siteId || !fileName || !base64Data) {
      return res.status(400).json({ error: 'Missing required fields: webflowToken, siteId, fileName, base64Data' });
    }

    // Step 1: Decode base64 to binary buffer
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // Check size (Webflow limit: 4MB)
    if (fileBuffer.length > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image exceeds 4MB Webflow limit' });
    }

    // Step 2: Compute MD5 hash
    const fileHash = createHash('md5').update(fileBuffer).digest('hex');

    // Step 3: Create asset record in Webflow
    const createResponse = await fetch(`${WEBFLOW_API_BASE}/sites/${siteId}/assets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName, fileHash }),
    });

    if (!createResponse.ok) {
      const errData = await createResponse.json().catch(() => ({}));
      return res.status(createResponse.status).json({
        error: 'Webflow asset creation failed',
        details: errData,
      });
    }

    const assetRecord = await createResponse.json();
    const { uploadUrl, uploadDetails } = assetRecord;

    if (!uploadUrl || !uploadDetails) {
      // Asset may already exist (duplicate hash) — return existing asset info
      return res.status(200).json({
        assetId: assetRecord.id || assetRecord._id,
        fileId: assetRecord.id || assetRecord._id,
        url: assetRecord.hostedUrl || assetRecord.assetUrl || assetRecord.url || '',
      });
    }

    // Step 4: Upload file to S3 presigned URL via multipart form-data
    const boundary = '----WebflowAssetUpload' + Date.now();
    const parts: Buffer[] = [];

    // Add all uploadDetails fields as form fields
    for (const [key, value] of Object.entries(uploadDetails)) {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
      ));
    }

    // Add the file
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: image/png\r\n\r\n`
    ));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const formBody = Buffer.concat(parts);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': formBody.length.toString(),
      },
      body: formBody,
    });

    if (!uploadResponse.ok && uploadResponse.status !== 201 && uploadResponse.status !== 204) {
      const uploadErr = await uploadResponse.text().catch(() => 'Unknown upload error');
      return res.status(500).json({
        error: 'S3 upload failed',
        status: uploadResponse.status,
        details: uploadErr,
      });
    }

    // Step 5: Return asset info
    return res.status(200).json({
      assetId: assetRecord.id || assetRecord._id,
      fileId: assetRecord.id || assetRecord._id,
      url: assetRecord.hostedUrl || assetRecord.assetUrl || assetRecord.url || '',
    });

  } catch (error) {
    console.error('Webflow asset upload error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
