# @3ddet/api

NestJS modular monolith (`docs/adr/ADR-004-modular-monolith.md`).

## Modules

`src/modules/` holds one module per domain: identity, tenant, organization, people, jobs,
tasks, processes, scenarios, bpr, digital-twin, analytics, ai, integrations, school and
audit. Each is a module boundary only at this stage. No business logic is implemented.

Rules between modules:

- A module owns its tables. Other modules call its services; they do not query its tables.
- Every module depends on authorisation. There is no unauthorised internal path.
- A request or job opens one transaction through `@3ddet/db` and passes it down. Modules do
  not open their own.

## What is here now

`GET /health` returns `{ "status": "ok" }`, validated against `@3ddet/contracts`. It is a
liveness check and intentionally does not touch the database.

## Commands

```bash
pnpm --filter @3ddet/api build
pnpm --filter @3ddet/api start      # http://localhost:3000/health
pnpm --filter @3ddet/api test
```
