# security

Security tests. Tenant isolation is the primary objective.

Required once the approved DDL and application role exist:

- A query issued **outside** the tenant transaction wrapper returns zero rows from every
  tenant-scoped table. Row-Level Security returns nothing rather than erroring when the
  session context is absent, so this is the test that catches a bypassed wrapper.
- The application role does not hold `BYPASSRLS`.
- Every tenant-scoped table has both a `USING` and a `WITH CHECK` clause.
- A user cannot set a scenario they are not authorised for.
- These tests connect as the application role, never as a superuser.

Not implemented at bootstrap.
