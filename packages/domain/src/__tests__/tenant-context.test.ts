import { describe, expect, it } from 'vitest';

import { LIVE_SCENARIO_ID, createTenantContext, isLiveScenario } from '../tenant/tenant-context';

describe('createTenantContext', () => {
  it('accepts a positive tenant and the live scenario', () => {
    const result = createTenantContext(42n, LIVE_SCENARIO_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(isLiveScenario(result.value)).toBe(true);
    }
  });

  it('rejects a non-positive tenant id', () => {
    expect(createTenantContext(0n, 0n)).toEqual({
      ok: false,
      error: 'tenantId must be a positive identifier',
    });
  });

  it('rejects a negative scenario id', () => {
    expect(createTenantContext(1n, -1n).ok).toBe(false);
  });
});
