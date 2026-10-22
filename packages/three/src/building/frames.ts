import type { GroundPoint, Side } from '../viewer-contract/twin-model';

export const SIDES: readonly Side[] = ['north', 'south', 'east', 'west'];

/** A local frame as `[x, y, z, rotationY]`, ready for `ShapeBatch.push`. */
export type Placement = readonly [number, number, number, number];

/** Rotation that turns local +Z to face out of the given side. */
export const SIDE_ROTATION: Readonly<Record<Side, number>> = {
  south: 0,
  north: Math.PI,
  east: Math.PI / 2,
  west: -Math.PI / 2,
};

/**
 * One side of a `width` × `depth` footprint centred on the origin, as a local frame whose
 * X runs along the side and whose +Z points outwards. A positive `inset` moves the frame
 * inwards, a negative one outwards.
 */
export function sideFrame(
  side: Side,
  width: number,
  depth: number,
  inset: number,
): { length: number; place: Placement } {
  switch (side) {
    case 'south':
      return { length: width, place: [0, 0, depth / 2 - inset, SIDE_ROTATION.south] };
    case 'north':
      return { length: width, place: [0, 0, -depth / 2 + inset, SIDE_ROTATION.north] };
    case 'east':
      return { length: depth, place: [width / 2 - inset, 0, 0, SIDE_ROTATION.east] };
    case 'west':
      return { length: depth, place: [-width / 2 + inset, 0, 0, SIDE_ROTATION.west] };
  }
}

/** Converts a point in a side frame (`along` the side, `out` of it) to footprint coordinates. */
export function pointOnSide(
  side: Side,
  width: number,
  depth: number,
  along: number,
  out: number,
): GroundPoint {
  const [x, , z, rotation] = sideFrame(side, width, depth, 0).place;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  // Local X maps to (cos, -sin) and local Z to (sin, cos) on the ground.
  return [x + along * cos + out * sin, z - along * sin + out * cos];
}

/** The stretches of a run of `length` that remain once a gap of `gap` at `at` is left out. */
export function spans(length: number, gap: number, at = 0): (readonly [number, number])[] {
  const start = -length / 2;
  const end = length / 2;
  if (gap <= 0) return [[start, end]];
  return (
    [
      [start, at - gap / 2],
      [at + gap / 2, end],
    ] as const
  ).filter(([from, to]) => to - from > 0.05);
}

/** The stretches of a run of `length` left once several openings are cut out of it. */
export function spansAround(
  length: number,
  openings: readonly { readonly at: number; readonly width: number }[],
): (readonly [number, number])[] {
  const sorted = [...openings].sort((a, b) => a.at - b.at);
  const result: (readonly [number, number])[] = [];
  let cursor = -length / 2;
  for (const opening of sorted) {
    const from = opening.at - opening.width / 2;
    if (from - cursor > 0.05) result.push([cursor, from]);
    cursor = Math.max(cursor, opening.at + opening.width / 2);
  }
  if (length / 2 - cursor > 0.05) result.push([cursor, length / 2]);
  return result;
}
