import { normCounty } from './_tx-county-population.js';
import { resolveTxForm } from './_forms-tx.js';

export type StateId = 'TX' | 'CA' | 'GA' | 'FL';

export interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  required: boolean;
}

export interface FormDef {
  form: string;
  outputFileName: string;
  templateId(): string | null; // null ⇒ template env unset ⇒ treated as pending
  intakeFields: FieldDef[];
  buildPayload(subject: any, inputs: Record<string, string>): Record<string, unknown>;
}

export interface PendingForm {
  status: 'pending';
  form: string;
}

export type ResolvedForm = FormDef | PendingForm | null;

/** A resolved form is LIVE only when it's a FormDef whose template env resolves. */
export function isReady(f: ResolvedForm): f is FormDef {
  return !!f && !('status' in f) && (f as FormDef).templateId() != null;
}

// CA: each county files a DIFFERENT form. Registered as pending until each
// CraftMyPDF template is built + graduated to a real FormDef in a `_forms-ca.ts`.
const CA_COUNTY_FORMS: Record<string, string> = {
  alameda: 'Application for Changed Assessment (Alameda)',
  sacramento: 'Application for Changed Assessment (Sacramento)',
  losangeles: 'Assessment Appeal Application (Los Angeles)',
  sanfrancisco: 'Application for Changed Assessment (San Francisco)',
  contracosta: 'Application for Changed Assessment (Contra Costa)',
};

interface StateForms {
  resolve(subject: any): ResolvedForm;
}

export const FORMS_REGISTRY: Record<StateId, StateForms> = {
  TX: { resolve: (s) => resolveTxForm(s) },
  CA: {
    resolve: (s) => {
      const form = CA_COUNTY_FORMS[normCounty(s?.county)];
      return form ? { status: 'pending', form } : null;
    },
  },
  GA: { resolve: () => ({ status: 'pending', form: 'PT-311A' }) }, // statewide
  FL: { resolve: () => ({ status: 'pending', form: 'DR-486' }) },  // statewide
};

/** Normalize the subject/hint to a StateId. Defaults to TX so live TX is unaffected. */
export function stateIdFromSubject(subject: any, stateHint?: string): StateId {
  const raw = String(stateHint || subject?.us_state || subject?.state || subject?.site_state || '')
    .trim()
    .toUpperCase();
  if (raw === 'TX' || raw === 'CA' || raw === 'GA' || raw === 'FL') return raw;
  if (/^TEX/.test(raw)) return 'TX';
  if (/^CAL/.test(raw)) return 'CA';
  if (/^GEO/.test(raw)) return 'GA';
  if (/^FLO/.test(raw)) return 'FL';
  return 'TX';
}

export function resolveFormWithState(subject: any, stateHint?: string): { state: StateId; form: ResolvedForm } {
  const state = stateIdFromSubject(subject, stateHint);
  return { state, form: FORMS_REGISTRY[state].resolve(subject) };
}
