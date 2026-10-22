import type { Material } from 'three';

import * as furniture from '../assets/furniture';
import type { Materials } from '../assets/materials';
import type { GroundPoint, RoomModel, Side } from '../viewer-contract/twin-model';
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
/** How far doors stand open, in radians. */
const DOOR_SWING = (100 * Math.PI) / 180;

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

export function buildRoom(
  b: ShapeBatch,
  m: Materials,
  room: RoomModel,
  building: { readonly size: GroundPoint },
  floor: number,
  storeyHeight: number,
): void {
  const [cx, cz] = room.center;
  const [sx, sz] = room.size;
  b.block(sx - 0.1, 0.02, sz - 0.1, m[ROOM_FLOOR[room.kind]] as Material, cx, floor + 0.01, cz);

  if (room.kind === 'core') {
    buildCore(b, m, room, floor, storeyHeight);
    return;
  }

  if (room.door !== null && room.kind !== 'lobby') {
    for (const side of SIDES) {
      if (isOnFacade(room, side, building.size)) continue;
      const { length, place } = roomSideFrame(room, side, PARTITION_INSET);
      b.push(place[0], floor, place[2], place[3]);
      partition(b, m, length, side === room.door ? 0 : null);
      b.pop();
    }
  }

  const frame = roomFrame(room);
  b.push(frame.x, floor, frame.z, frame.rotation);
  furnishRoom(b, m, room.kind, frame.width, frame.depth);
  b.pop();
}

/**
 * A glazed partition along local X, centred on the origin: floor and head tracks, posts, a
 * frosted manifestation band and, when `door` is set, a timber door at that offset.
 */
function partition(b: ShapeBatch, m: Materials, length: number, door: number | null): void {
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
    // The door stands open into the room, swung on its hinge.
    const swing = DOOR_SWING;
    const hinge = door - DOOR_WIDTH / 2;
    b.block(
      DOOR_WIDTH,
      2.17,
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
} {
  const { width, depth } = roomFrame(room);
  const stairWidth = Math.min(1.4, width * 0.18);
  const firstFlight = -width * 0.32;
  return {
    width: stairWidth,
    firstFlight,
    secondFlight: firstFlight + stairWidth + 0.15,
    front: depth / 2,
    back: -depth / 2,
  };
}

/** Converts a point in a room's frame to the building's local frame. */
export function fromRoomFrame(room: RoomModel, x: number, z: number): GroundPoint {
  const frame = roomFrame(room);
  const cos = Math.cos(frame.rotation);
  const sin = Math.sin(frame.rotation);
  return [frame.x + x * cos + z * sin, frame.z - x * sin + z * cos];
}

/** Stairs, two lifts and solid walls, with the lift doors facing the door side. */
function buildCore(
  b: ShapeBatch,
  m: Materials,
  room: RoomModel,
  floor: number,
  wallHeight: number,
): void {
  // The stair is reached through an opening in the front wall.
  const stairs = stairLayout(room);
  const opening = {
    at: (stairs.firstFlight + stairs.secondFlight) / 2,
    width: stairs.width * 2 + 0.6,
  };
  for (const side of SIDES) {
    const { length, place } = roomSideFrame(room, side, 0.12);
    b.push(place[0], floor, place[2], place[3]);
    if (side === (room.door ?? 'south')) {
      for (const [from, to] of spansAround(length + 0.24, [opening])) {
        b.block(to - from, wallHeight, 0.24, m.coreWall, (from + to) / 2, 0, 0);
      }
      b.block(opening.width, wallHeight - 2.4, 0.24, m.coreWall, opening.at, 2.4, 0);
    } else {
      b.block(length + 0.24, wallHeight, 0.24, m.coreWall, 0, 0, 0);
    }
    b.pop();
  }

  const frame = roomFrame(room);
  b.push(frame.x, floor, frame.z, frame.rotation);
  const { width, depth } = frame;

  // Two lift shafts behind the front wall: a dark pit with the car waiting at this floor,
  // and steel landing doors on the corridor side.
  for (const offset of [width * 0.2, width * 0.38]) {
    const shaftDepth = Math.min(2.2, depth * 0.4);
    const shaftZ = depth / 2 - 0.25 - shaftDepth / 2;
    b.block(1.9, 0.03, shaftDepth, m.dockOpen, offset, 0.01, shaftZ);
    b.block(1.5, 2.4, shaftDepth - 0.3, m.aluminiumLight, offset, 0.02, shaftZ);
    b.block(1.52, 0.05, shaftDepth - 0.28, m.steelColumn, offset, 2.42, shaftZ);
    b.block(0.12, wallHeight, shaftDepth, m.coreWall, offset - 1.0, 0, shaftZ);
    b.block(1.1, 2.2, 0.06, m.steelDoor, offset, 0, depth / 2 + 0.13);
    b.block(1.3, 0.1, 0.08, m.aluminium, offset, 2.2, depth / 2 + 0.13);
  }
  b.block(0.12, 0.35, 0.04, m.plastic, width * 0.29, 1.1, depth / 2 + 0.15);

  // Dog-leg stair: two flights side by side with a landing at the back wall. The layout is
  // shared with the walking network, so people walk on the steps that are drawn.
  const stairWidth = stairs.width;
  const run = depth - 2.4;
  const steps = 11;
  const rise = wallHeight / 2 / steps;
  for (let step = 0; step < steps; step += 1) {
    const z = depth / 2 - 1.2 - (step + 0.5) * (run / steps);
    b.block(stairWidth, rise * (step + 1), run / steps, m.stone, stairs.firstFlight, 0, z);
    b.block(
      stairWidth,
      wallHeight / 2 + rise * (steps - step),
      run / steps,
      m.stone,
      stairs.secondFlight,
      0,
      z,
    );
  }
  b.block(
    stairWidth * 2 + 0.15,
    wallHeight / 2,
    1.1,
    m.stone,
    (stairs.firstFlight + stairs.secondFlight) / 2,
    0,
    -depth / 2 + 0.7,
  );
  b.block(
    0.06,
    wallHeight,
    run + 1,
    m.aluminiumLight,
    (stairs.firstFlight + stairs.secondFlight) / 2,
    0,
    -0.1,
  );
  // WC door on the far side.
  b.block(0.9, 2.1, 0.05, m.doorWood, -width * 0.05, 0, depth / 2 + 0.13);
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
      // Reception sits to one side, so the way from the entrance to the corridor is clear.
      const desk = Math.min(4.2, width * 0.3);
      const deskX = -width / 2 + desk / 2 + 1.4;
      b.push(deskX, 0, -depth / 2 + 2.4, 0);
      furniture.receptionDesk(b, m, desk);
      b.pop();
      b.block(desk + 1, 2.6, 0.12, m.oak, deskX, 0, -depth / 2 + 0.2);
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
      corner(width / 2 - 0.6, depth / 2 - 0.7, 1);
      if (width * depth > 28) {
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
