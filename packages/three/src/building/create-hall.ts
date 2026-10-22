import { Box3, Group, Vector3, type Material, type Object3D } from 'three';

import * as furniture from '../assets/furniture';
import type { Materials } from '../assets/materials';
import { seededRandom } from '../assets/seeded-random';
import { TRUCK_LENGTH, type VehicleKit } from '../assets/create-vehicle-kit';
import { createLabel } from '../overlays/create-label';
import type { HallModel, HallZoneModel, RackRowModel } from '../viewer-contract/twin-model';
import { buildRoom } from './create-room';
import { createSlidingDoor } from './create-sliding-door';
import { pointOnSide, SIDES, sideFrame, spansAround } from './frames';
import { ShapeBatch } from './shape-batch';

export interface BuiltHall {
  readonly root: Group;
  /** The hall floor; workstations inside the hall are added here. */
  readonly floor: Group;
  readonly roof: Group;
  /** Height of the hall floor above the yard: the dock height. */
  readonly floorLevel: number;
  /** Selectable objects by entity key, such as the docked trucks. */
  readonly registry: ReadonlyMap<string, Object3D>;
  /** A point above each docked truck, by truck entity id. */
  readonly anchors: ReadonlyMap<string, Vector3>;
  bounds(): Box3;
  update(elapsed: number, deltaSeconds: number, cameraPosition: Vector3): void;
}

/** The hall floor is raised to trailer-deck height so pallets roll straight onto trucks. */
const DOCK_HEIGHT = 1.2;
const DOOR = { width: 3.2, height: 3.6 } as const;
const BAY_WIDTH = 2.7;
const RACK_DEPTH = 1.1;
const LEVEL_HEIGHT = 1.55;
const WALL = 0.25;
const PERSONNEL_DOOR = 1.8;

/**
 * Builds a portal-frame manufacturing and warehouse hall: a raised floor at dock height,
 * clad walls with a strip of high windows, loading docks with shelters and a canopy, the
 * racking, production cell, picking and packing areas of the model, the offices built
 * inside it, and a roof with skylights that can be lifted off.
 */
