// 37 TX counties with population >= 120,000 (ACS 2023 5-yr).
// Slugs are normalized (lowercase, non-alphanumerics stripped) to match the
// engine subject.county value (e.g. "fortbend", "elpaso"), which has no spaces.
// Derived from taxdrop/savings-engine/tax_rates/tx_county_population.json — refresh with it.
export const TX_COUNTIES_OVER_120K = new Set<string>([
  "bell", "bexar", "brazoria", "brazos", "cameron", "collin",
  "comal", "dallas", "denton", "ector", "ellis", "elpaso",
  "fortbend", "galveston", "grayson", "gregg", "guadalupe", "harris",
  "hays", "hidalgo", "jefferson", "johnson", "kaufman", "lubbock",
  "mclennan", "midland", "montgomery", "nueces", "parker", "randall",
  "smith", "tarrant", "taylor", "travis", "webb", "wichita",
  "williamson",
]);

/** Normalize a county name to the engine's slug form: lowercase, alphanumerics only. */
export function normCounty(county: string | null | undefined): string {
  return (county || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** True when the county's CAD must use the population-≥120,000 Form 50-132 variant. */
export function isOver120k(county: string | null | undefined): boolean {
  return TX_COUNTIES_OVER_120K.has(normCounty(county));
}
