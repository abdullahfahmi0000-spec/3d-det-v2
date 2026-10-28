import { Matrix4, type Material } from 'three';

import * as furniture from '../assets/furniture';
import type { Materials } from '../assets/materials';
import type { GroundPoint, RoomModel, Side } from '../viewer-contract/twin-model';
import type { DoorSpot } from './create-swing-doors';
import { SIDE_ROTATION, SIDES, sideFrame, spans, spansAround, type Placement } from './frames';
import type { ShapeBatch } from './shape-batch';

/**
 * Rooms inside a building: floor finish, glass partitions with a door, solid cores with
 * stairs and lifts, and the decor each kind of room gets. Shared by offices and by rooms
 * built inside the warehouse hall.
 */

export const PARTITION_HEIGHT = 3;
const PARTITION_INSET = 0.05;
const DOOR_WIDTH = 1;
const DOOR_HEIGHT = 2.17;
/** How far doors open, in radians. */
const DOOR_SWING = (100 * Math.PI) / 180;

/**
 * How deep a building's outer wall is, in from the edge of its footprint: its columns and
 * the mullions of its glazing. Rooms on the facade are built clear of it.
 */
const FACADE_DEPTH = 0.3;

const ROOM_FLOOR: Readonly<Record<RoomModel['kind'], keyof Materials>> = {
  office: 'carpet',
  'open-office': 'carpet',
  meeting: 'carpetDark',
  boardroom: 'carpetDark',
  lobby: 'stone',
  break: 'oakFloor',
  core: 'vinyl',
  service: 'vinyl',
  archive: 'vinyl',
};

export interface RoomOptions {
  /**
   * Where the room's door is recorded, to be hung as a moving leaf (see
   * `createSwingDoors`); without it the door is built standing open.
   */
  readonly doors?: DoorSpot[];
  /**
   * How far a core's stair climbs: from this floor to the finished floor above, which is
   * `storeyHeight` plus the slab. Defaults to `storeyHeight`.
   */
  readonly climb?: number;
  /** Whether a stair comes up through a core's floor from the storey below. */
  readonly stairBelow?: boolean;
  /** Whether a core's stair climbs on to a storey above; not from the top floor. */
  readonly stairUp?: boolean;
}

/** A rectangle on the ground, in a building's local frame. */
export interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * The part of a room clear of the building's outer wall: a side on the facade is pulled in
 * behind its columns and glazing, so that nothing in the room is built into them.
 */
export function insideFacade(room: RoomModel, building: { readonly size: GroundPoint }): RoomModel {
  const [width, depth] = building.size;
  let minX = room.center[0] - room.size[0] / 2;
  let maxX = room.center[0] + room.size[0] / 2;
  let minZ = room.center[1] - room.size[1] / 2;
  let maxZ = room.center[1] + room.size[1] / 2;
  if (isOnFacade(room, 'west', building.size)) minX = Math.max(minX, -width / 2 + FACADE_DEPTH);
  if (isOnFacade(room, 'east', building.size)) maxX = Math.min(maxX, width / 2 - FACADE_DEPTH);
  if (isOnFacade(room, 'north', building.size)) minZ = Math.max(minZ, -depth / 2 + FACADE_DEPTH);
  if (isOnFacade(room, 'south', building.size)) maxZ = Math.min(maxZ, depth / 2 - FACADE_DEPTH);
  return {
    ...room,
    center: [(minX + maxX) / 2, (minZ + maxZ) / 2],
    size: [maxX - minX, maxZ - minZ],
  };
}

/**
 * The opening a core's stair comes up through on the storey above: over its two flights
 * and the landing, from the back wall to the top step, where the floor resumes.
 */
