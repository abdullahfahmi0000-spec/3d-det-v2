import { Kysely, PostgresDialect } from 'kysely';
import { Pool, type PoolConfig } from 'pg';

import type { Database } from './database';

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  /**
   * Maximum pooled connections. The pool must be configured so that a connection is never
   * shared between two units of work mid-transaction, because the tenant session context
   * is transaction-scoped (see `rls/session-context.ts`).
   */
  maxConnections?: number;
}

/**
 * Builds a Kysely instance. Creating the client does not open a connection, so importing
 * this module has no side effects and the package stays safe to load in tests and in CI.
 *
 * Application code does not use the returned instance directly. All tenant-scoped access
 * goes through `withTenantTransaction`, which is the only supported entry point.
 */
export function createDatabaseClient(config: DatabaseConnectionConfig): Kysely<Database> {
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.maxConnections ?? 10,
  };

  if (config.ssl === true) {
    poolConfig.ssl = { rejectUnauthorized: true };
  }

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new Pool(poolConfig) }),
  });
}
