import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveFormWithState, isReady } from './_forms-registry.js';

const OVER = 'harris';     // ≥120k population TX county
const UNDER = 'anderson';  // <120k population TX county
const INPUTS = {
  name: 'Jane Q. Homeowner',
  street: '123 Oak St',
  cityStateZip: 'Houston, TX 77002',
  phone: '(555) 111-2222',
  email: 'jane@example.com',
};

beforeEach(() => {
  vi.stubEnv('CRAFTMYPDF_TEMPLATE_50_132_OVER120K', '47b77b2358c5b082');
  vi.stubEnv('CRAFTMYPDF_TEMPLATE_50_132_UNDER120K', 'dc977b235ab91110');
});
afterEach(() => vi.unstubAllEnvs());

describe('TX routing', () => {
  it('routes a ≥120k county to the over-120k template', () => {
    const { state, form } = resolveFormWithState({ county: OVER, us_state: 'TX' });
    expect(state).toBe('TX');
    expect(isReady(form)).toBe(true);
    expect((form as any).templateId()).toBe('47b77b2358c5b082');
  });

  it('routes a <120k county to the under-120k template', () => {
    const { form } = resolveFormWithState({ county: UNDER, us_state: 'TX' });
    expect((form as any).templateId()).toBe('dc977b235ab91110');
  });

  it('TX over-120k payload matches the known-good mapping (regression)', () => {
    const { form } = resolveFormWithState({ county: OVER, us_state: 'TX' });
    const payload = (form as any).buildPayload(
      { county: OVER, parcel_id: 'ACC-1', full_address: '123 Oak St, Houston, TX 77002' },
      INPUTS,
    );
    expect(payload).toEqual({
      appraisal_district_name: 'Harris Central Appraisal District',
      district_account_number: 'ACC-1',
      property_address: '123 Oak St, Houston, TX 77002',
      legal_description: '',
      date_signed: '',
      owner_email: 'jane@example.com',
      owner_name: 'Jane Q. Homeowner',
      owner_address: '123 Oak St',
      owner_city_state_zip: 'Houston, TX 77002',
      owner_phone: '(555) 111-2222',
    });
  });

  it('TX under-120k payload uses cad_-prefixed combined owner fields (regression)', () => {
    const { form } = resolveFormWithState({ county: UNDER, us_state: 'TX' });
    const payload = (form as any).buildPayload(
      { county: UNDER, parcel_id: 'A-9', full_address: '5 Elm St, Palestine, TX 75801' },
      INPUTS,
    );
    expect(payload).toEqual({
      appraisal_district_name: 'Anderson County Appraisal District',
      district_account_number: 'A-9',
      property_address: '5 Elm St, Palestine, TX 75801',
      legal_description: '',
      date_signed: '',
      owner_email: 'jane@example.com',
      cad_owner_name: 'Jane Q. Homeowner',
      cad_owner_address_city_state_zip: '123 Oak St, Houston, TX 77002',
    });
  });

  it('treats TX as pending when the template env is unset (readiness flip)', () => {
    vi.stubEnv('CRAFTMYPDF_TEMPLATE_50_132_OVER120K', '');
    const { form } = resolveFormWithState({ county: OVER, us_state: 'TX' });
    expect(isReady(form)).toBe(false);
  });
});

describe('pending states', () => {
  it('CA known county resolves to a pending form (not ready)', () => {
    const { state, form } = resolveFormWithState({ county: 'Los Angeles', us_state: 'CA' });
    expect(state).toBe('CA');
    expect(isReady(form)).toBe(false);
    expect(form).toMatchObject({ status: 'pending' });
  });

  it('CA unknown county resolves to null', () => {
    const { form } = resolveFormWithState({ county: 'Fresno', us_state: 'CA' });
    expect(form).toBeNull();
  });

  it('GA is statewide pending (PT-311A)', () => {
    const { form } = resolveFormWithState({ county: 'Fulton', us_state: 'GA' });
    expect(form).toMatchObject({ status: 'pending', form: 'PT-311A' });
  });

  it('FL is statewide pending (DR-486)', () => {
    const { form } = resolveFormWithState({ county: 'Miami-Dade', us_state: 'FL' });
    expect(form).toMatchObject({ status: 'pending', form: 'DR-486' });
  });

  it('defaults to TX when no state hint is present', () => {
    const { state } = resolveFormWithState({ county: OVER });
    expect(state).toBe('TX');
  });
});