export function createHall(model: HallModel, m: Materials, vehicles: VehicleKit): BuiltHall {
  const root = new Group();
  root.name = `hall:${model.entity.id}`;
  root.position.set(model.center[0], 0, model.center[1]);
  const [width, depth] = model.size;
  const top = DOCK_HEIGHT + model.height;

  const floor = new Group();
  floor.name = 'hall-floor';
  const roof = new Group();
  roof.name = 'hall-roof';
  root.add(floor, roof);

  const registry = new Map<string, Object3D>();
  const anchors = new Map<string, Vector3>();

  const shell = new ShapeBatch();
  buildShell(shell, m, model, top);
  floor.add(shell.build('hall-shell'));

  const interior = new ShapeBatch();
  for (const zone of model.zones) buildZone(interior, m, zone);
  for (const row of model.rackRows) buildRackRow(interior, m, row);
  for (const room of model.rooms) buildRoom(interior, m, room, model, DOCK_HEIGHT, 3.2);
  buildDocksInside(interior, m, model);
  floor.add(interior.build('hall-interior'));

  for (const zone of model.zones) {
    const label = createLabel({ variant: 'zone', title: zone.title });
    label.position.set(zone.center[0], DOCK_HEIGHT, zone.center[1]);
    floor.add(label);
  }
  for (const room of model.rooms) {
    const label = createLabel({ variant: 'room', title: room.title });
    label.position.set(room.center[0], DOCK_HEIGHT + 0.2, room.center[1]);
    label.userData.reveal = 'near';
    floor.add(label);
  }

  // Forklifts: one parked by the docks, one working an aisle.
  const parked = vehicles.forklift();
  const parkedAt = pointOnSide(model.dockSide, width, depth, -width / 2 + 6, -7);
  parked.position.set(parkedAt[0], DOCK_HEIGHT, parkedAt[1]);
  parked.rotation.y = 0.6;
  floor.add(parked);

  const working = vehicles.forklift();
  floor.add(working);
  const aisle = aisleFor(model);

  // Trucks backed onto the docks, with a sign over each door.
  const rotation = sideFrame(model.dockSide, width, depth, 0).place[3];
  model.docks.forEach((dock, index) => {
    const sign = createLabel({
      variant: 'dock',
      title: dock.title,
      lines: dock.lines,
      tone: dock.tone,
    });
    const signAt = pointOnSide(model.dockSide, width, depth, dock.offset, 1.2);
    // Alternate sign heights so neighbouring docks do not cover each other.
    sign.position.set(signAt[0], DOCK_HEIGHT + DOOR.height + 1.2 + (index % 2) * 2.4, signAt[1]);
    floor.add(sign);

    if (!dock.truck) return;
    const truck = vehicles.truck(dock.truck.cabColor);
    const at = pointOnSide(model.dockSide, width, depth, dock.offset, TRUCK_LENGTH / 2 + 0.75);
    truck.position.set(at[0], 0, at[1]);
    truck.rotation.y = rotation;
    truck.userData.selectable = dock.truck.entity;
    root.add(truck);

    const key = `${dock.truck.entity.kind}:${dock.truck.entity.id}`;
    registry.set(key, truck);
    anchors.set(
      dock.truck.entity.id,
      new Vector3(model.center[0] + at[0], 4.6, model.center[1] + at[1]),
    );
  });

  // Personnel doors slide open as the camera comes through them.
  const sliding = (model.doors ?? []).map((door) => {
    const built = createSlidingDoor({
      width: PERSONNEL_DOOR - 0.12,
      height: 2.4,
      leaf: m.steelDoor,
      frame: m.steelColumn,
    });
    const [x, , z, rotation] = sideFrame(door.side, width, depth, WALL / 2).place;
    const along = new Vector3(Math.cos(rotation), 0, -Math.sin(rotation));
    built.root.position.set(x + along.x * door.offset, DOCK_HEIGHT, z + along.z * door.offset);
    built.root.rotation.y = rotation;
    floor.add(built.root);
    return built;
  });

  const roofBatch = new ShapeBatch();
  buildRoof(roofBatch, m, width, depth, top);
  roof.add(roofBatch.build('hall-roof'));

  return {
    root,
    floor,
    roof,
    floorLevel: DOCK_HEIGHT,
    registry,
    anchors,
    bounds() {
      return new Box3(
        new Vector3(model.center[0] - width / 2, 0, model.center[1] - depth / 2),
        new Vector3(model.center[0] + width / 2, DOCK_HEIGHT + 4, model.center[1] + depth / 2),
      );
    },
    update(elapsed, deltaSeconds, cameraPosition) {
      for (const door of sliding) door.update(deltaSeconds, cameraPosition);
      if (!aisle) return;
      // Out along the aisle, pause, and back, on a 26-second cycle.
      const cycle = (elapsed % 26) / 26;
      const travel = cycle < 0.45 ? cycle / 0.45 : cycle < 0.55 ? 1 : 1 - (cycle - 0.55) / 0.45;
      const eased = travel * travel * (3 - 2 * travel);
      working.position.set(aisle.from + (aisle.to - aisle.from) * eased, DOCK_HEIGHT, aisle.z);
      working.rotation.y = cycle < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    },
  };
}

