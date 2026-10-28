import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import type { NavPoint } from '../building/create-navigation';
import {
  BODY_RADIUS,
  COMFORT,
  createWalkPlanner,
  WalkGrid,
  type StoreyFloor,
} from '../building/create-walk-grid';

const floor = (level = 0, elevation = 0): StoreyFloor => ({
  building: 'B',
  level,
  elevation,
  minX: 0,
  maxX: 20,
  minZ: 0,
  maxZ: 10,
});
/** A box standing on the floor at `elevation`, from (x0, z0) to (x1, z1). */
const box = (x0: number, z0: number, x1: number, z1: number, elevation = 0): Box3 =>
  new Box3(new Vector3(x0, elevation, z0), new Vector3(x1, elevation + 2.5, z1));
const at = (x: number, z: number, level = 0, y = 0): NavPoint => ({
  position: new Vector3(x, y, z),
  building: 'B',
  level,
});
/** A wall across the floor at x = 10, with a one-metre doorway from z = 4.5 to 5.5. */
const wallWithDoor = [box(9.95, 0, 10.05, 4.5), box(9.95, 5.5, 10.05, 10)];

/** How near a walk comes to any of the boxes, across the floor. */
function clearance(path: readonly NavPoint[], boxes: readonly Box3[]): number {
  let nearest = Infinity;
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1]!.position;
    const b = path[index]!.position;
    const steps = Math.ceil(a.distanceTo(b) / 0.02);
    for (let step = 0; step <= steps; step += 1) {
      const p = a.clone().lerp(b, step / steps);
      for (const solid of boxes) {
        const dx = Math.max(solid.min.x - p.x, 0, p.x - solid.max.x);
        const dz = Math.max(solid.min.z - p.z, 0, p.z - solid.max.z);
        nearest = Math.min(nearest, Math.hypot(dx, dz));
      }
    }
  }
  return nearest;
}

const lengthOf = (path: readonly NavPoint[]): number =>
  path
    .slice(1)
    .reduce((sum, point, index) => sum + point.position.distanceTo(path[index]!.position), 0);

describe('WalkGrid', () => {
  it('closes the floor a body width round what stands on it, and nothing else', () => {
    const grid = new WalkGrid(floor(), [box(4, 4, 6, 6)]);
    expect(grid.isOpen(5, 5)).toBe(false);
    expect(grid.isOpen(6.1, 5)).toBe(false);
    expect(grid.isOpen(6 + BODY_RADIUS + 0.15, 5)).toBe(true);
    expect(grid.isOpen(1, 1)).toBe(true);
  });

  it('ignores what is overhead or only on the floor, and what is on another storey', () => {
    const grid = new WalkGrid(floor(1, 4), [
      new Box3(new Vector3(4, 6.2, 4), new Vector3(6, 6.5, 6)), // a ceiling light
      new Box3(new Vector3(4, 4, 4), new Vector3(6, 4.03, 6)), // a rug
      box(4, 4, 6, 6, 0), // a cupboard downstairs
    ]);
    expect(grid.isOpen(5, 5)).toBe(true);
  });
});

describe('createWalkPlanner', () => {
  it('walks the shortest way round, through the doorway, never touching the wall', () => {
    const planner = createWalkPlanner([new WalkGrid(floor(), wallWithDoor)], []);
    const path = planner.route(at(2, 1), at(18, 1))!;
    expect(path).not.toBeNull();
    expect(path[0]!.position.toArray()).toEqual([2, 0, 1]);
    expect(path.at(-1)!.position.toArray()).toEqual([18, 0, 1]);
    expect(clearance(path, wallWithDoor)).toBeGreaterThanOrEqual(BODY_RADIUS - 0.01);
    // Straight to the doorway and straight on: within a few per cent of the shortest walk
    // through it, which bends round the corner of the door post a body width off it.
    const toPost = Math.hypot(9.95 - 2, 4.5 + BODY_RADIUS - 1);
    const shortest = toPost * 2 + 0.1;
    expect(lengthOf(path)).toBeLessThan(shortest * 1.03);
    expect(path.length).toBeLessThanOrEqual(5);
  });

  it('keeps a swinging hand off a corner it walks round, where there is room', () => {
    // A block from the south edge of the floor to z = 6, with four metres of floor beyond.
    const block = [box(8, 0, 12, 6)];
    const planner = createWalkPlanner([new WalkGrid(floor(), block)], []);
    const path = planner.route(at(2, 2), at(18, 2))!;
    expect(clearance(path, block)).toBeGreaterThanOrEqual(COMFORT - 0.15);
    // Still about as short as a walk that far off the block can be.
    const shortest = Math.hypot(6, 4 + COMFORT) * 2 + 4;
    expect(lengthOf(path)).toBeLessThan(shortest * 1.03);
  });

  it('goes straight when nothing is in the way', () => {
    const planner = createWalkPlanner([new WalkGrid(floor(), [])], []);
    const path = planner.route(at(1, 1), at(19, 9))!;
    expect(path).toHaveLength(2);
  });

  it('takes a stair between storeys, walking its steps', () => {
    const stair = { from: at(18, 9), via: [at(18, 5, 0, 2)], to: at(18, 1, 1, 4) };
    const planner = createWalkPlanner(
      [new WalkGrid(floor(0, 0), wallWithDoor), new WalkGrid(floor(1, 4), [])],
      [stair],
    );
    const path = planner.route(at(2, 9), at(2, 1, 1, 4))!;
    expect(path.at(-1)).toMatchObject({ level: 1 });
    expect(path.some((point) => point.position.y === 2)).toBe(true);
    // On the ground floor it went through the doorway to reach the stair.
    const below = path.filter((point) => point.level === 0 && point.position.y === 0);
    expect(clearance(below, wallWithDoor)).toBeGreaterThanOrEqual(BODY_RADIUS - 0.01);
  });

  it('starts beside a desk without walking through it', () => {
    const desk = box(4, 4, 6, 6);
    const planner = createWalkPlanner([new WalkGrid(floor(), [desk])], []);
    // Standing just beside the desk, closer than a body width: off open floor.
    const path = planner.route(at(6.1, 5), at(2, 5))!;
    expect(path).not.toBeNull();
    for (let index = 1; index < path.length; index += 1) {
      const a = path[index - 1]!.position;
      const b = path[index]!.position;
      for (let t = 0; t <= 1; t += 0.01) {
        const p = a.clone().lerp(b, t);
        expect(p.x > 4 && p.x < 6 && p.z > 4 && p.z < 6).toBe(false);
      }
    }
  });

  it('finds no way to a place walled in', () => {
    const boxed = [
      box(14, 3, 14.1, 7),
      box(16, 3, 16.1, 7),
      box(14, 3, 16.1, 3.1),
      box(14, 6.9, 16.1, 7),
    ];
    const planner = createWalkPlanner([new WalkGrid(floor(), boxed)], []);
    expect(planner.route(at(2, 5), at(15, 5))).toBeNull();
  });
});