export function stairOpening(core: RoomModel): Rect {
  const stairs = stairLayout(core);
  const a = fromRoomFrame(core, stairs.firstFlight - stairs.width / 2, stairs.flightFront);
  const b = fromRoomFrame(core, stairs.secondFlight + stairs.width / 2, stairs.back);
  return {
    minX: Math.min(a[0], b[0]),
    maxX: Math.max(a[0], b[0]),
    minZ: Math.min(a[1], b[1]),
    maxZ: Math.max(a[1], b[1]),
  };
}

/** A flat slab over `area`, with `hole` left open: laid in up to four strips round it. */
export function slabWithHole(
  b: ShapeBatch,
  material: Material,
  area: Rect,
  hole: Rect | null,
  y: number,
  thickness: number,
): void {
  const strip = (minX: number, maxX: number, minZ: number, maxZ: number): void => {
    if (maxX - minX < 0.01 || maxZ - minZ < 0.01) return;
    b.block(maxX - minX, thickness, maxZ - minZ, material, (minX + maxX) / 2, y, (minZ + maxZ) / 2);
  };
  if (!hole) {
    strip(area.minX, area.maxX, area.minZ, area.maxZ);
    return;
  }
  const minZ = Math.max(area.minZ, hole.minZ);
  const maxZ = Math.min(area.maxZ, hole.maxZ);
  strip(area.minX, area.maxX, area.minZ, minZ);
  strip(area.minX, area.maxX, maxZ, area.maxZ);
  strip(area.minX, Math.max(area.minX, hole.minX), minZ, maxZ);
  strip(Math.min(area.maxX, hole.maxX), area.maxX, minZ, maxZ);
}

export function buildRoom(
  b: ShapeBatch,
  m: Materials,
  room: RoomModel,
  building: { readonly size: GroundPoint },
  floor: number,
  storeyHeight: number,
  options: RoomOptions = {},
): void {
  const [cx, cz] = room.center;
  const [sx, sz] = room.size;
  // The floor finish runs to the facade; walls and furniture stop clear of it.
  const inside = insideFacade(room, building);
  const finish = {
    minX: cx - sx / 2 + 0.05,
    maxX: cx + sx / 2 - 0.05,
    minZ: cz - sz / 2 + 0.05,
    maxZ: cz + sz / 2 - 0.05,
  };
  const hole = room.kind === 'core' && options.stairBelow === true ? stairOpening(inside) : null;
  // A centimetre over the storey's own finish, so the two never fight.
  slabWithHole(b, m[ROOM_FLOOR[room.kind]] as Material, finish, hole, floor + 0.01, 0.02);

  if (room.kind === 'core') {
    buildCore(
      b,
      m,
      inside,
      floor,
      storeyHeight,
      options.climb ?? storeyHeight,
      options.stairUp ?? true,
    );
    return;
  }

  if (room.door !== null && room.kind !== 'lobby') {
    for (const side of SIDES) {
      if (isOnFacade(room, side, building.size)) continue;
      const { length, place } = roomSideFrame(inside, side, PARTITION_INSET);
      b.push(place[0], floor, place[2], place[3]);
      partition(b, m, length, side === room.door ? 0 : null, options.doors);
      b.pop();
    }
  }

  const frame = roomFrame(inside);
  b.push(frame.x, floor, frame.z, frame.rotation);
  furnishRoom(b, m, room.kind, frame.width, frame.depth);
  b.pop();
}

/**
 * A glazed partition along local X, centred on the origin: floor and head tracks, posts, a
 * frosted manifestation band and, when `door` is set, a timber door at that offset, either
 * recorded in `doors` or built standing open.
 */
