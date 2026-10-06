import { describe, expect, it } from 'vitest';

import { AiToolDescriptorSchema } from '../ai-tool';
import { HealthResponseSchema } from '../health';
import { LIVE_SCENARIO_ID, TenantContextSchema } from '../tenant-context';

describe('HealthResponseSchema', () => {
  it('accepts the documented health payload', () => {
    expect(HealthResponseSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });

  it('rejects any other status', () => {
    expect(HealthResponseSchema.safeParse({ status: 'degraded' }).success).toBe(false);
  });
});

describe('TenantContextSchema', () => {
  it('coerces numeric input to bigint identifiers', () => {
    const parsed = TenantContextSchema.parse({ tenantId: 42, scenarioId: 0 });
    expect(parsed.tenantId).toBe(42n);
    expect(parsed.scenarioId).toBe(LIVE_SCENARIO_ID);
  });

  it('rejects a non-positive tenant id', () => {
    expect(TenantContextSchema.safeParse({ tenantId: 0, scenarioId: 0 }).success).toBe(false);
  });
});

describe('AiToolDescriptorSchema', () => {
  it('requires a dotted tool name', () => {
    expect(
      AiToolDescriptorSchema.safeParse({
        name: 'organization',
        description: 'x',
        resourceType: 'NODE',
        action: 'READ',
        mutating: false,
      }).success,
    ).toBe(false);
  });

  it('accepts a fully qualified descriptor', () => {
    const descriptor = AiToolDescriptorSchema.parse({
      name: 'organization.read_node',
      description: 'Read a single organisational node.',
      resourceType: 'NODE',
      action: 'READ',
      mutating: false,
    });
    expect(descriptor.action).toBe('READ');
  });
});
