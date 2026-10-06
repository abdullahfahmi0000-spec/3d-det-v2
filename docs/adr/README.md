# Architecture decision records

| ADR                                        | Decision                                  | Status                                  |
| ------------------------------------------ | ----------------------------------------- | --------------------------------------- |
| [ADR-001](ADR-001-postgresql-rls.md)       | PostgreSQL with Row-Level Security        | Accepted (confirmed requirement)        |
| [ADR-002](ADR-002-threejs-rendering.md)    | Three.js rendering, glTF 2.0 / GLB assets | Accepted (confirmed requirement)        |
| [ADR-003](ADR-003-frontend-react-vite.md)  | React + Vite + TypeScript frontend        | Proposed (recommended)                  |
| [ADR-004](ADR-004-modular-monolith.md)     | NestJS + TypeScript modular monolith      | Proposed (recommended)                  |
| [ADR-005](ADR-005-ai-tool-architecture.md) | AI tool architecture                      | Accepted direction; implementation open |

## Writing an ADR

Copy the structure of an existing record: Status, Context, Decision, Consequences, and the
alternatives that were considered. Mark whether the decision is a confirmed requirement or a
recommendation. Open an issue with the _Architecture decision_ template first, so the
decision is discussed before it is written down.

## Decisions known to be open

These are deliberately not decided at bootstrap; each is settled by measurement or by a
client decision, then recorded here.

- React Three Fiber versus a thin React mount over plain Three.js.
- Partitioning strategy and hierarchy storage at the largest expected organisation size.
- RDS or Aurora for managed PostgreSQL.
- The model for per-student working copies in the education product.
- Authentication model for external MCP clients.
