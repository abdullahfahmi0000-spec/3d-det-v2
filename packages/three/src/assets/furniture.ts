import type { ShapeBatch } from '../building/shape-batch';
import type { Materials } from './materials';

/**
 * Procedural office furniture, emitted into a `ShapeBatch`. Every piece is described in its
 * own frame: origin on the floor at the piece's centre, the user side towards −Z and the
 * "front" (screen, seat back) towards +Z unless stated otherwise.
 */

export interface DeskOptions {
  readonly width?: number;
  readonly monitors?: 1 | 2;
  readonly screensOn?: boolean;
  readonly white?: boolean;
}

/** Desk height and the distance from a seated person's hips to the desk centre. */
export const DESK_TOP = 0.74;
export const DESK_REACH = 0.62;

/**
 * A desk with monitors, keyboard and paperwork. The origin is where the user's chair
 * stands; the desk is in front of it, along +Z.
 */
export function desk(b: ShapeBatch, m: Materials, options: DeskOptions = {}): void {
  const width = options.width ?? 1.6;
  const depth = 0.8;
  const top = options.white ? m.deskWhite : m.oak;
  const z = DESK_REACH;

  b.block(width, 0.03, depth, top, 0, DESK_TOP - 0.03, z);
  // T-frame legs and a modesty panel facing away from the user.
  for (const side of [-1, 1]) {
    b.block(0.06, DESK_TOP - 0.03, 0.06, m.steelBlack, side * (width / 2 - 0.08), 0, z);
    b.block(0.07, 0.03, depth - 0.1, m.steelBlack, side * (width / 2 - 0.08), 0, z);
  }
  b.block(width - 0.2, 0.06, 0.05, m.steelBlack, 0, DESK_TOP - 0.1, z);
  b.block(width - 0.3, 0.36, 0.02, m.steelBlack, 0, 0.32, z + depth / 2 - 0.06);

  const screen = options.screensOn === false ? m.screenOff : m.screenOn;
  const screens = options.monitors === 2 ? [-0.34, 0.34] : [0];
  for (const x of screens) {
    b.block(0.2, 0.012, 0.16, m.steelBlack, x, DESK_TOP, z + 0.22);
    b.block(0.035, 0.28, 0.03, m.steelBlack, x, DESK_TOP, z + 0.26);
    b.box(0.6, 0.36, 0.025, m.plastic, x, DESK_TOP + 0.36, z + 0.25, x === 0 ? 0 : -x * 0.5);
    b.box(0.57, 0.33, 0.005, screen, x, DESK_TOP + 0.36, z + 0.236, x === 0 ? 0 : -x * 0.5);
  }
  b.block(0.44, 0.018, 0.14, m.plastic, 0, DESK_TOP, z - 0.12);
  b.block(0.06, 0.02, 0.1, m.plastic, 0.32, DESK_TOP, z - 0.12);
  b.block(0.22, 0.012, 0.3, m.paper, -0.52, DESK_TOP, z - 0.05, 0.25);
  b.cylinder(0.04, 0.035, 0.1, m.ceramicPot, 0.6, DESK_TOP + 0.05, z + 0.1);
  // Pedestal drawer unit under the desk.
  b.block(0.42, 0.56, 0.55, m.cabinet, width / 2 - 0.32, 0, z + 0.05);
}

/** A task chair; the seat back is towards −Z, behind the person facing +Z. */
export function officeChair(b: ShapeBatch, m: Materials, executive = false): void {
  const fabric = executive ? m.leather : m.chairFabric;
  // Five-star base, gas lift and seat.
  for (let arm = 0; arm < 5; arm += 1) {
    const angle = (arm / 5) * Math.PI * 2;
    b.box(
      0.3,
      0.04,
      0.05,
      m.steelBlack,
      Math.cos(angle) * 0.15,
      0.08,
      Math.sin(angle) * 0.15,
      -angle,
    );
    b.sphere(0.03, m.plastic, Math.cos(angle) * 0.29, 0.03, Math.sin(angle) * 0.29);
  }
  b.cylinder(0.025, 0.03, 0.34, m.steelBlack, 0, 0.27, 0);
  b.block(0.5, 0.08, 0.48, fabric, 0, 0.42, 0.02);
  // Back rest, taller for executive chairs.
  const backHeight = executive ? 0.78 : 0.56;
  b.block(0.46, backHeight, 0.07, executive ? fabric : m.chairMesh, 0, 0.55, -0.24);
  b.block(0.06, 0.2, 0.06, m.steelBlack, 0, 0.45, -0.22);
  for (const side of [-1, 1]) {
    b.block(0.05, 0.2, 0.05, m.steelBlack, side * 0.25, 0.5, 0.0);
    b.block(0.06, 0.03, 0.26, m.plastic, side * 0.25, 0.7, 0.02);
  }
}