function partition(
  b: ShapeBatch,
  m: Materials,
  length: number,
  door: number | null,
  doors?: DoorSpot[],
): void {
  const gap = door === null ? 0 : DOOR_WIDTH + 0.1;
  for (const [from, to] of spans(length, gap, door ?? 0)) {
    const span = to - from;
    const middle = (from + to) / 2;
    b.block(span, PARTITION_HEIGHT, 0.012, m.partitionGlass, middle, 0, 0);
    b.block(span, 0.1, 0.016, m.frostBand, middle, 1.1, 0);
    b.block(span, 0.05, 0.07, m.aluminium, middle, 0, 0);
    b.block(span, 0.07, 0.08, m.aluminium, middle, PARTITION_HEIGHT - 0.07, 0);
  }
  const posts = Math.max(1, Math.round(length / 1.2));
  for (let index = 0; index <= posts; index += 1) {
    const x = -length / 2 + (index * length) / posts;
    if (door !== null && Math.abs(x - door) < gap / 2 + 0.05) continue;
    b.block(0.04, PARTITION_HEIGHT, 0.06, m.aluminium, x, 0, 0);
  }
  if (door !== null) {
    for (const side of [-1, 1]) {
      b.block(0.06, 2.2, 0.09, m.aluminium, door + side * (gap / 2), 0, 0);
    }
    b.block(gap, 0.06, 0.09, m.aluminium, door, 2.2, 0);
    b.block(gap, PARTITION_HEIGHT - 2.26, 0.012, m.partitionGlass, door, 2.26, 0);
    const swing = DOOR_SWING;
    const hinge = door - DOOR_WIDTH / 2;
    if (doors) {
      // Hung separately, shut, to swing open into the room as someone comes through.
      doors.push({
        hinge: b.matrix().multiply(new Matrix4().makeTranslation(hinge, 0.02, 0)),
        width: DOOR_WIDTH,
        height: DOOR_HEIGHT,
        swing,
      });
      return;
    }
    // The door stands open into the room, swung on its hinge.
    b.block(
      DOOR_WIDTH,
      DOOR_HEIGHT,
      0.04,
      m.doorWood,
      hinge + (Math.cos(swing) * DOOR_WIDTH) / 2,
      0.02,
      -(Math.sin(swing) * DOOR_WIDTH) / 2,
      swing,
    );
  }
}

/**
 * Where a core's dog-leg stair is, in the core's own frame (see `roomFrame`): the first
 * flight climbs from the front to the back wall, a landing turns, and the second flight
 * climbs back to the front. Shared by the geometry and the walking network, so people
 * walk on the steps that are drawn.
 */
export function stairLayout(room: RoomModel): {
  readonly width: number;
  readonly firstFlight: number;
  readonly secondFlight: number;
  readonly front: number;
  readonly back: number;
  /** Where the flights start, at the front, and end, at the landing. */
  readonly flightFront: number;
  readonly flightBack: number;
  /** Steps in a flight, and the going of one step. */
  readonly steps: number;
  readonly going: number;
} {
  const { width, depth } = roomFrame(room);
  const stairWidth = Math.min(1.4, width * 0.18);
  const firstFlight = -width * 0.32;
  const steps = 11;
  return {
    width: stairWidth,
    firstFlight,
    secondFlight: firstFlight + stairWidth + 0.15,
    front: depth / 2,
    back: -depth / 2,
    flightFront: depth / 2 - 1.2,
    flightBack: -depth / 2 + 1.2,
    steps,
    going: (depth - 2.4) / steps,
  };
}

/**
 * Where a lobby's reception desk is, in the lobby's frame: to one side, so the way from the
 * entrance to the corridor is clear, its counter facing the door.
 */
function receptionDeskAt(
  width: number,
  depth: number,
): { readonly length: number; readonly x: number; readonly z: number } {
  const length = Math.min(4.2, width * 0.3);
  return { length, x: -width / 2 + length / 2 + 1.4, z: -depth / 2 + 2.4 };
}

/** The receptionist's chair at a lobby's reception desk, in the building's local frame. */
export interface Reception {
  /** The seat centre of the chair. */
  readonly seat: GroundPoint;
  /** How the chair is turned: it faces +Z turned by this, towards the counter. */
  readonly rotation: number;
}

