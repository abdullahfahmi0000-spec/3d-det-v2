# @3ddet/db

PostgreSQL access layer built on Kysely.

## The database owns the schema

This package does not declare a schema. Types in `generated/` are produced from the live
database, which is itself built from the approved DDL in `database/ddl/`. A schema declared
in TypeScript would become a second source of truth and drift from the database
(`docs/adr/ADR-001-postgresql-rls.md`).

## One way in

`withTenantTransaction` is the only supported way to reach the database. It opens a
transaction and applies the tenant session context that Row-Level Security policies read,
before any caller query runs.

```ts
await withTenantTransaction(db, context, async (trx) => {
  // every statement here runs with app.tenant_id and app.scenario_id applied
});
```

Two consequences worth stating plainly, because both are easy to lose later:

- Row-Level Security returns **no rows** when the session settings are absent, rather than
  raising an error. A query that bypasses this wrapper therefore looks like missing data,
  not like a fault. The security suite in `tests/security/` asserts the empty result.
- `set_config(..., true)` is transaction-scoped. Connection pooling must not hand a
  connection to another unit of work mid-transaction.

## Layout

| Path                | Contents                                                      |
| ------------------- | ------------------------------------------------------------- |
| `src/client/`       | Client construction. Creating a client opens no connection.   |
| `src/transactions/` | `withTenantTransaction`, the single entry point.              |
| `src/rls/`          | Session-context helpers that RLS policies depend on.          |
| `src/queries/`      | Query modules, organised by owning domain module.             |
| `generated/`        | Types generated from the live schema. Not in version control. |
