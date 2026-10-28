# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**3D.DET 2.0**: a multi-tenant platform that models an organisation as a digital twin (its
structure, people, jobs, tasks and processes), shows the spaces they occupy in 3D, and adds AI
tools. Upstream is `github.com/hafizhuzaifaahmed/3d-det-v2` (branch `main`). It is a pnpm +
Turborepo monorepo:

```
apps/web          React + Vite web app            apps/api     NestJS modular monolith
apps/worker       BullMQ background jobs          packages/domain  framework-free domain logic
packages/db       PostgreSQL access (Kysely)      packages/contracts  Zod schemas
packages/ai       AI providers, tools             packages/ui  shared React components
packages/config   shared TS/tooling config        packages/three  THE 3D VIEWER (most work here)
database/  DDL, Flyway migrations   infrastructure/  Terraform   docs/  architecture + ADRs
```

Almost all of our work so far is in **`packages/three`**: the Three.js viewer and its demo,
an Order-to-Cash (O2C) digital twin of a company site (head office + production hall), with a
guided walk in which an animated avatar carries an order from desk to desk.

## How to run it (step by step)

Requirements (from the root `package.json`): **Node.js >= 24.11.0** and **pnpm >= 10.18.0**
(`packageManager: pnpm@10.18.2`). This machine has Node 24.16.0 and pnpm 10.18.2.

In a terminal (PowerShell or Git Bash):

1. Check the tools: `node -v` and `pnpm -v`. If `pnpm` is missing, install it once with
   `npm install -g pnpm@10.18.2`.
2. Go to the project: `cd C:\Users\abood\3d-det-v2`
3. Install the packages (first time, or after pulling new code): `pnpm install`
4. Start the 3D demo: `pnpm --filter @3ddet/three dev` (runs `vite demo --open` in
   `packages/three`, opens the browser itself). No `pnpm build` is needed for it: its only
   workspace dependency is `@3ddet/config`, which is tooling config.
5. Open the address the terminal prints, usually **http://localhost:5173**:
   - `http://localhost:5173` - the 3D twin of the site
   - `http://localhost:5173/?play` - starts the guided walk through an order at once
   - `http://localhost:5173/?order=SO-1001&play` - the walk for one particular order
   - `?play=3` starts the walk at scene 3; `?mode=2d` opens the 2D top view
6. Stop it with **Ctrl + C** in that terminal.

Vite takes 5173 if it is free, otherwise the next free port (5174, ...), and prints which; a
second copy started while one is running lands on 5174. In the Claude desktop app it runs in
the Terminal tab "three demo".

The old version, before the reset to upstream (see History), is in
`C:\Users\abood\3d-det-v2-before-update` and runs the same way from that folder
(`pnpm install`, then `pnpm --filter @3ddet/three dev`); stop the current one first.

## Commands

From the repo root:

- `pnpm install`; `pnpm build` builds every package (the apps need the built `dist/` of the
  packages they use; the 3D demo does not).
- `pnpm --filter @3ddet/three dev`: the 3D demo (see "How to run it" above).
- Checks (run all before calling work done; CI runs the same):
  `pnpm lint && pnpm typecheck && pnpm test && pnpm check:boundaries` and `pnpm build`.
  For just the viewer: `npx turbo run typecheck lint test build --filter=@3ddet/three`.
- Formatting: `npx prettier --check packages/three` (`--write` to fix). The root
  `package.json` already fails Prettier upstream; leave it alone. `.prettierignore` and
  `eslint.config.mjs` ignore `**/public/draco/**` (the vendored Draco decoder).
- In `packages/three`: `npx vitest run` (79 tests), `npx tsc -p tsconfig.json --noEmit` and
  `npx tsc -p demo/tsconfig.json` (the demo has its own tsconfig).

`check:boundaries` enforces: `packages/domain` imports no framework/IO/three; only
`packages/db` imports `pg`/`kysely`; only `packages/three` and `apps/web` import `three`.

