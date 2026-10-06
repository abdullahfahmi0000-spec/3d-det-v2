import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/configuration';

describe('loadConfig', () => {
  it('defaults to port 3000', () => {
    expect(loadConfig({}).port).toBe(3000);
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ API_PORT: '70000' })).toThrow(/valid TCP port/);
  });
});
