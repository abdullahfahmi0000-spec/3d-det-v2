# 3D.DET 2.0

## 1. Overview

3D.DET 2.0 is a multi-tenant, browser-based platform that models an organisation as a
digital twin: its structure, people, jobs, tasks and processes, the spaces they occupy shown
in 3D, and AI tools that analyse and propose changes to them.

This repository contains the complete platform: web application, API, background worker,
shared packages, database sources, infrastructure code and documentation.

## 2. Architecture

A modular monolith with three deployable applications -- `web`, `api` and `worker` -- over
PostgreSQL. Tenant isolation is enforced by PostgreSQL Row-Level Security. The 3D view is
built on Three.js. AI is a platform capability exposed through authorised tools.

See [docs/architecture/overview.md](docs/architecture/overview.md).

## 3. Repository structure

```
apps/
  web/            React + Vite web application
  api/            NestJS modular monolith
  worker/         Background jobs (BullMQ)
packages/
  domain/         Framework-independent domain logic
  db/             PostgreSQL access (Kysely), tenant transactions
  contracts/      Shared schemas (Zod)
  ai/             Provider abstraction, routing, tools, provenance
  three/          Three.js viewer platform
  ui/             Shared React components
  config/         Shared TypeScript and tooling configuration
database/         Approved DDL, migrations, functions, policies, seeds
infrastructure/   Terraform
tests/            End-to-end, integration, security and load suites
docs/             Architecture, ADRs, API, security, development guides
```

## 4. Technology stack

| Area             | Technology                                   | Status      |
| ---------------- | -------------------------------------------- | ----------- |
| Database         | PostgreSQL                                   | Confirmed   |
| Tenant isolation | PostgreSQL Row-Level Security                | Confirmed   |
| 3D rendering     | Three.js                                     | Confirmed   |
| 3D assets        | glTF 2.0 / GLB                               | Confirmed   |
| Frontend         | React, Vite, TypeScript                      | Recommended |
| Backend          | NestJS, TypeScript                           | Recommended |
| Database access  | Kysely, types generated from the database    | Recommended |
| Contracts        | Zod                                          | Recommended |
| Background jobs  | BullMQ                                       | Recommended |
| Realtime         | Server-Sent Events, PostgreSQL LISTEN/NOTIFY | Recommended |
| Embeddings       | pgvector                                     | Recommended |
| Infrastructure   | AWS, ECS/Fargate, Terraform                  | Recommended |
| Monorepo         | pnpm workspaces, Turborepo                   | --          |

## 5. Local development prerequisites

- Node.js 24 (`.nvmrc`)
- pnpm 10.18 (`packageManager` in `package.json`)
- Docker with Compose, for the optional local PostgreSQL and Redis

## 6. Getting started

```bash
pnpm install
cp .env.example .env
pnpm build
pnpm --filter @3ddet/api start      # http://localhost:3000/health
pnpm --filter @3ddet/web dev        # http://localhost:5173
```

Full guide: [docs/development/local-setup.md](docs/development/local-setup.md).

## 7. Workspace commands

| Command                 | Runs                                                     |
| ----------------------- | -------------------------------------------------------- |
| `pnpm dev`              | Development servers                                      |
| `pnpm build`            | Build every package and application, in dependency order |
| `pnpm test`             | Unit tests                                               |
| `pnpm lint`             | ESLint                                                   |
| `pnpm typecheck`        | TypeScript, without emitting                             |
| `pnpm check:boundaries` | Architectural import rules                               |
| `pnpm format`           | Prettier                                                 |

Run a command for one workspace with `pnpm --filter <name> <command>`, for example
`pnpm --filter @3ddet/api test`.

## 8. Testing

Unit tests sit beside the code in each package and run with Vitest. Suites that span
packages or need real dependencies live in `tests/`. Tenant isolation tests in
`tests/security/` are introduced with the approved DDL.

## 9. Environment configuration

Configuration is read from environment variables. Each application documents its variables
in a committed `.env.example` with placeholders only. Never commit a `.env` file; see
[docs/SECURITY.md](docs/SECURITY.md).

## 10. Development workflow

Branch from `main`, open a pull request using the template, and merge after CI passes and a
code owner approves. `main` is protected.

## 11. Architecture documentation

- [Architecture overview](docs/architecture/overview.md)
- [Architecture decision records](docs/adr/README.md)
- [Database](database/README.md)
- [Security policy](docs/SECURITY.md)

## 12. Contribution workflow

See [CONTRIBUTING.md](CONTRIBUTING.md).
