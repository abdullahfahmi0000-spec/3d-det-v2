import { describe, expect, it } from 'vitest';

import { effectiveSensitivity, isAtLeast } from '../sensitivity/sensitivity';

describe('effectiveSensitivity', () => {
  it('returns the task class when no context was retrieved', () => {
    expect(effectiveSensitivity('Internal')).toBe('Internal');
  });

  it('escalates to the most restrictive retrieved class', () => {
    expect(effectiveSensitivity('Public', ['Internal', 'Confidential'])).toBe('Confidential');
  });

  it('escalates a Public task that retrieves Restricted material', () => {
    expect(effectiveSensitivity('Public', ['Public', 'Restricted'])).toBe('Restricted');
  });

  it('never de-escalates below the task class', () => {
    expect(effectiveSensitivity('Restricted', ['Public'])).toBe('Restricted');
  });
});

describe('isAtLeast', () => {
  it('compares classes by restriction level', () => {
    expect(isAtLeast('Confidential', 'Internal')).toBe(true);
    expect(isAtLeast('Internal', 'Confidential')).toBe(false);
  });
});
