import {
  Box3,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  type Material,
} from 'three';

import type { Materials } from '../assets/materials';
import { createLabel } from '../overlays/create-label';
import type { OfficeBuildingModel, RoomModel, Side } from '../viewer-contract/twin-model';
import {
  buildRoom,
  insideFacade,
  PARTITION_HEIGHT,
  roomFrame,
  slabWithHole,
  stairLayout,
  stairOpening,
  type Rect,
} from './create-room';
import { createSlidingDoor } from './create-sliding-door';
import { createSwingDoors, type DoorSpot, type SwingDoors } from './create-swing-doors';
import { SIDES, sideFrame, spansAround } from './frames';
import { ShapeBatch } from './shape-batch';
import type { Walker } from './walker';

export interface BuiltOffice {
  readonly root: Group;
  /** One group per storey, ground floor first; workstations are added to these. */
  readonly floors: readonly Group[];
  readonly roof: Group;
  /** Height of a storey's finished floor above the ground. */
  elevation(level: number): number;
  /** World bounds of one storey, for camera framing. */
  floorBounds(level: number): Box3;
  /**
   * Opens the doors someone comes through: the room doors for walkers whose route goes
   * through them, the automatic doors for walkers or, with none about, for the camera.
   */
  update(deltaSeconds: number, cameraPosition: Vector3, walkers?: readonly Walker[]): void;
  /** The swinging room doors, one set per storey. */
  readonly roomDoors: readonly SwingDoors[];
}

/** Plinth height: the ground floor sits a few steps above the plaza. */
const PLINTH = 0.45;
const SLAB = 0.3;
/** Height of the precast band that runs round the building at each floor. */
const BAND = 0.85;
const GLASS_INSET = 0.18;
const MULLION_SPACING = 1.5;
const PILASTER_SPACING = 8;
/** The main entrance's glazed opening, and the width of the doors in it and elsewhere. */
const ENTRANCE_GAP = 7;
const DOOR_WIDTH = 3;
const DOOR_HEIGHT = 2.6;

/**
 * Builds a multi-storey office: a precast concrete frame with a band at every floor,
 * full-height glazing between slim pilasters, a canopied entrance, a roof with plant and
 * solar panels, and on each storey the rooms of the model with glass partitions, cores
 * (stairs, lifts) and furniture.
 *
 * Storeys are separate groups so the building can be cut away floor by floor.
 */
