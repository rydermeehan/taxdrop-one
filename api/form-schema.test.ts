import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./_forms-common.js', () => ({
  gate: vi.fn(async () => ({ ok: true })),
  lookupSubject: vi.fn(async () => ({ county: 'harris', us_state: 'TX' })),
}));

import handler from './form-schema.js';
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
  vi.stubEnv('CRAFTMYPDF_TEMPLATE_50_132_OVER120K', '47b77b2358c5b082');
  vi.stubEnv('CRAFTMYPDF_TEMPLATE_50_132_UNDER120K', 'dc977b235ab91110');
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('returns available:true with fields for a live TX property', async () => {
  const req: any = { method: 'POST', headers: {}, body: { address: '123 Oak St, Houston, TX 77002' } };
  const res = mockRes();
  await handler(req, res as any);
  expect(res.statusCode).toBe(200);
  expect(res.body.available).toBe(true);
  expect(res.body.state).toBe('TX');
  expect(res.body.form).toBe('Form 50-132');
  expect(res.body.fields.map((f: any) => f.key)).toEqual(['name', 'phone', 'street', 'cityStateZip', 'email']);
});

it('returns available:false for a pending jurisdiction', async () => {
  (lookupSubject as any).mockResolvedValueOnce({ county: 'Los Angeles', us_state: 'CA' });
  const req: any = { method: 'POST', headers: {}, body: { address: 'x' } };
  const res = mockRes();
  await handler(req, res as any);
  expect(res.statusCode).toBe(200);
  expect(res.body.available).toBe(false);
  expect(res.body.state).toBe('CA');
});
