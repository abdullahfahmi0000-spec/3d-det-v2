import { describe, expect, it } from 'vitest';

import { effectiveSensitivity } from '@3ddet/ai';
import { HealthResponseSchema } from '@3ddet/contracts';

import { contextFromEnvelope } from '../job-context';
import { QUEUES } from '../queues';
import { ALL_QUEUES, HandlerRegistry } from '../registry';

describe('HandlerRegistry', () => {
  it('starts with no handlers registered', () => {
    expect(new HandlerRegistry().registeredQueues()).toEqual([]);
  });

  it('refuses a second handler for the same queue', () => {
    const registry = new HandlerRegistry();
    registry.register(QUEUES.AI, async () => undefined);
    expect(() => registry.register(QUEUES.AI, async () => undefined)).toThrow(/already/);
  });

  it('declares one queue per workload class', () => {
    expect(ALL_QUEUES).toHaveLength(6);
  });
});

describe('contextFromEnvelope', () => {
  it('derives a tenant context from the job payload', () => {
    const context = contextFromEnvelope({
      tenantId: '12',
      scenarioId: '0',
      idempotencyKey: 'k',
      payload: {},
    });
    expect(context.tenantId).toBe(12n);
  });

  it('rejects an envelope without a valid tenant', () => {
    expect(() =>
      contextFromEnvelope({ tenantId: '0', scenarioId: '0', idempotencyKey: 'k', payload: {} }),
    ).toThrow(/invalid job tenant context/);
  });
});

describe('worker -> shared packages wiring', () => {
  it('resolves contracts and ai packages', () => {
    expect(HealthResponseSchema.safeParse({ status: 'ok' }).success).toBe(true);
    expect(effectiveSensitivity('Public', ['Confidential'])).toBe('Confidential');
  });
});
