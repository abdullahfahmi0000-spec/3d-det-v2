# ADR-006: Schema migrations with Flyway, guarded by Squawk

**Status:** Proposed. **RECOMMENDED**, not a confirmed requirement.

## Context

- **DAT-08.** A fresh environment must be built from the DDL with no manual step, and two
  builds must be identical.
- **DAT-09.** Schema changes to shared environments must be additive, applied through reviewed
  migrations, and destructive operations must be blocked by tooling, not just discouraged.
  The client's own history includes a wiped shared database.
- The client DDL (V62: 108 tables, 369 foreign keys) is the authoritative schema (ADR-001), and
  the application derives its types from the database (ADR-004). No tool may own a competing
  schema definition.
- The hosting platform is not final (Railway now, possibly AWS later). Whatever applies the
  schema must work unchanged on any PostgreSQL.

## Decision

1. **Flyway Community applies the schema**, from its official Docker image, using
   `database/flyway.toml` in every environment: local, CI and deployed.
   - The client DDL is **version 1**, split by table family (`database/ddl/V1.010` to
     `V1.140`), then foreign keys (`V1.200`), indexes (`V1.300`), Row-Level Security
     (`V1.400`) and roles and grants (`V1.500`). Tables are created before foreign keys, as
     `pg_dump` does, because the families reference each other in both directions.
   - Every later change is a forward-only migration in `database/migrations/` (`V2`, `V3`, …).
     Database functions are repeatable migrations (`R__…`).
   - The history table is `_migrations`. Flyway checksums each applied file and refuses to run
     if one has been edited, renamed or removed.
   - `cleanDisabled = true`: Flyway's reset command is unavailable in every environment.
2. **Squawk lints `database/migrations/` in CI** and fails on destructive statements (drops,
   type changes, renames, disabling RLS, revokes) and on long locks taken without a
   `lock_timeout`. A required exception is a reviewed `squawk-ignore` comment in the migration,
   with a rollback plan in the pull request.
3. **Ownership is separated by role.** The migration role (`det_migrator`) owns the schema;
   the application connects as `det_app`, a member of `det_application`, which owns nothing and
   does not hold `BYPASSRLS`. Login roles carry passwords and are created per environment by
   `database/bootstrap/create-login-roles.sql`, never by a migration.
4. **Migrations are a separate, approved deployment step**, never run at application start-up.
   The **Migrate database** workflow (`.github/workflows/migrate.yml`) deploys from `main` only,
   lints for destructive statements before connecting, and waits for the GitHub Environment's
   required reviewers before running Flyway.
5. **CI proves the build** (job `schema`): it builds the schema into two empty databases,
   checks the object counts against `tests/integration/schema/schema-baseline.sql`, and diffs
   the two `pg_dump --schema-only` outputs.

## Consequences

- One command, `flyway migrate`, builds or upgrades any environment, on Railway, RDS, Aurora or
  a laptop. Moving platform changes connection settings, not the schema or its tooling.
- The baseline files are fixed once applied to a shared environment. A new client DDL version
  becomes a forward migration computed from the difference, not a replacement baseline.
- Flyway is a Java tool. It is used only through its Docker image, so no Java installation is
  needed, but Docker is required to build a database locally.
- Squawk does not inspect data changes (`DELETE`, `UPDATE`, plain `TRUNCATE`); those rely on
  review. Its rule set is pinned with the tool version in CI.
- The expected object counts in the schema check are updated by any migration that changes
  them, which keeps every structural change visible in review.

## Alternatives considered

- **A custom migration runner with a destructive-statement guard.** Rejected: history,
  checksums, ordering and SQL parsing are solved problems, and custom code would need its own
  maintenance and tests.
- **Atlas.** Versioned migrations, linting and schema diff in one tool. Rejected for now:
  enforcing lint checks and some PostgreSQL analyzers are in the paid tier, and the tier for
  Row-Level Security management was not clear. Atlas can still be used ad hoc to compute the
  difference between two DDL versions.
- **ORM migrations (Prisma, Drizzle, TypeORM).** Rejected: each wants its own schema
  definition, which would compete with the client DDL, and setting tenant context per
  transaction for Row-Level Security is awkward in them.
- **node-pg-migrate, dbmate, graphile-migrate, Sqitch.** Viable, but less widely known than
  Flyway, and none includes a destructive-change guard, so Squawk would be needed regardless.
- **Liquibase.** Comparable to Flyway, but its changelog formats add a layer over plain SQL
  that this project does not need.
