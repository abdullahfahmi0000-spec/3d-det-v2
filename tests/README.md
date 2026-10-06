# Tests

Unit tests live beside the code they test, inside each package, and run with `pnpm test`.
This directory holds suites that span packages or need external dependencies.

| Directory      | Scope                                                    |
| -------------- | -------------------------------------------------------- |
| `e2e/`         | Browser-driven journeys across web and API.              |
| `integration/` | Real PostgreSQL, Redis and object storage in containers. |
| `security/`    | Tenant isolation and authorisation.                      |
| `load/`        | Load and performance.                                    |
