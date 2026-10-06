# ADR-003: React + Vite + TypeScript frontend

**Status:** Proposed. **RECOMMENDED**, not a confirmed requirement.

## Context

The web application is an authenticated enterprise product used behind single sign-on, with
form- and table-heavy screens alongside a highly interactive 3D view.

## Decision

Build the web application as a client-rendered single-page application with React, Vite and
TypeScript.

- **Authenticated enterprise SPA.** Every screen is behind sign-in, so there is nothing for a
  search engine to index and no first-paint benefit from server rendering that matters to
  these users.
- **Highly interactive 3D application.** The 3D view is inherently client-side; it cannot be
  server-rendered.
- **No requirement for SSR as the core application model.** Avoiding a server rendering tier
  also means each regional deployment serves static assets from a CDN instead of running an
  additional runtime.
- **Clean Three.js integration.** React and Three.js are both widely used together, and the
  viewer package keeps the two loosely coupled.
- **Code splitting.** Vite splits by route and isolates the rendering engine in its own chunk.
- **Maintainability.** TypeScript end to end, with request and response schemas shared with
  the API through `packages/contracts`.

## Consequences

- Any public, indexable surface such as a marketing or demonstration site is a separate
  concern and is not a reason to server-render the application.
- Angular is a credible alternative for form-heavy enterprise screens; React was preferred
  for its Three.js ecosystem and bundle control. This trade-off is close and is recorded so it
  can be revisited if the balance of screens changes.