Windows notes: the Bash tool is Git Bash. Python's `write_text` writes CRLF; write files with
`write_bytes(s.encode())` (or the Edit tool) and run Prettier, which normalises to LF. In a bash
heredoc, a `'` inside a single-quoted test name has broken the command; write long patch
scripts to the scratchpad with the Write tool and run them instead.

## Working rules for this repo

- **Do not commit or push unless the user asks.** All our work is currently uncommitted on
  `main` (see "History" below). If asked to ship: branch per CONTRIBUTING.md
  (`feat/DET-123-…`, one Jira task per PR, Conventional Commit title ending in the Jira key,
  squash merge; `main` is protected).
- Code style: follow the surrounding code. Comments are full sentences in plain British English
  that say _why_, JSDoc on exports and on non-obvious constants; names are descriptive words
  (`stairLayout`, `insideFacade`), not abbreviations. Constants in `UPPER_CASE` with a doc
  comment giving the unit.
- Keep docs in step: `packages/three/README.md` and the per-folder `README.md` files
  (`src/avatars/`, `src/loaders/`, ...) describe behaviour; update them with the code.
- Every behaviour change gets a test; check that a new test fails without the change.

## packages/three architecture

Units are **metres**. Y is up. Character/object forward is **+Z**; a heading/`facing` angle
is radians with **0 = +Z** (`direction = (sin a, 0, cos a)`, `atan2(dx, dz)`).

### Contract and orchestrator

- `src/viewer-contract/`: the public shape. `twin-model.ts` (`TwinViewModel`: site, offices
  with floors and rooms, halls with zones/racks/docks/trucks, walkways, workstations, route),
  `events.ts` (`select`, `focus`, `highlight`, `overlay`, `scenario`), `entityKey(entity)` =
  `"kind:id"` (kinds: building, floor, person, job, seat, truck).
- `src/scene/create-viewer.ts`: `createViewer(canvas, options)` returns the `ViewerHandle`
  (load, setView, setRoute, focus, select, setCallout, dispatch, showPlace, travelTo,
  pauseTravel, setTravelSpeed, clearTravel, setTopView, showPlanFloor, drawPath,
  peopleReady, ...). It owns renderer, CSS2D label layer, camera rig and the render loop. Frame
  `deltaSeconds` is capped at 0.1 s. No business logic: the demo decides what to show.
- `src/building/create-site.ts`: builds everything from the model; exposes `registry`
  (entityKey -> Object3D), `anchors` (head positions for callouts), `navigation`,
  `elevation(building, level)`, `setView`, `seatPeople`, `cameraOccluders`, `dispatch`.

### Buildings

- **`ShapeBatch`** (`building/shape-batch.ts`) merges static geometry into one mesh per
  material (push/pop frames, `block`, `box`, `cylinder`, `sphere`). It also records every
  shape's box in `group.userData.solids`; `solidsOf(root)` returns them in world space, and
  `keepOut(...)` adds an invisible box (e.g. forklift lanes, the stair opening). These solids
  are the **colliders** the walking grid avoids.
- `create-office-building.ts`: storeys are separate groups (cut-away by floor). Floor
  elevation = `PLINTH 0.45 + level * floorHeight (4)`, `SLAB 0.3`. Storey vinyl is laid with
  `slabWithHole` around the stair opening; a glass balustrade (offset `clear = 0.06`) runs
  round the opening; the top floor has no stair up (`stairUp: level < levels - 1`); ceiling
  lights skip the core footprint.
