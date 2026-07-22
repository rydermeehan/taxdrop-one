// Vercel Blob helpers for the TaxDrop One review flow.
// Underscore-prefixed → not a Vercel endpoint; imported by blob-upload.ts.
//
// Only the RAW uploaded evidence files live in Blob (PDFs/spreadsheets — binary
// and up to 10MB, which is too big to round-trip through a serverless JSON
// body). Everything small and editable (intake fields, status, the auto-draft
// JSON, reviewer overrides) lives in Postgres via _reviews.ts.
//
// Files are uploaded straight from the browser to Blob via the client-upload
// protocol (blob-upload.ts mints a short-lived, path-scoped token). That keeps
// the bytes off our serverless functions entirely.
//
// Requires BLOB_READ_WRITE_TOKEN, which Vercel injects automatically once a
// Blob store is connected to the `video-studio` project (Storage tab → create
// store → connect). Locally, pull it with `vercel env pull`.

export const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'text/csv',
  'text/tab-separated-values',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/octet-stream', // some browsers send this for .xlsb/.xls
];

export function isBlobConfigured(): boolean {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || '');
}

// Blob keys are namespaced by jti so a reviewer can find every file for one
// purchase, and one purchase can never overwrite/read another's uploads. The
// client-upload flow adds a random suffix, so same-name files won't collide.
export function evidencePrefix(jti: string): string {
  const safeJti = String(jti || '').replace(/[^a-zA-Z0-9._:-]+/g, '_').slice(0, 120);
  return `one/reviews/${safeJti}/`;
}

export function evidenceKey(jti: string, filename: string): string {
  const safeName = String(filename || 'evidence')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(-80);
  return evidencePrefix(jti) + safeName;
}
