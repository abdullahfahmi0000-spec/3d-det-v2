import { type Kysely, sql } from 'kysely';

import type { TenantContext } from '@3ddet/domain';

/**
 * Session variables that Row-Level Security policies read.
 *
 * Policies compare the row's tenant and scenario against these settings, so a query that
 * runs without them returns no rows rather than failing loudly. That is the reason
 * `withTenantTransaction` is the only supported way to reach the database, and the reason
 * the isolation test suite asserts the empty result.
 */
export const TENANT_SETTING = 'app.tenant_id';
export const SCENARIO_SETTING = 'app.scenario_id';

/**
 * Applies the tenant context to the current transaction.
 *
 * `set_config(..., is_local => true)` is the parameterisable equivalent of `SET LOCAL`:
 * the value is bound rather than interpolated, and it expires when the transaction ends.
 * `SET LOCAL` itself takes no bind parameters and must never be assembled by string
 * concatenation.
 *
 * Must be called inside an open transaction. Outside one, `is_local => true` has no
 * lasting effect and every subsequent tenant-scoped query would silently return nothing.
 */
export async function applyTenantSessionContext(
  trx: Kysely<unknown>,
  context: TenantContext,
): Promise<void> {
  await sql`select set_config(${TENANT_SETTING}, ${context.tenantId.toString()}, true)`.execute(
    trx,
  );
  await sql`select set_config(${SCENARIO_SETTING}, ${context.scenarioId.toString()}, true)`.execute(
    trx,
  );
}