/**
 * Where the receptionist sits in a lobby clear of the facade (see `insideFacade`). Shared
 * by the furniture and the person sat there, so the two meet at the chair that is drawn.
 */
export function receptionLayout(lobby: RoomModel): Reception {
  const frame = roomFrame(lobby);
  const desk = receptionDeskAt(frame.width, frame.depth);
  const [chairX, chairZ] = furniture.RECEPTION_CHAIR;
  return {
    seat: fromRoomFrame(lobby, desk.x + chairX, desk.z + chairZ),
    rotation: frame.rotation,
  };
}

/** Converts a point in a room's frame to the building's local frame. */
export function fromRoomFrame(room: RoomModel, x: number, z: number): GroundPoint {
  const frame = roomFrame(room);
  const cos = Math.cos(frame.rotation);
  const sin = Math.sin(frame.rotation);
  return [frame.x + x * cos + z * sin, frame.z - x * sin + z * cos];
}

/**
 * Thickness of a stair flight under its treads. The flights are stepped slabs rather than
 * solid to the floor, so there is headroom under the flight of the storey above.
 */
const FLIGHT_THICKNESS = 0.35;

/** Stairs, two lifts and solid walls, with the lift doors facing the door side. */
function buildCore(
  b: ShapeBatch,
  m: Materials,
  room: RoomModel,
  floor: number,
  wallHeight: number,
  climb: number,
  stairUp: boolean,
): void {
  // The stair is reached through an opening in the front wall.
  const stairs = stairLayout(room);
  const opening = {
    at: (stairs.firstFlight + stairs.secondFlight) / 2,
    width: stairs.width * 2 + 0.6,
  };
  for (const side of SIDES) {
    const { length, place } = roomSideFrame(room, side, 0.12);
    // The north and south walls run the full width; the east and west ones fit between
    // them, so that no two walls overlap at a corner.
    const run = side === 'north' || side === 'south' ? length + 0.24 : length - 0.24;
    b.push(place[0], floor, place[2], place[3]);
    if (side === (room.door ?? 'south')) {
      for (const [from, to] of spansAround(run, [opening])) {
        b.block(to - from, wallHeight, 0.24, m.coreWall, (from + to) / 2, 0, 0);
      }
      b.block(opening.width, wallHeight - 2.4, 0.24, m.coreWall, opening.at, 2.4, 0);
    } else {
      b.block(run, wallHeight, 0.24, m.coreWall, 0, 0, 0);
    }
    b.pop();
  }

  const frame = roomFrame(room);
  b.push(frame.x, floor, frame.z, frame.rotation);
  const { width, depth } = frame;

  // Two lift shafts behind the front wall: a dark pit with the car waiting at this floor,
  // and steel landing doors on the corridor side. Each shaft is walled off on its left,
  // between its own pit and its neighbour's.
  for (const offset of [width * 0.2, width * 0.38]) {
    const shaftDepth = Math.min(2.2, depth * 0.4);
    const shaftZ = depth / 2 - 0.25 - shaftDepth / 2;
    b.block(1.6, 0.03, shaftDepth, m.dockOpen, offset, 0.01, shaftZ);
    b.block(1.5, 2.4, shaftDepth - 0.3, m.aluminiumLight, offset, 0.04, shaftZ);
    b.block(1.52, 0.05, shaftDepth - 0.28, m.steelColumn, offset, 2.44, shaftZ);
    b.block(0.12, wallHeight, shaftDepth, m.coreWall, offset - 0.9, 0, shaftZ);
    b.block(1.1, 2.2, 0.06, m.steelDoor, offset, 0, depth / 2 + 0.13);
    b.block(1.3, 0.1, 0.08, m.aluminium, offset, 2.2, depth / 2 + 0.13);
  }
  b.block(0.12, 0.35, 0.04, m.plastic, width * 0.29, 1.1, depth / 2 + 0.15);

  // WC door on the far side.
  b.block(0.9, 2.1, 0.05, m.doorWood, -width * 0.05, 0, depth / 2 + 0.13);

  // Dog-leg stair: two flights side by side with a landing at the back wall, climbing to
  // the finished floor above. The layout is shared with the walking network, so people
  // walk on the steps that are drawn. The top floor has none: it would climb into the roof.
  if (!stairUp) {
    b.pop();
    return;
  }
  const stairWidth = stairs.width;
  const { steps, going } = stairs;
  const rise = climb / 2 / steps;
  /** A tread whose top is at `top`, with the flight's thickness under it. */
  const tread = (x: number, z: number, length: number, top: number): void => {
    const bottom = Math.max(0, top - FLIGHT_THICKNESS);
    b.block(stairWidth, top - bottom, length, m.stone, x, bottom, z);
  };
  for (let step = 0; step < steps; step += 1) {
    const z = stairs.flightFront - (step + 0.5) * going;
    tread(stairs.firstFlight, z, going, rise * (step + 1));
    tread(stairs.secondFlight, z, going, climb / 2 + rise * (steps - step));
  }
  // The landing, from the back wall to the top of the first flight, and a screen between
  // the flights that ends where they do, leaving the landing clear to turn on.
  const backWall = stairs.back + 0.24;
  b.block(
    stairWidth * 2 + 0.15,
    FLIGHT_THICKNESS,
    stairs.flightBack - backWall,
    m.stone,
    (stairs.firstFlight + stairs.secondFlight) / 2,
    climb / 2 - FLIGHT_THICKNESS,
    (backWall + stairs.flightBack) / 2,
  );
  b.block(
    0.06,
    wallHeight,
    stairs.flightFront - stairs.flightBack,
    m.aluminiumLight,
    (stairs.firstFlight + stairs.secondFlight) / 2,
    0,
    (stairs.flightFront + stairs.flightBack) / 2,
  );
  b.pop();
}

