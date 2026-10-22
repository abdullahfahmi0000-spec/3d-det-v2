# @3ddet/three

The Three.js viewer platform for the digital twin.

Three.js over WebGL 2 is the confirmed rendering technology and glTF 2.0 / GLB is the
confirmed asset format (`docs/adr/ADR-002-threejs-rendering.md`).

**React Three Fiber is not installed.** It is an implementation option under technical
evaluation, not a settled decision, and the viewer contract below is deliberately framework
independent so the evaluation can be run against the same interface either way.

## The contract

The viewer is driven by commands and reports through events. It holds no business rule:
everything it draws arrives already resolved.

- **In:** `load(TwinViewModel)` gives the site: grounds, roads and car park, office
  buildings with their floors and rooms, the production hall with zones, racking and
  docks, and one workstation per seat with its occupant, title and KPI line.
  `setView(ViewModeModel)` opens up a building or one of its floors, hiding what is above.
  `setRoute(RouteModel)` draws the path of one order from desk to desk.
  `focus`, `select`, `resetView` and `setInsets` move the camera and the selection.
- **Out:** `on(handler)` receives the five events `select`, `focus`, `highlight`, `overlay`
  and `scenario`.

Labels are DOM elements with the classes `twin-label` and `twin-label--<variant>`, plus
`data-tone` and `data-state`; the host page styles them.

## Layout

| Directory          | Responsibility                                                     |
| ------------------ | ------------------------------------------------------------------ |
| `viewer-contract/` | Events, view models and the twin model: the package's public shape |
| `scene/`           | Scene and sky, roads, the viewer orchestrator and GPU disposal     |
| `camera/`          | Camera, orbit + arrow-key rig and animated framing                 |
| `building/`        | Site, office storeys, rooms, the hall, and the geometry batcher    |
| `assets/`          | Materials, procedural furniture and vehicles                       |
| `avatars/`         | Seated people                                                      |
| `instancing/`      | Instanced trees                                                    |
| `traffic/`         | Vehicles driving looping paths                                     |
| `process-route/`   | Route arcs between desks, stop markers and state styling           |
| `overlays/`        | Screen-space labels                                                |
| `selection/`       | Click picking                                                      |
| `highlighting/`    | The selection marker                                               |

Static geometry goes through `ShapeBatch`, which merges a furnished floor into one mesh per
material, so the whole site renders in a few hundred draw calls.

`assets/`, `loaders/`, `culling/`, `animation/` and `avatars/` also keep their README for
the glTF pipeline that will replace the procedural placeholders.

## Demo

`pnpm dev` opens `demo/`, which plays the presentation layer over the Order-to-Cash demo
data in `demo/data/o2c-demo.json` (synthetic, from the O2C demo data guide):

- `demo/domain/` reads the dataset and derives order progress, process KPIs and, per job,
  what its holder did, waited on and cost.
- `demo/layout/` says where everything goes (`site-plan.ts`) and builds the twin, the
  navigator summaries and the route of the order being shown.
- `demo/ui/` renders the building navigator, summary card, flow bar and the Order, People
  and Process KPIs tabs.

Labour costs use the assumed hourly rates in `demo/data/cost-assumptions.json`; the guide
gives none, so replace them with real cost-centre data.

URL parameters open a specific state: `?order=SO-1004`, `?view=HQ-1` (building and floor,
or `HALL`), `?focus=E006` (a person or job code) and `?tab=process`.
