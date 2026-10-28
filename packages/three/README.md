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
  `travelTo` walks the way from one place to the next inside the buildings, and `drawPath`
  draws it on the floors in the top view.
- **Out:** `on(handler)` receives the five events `select`, `focus`, `highlight`, `overlay`
  and `scenario`.

`createViewer(canvas, { characters })` adds animated people (3DV-07). `characters.load`
fetches the GLB models (`gltfCharacterLoader(baseUrl, dracoPath)`); the `seated` models
type at every occupied desk in place of the procedural people, and the `avatar` model is the
process avatar. It walks each `travelTo` while the camera follows a few steps behind (third
person), empty-handed (between desks the order goes through the systems) unless the travel
says `carrying`: then it carries the order as a folder, as on the last leg, to the lorry. The rooms' doors swing open only for a walk that goes through
them, and the automatic doors slide open for it, rather than for the camera.
`peopleReady()` resolves once they are in place, and `setTravelSpeed` sets how fast the avatar
walks (a multiple of a real walking pace; 2 unless set). Without `characters` the procedural
people sit still and the camera travels alone.

Routes are the shortest walks that go round everything standing in the buildings
(`building/create-walk-grid.ts`): each storey's floor is a grid of 10 cm cells, closed a body
width round every shape the buildings are built of (furniture, walls, glazing, stairs, the
leaves of open doors, the forklifts and the aisle one works), and the grids are joined by the
stairs and walkways. Where there is room a walk keeps 0.6 m from anything, so that the
avatar's swinging hands and the folder miss walls and glazing; only doorways and gaps between
desks bring it nearer, never under 0.3 m.

`showPlace(workstation)` stands the avatar beside a desk, in a word with the person there,
seen from inside as at the end of a travel. A receptionist sits at each office's reception desk, as decoration.

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
| `avatars/`         | Seated people, animated characters and the process avatar          |
| `loaders/`         | GLB loading with Draco geometry                                    |
| `instancing/`      | Instanced trees                                                    |
| `traffic/`         | Vehicles driving looping paths                                     |
| `process-route/`   | Route arcs between desks, stop markers and state styling           |
| `overlays/`        | Screen-space labels                                                |
| `selection/`       | Click picking                                                      |
| `highlighting/`    | The selection marker                                               |

Static geometry goes through `ShapeBatch`, which merges a furnished floor into one mesh per
material, so the whole site renders in a few hundred draw calls.

`assets/`, `culling/` and `animation/` also keep their README for the glTF pipeline that
will replace the procedural placeholders.

Characters are Mixamo exports converted to GLB by `scripts/blender/build_character.py` (clips
merged onto one rig, root motion stripped from the walk, WebP textures, Draco geometry); see
its header for the command line.

## Demo

`pnpm dev` opens `demo/`, which plays the presentation layer over the Order-to-Cash demo
data in `demo/data/o2c-demo.json` (synthetic, from the O2C demo data guide):

- `demo/domain/` reads the dataset and derives order progress, process KPIs and, per job,
  what its holder did, waited on and cost.
- `demo/layout/` says where everything goes (`site-plan.ts`) and builds the twin, the
  navigator summaries and the route of the order being shown.
- `demo/ui/` renders the building navigator, summary card, flow bar and the Order, People
  and Process KPIs tabs.
- `demo/public/models/people/` holds the two character models: `office-worker-a` (Walk,
  Idle, Talk and Type: the process avatar, and some of the people at the desks) and
  `office-worker-b` (Type). `demo/public/draco/` serves three.js's Draco decoder for them.

Labour costs use the assumed hourly rates in `demo/data/cost-assumptions.json`; the guide
gives none, so replace them with real cost-centre data.

The walk opens outside the head office: the avatar walks in from its entrance to the desk of
whoever registers the order (the first step's person), and only there is the order received,
a "New order received" card beside that person. It goes on from there to each desk in turn, empty-handed, and carries the order, as a folder, only on the last leg, to the lorry. During
the walk the bar at the top has a speed slider for the avatar, and steps follow on by
themselves until Next or Previous is clicked: from then on each step waits for the next click,
until the Auto button is pressed again.

URL parameters open a specific state: `?order=SO-1004`, `?view=HQ-1` (building and floor,
or `HALL`), `?focus=E006` (a person or job code), `?tab=process`, `?play` (or `?play=3`, to
start the walk at its fourth scene) and `?mode=2d` for the top view.