/** Decor that depends only on the room's kind and size; workstations come from the model. */
function furnishRoom(
  b: ShapeBatch,
  m: Materials,
  kind: RoomModel['kind'],
  width: number,
  depth: number,
): void {
  const corner = (x: number, z: number, size = 1): void => {
    b.push(x, 0, z, 0);
    furniture.plant(b, m, size);
    b.pop();
  };
  const back = -depth / 2 + 0.45;

  switch (kind) {
    case 'lobby': {
      const desk = receptionDeskAt(width, depth);
      b.push(desk.x, 0, desk.z, 0);
      furniture.receptionDesk(b, m, desk.length);
      b.pop();
      b.block(desk.length + 1, 2.6, 0.12, m.oak, desk.x, 0, -depth / 2 + 0.2);
      for (const side of [-1, 1]) {
        b.push(side * (width / 2 - 1.1), 0, depth * 0.08, (side * -Math.PI) / 2);
        furniture.sofa(b, m, side > 0);
        b.pop();
        b.push(side * (width / 2 - 2.3), 0, depth * 0.08, 0);
        furniture.coffeeTable(b, m);
        b.pop();
      }
      corner(-width / 2 + 0.7, -depth / 2 + 0.7, 1.3);
      corner(width / 2 - 0.7, -depth / 2 + 0.7, 1.3);
      corner(-width / 2 + 0.7, depth / 2 - 0.9, 1.1);
      corner(width / 2 - 0.7, depth / 2 - 0.9, 1.1);
      break;
    }
    case 'meeting':
    case 'boardroom': {
      const length = Math.max(2.4, width - (kind === 'boardroom' ? 2.4 : 2));
      const tableWidth = kind === 'boardroom' ? 1.4 : 1.1;
      const chairs = Math.max(2, Math.floor(length / 0.85));
      b.push(0, 0, 0.2, 0);
      furniture.meetingTable(b, m, length, tableWidth, chairs);
      b.pop();
      b.push(0, 0, back - 0.35, 0);
      furniture.wallScreen(b, m, kind === 'boardroom' ? 2 : 1.5);
      b.pop();
      corner(width / 2 - 0.6, -depth / 2 + 0.6, 0.9);
      break;
    }
    case 'break': {
      b.push(0, 0, back, 0);
      furniture.kitchenette(b, m, Math.min(5, width * 0.5));
      b.pop();
      const columns = Math.max(1, Math.floor((width - 2) / 2.6));
      const rows = Math.max(1, Math.floor((depth - 3) / 2.6));
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          b.push(-width / 2 + 1.8 + column * 2.6, 0, back + 2.6 + row * 2.6, 0);
          furniture.cafeTable(b, m);
          b.pop();
        }
      }
      corner(width / 2 - 0.7, depth / 2 - 0.8, 1.2);
      break;
    }
    case 'archive':
    case 'service': {
      const rows = Math.max(1, Math.floor((depth - 1.5) / 1.6));
      for (let row = 0; row < rows; row += 1) {
        b.push(-0.4, 0, back + 0.3 + row * 1.6, 0);
        furniture.archiveShelf(b, m, Math.min(width - 2.5, 4));
        b.pop();
      }
      b.push(width / 2 - 0.7, 0, depth / 2 - 1, -Math.PI / 2);
      furniture.printer(b, m);
      b.pop();
      break;
    }
    case 'office': {
      b.push(-width / 2 + 0.9, 0, back, 0);
      furniture.cabinet(b, m, 1.2, 1.9);
      b.pop();
      // A large office has a small table in one front corner; the plant takes the other.
      const table = width * depth > 28;
      corner((table ? -1 : 1) * (width / 2 - 0.6), depth / 2 - 0.7, 1);
      if (table) {
        b.push(width / 2 - 1.6, 0, depth / 2 - 1.8, 0);
        furniture.cafeTable(b, m, 2);
        b.pop();
      }
      break;
    }
    case 'open-office': {
      corner(-width / 2 + 0.7, -depth / 2 + 0.7, 1.2);
      corner(width / 2 - 0.7, -depth / 2 + 0.7, 1.2);
      for (let x = -width / 2 + 2; x < width / 2 - 2; x += 3) {
        b.push(x, 0, back, 0);
        furniture.cabinet(b, m, 1.4, 1.1);
        b.pop();
      }
      break;
    }
    case 'core':
      break;
  }
}

