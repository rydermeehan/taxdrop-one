import { lookupCad } from './_tx-cads.js';
import { isOver120k } from './_tx-county-population.js';
import type { FieldDef, FormDef, ResolvedForm } from './_forms-registry.js';

// The owner fields the engine can't supply. Keys are IDENTICAL to the legacy
// `owner` object keys so the mapping below (and any legacy caller) is unchanged.
const TX_INTAKE_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Owner name', placeholder: 'Jane Q. Homeowner', required: true },
  { key: 'phone', label: 'Phone', placeholder: '(555) 123-4567', required: false },
  { key: 'street', label: 'Mailing street address', placeholder: '123 Main St', required: true },
  { key: 'cityStateZip', label: 'City, State ZIP', placeholder: 'Austin, TX 78701', required: true },
  { key: 'email', label: 'Email', placeholder: 'you@example.com', required: false },
];

// Verbatim port of the previous build50132Payload. The two population variants
// bind DIFFERENT owner fields (verified from each CraftMyPDF template body).
function build50132Payload(subject: any, inputs: Record<string, string>, over120k: boolean): Record<string, unknown> {
  const cad = lookupCad(subject.county);
  const propertyAddress = subject.full_address
    || [subject.site_address, subject.site_city, subject.site_zip].filter(Boolean).join(', ');

  const common = {
    appraisal_district_name: cad?.cadName || '',
    district_account_number: subject.parcel_id || '',
    property_address: propertyAddress,
    legal_description: '',
    date_signed: '',
    owner_email: inputs.email || '',
  };

  if (over120k) {
    return {
      ...common,
      owner_name: inputs.name,
      owner_address: inputs.street,
      owner_city_state_zip: inputs.cityStateZip,
      owner_phone: inputs.phone || '',
    };
  }
  return {
    ...common,
    cad_owner_name: inputs.name,
    cad_owner_address_city_state_zip: [inputs.street, inputs.cityStateZip].filter(Boolean).join(', '),
  };
}

function txFormDef(over120k: boolean): FormDef {
  return {
    form: 'Form 50-132',
    outputFileName: 'form-50-132.pdf',
    // Read env at call time so template availability can flip without a redeploy
    // and so tests can stub it.
    templateId: () => (over120k
      ? process.env.CRAFTMYPDF_TEMPLATE_50_132_OVER120K || null
      : process.env.CRAFTMYPDF_TEMPLATE_50_132_UNDER120K || null),
    intakeFields: TX_INTAKE_FIELDS,
    buildPayload: (subject, inputs) => build50132Payload(subject, inputs, over120k),
  };
}

export function resolveTxForm(subject: any): ResolvedForm {
  return txFormDef(isOver120k(subject?.county));
}
