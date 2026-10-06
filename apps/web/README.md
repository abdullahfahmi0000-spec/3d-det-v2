# @3ddet/web

The 3D.DET web application: React, Vite and TypeScript, rendered client-side.

It will host authentication, dashboards, organisation management, processes, tasks, jobs,
scenarios, business process redesign, analytics, the AI interface and the digital twin.
None of these are implemented yet.

## What is here now

A shell that proves the wiring:

- calls `GET /health` through `src/api/client.ts` and validates the response with the shared
  schema from `@3ddet/contracts`;
- renders a status badge from `@3ddet/ui`;
- mounts the bootstrap viewer from `@3ddet/three`.

Three.js is emitted as a separate chunk (`vite.config.ts`), so screens without a 3D view do
not download the rendering engine.

## Commands

```bash
pnpm --filter @3ddet/web dev        # http://localhost:5173, proxies /api to :3000
pnpm --filter @3ddet/web build
pnpm --filter @3ddet/web test
```
