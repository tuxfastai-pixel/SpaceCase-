import { Pool } from "pg";

import { readServerEnvironment } from "../config/env";

let pool: Pool | null = null;

export function getDatabasePool(): Pool {
  if (pool) return pool;

  const environment = readServerEnvironment();
  if (!environment.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  pool = new Pool({
    connectionString: environment.DATABASE_URL,
    max: 10,
    // Serverless databases can need more than five seconds to resume and negotiate TLS.
    // Keep acquisition bounded without retrying any financial transaction.
    connectionTimeoutMillis: 15_000,
    query_timeout: 15_000,
    idleTimeoutMillis: 10_000,
  });

  return pool;
}