export function createOfficeBuilding(model: OfficeBuildingModel, m: Materials): BuiltOffice {
  const root = new Group();
  root.name = `office:${model.entity.id}`;
  root.position.set(model.center[0], 0, model.center[1]);

  const [width, depth] = model.size;
  const height = model.floorHeight;
  const elevation = (level: number): number => PLINTH + level * height;
  const levels = model.floors.length;

  const roomDoors: SwingDoors[] = [];
  const floors = model.floors.map((floor) => {
    const group = new Group();
    group.name = `floor:${floor.entity.id}`;
    group.userData.level = floor.level;

    const shell = new ShapeBatch();
    buildStoreyShell(shell, m, model, floor.level, elevation);
    group.add(shell.build(`shell-${floor.level}`));

    const interior = new ShapeBatch();
    const spots: DoorSpot[] = [];
    for (const room of floor.rooms) {
      buildRoom(interior, m, room, model, elevation(floor.level), height - SLAB, {
        doors: spots,
        climb: height,
        stairBelow: floor.level > 0,
        stairUp: floor.level < levels - 1,
      });
    }
    group.add(interior.build(`interior-${floor.level}`));
    const swinging = createSwingDoors(spots, m.doorWood);
    group.add(swinging.root);
    roomDoors.push(swinging);

    for (const room of floor.rooms) {
      if (room.kind === 'core') continue;
      const label = createLabel({ variant: 'room', title: room.title });
      label.position.set(room.center[0], elevation(floor.level) + 0.2, room.center[1]);
      label.userData.reveal = 'floor';
      group.add(label);
    }

    root.add(group);
    return group;
  });

  const roof = new Group();
  roof.name = 'roof';
  const roofBatch = new ShapeBatch();
  const topCore = model.floors[levels - 1]?.rooms.find((room) => room.kind === 'core');
  buildRoof(
    roofBatch,
    m,
    width,
    depth,
    elevation(levels),
    topCore ? insideFacade(topCore, model) : undefined,
  );
  roof.add(roofBatch.build('roof'));
  root.add(roof);

  // The entrance canopy and lettering belong to the ground floor.
  const entrance = new ShapeBatch();
  buildEntrance(entrance, m, model, elevation(0), elevation(1) - SLAB);
  floors[0]?.add(entrance.build('entrance'));
  const sign = createSign(model.signage);
  placeOnSide(sign, model.entrance, width, depth, 4.6, elevation(1) - SLAB - 0.15);
  floors[0]?.add(sign);

  // Automatic doors: one in the recessed entrance, one wherever a walkway arrives.
  const doorOptions = {
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
    leaf: m.partitionGlass,
    frame: m.aluminium,
  };
  const doors = [
    { side: model.entrance, offset: 0, inset: 1.2 },
    ...(model.doors ?? []).map((door) => ({ ...door, inset: GLASS_INSET })),
  ].map(({ side, offset, inset }) => {
    const door = createSlidingDoor(doorOptions);
    const [x, , z, rotation] = sideFrame(side, width, depth, inset).place;
    const along = new Vector3(Math.cos(rotation), 0, -Math.sin(rotation));
    door.root.position.set(x + along.x * offset, elevation(0), z + along.z * offset);
    door.root.rotation.y = rotation;
    floors[0]?.add(door.root);
    return door;
  });

  return {
    root,
    floors,
    roof,
    elevation,
    roomDoors,
    update(deltaSeconds, cameraPosition, walkers = []) {
      for (const door of doors) door.update(deltaSeconds, cameraPosition, walkers);
      for (const set of roomDoors) set.update(deltaSeconds, walkers);
    },
    floorBounds(level) {
      const base = elevation(level);
      return new Box3(
        new Vector3(model.center[0] - width / 2, base, model.center[1] - depth / 2),
        new Vector3(
          model.center[0] + width / 2,
          base + PARTITION_HEIGHT,
          model.center[1] + depth / 2,
        ),
      );
    },
  };
}

// ---------------------------------------------------------------------------------------
// Shell