- `create-room.ts`: rooms in the building's local frame. `roomFrame(room)` gives a frame
  whose **+Z points at the room's door**; `fromRoomFrame` converts back.
  `insideFacade(room, building)` pulls a room clear of the facade (`FACADE_DEPTH 0.3`), so
  nothing is built into columns/glazing. Cores: walls (north/south run full width, east/west
  fit between), two lift shafts, WC door, and a dog-leg stair from **`stairLayout(core)`**,
  which is shared by geometry and navigation so feet land on drawn steps (11 steps per flight,
  `FLIGHT_THICKNESS 0.35` so there is headroom below). `stairOpening(core)` is the hole in the
  floor above. Lobbies get the reception desk via `receptionDeskAt` and
  `receptionLayout(lobby)` (the receptionist's chair seat and rotation), shared by the
  furniture and the seated receptionist, who is decoration only. Room doors are recorded as
  `DoorSpot`s, not built.
- `create-swing-doors.ts`: room doors as moving leaves (quaternion swing, `REACH 4`,
  `KEEP_OPEN 7`, `OPEN_SECONDS 0.35`); they open only for a walker whose route passes through
  them (`walker.ts`: `passesThrough`, `isComingThrough`), and `openBoxes()` gives the open
  leaves as obstacles. `create-sliding-door.ts`: automatic doors, walker-aware, else
  camera-triggered.
- `create-hall.ts`: the production hall (floor at 1.2 m, dock height), zones, racks, docks,
  trucks, rooms with doors, a working forklift and a parked one. The parked forklift stands
  beside the first dock (upstream had it inside the shipping office); keep-outs cover it and
  the working aisle.
- Walkways (`create-site.ts` `buildWalkway`) join buildings, flat then `WALKWAY_STEPS 3` x
  `WALKWAY_TREAD 0.4` steps up to the hall floor; these constants live in
  `create-navigation.ts` and are shared with the geometry.
- `assets/furniture.ts`: procedural furniture, each piece in its own frame (user side -Z,
  front +Z). `RECEPTION_CHAIR` is where the reception chair stands at its desk.

### Walking (navigation + colliders)

- `create-walk-grid.ts`: each storey's floor is a grid of `CELL 0.1` m cells. Anything whose
  box overlaps the body band (floor + 0.12 .. floor + 1.9) closes its cells; a chamfer distance
  transform gives each cell's `clearance` (metres to the nearest solid).
  - `BODY_RADIUS 0.3`: hard limit, cells nearer than this are not walkable.
  - `COMFORT 0.6`: soft limit. A* step cost is multiplied by `crowding` (1 at >= 0.6 m, up to
    `1 + CROWDING (3)` at 0.3 m), so walks take the middle of corridors and only come close
    where they must (1 m doorways leave ~0.4-0.5 m). This was added because the avatar's
    hands and folder clipped glass partitions at the old 0.25 m.
  - `createWalkPlanner(grids, links)`: multi-grid A* (Euclidean heuristic) with `WalkLink`s
    (stairs, walkways: fixed `via` polylines), then string-pulling (`straighten`) where a
    shortcut must be **as clear as the stretch of the walk it replaces** (minus one cell) and,
    within the "loose" radius of a start/end place beside a desk, need only miss solids.
  - Measured on the demo: all 182 place-to-place routes found, avg ~40 ms, max ~130 ms; away
    from doorways no route passes nearer than 0.5 m to anything.
- `create-navigation.ts`: `createNavigation({ model, elevation, obstacles })` builds grids per
  storey + hall, stair links (from `flightFront + 0.6` in front of the first flight, through
  tread centres and the landing, to in front of the top step on the floor above; every stair
  point belongs to the lower floor), walkway links, and **places**: workstation ids (visitor
  spot beside the chair: side 0.9 / exec 1.3 / standing 1.0, back 0.55, facing the seat),
  truck ids (2.2 m inside the dock door) and `entrance:<building>` (outside the lobby door).
  `route(from, to)` and `visit(place)`. Obstacles come from `create-site.ts`:
  `solidsOf(building.root)` + door `openBoxes()`.

### People, avatar and camera

- Character models: `demo/public/models/people/office-worker-a.glb` (clips Walk, Idle, Talk,
  Type; used for the avatar and some seated people) and `office-worker-b.glb` (Type). Built
  from Mixamo FBX by `packages/three/scripts/blender/build_character.py` (merge clips by bone
  name, strip root motion from Walk, WebP textures, Draco). Loaded by
  `gltfCharacterLoader(baseUrl, dracoPath)` (`loaders/create-gltf-loader.ts`); the demo
  serves the Draco decoder from `demo/public/draco/`.
- `avatars/create-character.ts`: one skeleton copy + mixer per person, clothes tinted per
  person (`Suit`, `Pants`, `Hair` mesh-name keys), `play(clip)`, `setPace`, `part(boneName)`.
- `avatars/create-seated-people.ts`: a typing character in every occupied chair, hips set
  `SEAT_BACK 0.08` behind the seat centre, replacing the procedural placeholder from
  `create-avatar-kit.ts`. Seats come from workstations (`occupant === 'person'`, not
  standing) **plus one receptionist per office lobby** (`reception:<building>` seat, built in
  `create-site.ts`).
- `avatars/create-process-avatar.ts`: the process avatar (SRS AVT-01). `walk(points)` at
  `WALK_SPEED 1.73` m/s x `setSpeed` multiplier (long walks quickened up to `MAX_PACE 3.5`),
  turning at `TURN_RATE 6`; Talk on arrival. Carries an `order-folder` mesh on
  `mixamorigRightHand` (bone is in centimetres, so the folder is scaled back).
  The folder is hidden by default: the avatar walks **empty-handed** and carries the order
  only when told (`setCarrying(true)`, `carrying`), which the demo does only on the last leg,
  to the truck (user's decision 2026-10-27: between desks the order goes through the systems).
  `placeAt(position, facing, clip)`, `setPaused`, `hide`. It is a `Walker`, so doors open for
  it.
- `camera/create-camera-rig.ts`: orbit rig + animated framing (`moveTo`, `frame`, `glide`) and
  a third-person **follow** mode (`FOLLOW_DEFAULTS` 4.2 back, 2.3 up). It pulls in front of
  occluders (`site.cameraOccluders()`: stone, core walls, slabs, concrete, door leaves), never
  nearer than `FOLLOW_MIN_DISTANCE`; under `FOLLOW_CLOSE 1.5` m it goes over the shoulder
  (`FOLLOW_OVER`) instead, e.g. at stair landings.
- Viewer travel: `travelTo(place, { from, state, onArrive, carrying })` routes, draws the
  floor arrow, then `walkTravel` walks the avatar (folder shown only with `carrying`) with the
  camera following, and settles behind the visitor spot along the way it arrived
  (`settleView`, `SETTLE`). It returns false when `from === place` (no walk). `showPlace(place)`:
  for `entrance:<building>` the avatar stands outside, seen from outside; for a workstation it
  stands beside the desk (Talk, empty-handed), interior view, camera from `settleView` of a
  route from the building's entrance, so it is always on open floor (a camera behind the
  visitor's facing landed outside the facade). `setTravelSpeed` default 2x.

## The demo (`packages/three/demo`)

- `data/o2c-demo.json` (synthetic O2C dataset: tenant, process steps, orders SO-1001..,
  people) and `data/cost-assumptions.json` (assumed hourly rates).
- `domain/`: order progress, process KPIs, per-job KPIs. `layout/site-plan.ts`: where
  everything is. Head office `HQ` at [-42, -2], 48 x 26 m, 3 floors (GF sales, 1F finance,
  2F shared rooms), entrance south, core [0, -8] 10 x 10, lobby "Reception" [0, 7] 14 x 12. Hall `HALL`
  70 x 44. `layout/twin-layout.ts` builds the `TwinViewModel`; `layout/tour-plan.ts` plans the
  guided walk (intro "Order received", one stop per reached step, dispatch, outcome).
- `main.ts`: wires viewer + UI. **Order intake** (user's decisions 2026-10-27; rejected:
  receiving at the reception desk, "doesn't make sense", and opening already inside at the
  desk): the avatar **starts outside** the head office's entrance (`ENTRANCE`,
  `entrance:HQ`) and the first scene, "Order received", is itself a walk: `travelTo` from
  `ENTRANCE` to the desk of whoever registers the order, `intakeOf(plan)` in
  `layout/tour-plan.ts` (the first stop, e.g. Giulia Rossi E001). Only **on arrival** is the
  order received: `arrivalCard` ("New order received", `ui/tour-cards.ts`) is pinned beside
  that person, the caption shows the `EXTERNAL_EVENT` trigger, and the scene is retimed to
  `INTRO_SECONDS 6` (it has `seconds: null` and `pause` while walking, like a stop). Step 1
  ("Register customer order") is at the same desk, so its `travelTo` returns false and the
  scene calls `showPlace` (not `focus`, which framed it from outside). Each later stop is a
  `travelTo` from the previous place, empty-handed; the dispatch leg passes `carrying: true`.
  2D mode draws the same entrance-to-desk line (`drawPath`) on the ground floor and pins the
  arrival card on arrival.
- `ui/tour-player.ts`: the tour bar. Steps advance automatically until Previous/Next is
  clicked, which switches to **Manual** (the step stays after its time runs out); the mode
  button (`.tour-mode`, Auto/Manual) switches back. `ui/speed-control.ts`: speed slider
  (0.5x..5x, starts at 2x).
- URL params: `?order=SO-1004`, `?view=HQ-1` or `HALL`, `?focus=E006`, `?tab=process`,
  `?play` / `?play=3` (start the walk, waiting for `peopleReady()`), `?mode=2d`.

## Verifying in a browser

- Vitest runs in Node without a DOM, so `createSite` (labels, canvas textures) cannot be
  built in unit tests; tests cover the walk grid, navigation over the demo twin with empty
  obstacles, room geometry via `ShapeBatch` + `solidsOf`, doors, characters (fake skinned
  model) and the avatar.
- For whole-site checks, temporarily expose the site after `site = createSite(model)` in
  `create-viewer.ts` (`globalThis.__site = site; // DEBUG-TEMP`), run JavaScript in the browser
  (routes between every place, clearance against `userData.solids`), then **remove the hook**.
- The desktop app's built-in browser pane renders with the software "Microsoft Basic Render
  Driver" (~11 fps). Walks still run in real time (dt cap), screenshots can be a frame stale
  (take two), and a hidden pane throttles `requestAnimationFrame`. The Practice_Babylon
  `.claude/launch.json` belongs to another project; open this demo with
  `preview_start { url: "http://localhost:5173/" }` (or the port the dev server printed) once it is running.
- `?play` starts the walk on load; use Previous to step back to "Order received" (this
  switches to Manual so the scene holds).

## History and state (as of 2026-10-27)

- 2026-10-26: the working copy was reset to upstream `main` (the teammate's O2C twin, commit
  `b10fbc6`) and our features ported in: seated typing characters, the walking process avatar
  with third-person camera, swing and walker-aware sliding doors, real stair openings. The
  previous version (Blender pipeline, BuildingConstruction, RouteMap/WalkLine, truck
  departure) is kept in `C:\Users\abood\3d-det-v2-before-update` and in `git stash@{0}`
  ("realistic site, avatar, people, doors, 2D replay"). Look there before rebuilding an old
  feature.
- Since then: walk-grid colliders and shortest paths, a speed slider, Auto/Manual stepping,
  the stair overlap fixes (top-floor stair into the roof, balustrade, lift pits/walls,
  ceiling lights), walkway steps aligned with the walk, forklift keep-outs, the
  over-the-shoulder camera, the 0.6 m wall clearance, a decorative receptionist, the order
  walk starting outside the entrance and the order received only once the avatar reaches the
  registering person's desk, and the folder carried only to the truck.
- Everything above is **uncommitted** (`git status` shows the modified and new files under
  `packages/three`, plus `.prettierignore`, `eslint.config.mjs` and this file).
- Related project: `C:\Users\abood\Practice_Babylon` (Next.js + Babylon.js), the earlier
  presentation-layer prototype for the same 3D.DET product. It has its own CLAUDE.md and
  nothing here depends on it.
