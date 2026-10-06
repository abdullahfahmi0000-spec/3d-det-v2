# Architecture overview

3D.DET 2.0 is a multi-tenant, browser-based SaaS platform that represents an organisation as a
digital twin, with a 3D view of its spaces and an AI tool layer.

## Decision status

Every technology decision in this repository is one of two kinds, and the distinction is kept
explicit everywhere.

| Decision                                           | Status                                     |
| -------------------------------------------------- | ------------------------------------------ |
| PostgreSQL as the system of record                 | **Confirmed**                              |
| PostgreSQL Row-Level Security for tenant isolation | **Confirmed**                              |
| Three.js as the rendering engine                   | **Confirmed**                              |
| glTF 2.0 / GLB as the 3D asset format              | **Confirmed**                              |
| Browser-based web application                      | **Confirmed**                              |
| Cloud-native SaaS                                  | **Confirmed**                              |
| AI agents and tools as a platform capability       | **Confirmed**                              |
| MCP-compatible tool architecture where applicable  | **Confirmed**                              |
| React + Vite + TypeScript for the web application  | Recommended                                |
| NestJS + TypeScript modular monolith               | Recommended                                |
| Kysely with types generated from the database      | Recommended                                |
| SSE with PostgreSQL LISTEN/NOTIFY for realtime     | Recommended                                |
| BullMQ for background jobs                         | Recommended                                |
| pgvector for embeddings                            | Recommended                                |
| S3-compatible object storage                       | Recommended                                |
| AWS, ECS/Fargate, Terraform                        | Recommended                                |
| RDS or Aurora for managed PostgreSQL               | Open, finalised during infrastructure work |
| React Three Fiber as a 3D implementation layer     | Under evaluation, not installed            |

A recommended decision may be revisited through an ADR. A confirmed decision is not revisited
by the development team.

## Shape

```
apps/web  ──►  packages/contracts  ◄──  apps/api  ──►  packages/domain
   │              ▲                       │               ▲
   ├─► packages/three                     └─► packages/db ─┘
   └─► packages/ui
                                    apps/worker ──► contracts, domain, db, ai
```

Three deployable applications: `web`, `api`, `worker`. The API is a modular monolith whose
modules mirror the domain. AI is a platform capability inside these applications, not a
separate service.

## Boundary rules

These are enforced by `pnpm check:boundaries` in CI, not by convention.

1. `packages/domain` has no framework or I/O dependency. It contains types and pure functions,
   so the surrounding framework stays replaceable.
2. Only `packages/db` imports the database driver. Everything else receives a transaction.
3. Only `packages/three` and `apps/web` import Three.js. The 2D application never downloads
   the rendering engine, and no business logic can drift into the viewer.

## Tenant isolation, in one paragraph

PostgreSQL enforces isolation through Row-Level Security. Application code may filter by
tenant as well, but it is never the boundary. Every tenant-scoped query runs inside
`withTenantTransaction`, which applies the tenant and scenario session context that the
policies read. A query outside that wrapper returns no rows, which is why that wrapper is the
only entry point and why the security suite asserts the empty result.