function buildStoreyShell(
  b: ShapeBatch,
  m: Materials,
  model: OfficeBuildingModel,
  level: number,
  elevation: (level: number) => number,
): void {
  const [width, depth] = model.size;
  const base = elevation(level);
  const ceiling = elevation(level + 1) - SLAB;

  // The stair from the storey below comes up through this floor's core.
  const coreRoom = model.floors[level]?.rooms.find((room) => room.kind === 'core');
  const core = level > 0 && coreRoom ? insideFacade(coreRoom, model) : undefined;
  if (level === 0) {
    b.block(width + 0.8, PLINTH, depth + 0.8, m.plinth, 0, 0, 0);
  } else {
    slab(b, m, width - 0.2, depth - 0.2, base - SLAB, core);
    ceilingLights(b, m, width, depth, base - SLAB, core);
    ring(b, m.concrete, width, depth, base - SLAB, BAND, 0.4);
  }
  // The floor finish, open over the stair like the slab under it.
  const finish = {
    minX: -width / 2 + 0.2,
    maxX: width / 2 - 0.2,
    minZ: -depth / 2 + 0.2,
    maxZ: depth / 2 - 0.2,
  };
  slabWithHole(b, m.vinyl, finish, core ? stairOpening(core) : null, base, 0.02);

  // Glazing between the bands, with mullions, a transom and a sill rail.
  const glassBottom = level === 0 ? base + 0.05 : base - SLAB + BAND;
  const glassHeight = ceiling - glassBottom;
  const openingsOn = (side: Side): { at: number; width: number }[] =>
    level !== 0
      ? []
      : [
          ...(side === model.entrance ? [{ at: 0, width: ENTRANCE_GAP }] : []),
          ...(model.doors ?? [])
            .filter((door) => door.side === side)
            .map((door) => ({ at: door.offset, width: DOOR_WIDTH + 0.2 })),
        ];
  const inOpening = (side: Side, x: number, margin = 0): boolean =>
    openingsOn(side).some((opening) => Math.abs(x - opening.at) < opening.width / 2 + margin);
  for (const side of SIDES) {
    const { length, place } = sideFrame(side, width, depth, GLASS_INSET);
    b.push(...place);
    for (const [from, to] of spansAround(length, openingsOn(side))) {
      const span = to - from;
      b.block(span, glassHeight, 0.03, m.facadeGlass, (from + to) / 2, glassBottom, 0);
      b.block(span, 0.08, 0.14, m.aluminium, (from + to) / 2, glassBottom, 0);
      b.block(
        span,
        0.06,
        0.1,
        m.aluminium,
        (from + to) / 2,
        glassBottom + 2.35 - (level === 0 ? 0 : BAND - SLAB),
        0,
      );
    }
    for (let x = -length / 2; x <= length / 2 + 0.01; x += MULLION_SPACING) {
      if (inOpening(side, x)) continue;
      b.block(0.06, glassHeight, 0.14, m.aluminium, x, glassBottom, 0);
    }
    // A transom over each door opening, other than the canopied entrance.
    for (const opening of openingsOn(side)) {
      if (side === model.entrance && opening.at === 0) continue;
      b.block(
        opening.width,
        glassHeight - DOOR_HEIGHT - 0.2,
        0.03,
        m.facadeGlass,
        opening.at,
        glassBottom + DOOR_HEIGHT + 0.2,
        0,
      );
    }
    b.pop();
  }

  // Pilasters, which also carry on through the band.
  for (const side of SIDES) {
    const { length, place } = sideFrame(side, width, depth, -0.05);
    b.push(...place);
    const count = Math.max(1, Math.round(length / PILASTER_SPACING));
    for (let index = 0; index <= count; index += 1) {
      const x = -length / 2 + (index * length) / count;
      if (inOpening(side, x, 0.3)) continue;
      b.block(0.5, ceiling - (base - SLAB), 0.6, m.concrete, x, base - SLAB, 0);
    }
    b.pop();
  }
}

/**
 * The stairwell opening through an upper floor (see `stairOpening`): its front is where the
 * top step meets this floor, so someone coming up steps out onto the floor in front of the
 * flights.
 */
function voidParts(core: RoomModel): Rect[] {
  return [stairOpening(core)];
}

/** A room's footprint as a rectangle. */
const footprint = (room: RoomModel): Rect => ({
  minX: room.center[0] - room.size[0] / 2,
  maxX: room.center[0] + room.size[0] / 2,
  minZ: room.center[1] - room.size[1] / 2,
  maxZ: room.center[1] + room.size[1] / 2,
});

const insideAny = (parts: readonly Rect[], x: number, z: number, margin = 0): boolean =>
  parts.some(
    (part) =>
      x > part.minX - margin &&
      x < part.maxX + margin &&
      z > part.minZ - margin &&
      z < part.maxZ + margin,
  );

/**
 * A floor slab whose underside is at `y`, with the stairwell void cut out of it so the
 * stairs (and a camera taking them) pass between floors. The slab is laid in columns that
 * skip the void, and a glass balustrade guards the landing's open edges.
 */