function roomSideFrame(
  room: RoomModel,
  side: Side,
  inset: number,
): { length: number; place: Placement } {
  const frame = sideFrame(side, room.size[0], room.size[1], inset);
  return {
    length: frame.length - inset * 2,
    place: [room.center[0] + frame.place[0], 0, room.center[1] + frame.place[2], frame.place[3]],
  };
}

/**
 * The room as a local frame whose +Z points at its door, so furniture can be described as
 * "against the back wall" whatever way the room faces.
 */
export function roomFrame(room: RoomModel): {
  x: number;
  z: number;
  rotation: number;
  width: number;
  depth: number;
} {
  const [sx, sz] = room.size;
  const door = room.door ?? 'south';
  const turned = door === 'east' || door === 'west';
  const rotation = SIDE_ROTATION[door];
  return {
    x: room.center[0],
    z: room.center[1],
    rotation,
    width: turned ? sz : sx,
    depth: turned ? sx : sz,
  };
}

function isOnFacade(room: RoomModel, side: Side, [width, depth]: GroundPoint): boolean {
  const [cx, cz] = room.center;
  const [sx, sz] = room.size;
  const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.6;
  switch (side) {
    case 'south':
      return near(cz + sz / 2, depth / 2);
    case 'north':
      return near(cz - sz / 2, -depth / 2);
    case 'east':
      return near(cx + sx / 2, width / 2);
    case 'west':
      return near(cx - sx / 2, -width / 2);
  }
}
