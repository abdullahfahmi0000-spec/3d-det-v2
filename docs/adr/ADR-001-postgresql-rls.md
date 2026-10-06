# ADR-001: PostgreSQL with Row-Level Security

**Status:** Accepted. Confirmed requirement.

## Context

3D.DET 2.0 is multi-tenant. Tenants are organisations whose structural, personnel and process
data must never be visible to one another. Tenant data is also partitioned by scenario, where
one scenario represents the live organisation and others represent proposed changes to it.

## Decision

1. **PostgreSQL is the system of record.**
2. **Row-Level Security is the tenant isolation mechanism**, enforced by the database.
3. **Application-level filtering is not the primary security boundary.** Application code may
   filter by tenant, and often will for clarity or performance, but isolation must hold even
   where an application query omits that filter.
4. **Tenant context is established before any tenant-scoped query runs**, and is scoped to the
   unit of work. No tenant-scoped query runs without it.
5. **Scenario authorisation is handled explicitly.** A well-formed scenario identifier does not
   imply permission to read or change that scenario; access is authorised before the scenario
   is placed in the session context.
6. **Privileged provisioning operations are tightly controlled and audited.** Operations that
   legitimately need to act across tenants -- creating a tenant from a template, for example --
   are narrow, named and audited. The general application role is never widened to make them
   possible.

## Consequences

- There is exactly one supported path to the database for tenant-scoped work. In this
  repository that path is `withTenantTransaction` in `packages/db`.
- Row-Level Security returns no rows when tenant context is absent, rather than raising an
  error. A bypassed path therefore looks like missing data, not a fault. The security suite
  must assert this empty result explicitly.
- The schema is owned by the approved DDL. The application derives its types from the
  database and never declares a competing schema.
- Local development databases that connect as a superuser do not exercise isolation and must
  not be used to test it.

## To be finalised during database and security implementation

- The exact session variables and policy expressions.
- Policy coverage across the approved table set, and which reference tables are exempt.
- The database roles and their grants.
- The mechanism for scenario comparison, which needs two scenarios visible together without
  relaxing isolation.
- The implementation of each privileged provisioning operation.
- Connection pooling configuration compatible with transaction-scoped session context.
