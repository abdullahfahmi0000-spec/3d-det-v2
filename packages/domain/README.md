# @3ddet/domain

Framework-independent domain layer.

## Hard rule

This package must not depend on NestJS, an HTTP framework, a database driver, React or
Three.js. It contains types and pure functions only, so it can be tested without any
infrastructure and so the surrounding framework stays replaceable
(`docs/adr/ADR-004-modular-monolith.md`).

The rule is enforced by `pnpm check:boundaries`, which runs in CI.

## Current contents

Structural primitives only. Business rules are added as the corresponding product
capabilities are specified; nothing here is a placeholder for a decision that has not been
made.

| Module                      | Purpose                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| `result.ts`                 | Explicit success/failure value for expected outcomes.                      |
| `tenant/tenant-context.ts`  | Tenant and scenario identifiers required by every tenant-scoped operation. |
| `authorization/decision.ts` | Authorisation decision value and the deny-precedence combination rule.     |
