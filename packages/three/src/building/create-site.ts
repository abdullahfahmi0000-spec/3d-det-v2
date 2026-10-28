import {
  BoxGeometry,
  Box3,
  CatmullRomCurve3,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import * as furniture from '../assets/furniture';
import { createMaterials, type Materials } from '../assets/materials';
import { seededRandom } from '../assets/seeded-random';
import { createVehicleKit, type VehicleKit } from '../assets/create-vehicle-kit';
import {
  createAvatarKit,
  type AvatarAppearance,
  type AvatarKit,
} from '../avatars/create-avatar-kit';
import type { CharacterModel } from '../avatars/create-character';
import { seatPeople, type Seat, type SeatedPeople } from '../avatars/create-seated-people';
import { SEATED_HEAD_HEIGHT } from '../avatars/proportions';
import { createTreeGrove } from '../instancing/create-tree-grove';
import {
  createLabel,
  setLabelNotes,
  toCssColor,
  type LabelNote,
  type LabelReveal,
} from '../overlays/create-label';
import { createTraffic } from '../traffic/create-traffic';
import {
  entityKey,
  type GroundPoint,
  type ParkingModel,
  type RoadModel,
  type SiteModel,
  type TwinViewModel,
  type ViewModeModel,
  type WalkwayModel,
  type WorkstationModel,
} from '../viewer-contract/twin-model';
import { createHall, type BuiltHall } from './create-hall';
import {
  createNavigation,
  WALKWAY_STEPS,
  WALKWAY_TREAD,
  type Navigation,
} from './create-navigation';
import { createOfficeBuilding, type BuiltOffice } from './create-office-building';
import { insideFacade, receptionLayout } from './create-room';
import { ShapeBatch, solidsOf } from './shape-batch';
import type { Walker } from './walker';

export interface Site {
  readonly root: Group;
  /** Focusable objects by entity key. */
  readonly registry: ReadonlyMap<string, Object3D>;
  /** Points just above each occupant's head and each docked truck, by entity id. */
  readonly anchors: ReadonlyMap<string, Vector3>;
  /** The walking network: routes between desks, posts and docks. */
  readonly navigation: Navigation;
  /** Finished-floor height of a storey, by building entity id and level. */
  elevation(building: string, level: number): number;
  /** Whether a building entity id is a hall (one storey, opened from above in the plan). */
  isHall(building: string): boolean;
  /** Opens up a building or one of its floors, hiding what is above it. */
  setView(view: ViewModeModel): void;
  /** World bounds of what a view shows, for camera framing. */
  boundsFor(view: ViewModeModel): Box3;
  /**
   * Writes notes, such as the process steps of the order being shown, under the labels of
   * the workstations they belong to. Returns the anchor ids that had a label to write on.
   */
  annotate(notes: ReadonlyMap<string, readonly LabelNote[]>): ReadonlySet<string>;
  /**
   * Drives a docked truck out of the yard and away along the nearest road. Returns how
   * long it takes to reach the road and the ground it covers, for camera framing, or null
   * for an unknown truck.
   */
  dispatch(truckId: string): { readonly seconds: number; readonly bounds: Box3 } | null;
  /** Puts every dispatched truck back at its dock. */
  resetDispatch(): void;
  /** Hides or shows every label of the twin at once. */
  setLabelsVisible(visible: boolean): void;
  /**
   * Sits an animated character, typing, in every occupied chair (the reception desks'
   * included) in place of the procedural person built there, choosing among `models` by
   * workstation. Returns how many were seated.
   */
  seatPeople(models: readonly CharacterModel[]): number;
  /** Takes the animated characters out again, back to the procedural people. */
  releasePeople(): void;
  /**
   * What a camera following someone through the buildings keeps in front of: the solid
   * parts (stair treads, core walls, slabs, the concrete frame) and the room doors' leaves.
   * Glazing is left out, as the camera can film through it.
   */
  cameraOccluders(): readonly Object3D[];
  /**
   * Animates the site. `walkers` are the people walking a route through the buildings, for
   * the doors on their way; with none, the automatic doors open for the camera instead.
   */
  update(elapsed: number, cameraPosition: Vector3, walkers?: readonly Walker[]): void;
}

/** Pull-away acceleration and cruising speed of a dispatched truck. */
const TRUCK_ACCELERATION = 2.2;
const TRUCK_SPEED = 10;

interface Departure {
  readonly truck: Object3D;
  readonly curve: CatmullRomCurve3;
  readonly length: number;
  /** The truck's parent; the path is in world space and is converted into its frame. */
  readonly parent: Object3D;
  /** World Y rotation of the parent, so a world heading can be written as a local one. */
  readonly parentYaw: number;
  start: number | null;
}

/** How the receptionist at the front desk looks. */
const RECEPTIONIST: AvatarAppearance = { shirt: 0x2f6f73, skin: 0xc99a76, hair: 0x2a1a12 };

/** Beyond this camera distance, in metres, people's labels would crowd, so they are hidden. */
const NEAR_DISTANCE = 62;
/** Free desks are labelled only from this close, so they do not crowd the people. */
const CLOSE_DISTANCE = 30;
const CAR_COLOURS = [
  0xe8e8e6, 0x2b2d31, 0x8d939a, 0x1f3550, 0xbfc3c7, 0x6b1f22, 0x4a4f55, 0xd9d4c8,
];

interface Storey {
  readonly group: Group;
  readonly elevation: number;
  readonly origin: GroundPoint;
}

interface TrackedLabel {
  readonly label: CSS2DObject;
  readonly reveal: LabelReveal;
  readonly building: string | null;
  readonly level: number | null;
  readonly position: Vector3;
  /** Entity id of the workstation the label belongs to, if any. */
  readonly owner: string | null;
}

/**
 * Builds the physical twin: grounds, roads and car park, the office buildings with their
 * storeys, the manufacturing hall with docks and trucks, a desk and person per
 * workstation, traffic, trees and a backdrop of the surrounding town.
 */
export function createSite(model: TwinViewModel): Site {
  const root = new Group();
  root.name = 'site';
  const registry = new Map<string, Object3D>();
  const anchors = new Map<string, Vector3>();

  const m = createMaterials();
  const vehicles = createVehicleKit(m);
  const avatars = createAvatarKit();

  root.add(buildGrounds(model.site, m));
  root.add(parkedCars(model.site.parking, vehicles));
  root.add(createTreeGrove(model.site.trees));
  root.add(createBackdrop(model.site));

  const storeys = new Map<string, Storey>();
  const offices = new Map<string, BuiltOffice>();
  for (const office of model.offices) {
    const built = createOfficeBuilding(office, m);
    built.root.userData.selectable = office.entity;
    registry.set(entityKey(office.entity), built.root);
    offices.set(office.entity.id, built);
    built.floors.forEach((group, level) => {
      storeys.set(`${office.entity.id}#${level}`, {
        group,
        elevation: built.elevation(level),
        origin: office.center,
      });
      const floor = office.floors[level];
      if (floor) registry.set(entityKey(floor.entity), group);
    });
    // Each floor is tagged with its code in the plan view, at the building's north-west corner.
    office.floors.forEach((floor, level) => {
      const tag = createLabel({
        variant: 'floor-tag',
        marker: floor.code ?? `L${level}`,
        title: office.title,
        lines: [floor.subtitle ? `${floor.title} · ${floor.subtitle}` : floor.title],
      });
      tag.position.set(-office.size[0] / 2, built.elevation(level) + 0.3, -office.size[1] / 2);
      tag.center.set(0, 1.15);
      tag.userData.reveal = 'plan';
      built.floors[level]?.add(tag);
    });
    root.add(built.root);
  }

  const halls = new Map<string, BuiltHall>();
  for (const hall of model.halls) {
    const built = createHall(hall, m, vehicles);
    built.root.userData.selectable = hall.entity;
    registry.set(entityKey(hall.entity), built.root);
    for (const [key, object] of built.registry) registry.set(key, object);
    for (const [id, anchor] of built.anchors) anchors.set(id, anchor);
    halls.set(hall.entity.id, built);
    storeys.set(`${hall.entity.id}#0`, {
      group: built.floor,
      elevation: built.floorLevel,
      origin: hall.center,
    });
    const tag = createLabel({
      variant: 'floor-tag',
      marker: 'HALL',
      title: hall.title,
      lines: ['Ground level · production, storage and dispatch'],
    });
    tag.position.set(-hall.size[0] / 2, built.floorLevel + 0.3, -hall.size[1] / 2);
    tag.center.set(0, 1.15);
    tag.userData.reveal = 'plan';
    built.floor.add(tag);
    root.add(built.root);
  }

  if (model.walkways.length > 0) {
    const batch = new ShapeBatch();
    for (const walkway of model.walkways) buildWalkway(batch, m, walkway);
    root.add(batch.build('walkways'));
  }

  /** The chairs someone sits in, for the animated people. */
  const seats: Seat[] = [];
  model.workstations.forEach((workstation, index) => {
    const storey = storeys.get(`${workstation.building}#${workstation.level}`);
    if (!storey) return;
    const station = buildWorkstation(workstation, m, avatars, index);
    station.position.set(
      workstation.position[0] - storey.origin[0],
      storey.elevation,
      workstation.position[1] - storey.origin[1],
    );
    storey.group.add(station);
    // Standing posts keep their procedural person: the characters only sit and type.
    if (workstation.occupant === 'person' && workstation.kind !== 'standing') {
      seats.push({
        id: workstation.entity.id,
        station,
        placeholder: station.getObjectByName('person') ?? null,
        appearance: workstation.appearance,
      });
    }
    registry.set(entityKey(workstation.entity), station);
    anchors.set(
      workstation.entity.id,
      new Vector3(
        workstation.position[0],
        storey.elevation + SEATED_HEAD_HEIGHT,
        workstation.position[1],
      ),
    );
  });

  // A receptionist behind each office's reception desk.
  for (const office of model.offices) {
    const lobby = office.floors[0]?.rooms.find((room) => room.kind === 'lobby');
    const storey = storeys.get(`${office.entity.id}#0`);
    if (!lobby || !storey) continue;
    const desk = receptionLayout(insideFacade(lobby, office));
    const station = new Group();
    station.name = `reception:${office.entity.id}`;
    station.position.set(desk.seat[0], storey.elevation, desk.seat[1]);
    station.rotation.y = desk.rotation;
    const person = avatars.seated(RECEPTIONIST, model.workstations.length);
    station.add(person);
    storey.group.add(station);
    seats.push({ id: station.name, station, placeholder: person, appearance: RECEPTIONIST });
  }

  for (const callout of model.callouts ?? []) {
    const label = createLabel({
      variant: 'callout',
      marker: String(callout.number),
      title: callout.title,
      lines: callout.lines,
    });
    label.element.style.setProperty('--callout-accent', toCssColor(callout.accent));
    label.position.set(callout.position[0], callout.height, callout.position[1]);
    label.userData.reveal = 'overview';
    root.add(label);
  }

  const traffic = createTraffic(model.site.traffic, vehicles);
  root.add(traffic.root);

  // Shadows: opaque meshes cast and receive, glazing only receives.
  root.traverse((object) => {
    if (!(object instanceof InstancedMesh)) return;
    object.receiveShadow = true;
  });

  root.updateMatrixWorld(true);
  const labels = trackLabels(root, storeys);
  const ownedLabels = new Map(
    labels.filter((entry) => entry.owner !== null).map((entry) => [entry.owner!, entry]),
  );
  const annotated = new Set<TrackedLabel>();

  // Trucks keep their docked placement so a dispatch can be undone.
  const docked = new Map<Object3D, { position: Vector3; rotation: number }>();
  let departures: Departure[] = [];

  let view: ViewModeModel = { building: null, level: null };
  let labelsOn = true;
  let people: SeatedPeople | null = null;
  let lastElapsed: number | null = null;
  /** In the plan, the office floor shown: the one asked for, else the ground floor. */
  const planLevel = (building: string): number =>
    view.building === building ? (view.level ?? 0) : 0;
  const applyView = (): void => {
    for (const [id, office] of offices) {
      const isolated = !view.interior && view.building === id && view.level !== null;
      if (view.plan) {
        const shown = planLevel(id);
        office.floors.forEach((floor, level) => {
          floor.visible = level <= shown;
        });
        office.roof.visible = false;
        continue;
      }
      office.floors.forEach((floor, level) => {
        floor.visible = !isolated || level <= (view.level ?? 0);
      });
      office.roof.visible = !isolated;
    }
    for (const hall of halls.values()) {
      // The hall is shown cut away unless the camera is busy with an office floor.
      hall.roof.visible =
        !view.plan &&
        (view.interior === true ||
          (view.building !== null && !halls.has(view.building) && view.level !== null));
    }
  };
  applyView();

  // Few, simple meshes (a storey's stair treads are one mesh of a few hundred triangles),
  // so a camera can test them every frame.
  const solid = new Set<Material>([m.stone, m.coreWall, m.slab, m.concrete]);
  const occluders: Object3D[] = [
    ...[...offices.values()].flatMap((office) => office.roomDoors.flatMap((set) => set.leaves)),
    ...[...halls.values()].flatMap((hall) => hall.roomDoors.leaves),
  ];
  for (const building of [
    ...[...offices.values()].flatMap((office) => office.floors),
    ...[...halls.values()].map((hall) => hall.floor),
  ]) {
    building.traverse((object) => {
      if (object instanceof Mesh && solid.has(object.material as Material)) occluders.push(object);
    });
  }

  // What stands in the buildings, for walks to go round: every shape they are built of,
  // and the leaves of the room doors, open.
  const obstacles = new Map<string, Box3[]>();
  for (const [id, office] of offices) {
    obstacles.set(id, [
      ...solidsOf(office.root),
      ...office.roomDoors.flatMap((set) => set.openBoxes()),
    ]);
  }
  for (const [id, hall] of halls) {
    obstacles.set(id, [...solidsOf(hall.root), ...hall.roomDoors.openBoxes()]);
  }

  const navigation = createNavigation({
    model,
    elevation: (building, level) => storeys.get(`${building}#${level}`)?.elevation ?? 0,
    obstacles: (building) => obstacles.get(building) ?? [],
  });

  return {
    root,
    registry,
    anchors,
    navigation,
    elevation: (building, level) => storeys.get(`${building}#${level}`)?.elevation ?? 0,
    isHall: (building) => halls.has(building),
    setView(next) {
      view = next;
      applyView();
    },
    boundsFor(target) {
      if (target.building === null) {
        const bounds = new Box3();
        for (const office of offices.values()) {
          bounds.union(office.floorBounds(0)).union(office.floorBounds(office.floors.length - 1));
        }
        for (const hall of halls.values()) bounds.union(hall.bounds());
        return bounds;
      }
      const office = offices.get(target.building);
      if (office) {
        if (target.level !== null) return office.floorBounds(target.level);
        return office.floorBounds(0).union(office.floorBounds(office.floors.length - 1));
      }
      return halls.get(target.building)?.bounds() ?? new Box3();
    },
    annotate(notes) {
      for (const entry of annotated) setLabelNotes(entry.label, []);
      annotated.clear();
      const handled = new Set<string>();
      for (const [anchor, list] of notes) {
        const entry = ownedLabels.get(anchor);
        if (!entry) continue;
        setLabelNotes(entry.label, list);
        annotated.add(entry);
        handled.add(anchor);
      }
      return handled;
    },
    dispatch(truckId) {
      const truck = registry.get(entityKey({ kind: 'truck', id: truckId }));
      if (!truck?.parent) return null;
      if (!docked.has(truck)) {
        docked.set(truck, { position: truck.position.clone(), rotation: truck.rotation.y });
      }
      departures = departures.filter((departure) => departure.truck !== truck);

      // The path is planned in world space from the truck's world position and heading, so
      // it holds however the hall (the truck's parent) is placed, rotated or scaled.
      const parent = truck.parent;
      const yawOf = (object: Object3D): number => {
        const direction = object.getWorldDirection(new Vector3());
        return Math.atan2(direction.x, direction.z);
      };
      const start = truck.getWorldPosition(new Vector3());
      const path = departurePath(start, yawOf(truck), model.site);
      const curve = new CatmullRomCurve3(path.points, false, 'centripetal', 0.3);
      departures.push({
        truck,
        curve,
        length: curve.getLength(),
        parent,
        parentYaw: yawOf(parent),
        start: null,
      });

      const bounds = new Box3().setFromPoints(path.points.slice(0, path.onRoad + 1));
      bounds.expandByScalar(4);
      bounds.max.y = Math.max(bounds.max.y, 4);
      return { seconds: travelTime(path.distanceToRoad) + 1.5, bounds };
    },
    setLabelsVisible(visible) {
      labelsOn = visible;
    },
    seatPeople(models) {
      people?.dispose();
      people = seatPeople(seats, models);
      return people.count;
    },
    releasePeople() {
      people?.dispose();
      people = null;
    },
    cameraOccluders: () => occluders,
    resetDispatch() {
      departures = [];
      for (const [truck, placement] of docked) {
        truck.position.copy(placement.position);
        truck.rotation.y = placement.rotation;
        truck.visible = true;
      }
    },
    update(elapsed, cameraPosition, walkers = []) {
      for (const departure of departures) {
        departure.start ??= elapsed;
        const distance = distanceAfter(elapsed - departure.start);
        const t = Math.min(distance / departure.length, 1);
        const point = departure.curve.getPointAt(t);
        const tangent = departure.curve.getTangentAt(t);
        departure.truck.position.copy(departure.parent.worldToLocal(point));
        departure.truck.rotation.y = Math.atan2(tangent.x, tangent.z) - departure.parentYaw;
        departure.truck.visible = t < 1;
      }
      avatars.update(elapsed);
      traffic.update(elapsed);
      const deltaSeconds = lastElapsed === null ? 0 : Math.min(elapsed - lastElapsed, 0.1);
      lastElapsed = elapsed;
      people?.update(deltaSeconds);
      for (const hall of halls.values()) {
        hall.update(elapsed, deltaSeconds, cameraPosition, walkers);
      }
      for (const office of offices.values()) office.update(deltaSeconds, cameraPosition, walkers);

      for (const entry of labels) {
        // Floor tags give the plan its floor numbers, so they stay on during a walk.
        if (entry.reveal === 'plan') {
          entry.label.visible =
            view.plan === true &&
            entry.building !== null &&
            (halls.has(entry.building) || entry.level === planLevel(entry.building));
          continue;
        }
        if (!labelsOn) {
          entry.label.visible = false;
          continue;
        }
        const inPlan = view.plan === true && entry.building !== null;
        const isolated =
          entry.building !== null &&
          (inPlan
            ? halls.has(entry.building) || entry.level === planLevel(entry.building)
            : view.building === entry.building &&
              (view.level === null ? halls.has(entry.building) : view.level === entry.level));
        // With one floor opened up, the floors below it keep their labels to themselves.
        const underneath =
          entry.building !== null &&
          (inPlan
            ? !halls.has(entry.building) && entry.level !== planLevel(entry.building)
            : view.building === entry.building &&
              view.level !== null &&
              entry.level !== view.level);
        if (underneath) {
          entry.label.visible = false;
          continue;
        }
        const near = entry.position.distanceTo(cameraPosition) < NEAR_DISTANCE;
        // A label with notes always shows; from afar it shrinks to its markers.
        if (annotated.has(entry)) {
          entry.label.visible = true;
          entry.label.element.classList.toggle('is-far', !isolated && !near);
          continue;
        }
        switch (entry.reveal) {
          case 'always':
            entry.label.visible = true;
            break;
          case 'floor':
            entry.label.visible = isolated;
            break;
          case 'near':
            entry.label.visible = isolated || near;
            break;
          case 'close':
            entry.label.visible =
              isolated && entry.position.distanceTo(cameraPosition) < CLOSE_DISTANCE;
            break;
          case 'overview':
            entry.label.visible = view.building === null && !view.plan && !view.interior && !near;
            break;
        }
      }
    },
  };
}

/** Distance covered after `seconds`, accelerating from rest up to cruising speed. */
function distanceAfter(seconds: number): number {
  const rampTime = TRUCK_SPEED / TRUCK_ACCELERATION;
  if (seconds <= rampTime) return 0.5 * TRUCK_ACCELERATION * seconds * seconds;
  return 0.5 * TRUCK_ACCELERATION * rampTime * rampTime + TRUCK_SPEED * (seconds - rampTime);
}

/** The inverse of `distanceAfter`. */
function travelTime(distance: number): number {
  const rampTime = TRUCK_SPEED / TRUCK_ACCELERATION;
  const rampDistance = 0.5 * TRUCK_ACCELERATION * rampTime * rampTime;
  if (distance <= rampDistance) return Math.sqrt((2 * distance) / TRUCK_ACCELERATION);
  return rampTime + (distance - rampDistance) / TRUCK_SPEED;
}

/**
 * Waypoints for a truck leaving its dock: straight out, through the nearest driveway, a
 * turn into the near lane of the nearest road (keeping right), then far along the road.
 */
function departurePath(
  start: Vector3,
  heading: number,
  site: SiteModel,
): { points: Vector3[]; onRoad: number; distanceToRoad: number } {
  const forward = new Vector3(Math.sin(heading), 0, Math.cos(heading));
  const pulledOut = start.clone().addScaledVector(forward, 13);
  const points = [start.clone(), pulledOut];

  const driveways = site.paved.filter((area) => area.kind === 'driveway');
  const nearestDriveway = driveways
    .map((area) => new Vector3(area.center[0], 0, area.center[1]))
    .sort((a, b) => a.distanceTo(pulledOut) - b.distanceTo(pulledOut))[0];
  const gate = nearestDriveway ?? pulledOut;
  if (nearestDriveway) points.push(nearestDriveway);

  const road = [...site.roads].sort(
    (a, b) => distanceToRoad([gate.x, gate.z], a) - distanceToRoad([gate.x, gate.z], b),
  )[0];
  if (!road) return { points, onRoad: points.length - 1, distanceToRoad: 30 };

  const from = new Vector3(road.from[0], 0, road.from[1]);
  const along = new Vector3(road.to[0] - road.from[0], 0, road.to[1] - road.from[1]).normalize();
  const centre = from.clone().addScaledVector(along, gate.clone().sub(from).dot(along));
  // The near lane is a quarter of the road's width towards the site.
  const towardsSite = gate.clone().sub(centre).setY(0).normalize();
  const lane = centre.clone().addScaledVector(towardsSite, road.width / 4);
  // Keeping right: the lane must be on the right of the direction of travel.
  const right = (direction: Vector3): Vector3 => new Vector3(-direction.z, 0, direction.x);
  const direction = right(along).dot(towardsSite) > 0 ? along : along.clone().negate();

  const onRoad = points.length + 1;
  points.push(
    lane.clone().addScaledVector(direction, 2),
    lane.clone().addScaledVector(direction, 12),
    lane.clone().addScaledVector(direction, 40),
    lane.clone().addScaledVector(direction, 420),
  );
  let covered = 0;
  for (let index = 1; index <= onRoad; index += 1) {
    covered += points[index]!.distanceTo(points[index - 1]!);
  }
  return { points, onRoad, distanceToRoad: covered + 25 };
}

/** Finds every label in the site and remembers which storey it is on. */
function trackLabels(root: Group, storeys: ReadonlyMap<string, Storey>): TrackedLabel[] {
  const owner = new Map<Object3D, { building: string; level: number }>();
  for (const [key, storey] of storeys) {
    const [building, level] = key.split('#');
    owner.set(storey.group, { building: building!, level: Number(level) });
  }

  const labels: TrackedLabel[] = [];
  root.traverse((object) => {
    if (!(object instanceof CSS2DObject)) return;
    let storey: { building: string; level: number } | undefined;
    for (let parent = object.parent; parent && !storey; parent = parent.parent) {
      storey = owner.get(parent);
    }
    const isBuildingSign = object.element.classList.contains('twin-label--building');
    labels.push({
      label: object,
      reveal:
        (object.userData.reveal as LabelReveal | undefined) ?? (isBuildingSign ? 'always' : 'near'),
      building: storey?.building ?? null,
      level: storey?.level ?? null,
      position: object.getWorldPosition(new Vector3()),
      owner: (object.userData.owner as string | undefined) ?? null,
    });
  });
  return labels;
}

// ---------------------------------------------------------------------------------------
// Workstations

function buildWorkstation(
  model: WorkstationModel,
  m: Materials,
  avatars: AvatarKit,
  index: number,
): Group {
  const station = new Group();
  station.name = `workstation:${model.entity.id}`;
  station.rotation.y = model.heading;
  station.userData.selectable = model.entity;

  const b = new ShapeBatch();
  switch (model.kind) {
    case 'executive':
      furniture.executiveDesk(b, m);
      if (model.occupant !== 'automated') furniture.officeChair(b, m, true);
      break;
    case 'standing':
      furniture.standingStation(b, m, model.occupant !== 'vacant');
      break;
    case 'desk':
      furniture.desk(b, m, {
        monitors: model.occupant === 'automated' || index % 3 === 0 ? 2 : 1,
        screensOn: model.occupant !== 'free',
        white: index % 4 === 1,
      });
      if (model.occupant !== 'automated') furniture.officeChair(b, m);
      break;
  }
  if (model.occupant === 'automated') {
    // The service that does the job stands where its operator would sit, its lights to
    // the room: beside the desk it would stand in the next one.
    b.push(0, 0, -0.15, Math.PI);
    furniture.serverCabinet(b, m, 0.6);
    b.pop();
  }
  if (model.occupant === 'vacant') {
    // A hatched amber box on the floor marks a post nobody holds.
    const size = 2.6;
    for (const [x, z, w, d] of [
      [0, -size / 2 + 0.4, size, 0.1],
      [0, size / 2 + 0.4, size, 0.1],
      [-size / 2, 0.4, 0.1, size],
      [size / 2, 0.4, 0.1, size],
    ] as const) {
      b.block(w, 0.012, d, m.floorAmber, x, 0.012, z);
    }
    for (let stripe = 0; stripe < 6; stripe += 1) {
      b.box(
        0.08,
        0.012,
        size * 0.4,
        m.floorAmber,
        -size / 2 + 0.3 + stripe * 0.42,
        0.018,
        -0.4,
        0.6,
      );
    }
  }
  station.add(b.build(`workstation-${model.entity.id}`));

  if (model.occupant === 'person') {
    const person = avatars.seated(model.appearance, index);
    station.add(person);
  }

  const label = createLabel({
    variant: 'person',
    title: model.title,
    lines: [model.subtitle],
    detail: model.detail,
    tone: model.tone,
  });
  label.position.set(0, model.kind === 'standing' ? 2.4 : 1.85, 0.2);
  label.userData.reveal = model.occupant === 'free' ? 'close' : 'near';
  label.userData.owner = model.entity.id;
  label.element.dataset.occupant = model.occupant;
  station.add(label);
  return station;
}

// ---------------------------------------------------------------------------------------
// Grounds

function buildGrounds(site: SiteModel, m: Materials): Group {
  const b = new ShapeBatch();
  const [lx, lz] = site.lawn.center;
  b.block(site.lawn.size[0], 0.02, site.lawn.size[1], m.grass, lx, 0, lz);

  for (const area of site.paved) {
    const [x, z] = area.center;
    const [w, d] = area.size;
    if (area.kind === 'plaza') {
      b.block(w, 0.1, d, m.paving, x, 0, z);
      for (const [px, pz, pw, pd] of [
        [x, z - d / 2, w + 0.3, 0.3],
        [x, z + d / 2, w + 0.3, 0.3],
        [x - w / 2, z, 0.3, d],
        [x + w / 2, z, 0.3, d],
      ] as const) {
        b.block(pw, 0.14, pd, m.curb, px, 0, pz);
      }
    } else if (area.kind === 'path') {
      b.block(w, 0.06, d, m.paving, x, 0, z);
    } else if (area.kind === 'driveway') {
      b.block(w, 0.17, d, m.asphalt, x, 0, z);
    } else {
      b.block(w, 0.04, d, m.yard, x, 0, z);
    }
  }

  for (const road of site.roads) buildRoad(b, m, road);
  for (const parking of site.parking) buildParking(b, m, parking);

  for (const bench of site.benches) {
    b.push(bench.position[0], 0.1, bench.position[1], bench.heading);
    for (let slat = 0; slat < 4; slat += 1)
      b.block(1.8, 0.04, 0.1, m.oak, 0, 0.42, -0.18 + slat * 0.12);
    for (let slat = 0; slat < 2; slat += 1)
      b.block(1.8, 0.1, 0.04, m.oak, 0, 0.55 + slat * 0.14, -0.26);
    for (const x of [-0.75, 0.75]) b.block(0.06, 0.42, 0.5, m.steelBlack, x, 0, -0.05);
    b.pop();
  }

  return b.build('grounds');
}

function buildRoad(b: ShapeBatch, m: Materials, road: RoadModel): void {
  const [x1, z1] = road.from;
  const [x2, z2] = road.to;
  const length = Math.hypot(x2 - x1, z2 - z1);
  const rotation = Math.atan2(-(z2 - z1), x2 - x1);
  b.push((x1 + x2) / 2, 0, (z1 + z2) / 2, rotation);
  b.block(length, 0.05, road.width, m.asphalt, 0, 0, 0);

  if (length > 60) {
    for (const side of [-1, 1]) {
      b.block(length, 0.01, 0.15, m.roadLine, 0, 0.05, side * (road.width / 2 - 0.45));
      // Pavement with a kerb along each side.
      b.block(length, 0.15, 3, m.paving, 0, 0, side * (road.width / 2 + 1.5));
      b.block(length, 0.17, 0.25, m.curb, 0, 0, side * (road.width / 2 + 0.12));
    }
    for (let x = -length / 2 + 2; x < length / 2 - 3; x += 9) {
      b.block(4.5, 0.01, 0.15, m.roadLine, x + 2.25, 0.05, 0);
    }
    // Street lights on alternate sides.
    for (let x = -length / 2 + 10; x < length / 2; x += 30) {
      const side = Math.round(x / 30) % 2 === 0 ? 1 : -1;
      const z = side * (road.width / 2 + 0.9);
      b.cylinder(0.08, 0.11, 8, m.steelColumn, x, 4, z, 8);
      b.block(0.1, 0.1, 1.6, m.steelColumn, x, 7.9, z - side * 0.8);
      b.block(0.45, 0.14, 0.7, m.steelColumn, x, 7.8, z - side * 1.5);
      b.block(0.4, 0.03, 0.6, m.lightFront, x, 7.78, z - side * 1.5);
    }
  } else {
    for (const side of [-1, 1]) {
      b.block(length, 0.01, 0.12, m.roadLine, 0, 0.05, side * (road.width / 2 - 0.35));
    }
  }
  b.pop();
}

const BAY = { width: 2.6, depth: 5.2 } as const;

function bayPositions(parking: ParkingModel): { x: number; z: number; heading: number }[] {
  const perRow = Math.ceil(parking.bays / 2);
  const [cx, cz] = parking.center;
  const rowZ = [
    cz - parking.size[1] / 2 + BAY.depth / 2 + 0.5,
    cz + parking.size[1] / 2 - BAY.depth / 2 - 0.5,
  ];
  const positions: { x: number; z: number; heading: number }[] = [];
  for (let index = 0; index < parking.bays; index += 1) {
    const row = index < perRow ? 0 : 1;
    const column = index % perRow;
    positions.push({
      x: cx + (column - (perRow - 1) / 2) * BAY.width,
      z: rowZ[row]!,
      heading: row === 0 ? Math.PI : 0,
    });
  }
  return positions;
}

function buildParking(b: ShapeBatch, m: Materials, parking: ParkingModel): void {
  const [cx, cz] = parking.center;
  b.block(parking.size[0], 0.045, parking.size[1], m.asphalt, cx, 0, cz);
  const positions = bayPositions(parking);
  for (const bay of positions) {
    for (const side of [-1, 1]) {
      b.block(0.12, 0.01, BAY.depth, m.roadLine, bay.x + (side * BAY.width) / 2, 0.045, bay.z);
    }
  }
  // A planted strip at each end of the rows.
  for (const end of [-1, 1]) {
    b.block(1.4, 0.3, parking.size[1] - 2, m.hedge, cx + end * (parking.size[0] / 2 - 0.7), 0, cz);
  }
}

function parkedCars(parkings: readonly ParkingModel[], vehicles: VehicleKit): Group {
  const group = new Group();
  group.name = 'parked-cars';
  let colour = 0;
  for (const parking of parkings) {
    const positions = bayPositions(parking);
    for (const index of parking.occupied) {
      const bay = positions[index];
      if (!bay) continue;
      const car = vehicles.car(CAR_COLOURS[colour % CAR_COLOURS.length]!);
      colour += 3;
      car.position.set(bay.x, 0.05, bay.z);
      car.rotation.y = bay.heading;
      group.add(car);
    }
  }
  return group;
}

function buildWalkway(b: ShapeBatch, m: Materials, walkway: WalkwayModel): void {
  const [x1, z1] = walkway.from;
  const [x2, z2] = walkway.to;
  const length = Math.hypot(x2 - x1, z2 - z1);
  b.push((x1 + x2) / 2, 0, (z1 + z2) / 2, Math.atan2(-(z2 - z1), x2 - x1));
  b.block(length, 0.45, walkway.width + 0.6, m.plinth, 0, 0, 0);
  b.block(length, 0.02, walkway.width, m.stone, 0, 0.45, 0);
  for (const side of [-1, 1]) {
    b.block(length, 2.7, 0.03, m.facadeGlass, 0, 0.5, (side * walkway.width) / 2);
    for (let x = -length / 2; x <= length / 2; x += 2) {
      b.block(0.08, 2.75, 0.1, m.aluminium, x, 0.45, (side * walkway.width) / 2);
    }
  }
  b.block(length + 0.4, 0.3, walkway.width + 0.8, m.concrete, 0, 3.2, 0);
  // Steps up to the hall's raised floor at the far end.
  for (let step = 1; step <= WALKWAY_STEPS; step += 1) {
    const rise = (WALKWAY_TOP - 0.45) / WALKWAY_STEPS;
    b.block(
      WALKWAY_TREAD,
      rise * step,
      walkway.width,
      m.stone,
      length / 2 - (WALKWAY_STEPS - step + 0.5) * WALKWAY_TREAD,
      0.45,
      0,
    );
  }
  b.pop();
}

/** The walkway rises to the hall floor, at dock height, in a short flight of steps. */
const WALKWAY_TOP = 1.2;

/** Low-rise blocks around the site, fading into the fog, so it does not float in a void. */
function createBackdrop(site: SiteModel): Group {
  const random = seededRandom(42);
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const count = 70;
  const blocks = new InstancedMesh(geometry, material, count);
  const matrix = new Matrix4();
  const colour = new Color();
  const [cx, cz] = site.lawn.center;
  const reach = Math.max(site.lawn.size[0], site.lawn.size[1]) / 2 + 60;

  let placed = 0;
  for (let attempt = 0; attempt < count * 4 && placed < count; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const distance = reach + 150 + random() * 380;
    const x = cx + Math.cos(angle) * distance;
    const z = cz + Math.sin(angle) * distance;
    if (site.roads.some((road) => distanceToRoad([x, z], road) < road.width + 22)) continue;
    const width = 14 + random() * 30;
    const depth = 12 + random() * 24;
    const height = 7 + random() * (distance > reach + 330 ? 26 : 14);
    matrix.compose(
      new Vector3(x, 0, z),
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        Math.round(random() * 4) * (Math.PI / 2) + 0.05,
      ),
      new Vector3(width, height, depth),
    );
    blocks.setMatrixAt(placed, matrix);
    const shade = 0.5 + random() * 0.14;
    blocks.setColorAt(placed, colour.setRGB(shade, shade * 0.97, shade * 0.92));
    placed += 1;
  }
  blocks.count = placed;
  blocks.receiveShadow = true;

  const group = new Group();
  group.name = 'backdrop';
  group.add(blocks);
  return group;
}

function distanceToRoad([x, z]: GroundPoint, road: RoadModel): number {
  const [x1, z1] = road.from;
  const [x2, z2] = road.to;
  const dx = x2 - x1;
  const dz = z2 - z1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz));
}
