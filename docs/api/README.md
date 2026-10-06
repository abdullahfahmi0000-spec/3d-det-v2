# API documentation

The API contract is defined in code, in `packages/contracts`, using Zod schemas shared by the
API and the web application.

An OpenAPI description is generated from the API once endpoints beyond the health check
exist, and published here. It is generated rather than hand-written so it cannot drift from
the implementation.

## Current endpoints

| Method | Path      | Response                                                           |
| ------ | --------- | ------------------------------------------------------------------ |
| `GET`  | `/health` | `{ "status": "ok" }` -- liveness only; does not touch the database |