/** A larger desk with a return and a credenza behind the user. */
export function executiveDesk(b: ShapeBatch, m: Materials): void {
  const z = DESK_REACH + 0.06;
  b.block(1.9, 0.04, 0.9, m.oak, 0, DESK_TOP - 0.04, z);
  b.block(1.9, DESK_TOP - 0.04, 0.04, m.oak, 0, 0, z + 0.43);
  for (const side of [-1, 1]) b.block(0.04, DESK_TOP - 0.04, 0.88, m.oak, side * 0.93, 0, z);
  b.block(0.6, 0.04, 1.0, m.oak, 1.25, DESK_TOP - 0.04, z - 0.25);
  b.block(0.58, DESK_TOP - 0.04, 0.96, m.cabinet, 1.25, 0, z - 0.25);

  b.block(0.2, 0.012, 0.16, m.steelBlack, 0, DESK_TOP, z + 0.2);
  b.block(0.035, 0.3, 0.03, m.steelBlack, 0, DESK_TOP, z + 0.24);
  b.box(0.68, 0.4, 0.025, m.plastic, 0, DESK_TOP + 0.4, z + 0.23);
  b.box(0.65, 0.37, 0.005, m.screenOn, 0, DESK_TOP + 0.4, z + 0.216);
  b.block(0.42, 0.018, 0.14, m.plastic, 0, DESK_TOP, z - 0.14);
  b.block(0.24, 0.02, 0.32, m.leather, -0.55, DESK_TOP, z - 0.05);
  b.block(0.3, 0.012, 0.22, m.paper, 0.45, DESK_TOP, z - 0.1, -0.2);

  // Credenza against the wall behind the chair.
  b.block(1.8, 0.7, 0.45, m.oak, 0, 0, -1.05);
  b.block(1.8, 0.02, 0.47, m.countertop, 0, 0.7, -1.05);
  b.cylinder(0.12, 0.09, 0.28, m.ceramicPot, 0.6, 0.86, -1.05);
  b.sphere(0.2, m.foliage, 0.6, 1.12, -1.05, 1.2);
  for (const x of [-0.6, -0.45, -0.32]) b.block(0.08, 0.28, 0.22, m.paper, x, 0.72, -1.05);
}

/** A standing workstation with a scanner, as used at a warehouse picking post. */
export function standingStation(b: ShapeBatch, m: Materials, screenOn: boolean): void {
  b.block(1.2, 0.04, 0.7, m.deskWhite, 0, 1.02, 0.55);
  for (const x of [-0.5, 0.5]) b.block(0.06, 1.02, 0.06, m.steelBlack, x, 0, 0.55);
  b.block(1.1, 0.04, 0.6, m.steelBlack, 0, 0.25, 0.55);
  b.block(0.04, 0.32, 0.03, m.steelBlack, 0.1, 1.06, 0.78);
  b.box(0.48, 0.3, 0.025, m.plastic, 0.1, 1.5, 0.78);
  b.box(0.45, 0.27, 0.005, screenOn ? m.screenOn : m.screenOff, 0.1, 1.5, 0.766);
  b.block(0.08, 0.04, 0.18, m.safetyYellow, -0.35, 1.06, 0.45, 0.3);
  b.block(0.36, 0.25, 0.3, m.carton, -0.3, 0.29, 0.5);
}

