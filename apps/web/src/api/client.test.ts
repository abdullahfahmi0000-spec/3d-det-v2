import { describe, expect, it } from 'vitest';

import { fetchHealth } from './client';

const respond = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('fetchHealth', () => {
  it('returns the parsed contract on success', async () => {
    await expect(fetchHealth(respond(200, { status: 'ok' }))).resolves.toEqual({ status: 'ok' });
  });

  it('rejects a payload that violates the shared contract', async () => {
    await expect(fetchHealth(respond(200, { status: 'up' }))).rejects.toThrow();
  });

  it('rejects a non-success status', async () => {
    await expect(fetchHealth(respond(503, {}))).rejects.toThrow(/HTTP 503/);
  });
});
