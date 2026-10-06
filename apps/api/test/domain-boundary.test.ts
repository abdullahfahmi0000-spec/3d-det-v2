import { describe, expect, it } from 'vitest';

import { combineDecisions, createTenantContext, deny } from '@3ddet/domain';

/**
 * Confirms the API consumes the framework-independent domain package. If this import
 * fails, the dependency direction api -> domain has been broken.
 */
describe('api -> domain wiring', () => {
  it('uses domain primitives without a framework', () => {
    expect(createTenantContext(1n, 0n).ok).toBe(true);
    expect(combineDecisions([deny('test')]).effect).toBe('DENY');
  });
});
