import { describe, expect, it } from 'vitest';

import { allow, combineDecisions, deny } from '../authorization/decision';

describe('combineDecisions', () => {
  it('denies when nothing applies', () => {
    expect(combineDecisions([])).toEqual({ effect: 'DENY', source: 'default-deny' });
  });

  it('lets an explicit denial win regardless of order', () => {
    const forwards = combineDecisions([allow('profile'), deny('exception')]);
    const backwards = combineDecisions([deny('exception'), allow('profile')]);
    expect(forwards.effect).toBe('DENY');
    expect(backwards.effect).toBe('DENY');
    expect(forwards.source).toBe('exception');
  });

  it('allows when only grants apply', () => {
    expect(combineDecisions([allow('profile')]).effect).toBe('ALLOW');
  });
});