function buildShell(b: ShapeBatch, m: Materials, model: HallModel, top: number): void {
  const [width, depth] = model.size;
  b.block(width, DOCK_HEIGHT, depth, m.plinth, 0, 0, 0);
  b.block(width - 0.5, 0.02, depth - 0.5, m.epoxy, 0, DOCK_HEIGHT, 0);

  for (const side of SIDES) {
    const { length, place } = sideFrame(side, width, depth, WALL / 2);
    const docks = side === model.dockSide ? model.docks : [];
    const doors = (model.doors ?? []).filter((door) => door.side === side);
    const openings = [
      ...docks.map((dock) => ({ at: dock.offset, width: DOOR.width })),
      ...doors.map((door) => ({ at: door.offset, width: PERSONNEL_DOOR })),
    ];
    b.push(...place);

    // Dock wall in concrete, cladding above it with openings for the doors.
    b.block(length + WALL, DOCK_HEIGHT, WALL + 0.1, m.plinth, 0, 0, 0.05);
    for (const [from, to] of spansAround(length, openings)) {
      b.block(to - from, DOOR.height, WALL, m.cladding, (from + to) / 2, DOCK_HEIGHT, 0);
    }
    const above = DOCK_HEIGHT + DOOR.height;
    b.block(length + WALL, top - above, WALL, m.cladding, 0, above, 0);
    b.block(length + WALL, 0.6, WALL + 0.12, m.claddingDark, 0, top - 0.6, 0);

    // A strip of high-level windows on the walls without docks.
    if (docks.length === 0) {
      for (let x = -length / 2 + 3; x < length / 2 - 3; x += 6) {
        b.block(5, 1.1, 0.06, m.facadeGlass, x + 2.5, top - 2.6, WALL / 2 + 0.02);
        b.block(5.1, 0.08, 0.12, m.aluminium, x + 2.5, top - 2.62, WALL / 2 + 0.03);
        b.block(5.1, 0.08, 0.12, m.aluminium, x + 2.5, top - 1.52, WALL / 2 + 0.03);
      }
      // Pilaster columns of the portal frame on the outside face.
      for (let x = -length / 2; x <= length / 2 + 0.01; x += 8) {
        b.block(0.35, top - DOCK_HEIGHT, 0.3, m.claddingDark, x, DOCK_HEIGHT, WALL / 2 + 0.12);
      }
    }

    for (const door of doors) {
      // Door frame and a transom closing the opening above head height.
      b.block(
        PERSONNEL_DOOR,
        DOOR.height - 2.4,
        WALL,
        m.cladding,
        door.offset,
        DOCK_HEIGHT + 2.4,
        0,
      );
      for (const edge of [-1, 1]) {
        b.block(
          0.1,
          2.4,
          WALL + 0.06,
          m.steelColumn,
          door.offset + (edge * PERSONNEL_DOOR) / 2,
          DOCK_HEIGHT,
          0,
        );
      }
      b.block(PERSONNEL_DOOR, 0.1, WALL + 0.06, m.steelColumn, door.offset, DOCK_HEIGHT + 2.4, 0);
    }
    for (const dock of docks) {
      const x = dock.offset;
      const open = dock.truck !== null;
      if (open) {
        b.block(DOOR.width, 0.5, 0.3, m.dockDoor, x, DOCK_HEIGHT + DOOR.height - 0.5, -0.2);
      } else {
        b.block(DOOR.width, DOOR.height, 0.08, m.dockDoor, x, DOCK_HEIGHT, 0);
      }
      // Shelter, bumpers, dock light and leveller lip.
      for (const side of [-1, 1]) {
        b.block(
          0.45,
          DOOR.height + 0.5,
          0.7,
          m.dockShelter,
          x + side * (DOOR.width / 2 + 0.22),
          DOCK_HEIGHT,
          0.45,
        );
        b.block(0.25, 0.45, 0.25, m.bumper, x + side * 1.1, DOCK_HEIGHT - 0.35, WALL / 2 + 0.12);
      }
      b.block(DOOR.width + 0.9, 0.7, 0.7, m.dockShelter, x, DOCK_HEIGHT + DOOR.height, 0.45);
      b.block(0.2, 0.15, 0.3, m.safetyYellow, x + 2.3, DOCK_HEIGHT + 2.8, WALL / 2 + 0.15);
      b.block(DOOR.width - 0.2, 0.06, 0.4, m.steelColumn, x, DOCK_HEIGHT - 0.06, WALL / 2 + 0.2);
    }
    if (docks.length > 0) {
      // Canopy over the dock run.
      const first = Math.min(...docks.map((dock) => dock.offset)) - 4;
      const last = Math.max(...docks.map((dock) => dock.offset)) + 4;
      b.block(
        last - first,
        0.25,
        3.2,
        m.claddingDark,
        (first + last) / 2,
        DOCK_HEIGHT + DOOR.height + 2.3,
        1.7,
      );
      b.block(
        last - first,
        0.35,
        0.08,
        m.aluminiumLight,
        (first + last) / 2,
        DOCK_HEIGHT + DOOR.height + 2.2,
        3.3,
      );
    }
    b.pop();
  }

  // Personnel entrance with steps on the far end from the docks.
  const doorAt = pointOnSide('west', width, depth, -depth / 2 + 6, 0.5);
  b.block(2.4, 0.4, 2, m.stone, doorAt[0] - 0.6, 0, doorAt[1]);
  b.block(2.4, 0.8, 1.4, m.stone, doorAt[0] - 0.3, 0, doorAt[1]);
  b.block(2.4, DOCK_HEIGHT, 0.9, m.stone, doorAt[0], 0, doorAt[1]);
  b.block(0.08, 2.3, 1.2, m.steelDoor, -width / 2 - 0.02, DOCK_HEIGHT, doorAt[1]);
  b.block(2.6, 0.15, 2.4, m.claddingDark, doorAt[0] - 0.4, DOCK_HEIGHT + 2.9, doorAt[1]);
}

