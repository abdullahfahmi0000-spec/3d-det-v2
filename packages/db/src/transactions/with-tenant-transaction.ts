import type { Kysely, Transaction } from 'kysely';

import type { TenantContext } from '@3ddet/domain';

import type { Database } from '../client/database';
import { applyTenantSessionContext } from '../rls/session-context';

/**
 * The single supported entry point for tenant-scoped database access.
 *
 * Opens a transaction, applies the tenant session context that Row-Level Security policies
 * read, and then runs the caller's work. Nothing else in the codebase may obtain a
 * database handle; `pnpm check:boundaries` enforces that the driver is imported only here,
 * and the isolation suite asserts that a query issued outside this wrapper returns no rows.
 */
export async function withTenantTransaction<T>(
  db: Kysely<Database>,
  context: TenantContext,
  work: (trx: Transaction<Database>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await applyTenantSessionContext(trx, context);
    return work(trx);
  });
}
