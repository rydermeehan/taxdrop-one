import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Stub the shared request layer so the handler test exercises only routing,
// validation, and the CraftMyPDF call.
vi.mock('./_forms-common.js', () => ({
  gate: vi.fn(async () => ({ ok: true })),
  lookupSubject: vi.fn(async () => ({
    county: 'harris',
    parcel_id: 'ACC-1',
    full_address: '123 Oak St, Houston, TX 77002',
    us_state: 'TX',
  })),
  CMP_API_KEY: 'test-key',
  CMP_ENDPOINT: 'https://cmp.test/create',
}));

import handler from './generate-forms.js';
import { lookupSubject } from './_forms-common.js';

function mockRes() {
  return {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this.body = b; return this; },
    end() { return this; },
  };
}

beforeEach(() => {
  // Pre-fill is dark by default (FORMS_PREFILL_ENABLED gate in generate-forms.ts);
  // these tests exercise the pre-fill behavior itself, so turn it on.
  vi.stubEnv('FORMS_PREFILL_ENABLED', '1');
  vi.stubEnv('CRAFTMYPDF_TEMPLATE_50_132_OVER120K', '47b77b2358c5b082');
  vi.stubEnv('CRAFTMYPDF_TEMPLATE_50_132_UNDER120K', 'dc977b235ab91110');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ file: 'https://files.test/form.pdf' }) })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('renders the TX over-120k template and returns the file url', async () => {
  const req: any = { method: 'POST', headers: {}, body: { address: '123 Oak St, Houston, TX 77002', inputs: { name: 'Jane', street: '123 Oak St', cityStateZip: 'Houston, TX 77002' } } };
  const res = mockRes();
  await handler(req, res as any);
  expect(res.statusCode).toBe(200);
  expect(res.body).toMatchObject({ ok: true, file: 'https://files.test/form.pdf', state: 'TX', county: 'harris', form: 'Form 50-132' });
  const call = (globalThis.fetch as any).mock.calls[0];
  expect(call[0]).toBe('https://cmp.test/create');
  expect(JSON.parse(call[1].body).template_id).toBe('47b77b2358c5b082');
});

it('accepts the legacy `owner` body as an alias for `inputs`', async () => {
  const req: any = { method: 'POST', headers: {}, body: { address: 'x', owner: { name: 'Jane', street: '123 Oak St', cityStateZip: 'Houston, TX 77002' } } };
  const res = mockRes();
  await handler(req, res as any);
  expect(res.statusCode).toBe(200);
  expect(res.body.ok).toBe(true);
});

it('400s missing_fields when a required field is blank', async () => {
  const req: any = { method: 'POST', headers: {}, body: { address: 'x', inputs: { name: 'Jane' } } };
  const res = mockRes();
  await handler(req, res as any);
  expect(res.statusCode).toBe(400);
  expect(res.body.error).toBe('missing_fields');
  expect(res.body.missing).toEqual(expect.arrayContaining(['street', 'cityStateZip']));
});

it('400s form_not_available for a pending jurisdiction', async () => {
  (lookupSubject as any).mockResolvedValueOnce({ county: 'Los Angeles', us_state: 'CA' });
  const req: any = { method: 'POST', headers: {}, body: { address: 'x', inputs: {} } };
  const res = mockRes();
  await handler(req, res as any);
  expect(res.statusCode).toBe(400);
  expect(res.body.error).toBe('form_not_available');
  expect(res.body.state).toBe('CA');
});
