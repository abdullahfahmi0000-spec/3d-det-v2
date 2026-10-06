import { type TenantContext, createTenantContext } from '@3ddet/domain';

/**
 * Every job payload carries its tenant context explicitly. A job is not privileged: the
 * handler opens a tenant transaction exactly as a request does, so Row-Level Security
 * applies to background work the same way it applies to interactive work.
 */
export interface JobEnvelope<TPayload> {
  readonly tenantId: string;
  readonly scenarioId: string;
  /** Idempotency key. Retries with the same key must not repeat side effects. */
  readonly idempotencyKey: string;
  readonly payload: TPayload;
}

export function contextFromEnvelope(envelope: JobEnvelope<unknown>): TenantContext {
  const result = createTenantContext(BigInt(envelope.tenantId), BigInt(envelope.scenarioId));
  if (!result.ok) {
    throw new Error(`invalid job tenant context: ${result.error}`);
  }
  return result.value;
}
