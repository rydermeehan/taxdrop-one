import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./_forms-common.js', () => ({
  gate: vi.fn(async () => ({ ok: true })),
  lookupSubject: vi.fn(async () => ({
    us_state: 'GA', county: 'fulton', account: 'R-12345', situs_address: '1 Peachtree St',
  })),
}));

const { default: handler } = await import('./form-schema.js');

function mkRes() {
  const res: any = { statusCode: 0, payload: null, headers: {} as Record<string, string> };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.payload = b; return res; };
  res.end = () => res;
  return res;
}

describe('form-schema catalog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the catalog record for the resolved jurisdiction', async () => {
    const res = mkRes();
    await handler({ method: 'POST', body: { address: '1 Peachtree St, Atlanta, GA 30303' } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload.catalog.state).toBe('GA');
    expect(res.payload.catalog.form).toBe('PT-311A');
    expect(res.payload.catalog.pdfPath).toBe('/forms/ga-pt-311a.pdf');
    expect(res.payload.catalog.authority).toBe('Fulton County Board of Assessors');
  });

  it('passes the account number through for the copy block', async () => {
    const res = mkRes();
    await handler({ method: 'POST', body: { address: '1 Peachtree St' } } as any, res);
    expect(res.payload.account).toBe('R-12345');
  });

  it('still requires an address', async () => {
    const res = mkRes();
    await handler({ method: 'POST', body: {} } as any, res);
    expect(res.statusCode).toBe(400);
  });
});
