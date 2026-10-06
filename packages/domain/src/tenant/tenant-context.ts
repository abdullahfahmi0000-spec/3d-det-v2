import { type Result, err, ok } from '../result';

/**
 * Identifiers that scope every tenant-scoped operation.
 *
 * Isolation itself is enforced by PostgreSQL Row-Level Security, not by this type; see
 * `docs/adr/ADR-001-postgresql-rls.md`. This value object exists so that no code path can
 * reach the database without having stated which tenant and scenario it intends to act in.
 */
export interface TenantContext {
  readonly tenantId: bigint;
  readonly scenarioId: bigint;
}

/** Scenario identifier reserved for the live organisation. */
export const LIVE_SCENARIO_ID = 0n;

export function createTenantContext(
  tenantId: bigint,
  scenarioId: bigint,
): Result<TenantContext, string> {
  if (tenantId <= 0n) {
    return err('tenantId must be a positive identifier');
  }
  if (scenarioId < 0n) {
    return err('scenarioId must not be negative');
  }
  return ok({ tenantId, scenarioId });
}

export const isLiveScenario = (context: TenantContext): boolean =>
  context.scenarioId === LIVE_SCENARIO_ID;