/** A meeting table with chairs on both long sides, centred on the origin, long along X. */
export function meetingTable(
  b: ShapeBatch,
  m: Materials,
  length: number,
  width: number,
  chairsPerSide: number,
): void {
  b.block(length, 0.05, width, m.oak, 0, DESK_TOP - 0.05, 0);
  for (const x of [-length / 2 + 0.5, length / 2 - 0.5]) {
    b.block(0.12, DESK_TOP - 0.05, width * 0.6, m.steelBlack, x, 0, 0);
  }
  const spacing = length / chairsPerSide;
  for (let index = 0; index < chairsPerSide; index += 1) {
    const x = -length / 2 + spacing * (index + 0.5);
    for (const side of [-1, 1]) {
      b.push(x, 0, side * (width / 2 + 0.35), side > 0 ? Math.PI : 0);
      officeChair(b, m);
      b.pop();
    }
    b.block(0.24, 0.01, 0.32, m.paper, x, DESK_TOP, -width / 2 + 0.3);
  }
  b.cylinder(0.09, 0.09, 0.05, m.plastic, 0, DESK_TOP + 0.025, 0);
}

/** A wall-mounted display facing +Z, its back against the wall at the origin. */
export function wallScreen(b: ShapeBatch, m: Materials, width = 1.6): void {
  b.box(width, width * 0.57, 0.06, m.plastic, 0, 1.6, 0.05);
  b.box(width - 0.06, width * 0.57 - 0.06, 0.01, m.screenOn, 0, 1.6, 0.085);
  b.block(width * 0.8, 0.5, 0.4, m.oak, 0, 0, 0.25);
}

export function whiteboard(b: ShapeBatch, m: Materials, width = 2.2): void {
  b.box(width, 1.1, 0.03, m.whiteboard, 0, 1.5, 0.03);
  b.box(width + 0.04, 0.04, 0.08, m.aluminiumLight, 0, 0.93, 0.05);
}

/** A three-seat sofa facing +Z. */
export function sofa(b: ShapeBatch, m: Materials, warm = false, length = 2.1): void {
  const fabric = warm ? m.sofaWarm : m.sofa;
  b.block(length, 0.42, 0.85, fabric, 0, 0.06, 0);
  b.block(length, 0.42, 0.2, fabric, 0, 0.42, -0.33);
  for (const side of [-1, 1])
    b.block(0.18, 0.24, 0.85, fabric, side * (length / 2 - 0.09), 0.42, 0);
  for (const x of [-length / 2 + 0.1, length / 2 - 0.1]) {
    b.block(0.04, 0.06, 0.04, m.steelBlack, x, 0, 0.35);
    b.block(0.04, 0.06, 0.04, m.steelBlack, x, 0, -0.35);
  }
}

export function coffeeTable(b: ShapeBatch, m: Materials): void {
  b.cylinder(0.45, 0.45, 0.04, m.oak, 0, 0.42, 0, 24);
  b.cylinder(0.04, 0.04, 0.4, m.steelBlack, 0, 0.2, 0);
  b.cylinder(0.25, 0.25, 0.02, m.steelBlack, 0, 0.01, 0, 20);
  b.block(0.24, 0.02, 0.32, m.paper, 0.1, 0.44, 0, 0.4);
}

/** A round café table with chairs around it. */
export function cafeTable(b: ShapeBatch, m: Materials, chairs = 4): void {
  b.cylinder(0.4, 0.4, 0.03, m.countertop, 0, 0.73, 0, 24);
  b.cylinder(0.04, 0.04, 0.72, m.steelBlack, 0, 0.36, 0);
  b.cylinder(0.22, 0.22, 0.02, m.steelBlack, 0, 0.01, 0, 20);
  for (let index = 0; index < chairs; index += 1) {
    const angle = (index / chairs) * Math.PI * 2 + Math.PI / 4;
    b.push(Math.sin(angle) * 0.72, 0, Math.cos(angle) * 0.72, angle + Math.PI);
    b.block(0.42, 0.04, 0.42, m.oak, 0, 0.45, 0);
    b.block(0.4, 0.38, 0.03, m.oak, 0, 0.47, -0.2);
    for (const [x, z] of [
      [-0.18, -0.18],
      [0.18, -0.18],
      [-0.18, 0.18],
      [0.18, 0.18],
    ] as const) {
      b.block(0.025, 0.45, 0.025, m.steelBlack, x, 0, z);
    }
    b.pop();
  }
}