function slab(
  b: ShapeBatch,
  m: Materials,
  width: number,
  depth: number,
  y: number,
  core: RoomModel | undefined,
): void {
  if (!core) {
    b.block(width, SLAB, depth, m.slab, 0, y, 0);
    return;
  }
  const parts = voidParts(core);
  const z0 = -depth / 2;
  const z1 = depth / 2;
  const columns = [
    ...new Set([-width / 2, width / 2, ...parts.flatMap((part) => [part.minX, part.maxX])]),
  ].sort((p, q) => p - q);
  for (let index = 1; index < columns.length; index += 1) {
    const left = columns[index - 1]!;
    const right = columns[index]!;
    const middle = (left + right) / 2;
    const open = parts.filter((part) => middle > part.minX && middle < part.maxX);
    if (open.length === 0) {
      b.block(right - left, SLAB, depth, m.slab, middle, y, 0);
      continue;
    }
    const north = Math.min(...open.map((part) => part.minZ));
    const south = Math.max(...open.map((part) => part.maxZ));
    if (north > z0) b.block(right - left, SLAB, north - z0, m.slab, middle, y, (z0 + north) / 2);
    if (z1 > south) b.block(right - left, SLAB, z1 - south, m.slab, middle, y, (south + z1) / 2);
  }

  // Nobody walks into the opening.
  const opening = parts[0]!;
  b.keepOut(
    opening.maxX - opening.minX,
    2.2,
    opening.maxZ - opening.minZ,
    (opening.minX + opening.maxX) / 2,
    y + SLAB,
    (opening.minZ + opening.maxZ) / 2,
  );

  // A glass balustrade along the opening's two long sides, at this floor, standing on the
  // edge of the slab clear of the flights; its front is open, where the stair meets the
  // floor, and it ends at the face of the core's back wall.
  const stairs = stairLayout(core);
  const frame = roomFrame(core);
  const glass = 1.05;
  const backWall = stairs.back + 0.24;
  const length = stairs.flightFront - backWall;
  const middle = (stairs.flightFront + backWall) / 2;
  const clear = 0.06;
  b.push(frame.x, y + SLAB, frame.z, frame.rotation);
  for (const x of [
    stairs.firstFlight - stairs.width / 2 - clear,
    stairs.secondFlight + stairs.width / 2 + clear,
  ]) {
    b.block(0.03, glass, length, m.partitionGlass, x, 0, middle);
    b.block(0.08, 0.05, length, m.aluminiumLight, x, glass, middle);
  }
  b.pop();
}

/** A grid of recessed light panels on the underside of a slab whose soffit is at `y`. */
function ceilingLights(
  b: ShapeBatch,
  m: Materials,
  width: number,
  depth: number,
  y: number,
  core?: RoomModel,
): void {
  for (let x = -width / 2 + 2.5; x < width / 2 - 1.5; x += 3.6) {
    for (let z = -depth / 2 + 2.5; z < depth / 2 - 1.5; z += 3.6) {
      // Not over the core, whose walls would cut through the panels.
      if (core && insideAny([footprint(core)], x, z, 0.7)) continue;
      b.block(1.2, 0.02, 0.6, m.ceilingLight, x, y - 0.02, z);
    }
  }
}

/** A band of `height` metres round the footprint, standing proud of it by `proud`. */
function ring(
  b: ShapeBatch,
  material: Material,
  width: number,
  depth: number,
  y: number,
  height: number,
  proud: number,
): void {
  const thickness = 0.35;
  const offset = proud - thickness / 2;
  b.block(width + proud * 2, height, thickness, material, 0, y, depth / 2 + offset);
  b.block(width + proud * 2, height, thickness, material, 0, y, -depth / 2 - offset);
  b.block(thickness, height, depth + proud * 2, material, width / 2 + offset, y, 0);
  b.block(thickness, height, depth + proud * 2, material, -width / 2 - offset, y, 0);
}