function buildRoof(b: ShapeBatch, m: Materials, width: number, depth: number, top: number): void {
  b.block(width + 0.3, 0.3, depth + 0.3, m.roofSheet, 0, top, 0);
  // Portal-frame rafters, visible inside under the roof sheet.
  for (let x = -width / 2 + 8; x < width / 2 - 1; x += 8) {
    b.block(0.35, 0.9, depth - 0.6, m.steelColumn, x, top - 0.9, 0);
    for (let z = -depth / 2 + 5; z < depth / 2 - 3; z += 7) {
      b.cylinder(0.02, 0.02, 1.2, m.steelBlack, x, top - 1.5, z, 6);
      b.cylinder(0.25, 0.5, 0.35, m.steelColumn, x, top - 2.25, z, 16);
      b.cylinder(0.45, 0.45, 0.02, m.ceilingLight, x, top - 2.43, z, 16);
    }
  }
  for (let x = -width / 2 + 6; x < width / 2 - 6; x += 12) {
    b.block(2.2, 0.35, depth - 8, m.skylight, x + 2, top + 0.3, 0);
  }
  for (let index = 0; index < 4; index += 1) {
    b.cylinder(
      0.35,
      0.35,
      0.9,
      m.aluminiumLight,
      -width / 2 + 10 + index * 14,
      top + 0.75,
      -depth / 2 + 4,
    );
  }
}

// ---------------------------------------------------------------------------------------
// Interior

