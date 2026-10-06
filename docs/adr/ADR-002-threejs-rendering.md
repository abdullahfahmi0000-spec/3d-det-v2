# ADR-002: Three.js rendering with glTF 2.0 / GLB assets

**Status:** Accepted. Confirmed requirement.

## Context

The digital twin presents an organisation's buildings, workplaces and people in 3D, in the
browser, alongside a conventional two-dimensional application.

## Decision

- **Rendering engine:** Three.js over WebGL 2.
- **Asset format:** glTF 2.0, delivered as binary GLB.
- **The viewer is a presentation layer.** It renders a view model and reports user
  interaction through a small, fixed event contract. Business rules, thresholds and derived
  values do not live in the viewer; overlay values arrive pre-computed from the server.
- **React Three Fiber:** implementation option under technical evaluation. It is not a
  confirmed decision and is not installed. The viewer contract is framework-independent so
  that the evaluation can be run against the same interface either way.

## Consequences

- Three.js is imported only by `packages/three` and `apps/web`, enforced in CI.
- Three.js is built into its own chunk so that screens without a 3D view do not download it.
- Source models in other formats, including BIM formats, require a conversion step to glTF
  before they can be rendered. The conversion pipeline is chosen during implementation.
- Values that the 3D view and the 2D views both display are computed once, on the server.

## Alternatives considered

Earlier project documentation referred to a different WebGL engine. That position is
superseded by this record.
