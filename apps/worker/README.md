# @3ddet/worker

Background job worker built on BullMQ.

One process consumes several queues, each with its own concurrency limit: `ai`, `documents`,
`assets`, `import-export`, `calculations` and `integrations`. No handlers are implemented.

Rules:

- Every job carries its tenant context and opens a tenant transaction exactly as a request
  does. A background job is not a privileged path.
- Every retryable job carries an idempotency key.
- Heavy, infrequent work such as 3D asset conversion runs as a short-lived task launched per
  job rather than as a standing service.

## Commands

```bash
pnpm --filter @3ddet/worker build
pnpm --filter @3ddet/worker start   # requires Redis; see docker-compose.dev.yml
pnpm --filter @3ddet/worker test    # no Redis required
```