/** Floor markings and equipment for one zone, by kind. */
function buildZone(b: ShapeBatch, m: Materials, zone: HallZoneModel): void {
  const [cx, cz] = zone.center;
  const [sx, sz] = zone.size;
  const y = DOCK_HEIGHT + 0.022;
  outline(b, zone.kind === 'picking' ? m.floorWhite : m.floorYellow, cx, cz, sx, sz, y);
  const random = seededRandom(Math.round(cx * 13 + cz * 7));

  switch (zone.kind) {
    case 'production': {
      // Machining centres along the back, an assembly conveyor and benches in front.
      const machines = Math.max(1, Math.floor((sx - 2) / 5.5));
      for (let index = 0; index < machines; index += 1) {
        b.push(cx - sx / 2 + 3.5 + index * 5.5, DOCK_HEIGHT, cz - sz / 2 + 2.6, 0);
        machiningCentre(b, m);
        b.pop();
      }
      b.push(cx, DOCK_HEIGHT, cz + 1.5, 0);
      conveyor(b, m, sx - 4);
      b.pop();
      for (let index = 0; index < Math.floor((sx - 4) / 4); index += 1) {
        b.push(cx - sx / 2 + 4 + index * 4, DOCK_HEIGHT, cz + sz / 2 - 2.5, 0);
        workbench(b, m);
        b.pop();
      }
      break;
    }
    case 'picking': {
      // Carton-flow shelving rows with a walkway between.
      for (let row = 0; row < Math.floor((sz - 3) / 3.2); row += 1) {
        b.push(cx - 2, DOCK_HEIGHT, cz - sz / 2 + 1.5 + row * 3.2, 0);
        for (let x = -sx / 2 + 3; x < sx / 2 - 5; x += 3.2) {
          b.push(x, 0, 0, 0);
          furniture.archiveShelf(b, m, 3);
          b.pop();
        }
        b.pop();
      }
      break;
    }
    case 'packing': {
      for (let index = 0; index < Math.floor(sx / 5); index += 1) {
        b.push(cx - sx / 2 + 2.5 + index * 5, DOCK_HEIGHT, cz - sz / 2 + 2, 0);
        packingTable(b, m);
        b.pop();
      }
      b.push(cx + sx / 2 - 2.5, DOCK_HEIGHT, cz + sz / 2 - 2.5, 0);
      stretchWrapper(b, m);
      b.pop();
      break;
    }
    case 'staging':
    case 'storage':
      for (let index = 0; index < 4; index += 1) {
        b.push(cx - sx / 2 + 1.5 + random() * (sx - 3), DOCK_HEIGHT, cz + sz / 2 - 1.5, 0);
        pallet(b, m, random, 1);
        b.pop();
      }
      break;
  }
}

/** Painted lane lines and staged pallets inside each dock door. */
function buildDocksInside(b: ShapeBatch, m: Materials, model: HallModel): void {
  const [width, depth] = model.size;
  const random = seededRandom(91);
  const { place } = sideFrame(model.dockSide, width, depth, 0);
  b.push(...place);
  for (const dock of model.docks) {
    const y = DOCK_HEIGHT + 0.022;
    for (const side of [-1, 1]) {
      b.box(0.1, 0.01, 9, m.floorYellow, dock.offset + side * 1.9, y, -5);
    }
    b.box(3.9, 0.01, 0.1, m.floorYellow, dock.offset, y, -9.5);
    for (let index = 0; index < dock.staged; index += 1) {
      b.push(
        dock.offset + (index % 2 === 0 ? -0.7 : 0.7),
        DOCK_HEIGHT,
        -2.2 - Math.floor(index / 2) * 1.4,
        0,
      );
      pallet(b, m, random, 1);
      b.pop();
    }
    // Guide lines on the yard for reversing in.
    for (const side of [-1, 1])
      b.box(0.15, 0.01, 18, m.roadLine, dock.offset + side * 1.9, 0.045, 10);
  }
  b.pop();
}

