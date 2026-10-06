# Database

PostgreSQL is the system of record and Row-Level Security is the tenant isolation mechanism.
Both are confirmed requirements (`docs/adr/ADR-001-postgresql-rls.md`).

## The approved DDL is the authoritative schema

The schema is defined by the client-approved PostgreSQL DDL, which is added to `ddl/` when it
is released to the team. Nothing in this repository declares a competing schema: the access
layer in `packages/db` generates its types _from_ the database, and no ORM owns the schema.

**No tables, policies, functions or migrations exist yet.** None will be written ahead of the
approved DDL, because a fabricated schema would have to be unpicked later and a fabricated
security policy would give false confidence.

## Layout

| Directory     | Contents                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `ddl/`        | The approved DDL, organised by table family.                                                            |
| `migrations/` | Forward-only, reviewed SQL migrations applied after the baseline DDL.                                   |
| `functions/`  | Database functions, including any tightly controlled privileged operations.                             |
| `policies/`   | Row-Level Security policies. Production RLS policies will be introduced with the approved database DDL. |
| `seeds/`      | Development and demonstration data. Never production data.                                              |

## Rules that apply from the first migration

- Migrations are forward-only SQL, reviewed like code, and applied as a separate, explicitly
  approved deployment step. They never run automatically at application start-up.
- Destructive statements (`DROP`, column removal, type narrowing) require an explicit note in
  the pull request and a rollback plan.
- Schema-reset commands are never run against a shared environment.
- The application connects as a role that does **not** hold `BYPASSRLS` and does not own the
  tables. Privileged operations that must cross tenants are implemented as narrowly scoped,
  audited functions in `functions/`, never by widening the application role.

## Local development

`docker-compose.dev.yml` starts PostgreSQL 16 with the pgvector extension available.

The local bootstrap user is a **superuser**, which bypasses Row-Level Security. Connecting as
that user is useful for exploring the schema and is useless for testing isolation. The
isolation tests in `tests/security/` must connect as the non-privileged application role once
it exists.

The PostgreSQL major version used in deployed environments is finalised during infrastructure
implementation.
