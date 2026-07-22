// Shared Postgres pool for the one.taxdrop.com serverless functions.
// Underscore-prefixed → not a Vercel endpoint; imported by _entitlements.ts,
// _reviews.ts, etc.
//
// One pool per warm lambda, reused across invocations. Reuses the engine's
// Postgres via DATABASE_URL (same instance the Python savings-engine uses).
// All app tables are namespaced `one_*` so they can't collide with engine
// tables.

import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
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