/** A run of selective pallet racking along X: upright frames, beams and pallet loads. */
function buildRackRow(b: ShapeBatch, m: Materials, row: RackRowModel): void {
  const random = seededRandom(Math.round(row.center[0] * 31 + row.center[1] * 17 + row.bays));
  const length = row.bays * BAY_WIDTH;
  const height = row.levels * LEVEL_HEIGHT + 1.2;
  b.push(row.center[0], DOCK_HEIGHT, row.center[1], 0);

  for (let frame = 0; frame <= row.bays; frame += 1) {
    const x = -length / 2 + frame * BAY_WIDTH;
    for (const z of [-RACK_DEPTH / 2, RACK_DEPTH / 2])
      b.block(0.09, height, 0.09, m.rackUpright, x, 0, z);
    for (let brace = 0; brace < Math.floor(height / 1.4); brace += 1) {
      b.block(0.04, 0.04, RACK_DEPTH, m.rackUpright, x, 0.4 + brace * 1.4, 0);
    }
  }
  for (const end of [-length / 2 - 0.25, length / 2 + 0.25]) {
    b.block(0.12, 0.4, RACK_DEPTH + 0.2, m.safetyYellow, end, 0, 0);
  }

  for (let level = 0; level < row.levels; level += 1) {
    const y = 0.15 + level * LEVEL_HEIGHT;
    if (level > 0) {
      for (const z of [-RACK_DEPTH / 2, RACK_DEPTH / 2]) {
        b.block(length, 0.12, 0.06, m.rackBeam, 0, y - 0.12, z);
      }
    }
    for (let bay = 0; bay < row.bays; bay += 1) {
      for (const slot of [-0.66, 0.66]) {
        if (random() > row.fill) continue;
        b.push(-length / 2 + (bay + 0.5) * BAY_WIDTH + slot, y, 0, Math.PI / 2);
        pallet(b, m, random, Math.min(1.25, LEVEL_HEIGHT - 0.35));
        b.pop();
      }
    }
  }
  b.pop();
}

/** A pallet with a load of cartons, sometimes shrink-wrapped. */
function pallet(b: ShapeBatch, m: Materials, random: () => number, maxHeight: number): void {
  b.block(1.0, 0.14, 1.2, m.pallet, 0, 0, 0);
  const load = 0.5 + random() * (maxHeight - 0.5);
  const kind = random();
  if (kind < 0.55) {
    // Stacked cartons.
    const layers = Math.max(1, Math.round(load / 0.38));
    for (let layer = 0; layer < layers; layer += 1) {
      for (const [x, z] of [
        [-0.25, -0.3],
        [0.25, -0.3],
        [-0.25, 0.3],
        [0.25, 0.3],
      ] as const) {
        b.block(
          0.48,
          0.36,
          0.58,
          (layer + (x > 0 ? 1 : 0)) % 3 === 0 ? m.cartonDark : m.carton,
          x,
          0.14 + layer * 0.38,
          z,
        );
      }
    }
  } else if (kind < 0.85) {
    b.block(0.98, load, 1.16, m.carton, 0, 0.14, 0);
    b.block(1.0, load * 0.96, 1.18, m.shrinkWrap, 0, 0.15, 0);
  } else {
    // Drums of raw material.
    for (const [x, z] of [
      [-0.25, -0.3],
      [0.25, -0.3],
      [-0.25, 0.3],
      [0.25, 0.3],
    ] as const) {
      b.cylinder(0.24, 0.24, 0.85, m.machineAccent, x, 0.14 + 0.425, z, 16);
    }
  }
}

function outline(
  b: ShapeBatch,
  material: Material,
  cx: number,
  cz: number,
  sx: number,
  sz: number,
  y: number,
): void {
  const line = 0.12;
  b.box(sx, 0.01, line, material, cx, y, cz - sz / 2);
  b.box(sx, 0.01, line, material, cx, y, cz + sz / 2);
  b.box(line, 0.01, sz, material, cx - sx / 2, y, cz);
  b.box(line, 0.01, sz, material, cx + sx / 2, y, cz);
}

/** The aisle the working forklift drives: in front of the first rack row. */
function aisleFor(model: HallModel): { from: number; to: number; z: number } | null {
  const row = model.rackRows[0];
  if (!row) return null;
  const length = row.bays * BAY_WIDTH;
  return {
    from: row.center[0] - length / 2 + 2,
    to: row.center[0] + length / 2 - 2,
    z: row.center[1] + RACK_DEPTH / 2 + 1.7,
  };
}

