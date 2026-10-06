# @3ddet/three

The Three.js viewer platform for the digital twin.

Three.js over WebGL 2 is the confirmed rendering technology and glTF 2.0 / GLB is the
confirmed asset format (`docs/adr/ADR-002-threejs-rendering.md`).

**React Three Fiber is not installed.** It is an implementation option under technical
evaluation, not a settled decision, and the viewer contract below is deliberately framework
independent so the evaluation can be run against the same interface either way.

## The contract

The viewer accepts one view model and emits five events: `select`, `focus`, `highlight`,
`overlay` and `scenario`. Overlay values arrive pre-computed, so the rule that produces a
colour lives on the server and the same values drive the two-dimensional views.

No business rule, threshold or computation belongs in this package.

## Layout

`viewer-contract/`, `scene/` and `camera/` carry the bootstrap implementation. The remaining
directories are scoped placeholders, each with a README stating its responsibility:
`assets/`, `loaders/`, `instancing/`, `culling/`, `avatars/`, `animation/`, `selection/`,
`highlighting/`, `overlays/`, `process-route/`.

## What is here now

`createViewer(canvas)` initialises the WebGL renderer, builds a lit scene and a camera, and
runs a render loop. It verifies the rendering pipeline. It is not the digital twin: there is
no building, no floor plan and no data.
