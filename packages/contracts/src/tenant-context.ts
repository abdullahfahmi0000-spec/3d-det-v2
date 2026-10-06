import { z } from 'zod';

/**
 * Tenant and scenario identifiers that must accompany every tenant-scoped operation.
 *
 * The database enforces isolation through Row-Level Security; see
 * `docs/adr/ADR-001-postgresql-rls.md`. This contract exists so that callers cannot
 * construct a request without declaring the context the database will be asked to apply.
 *
 * Scenario `0` denotes the live organisation. Scenario authorisation is a separate step and
 * is not implied by a well-formed context object.
 */
export const TenantContextSchema = z.object({
  tenantId: z.coerce.bigint().positive(),
  scenarioId: z.coerce.bigint().nonnegative(),
});

export type TenantContext = z.infer<typeof TenantContextSchema>;

/** Scenario identifier reserved for the live organisation. */
export const LIVE_SCENARIO_ID = 0n;