// ---------------------------------------------------------------------------------------
// Equipment

function machiningCentre(b: ShapeBatch, m: Materials): void {
  b.block(3.6, 0.35, 2.4, m.machineDark, 0, 0, 0);
  b.block(3.4, 2.3, 2.2, m.machine, 0, 0.35, 0);
  b.block(3.42, 0.3, 2.22, m.machineAccent, 0, 2.3, 0);
  b.box(1.6, 1.1, 0.03, m.machineWindow, -0.3, 1.45, 1.11);
  b.box(1.7, 0.06, 0.05, m.machineDark, -0.3, 0.88, 1.12);
  // Control pendant and a stack light.
  b.block(0.6, 0.8, 0.15, m.machineDark, 1.25, 1.1, 1.2);
  b.box(0.5, 0.35, 0.01, m.screenOn, 1.25, 1.65, 1.28);
  b.cylinder(0.06, 0.06, 0.5, m.steelBlack, 1.5, 2.9, -0.6);
  b.cylinder(0.08, 0.08, 0.12, m.screenOn, 1.5, 3.2, -0.6);
  b.block(0.7, 0.9, 1.6, m.machineDark, -2.1, 0, 0.1);
}

function conveyor(b: ShapeBatch, m: Materials, length: number): void {
  for (const z of [-0.4, 0.4]) b.block(length, 0.12, 0.08, m.steelColumn, 0, 0.85, z);
  for (let x = -length / 2; x <= length / 2; x += 2) {
    for (const z of [-0.38, 0.38]) b.block(0.06, 0.85, 0.06, m.steelColumn, x, 0, z);
  }
  for (let x = -length / 2 + 0.1; x < length / 2; x += 0.25) {
    b.roller(0.04, 0.78, m.roller, x, 0.9, 0, true, 8);
  }
  for (let index = 0; index < Math.floor(length / 3); index += 1) {
    b.block(0.5, 0.35, 0.55, m.carton, -length / 2 + 1 + index * 3, 0.95, 0);
  }
}

function workbench(b: ShapeBatch, m: Materials): void {
  b.block(2, 0.05, 0.8, m.oak, 0, 0.85, 0);
  for (const x of [-0.9, 0.9]) b.block(0.06, 0.85, 0.7, m.steelColumn, x, 0, 0);
  b.block(2, 1.0, 0.04, m.steelColumn, 0, 0.9, -0.38);
  b.block(0.5, 0.3, 0.4, m.machineAccent, 0.5, 0.9, 0);
  b.block(0.4, 0.08, 0.3, m.steelBlack, -0.5, 0.9, 0.1);
}

function packingTable(b: ShapeBatch, m: Materials): void {
  b.block(2.4, 0.05, 1.0, m.oak, 0, 0.88, 0);
  for (const x of [-1.1, 1.1]) b.block(0.06, 0.88, 0.9, m.steelColumn, x, 0, 0);
  b.block(2.4, 0.9, 0.05, m.steelColumn, 0, 0.93, -0.48);
  b.roller(0.12, 0.6, m.paper, -0.6, 1.4, -0.35);
  b.block(0.6, 0.4, 0.5, m.carton, 0.5, 0.93, 0.1);
  b.block(0.8, 0.03, 0.6, m.cartonDark, -0.3, 0.93, 0.15);
  b.block(1.0, 0.6, 1.2, m.pallet, 0, 0, 1.5);
}

function stretchWrapper(b: ShapeBatch, m: Materials): void {
  b.cylinder(0.95, 0.95, 0.1, m.steelColumn, 0, 0.05, 0, 28);
  b.block(0.3, 2.6, 0.3, m.machine, 1.35, 0, 0);
  b.block(0.5, 0.4, 0.5, m.machineAccent, 1.2, 1.2, 0);
  b.block(1.0, 1.2, 1.2, m.shrinkWrap, 0, 0.24, 0);
}
