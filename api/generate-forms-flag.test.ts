import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./_forms-common.js', async (orig) => {
  const actual = await (orig as any)();
  return {
    ...actual,
    // The real CMP_API_KEY is a module-level const read from env at import time.
    // Without overriding it here the handler short-circuits at 'pdf_not_configured'
    // before it can reach lookupSubject, which is what this file needs to observe.
    CMP_API_KEY: 'test-key',
    gate: vi.fn(async () => ({ ok: true })),
    lookupSubject: vi.fn(async () => null),
  };
});

const { default: handler } = await import('./generate-forms.js');

function mkRes() {
  const res: any = { statusCode: 0, payload: null };
  res.setHeader = () => {};
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.payload = b; return res; };
  res.end = () => res;
  return res;
}

const req = { method: 'POST', body: { address: '123 Main St', inputs: {} } } as any;

describe('FORMS_PREFILL_ENABLED', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it('returns 404 when the flag is unset', async () => {
    const res = mkRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.payload.error).toBe('prefill_disabled');
  });

  it('returns 404 when the flag is explicitly off', async () => {
    vi.stubEnv('FORMS_PREFILL_ENABLED', '0');
    const res = mkRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('proceeds past the flag when it is on', async () => {
    vi.stubEnv('FORMS_PREFILL_ENABLED', '1');
    const res = mkRes();
    await handler(req, res);
    // lookupSubject is mocked to null → the handler reaches its 404
    // property_not_found, proving it got past the flag check.
    expect(res.payload.error).toBe('property_not_found');
  });

  it('still 403s an unauthorized caller with the flag OFF — the gate runs before the flag check', async () => {
    const { gate } = await import('./_forms-common.js');
    (gate as any).mockResolvedValueOnce({ ok: false, status: 403, body: { error: 'forbidden' } });
    const res = mkRes();
    await handler(req, res);
    // If the flag check ran first, an unauthorized caller would get 404
    // prefill_disabled instead — weakening the fail-closed gate and leaking
    // the feature's existence/state to anyone who asks.
    expect(res.statusCode).toBe(403);
    expect(res.payload.error).toBe('forbidden');
  });
});