/** A kitchenette run along X with its back against a wall at −Z. */
export function kitchenette(b: ShapeBatch, m: Materials, length = 4): void {
  b.block(length, 0.88, 0.62, m.kitchen, 0, 0, 0);
  b.block(length + 0.04, 0.04, 0.65, m.countertop, 0, 0.88, 0);
  b.block(length, 0.7, 0.35, m.kitchen, 0, 1.5, -0.14);
  b.block(0.7, 1.9, 0.65, m.steelDoor, length / 2 + 0.38, 0, 0);
  b.block(0.5, 0.02, 0.38, m.steelDoor, -length / 4, 0.92, 0);
  b.block(0.35, 0.4, 0.38, m.plastic, length / 4, 0.92, -0.05);
  b.cylinder(0.06, 0.06, 0.12, m.ceramicPot, length / 4 + 0.35, 0.98, 0.05);
}

/** A reception counter facing +Z, with the receptionist's side towards −Z. */
export function receptionDesk(b: ShapeBatch, m: Materials, length = 3.6): void {
  b.block(length, 1.1, 0.5, m.deskWhite, 0, 0, 0.35);
  b.block(length + 0.1, 0.04, 0.62, m.oak, 0, 1.1, 0.35);
  b.block(length, 0.04, 0.7, m.countertop, 0, 0.74, -0.15);
  b.block(0.6, 0.36, 0.025, m.plastic, -0.6, 0.78, 0.0);
  b.block(0.58, 0.32, 0.005, m.screenOn, -0.6, 0.8, -0.015);
  b.push(-0.6, 0, -0.55, 0);
  officeChair(b, m);
  b.pop();
}

/** A filing cabinet or shelving unit against a wall at −Z. */
export function cabinet(b: ShapeBatch, m: Materials, width = 1.2, height = 1.1): void {
  b.block(width, height, 0.45, m.cabinet, 0, 0, 0);
  b.block(width, 0.02, 0.47, m.oak, 0, height, 0);
  for (let index = 0; index < 3; index += 1) {
    b.block(0.07, 0.25, 0.22, m.paper, -width / 2 + 0.2 + index * 0.09, height + 0.02, 0);
  }
}

/** Open shelving full of archive boxes. */
export function archiveShelf(b: ShapeBatch, m: Materials, width = 2): void {
  for (const x of [-width / 2, width / 2]) b.block(0.04, 2.1, 0.5, m.steelColumn, x, 0, 0);
  for (let level = 0; level < 5; level += 1) {
    const y = 0.08 + level * 0.42;
    b.block(width, 0.03, 0.5, m.steelColumn, 0, y, 0);
    for (let box = 0; box < Math.floor(width / 0.36); box += 1) {
      b.block(
        0.32,
        0.28,
        0.4,
        (box + level) % 3 === 0 ? m.cartonDark : m.carton,
        -width / 2 + 0.2 + box * 0.36,
        y + 0.03,
        0,
      );
    }
  }
}

/** A potted plant; `size` scales the whole plant. */
export function plant(b: ShapeBatch, m: Materials, size = 1): void {
  b.cylinder(0.22 * size, 0.17 * size, 0.5 * size, m.ceramicPot, 0, 0.25 * size, 0, 16);
  b.cylinder(0.02 * size, 0.03 * size, 0.6 * size, m.bark, 0, 0.75 * size, 0, 6);
  b.sphere(0.36 * size, m.foliage, 0, 1.1 * size, 0, 1.15);
  b.sphere(0.26 * size, m.foliageLight, 0.14 * size, 1.32 * size, 0.08 * size, 1.1);
  b.sphere(0.22 * size, m.foliage, -0.12 * size, 1.4 * size, -0.06 * size, 1.1);
}

export function printer(b: ShapeBatch, m: Materials): void {
  b.block(0.65, 0.95, 0.6, m.cabinet, 0, 0, 0);
  b.block(0.6, 0.12, 0.5, m.plastic, 0, 0.95, 0);
  b.block(0.24, 0.01, 0.3, m.paper, 0, 1.07, 0.05);
}

/** A server cabinet, as used by an automated service. */
export function serverCabinet(b: ShapeBatch, m: Materials): void {
  b.block(0.6, 2, 1, m.steelBlack, 0, 0, 0);
  b.box(0.52, 1.8, 0.01, m.machineWindow, 0, 1.0, 0.505);
  for (let slot = 0; slot < 8; slot += 1) {
    b.box(0.48, 0.08, 0.01, slot % 3 === 0 ? m.screenOn : m.plastic, 0, 0.3 + slot * 0.2, 0.51);
  }
}