function buildRoof(
  b: ShapeBatch,
  m: Materials,
  width: number,
  depth: number,
  top: number,
  core: RoomModel | undefined,
): void {
  b.block(width - 0.2, SLAB, depth - 0.2, m.slab, 0, top - SLAB, 0);
  ceilingLights(b, m, width, depth, top - SLAB, core);
  ring(b, m.concrete, width, depth, top - SLAB, 1.35, 0.4);
  b.block(width - 0.4, 0.04, depth - 0.4, m.gravel, 0, top, 0);
  ring(b, m.aluminiumLight, width, depth, top + 1.05, 0.08, 0.42);

  // Lift and stair overrun with a plant screen.
  b.block(10, 3, 7, m.plantRoom, -width * 0.18, top, -depth * 0.15);
  b.block(10.4, 0.15, 7.4, m.aluminium, -width * 0.18, top + 3, -depth * 0.15);
  for (let index = 0; index < 3; index += 1) {
    const x = -width * 0.18 + 7.5 + index * 3;
    b.block(2.2, 1.3, 1.6, m.plantRoom, x, top, -depth * 0.2);
    b.cylinder(0.5, 0.5, 0.06, m.steelBlack, x - 0.5, top + 1.33, -depth * 0.2, 20);
    b.cylinder(0.5, 0.5, 0.06, m.steelBlack, x + 0.5, top + 1.33, -depth * 0.2, 20);
  }
  for (let index = 0; index < 4; index += 1) {
    b.cylinder(
      0.18,
      0.18,
      0.9,
      m.aluminiumLight,
      -width * 0.32 + index * 1.4,
      top + 0.45,
      depth * 0.18,
    );
  }

  // Solar array on the east half of the roof.
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      const x = width * 0.12 + column * 2.1;
      const z = -depth * 0.1 + row * 2.6;
      b.push(x, top + 0.55, z, 0);
      b.box(2, 0.05, 1.6, m.solar, 0, 0, 0);
      b.box(2.02, 0.07, 0.04, m.aluminiumLight, 0, 0, 0.8);
      b.pop();
      b.block(0.06, 0.5, 0.06, m.aluminiumLight, x, top, z + 0.5);
    }
  }
}

function buildEntrance(
  b: ShapeBatch,
  m: Materials,
  model: OfficeBuildingModel,
  floor: number,
  ceiling: number,
): void {
  const [width, depth] = model.size;
  const { place } = sideFrame(model.entrance, width, depth, 0);
  b.push(...place);

  // Glazed entrance set back in a recess, its automatic doors slid open in the middle.
  for (const x of [-2.75, 2.75]) b.block(1.5, ceiling - floor, 0.03, m.facadeGlass, x, floor, -1.2);
  b.block(3, ceiling - floor - 2.6, 0.03, m.facadeGlass, 0, floor + 2.6, -1.2);
  for (const x of [-3.5, -1.5, 1.5, 3.5]) {
    b.block(0.1, ceiling - floor, 0.16, m.aluminium, x, floor, -1.2);
  }
  b.block(7, 0.12, 0.2, m.aluminium, 0, floor + 2.6, -1.2);
  b.block(7.2, 0.3, 1.4, m.concrete, 0, ceiling - 0.3, -0.6);
  for (const side of [-1, 1])
    b.block(0.4, ceiling - floor, 1.4, m.concrete, side * 3.7, floor, -0.6);
  b.block(7, 0.02, 1.4, m.stone, 0, floor, -0.6);

  // Canopy on two columns, with steps down to the plaza.
  b.block(11, 0.35, 4.6, m.concrete, 0, 3.6, 2.3);
  b.block(11.1, 0.06, 4.7, m.aluminiumLight, 0, 3.95, 2.3);
  for (const x of [-4.6, 4.6]) b.cylinder(0.16, 0.16, 3.6, m.aluminiumLight, x, 1.8, 4.1);
  for (let step = 1; step <= 3; step += 1) {
    b.block(8, (step * PLINTH) / 3, 0.4, m.stone, 0, 0, 0.6 + (3 - step) * 0.4);
  }
  b.pop();
}

// ---------------------------------------------------------------------------------------
// Geometry helpers

function placeOnSide(
  object: Mesh,
  side: Side,
  width: number,
  depth: number,
  out: number,
  y: number,
): void {
  const { place } = sideFrame(side, width, depth, -out);
  object.position.set(place[0], y + 0.55, place[2]);
  object.rotation.y = place[3];
}

/** Lettering on a panel above the canopy. */
function createSign(text: string): Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#2b3138';
  context.font = '600 64px "Segoe UI", Helvetica, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.letterSpacing = '6px';
  context.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  const sign = new Mesh(
    new PlaneGeometry(8, 1),
    new MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.6,
      depthWrite: false,
    }),
  );
  sign.name = 'signage';
  return sign;
}
