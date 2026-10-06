# ADR-004: NestJS + TypeScript modular monolith

**Status:** Proposed. **RECOMMENDED**, not a confirmed requirement.

## Context

The domain is broad: organisation structure, people, jobs, tasks, processes, scenarios,
process redesign, spatial data, analytics, AI, integrations, education and audit. Several
operations must change data across these areas atomically.

## Decision

Build the API as a **modular monolith** in **NestJS and TypeScript**, deployed with a separate
**worker** process for background jobs.

- **Domain complexity.** One module per domain area, with explicit boundaries: a module owns
  its tables and other modules call its services.
- **Transaction boundaries.** Operations that must be atomic across domain areas stay inside
  one database transaction. Splitting them across services would require distributed
  transactions with no stated benefit.
- **PostgreSQL and RLS.** A single process opening one transaction per unit of work is the
  simplest model in which to apply tenant session context correctly every time.
- **API and tool layer.** The same domain services serve the HTTP API and the AI tools, so
  authorisation runs on one path rather than being reimplemented per surface.
- **AI integration.** AI runs as a platform capability inside the API and worker, not as a
  separate service.
- **Realtime.** Server-to-client notifications are delivered from the API.
- **Workers.** Long-running and asynchronous work runs in `apps/worker`, which uses the same
  packages and the same tenant transaction rules.

**Database access** uses Kysely with types generated from the database (RECOMMENDED). The
database is the authoritative schema; the application does not declare a competing one.

**The domain layer remains framework-independent to preserve future reversibility.**
`packages/domain` has no NestJS dependency, enforced in CI, so the framework is a replaceable
shell around portable logic.

## Consequences

- Three deployable applications: `web`, `api`, `worker`.
- Module boundaries are enforced by structure and review; they cost nothing at runtime.
- ASP.NET Core and Spring Boot were close alternatives on capability. NestJS was preferred for
  a single language across web, API, workers and tools, and for shared contracts with the
  frontend. Keeping the domain layer framework-free is what keeps this decision reversible.
