// Property-lock store for one.taxdrop.com customer links.
// Underscore-prefixed → not a Vercel endpoint; imported by cad-proxy.ts.
//
// The ONLY state access control needs: which property a paid token claimed.
// Tokens are stateless (see _token.ts); this table just enforces "one link =
// one property, locked on first report run".
//
// Reuses the engine's Postgres via DATABASE_URL (same instance the Python
// savings-engine uses). Table is namespaced `one_*` so it can't collide with
// engine tables.

import { Pool } from 'pg';

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL not set');
    pool = new Pool({
      connectionString,
      max: 3,
      // Managed Postgres (Neon/Supabase/Vercel) terminates TLS; don't fail on
      // the provider cert chain in a serverless function.
      ssl: connectionString.includes('sslmode=disable')
        ? undefined
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS one_entitlements (
           jti           TEXT PRIMARY KEY,
           tax_year      INT,
           state         TEXT,
           property_key  TEXT,
           claimed_at    TIMESTAMPTZ,
           created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
           last_used_at  TIMESTAMPTZ
         )`
      )
      .then(() => undefined)
      .catch((e) => {
        // Reset so a later request can retry instead of caching the failure.
        schemaReady = null;
        throw e;
      });
  }
  return schemaReady;
}

export interface ClaimResult {
  /** true if the request's property matches what this token is (now) locked to. */
  allowed: boolean;
  /** The property this token is locked to (the requested one if it just claimed). */
  lockedTo: string;
}

/**
 * Atomically claim `propertyKey` for `jti`, or verify it matches an existing
 * claim. First call for a jti locks it; later calls only succeed for the same
 * property. Safe under concurrent requests (single ON CONFLICT statement).
 */
export async function claimOrVerifyProperty(
  jti: string,
  propertyKey: string,
  meta: { taxYear?: number; state?: string } = {}
): Promise<ClaimResult> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `INSERT INTO one_entitlements (jti, tax_year, state, property_key, claimed_at, last_used_at)
       VALUES ($1, $2, $3, $4, now(), now())
     ON CONFLICT (jti) DO UPDATE
       SET property_key = COALESCE(one_entitlements.property_key, EXCLUDED.property_key),
           claimed_at   = COALESCE(one_entitlements.claimed_at, now()),
           last_used_at = now()
     RETURNING property_key`,
    [jti, meta.taxYear ?? null, meta.state ?? null, propertyKey]
  );
  const lockedTo: string = rows[0]?.property_key ?? propertyKey;
  return { allowed: lockedTo === propertyKey, lockedTo };
}
