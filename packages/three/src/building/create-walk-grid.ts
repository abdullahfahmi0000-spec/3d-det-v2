import { Vector3, type Box3 } from 'three';

import type { NavPoint } from './create-navigation';

/**
 * Walking round things: each storey's floor as a grid of small cells, those that something
 * stands in (furniture, walls, glazing, stairs, the leaf of an open door) closed, and the
 * cells too near them for a person's width closed with them. Routes are the shortest walks
 * over the open cells of every storey, joined by the stairs and walkways, straightened
 * wherever the way is clear. Where there is room they keep further off walls and furniture
 * than a body's width, so that a swinging hand, and the order carried in it, miss them.
 */

/** Size of a cell, in metres. */
const CELL = 0.1;
/** How near the middle of someone can come to anything: half their width, arms included. */
export const BODY_RADIUS = 0.3;
/**
 * How far from anything the middle of someone walking keeps where there is room: clear of
 * the hands as they swing. Nearer than this, through a doorway or between desks, a metre
 * walked costs up to `1 + CROWDING` times as much, so walks take the open middle of a
 * corridor rather than brush along its wall.
 */
export const COMFORT = 0.6;
const CROWDING = 3;
/** The height of a walking person above their floor: anything in between is in the way. */
const BODY_BOTTOM = 0.12;
const BODY_TOP = 1.9;
/** How far a place can be from open floor and still be walked to. */
const SNAP_REACH = 1.6;
const DIAGONAL = Math.SQRT2;

/** A storey's floor: whose it is, its height, and the world rectangle it covers. */
export interface StoreyFloor {
  readonly building: string;
  readonly level: number;
  readonly elevation: number;
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
}

/** One storey's floor as cells. */
export class WalkGrid {
  readonly cols: number;
  readonly rows: number;
  /** 1 where the middle of someone can be, 0 where they would touch something. */
  readonly open: Uint8Array;
  /** 1 where something stands. */
  readonly solid: Uint8Array;
  /** How far each cell's middle is from anything standing, in metres. */
  readonly clearance: Float32Array;
  /** What a metre walked in each cell costs: 1 at `COMFORT` from everything, more nearer. */
  readonly crowding: Float32Array;

  constructor(
    readonly floor: StoreyFloor,
    obstacles: readonly Box3[],
  ) {
    const cols = Math.max(1, Math.ceil((floor.maxX - floor.minX) / CELL));
    const rows = Math.max(1, Math.ceil((floor.maxZ - floor.minZ) / CELL));
    this.cols = cols;
    this.rows = rows;

    // Distance from each cell to the nearest cell something stands in, in cells, by a
    // two-pass chamfer transform; those stood in start at 0.
    const distance = new Float32Array(cols * rows).fill(Number.POSITIVE_INFINITY);
    const bottom = floor.elevation + BODY_BOTTOM;
    const top = floor.elevation + BODY_TOP;
    for (const box of obstacles) {
      if (box.max.y <= bottom || box.min.y >= top) continue;
      const i0 = Math.max(0, Math.floor((box.min.x - floor.minX) / CELL));
      const i1 = Math.min(cols - 1, Math.floor((box.max.x - floor.minX) / CELL));
      const j0 = Math.max(0, Math.floor((box.min.z - floor.minZ) / CELL));
      const j1 = Math.min(rows - 1, Math.floor((box.max.z - floor.minZ) / CELL));
      for (let j = j0; j <= j1; j += 1) distance.fill(0, j * cols + i0, j * cols + i1 + 1);
    }
    const relax = (cell: number, other: number, step: number): void => {
      const through = distance[other]! + step;
      if (through < distance[cell]!) distance[cell] = through;
    };
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const cell = j * cols + i;
        if (i > 0) relax(cell, cell - 1, 1);
        if (j > 0) {
          relax(cell, cell - cols, 1);
          if (i > 0) relax(cell, cell - cols - 1, DIAGONAL);
          if (i < cols - 1) relax(cell, cell - cols + 1, DIAGONAL);
        }
      }
    }
    for (let j = rows - 1; j >= 0; j -= 1) {
      for (let i = cols - 1; i >= 0; i -= 1) {
        const cell = j * cols + i;
        if (i < cols - 1) relax(cell, cell + 1, 1);
        if (j < rows - 1) {
          relax(cell, cell + cols, 1);
          if (i < cols - 1) relax(cell, cell + cols + 1, DIAGONAL);
          if (i > 0) relax(cell, cell + cols - 1, DIAGONAL);
        }
      }
    }
    this.open = new Uint8Array(cols * rows);
    this.solid = new Uint8Array(cols * rows);
    this.clearance = new Float32Array(cols * rows);
    this.crowding = new Float32Array(cols * rows);
    for (let cell = 0; cell < this.open.length; cell += 1) {
      // A cell stood in reaches up to half a cell towards its neighbour.
      const clear = Math.max(0, (distance[cell]! - 0.5) * CELL);
      this.clearance[cell] = clear;
      this.open[cell] = clear >= BODY_RADIUS - 1e-6 ? 1 : 0;
      this.solid[cell] = distance[cell] === 0 ? 1 : 0;
      const near = Math.min(1, Math.max(0, (COMFORT - clear) / (COMFORT - BODY_RADIUS)));
      this.crowding[cell] = 1 + CROWDING * near;
    }
  }

  get size(): number {
    return this.cols * this.rows;
  }

  /** The cell a point is in, or -1 outside the floor. */
  cellAt(x: number, z: number): number {
    const i = Math.floor((x - this.floor.minX) / CELL);
    const j = Math.floor((z - this.floor.minZ) / CELL);
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return -1;
    return j * this.cols + i;
  }

  /** The middle of a cell, at floor height. */
  centre(cell: number, out = new Vector3()): Vector3 {
    const i = cell % this.cols;
    const j = (cell - i) / this.cols;
    return out.set(
      this.floor.minX + (i + 0.5) * CELL,
      this.floor.elevation,
      this.floor.minZ + (j + 0.5) * CELL,
    );
  }

  isOpen(x: number, z: number): boolean {
    const cell = this.cellAt(x, z);
    return cell >= 0 && this.open[cell] === 1;
  }

  /** How far a point is from anything standing, to the nearest cell; 0 off the floor. */
  clearanceAt(x: number, z: number): number {
    const cell = this.cellAt(x, z);
    return cell < 0 ? 0 : this.clearance[cell]!;
  }

  /** The open cell nearest a point, within `reach` metres; -1 if there is none. */
  nearestOpen(x: number, z: number, reach = SNAP_REACH): number {
    const ci = Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.floor.minX) / CELL)));
    const cj = Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.floor.minZ) / CELL)));
    const span = Math.ceil(reach / CELL);
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let j = Math.max(0, cj - span); j <= Math.min(this.rows - 1, cj + span); j += 1) {
      for (let i = Math.max(0, ci - span); i <= Math.min(this.cols - 1, ci + span); i += 1) {
        const cell = j * this.cols + i;
        if (this.open[cell] !== 1) continue;
        const dx = this.floor.minX + (i + 0.5) * CELL - x;
        const dz = this.floor.minZ + (j + 0.5) * CELL - z;
        const d = dx * dx + dz * dz;
        if (d < bestDistance) {
          bestDistance = d;
          best = cell;
        }
      }
    }
    return bestDistance <= reach * reach ? best : -1;
  }

  /**
   * Whether the straight line between two points keeps clear of what stands on the floor:
   * at each point of it by `need(metres from a)`, a body's width unless told otherwise.
   * Where `need` is 0 it need only miss what stands there: near an end that is a place
   * beside a desk, closer to it than open floor is.
   */
  isClear(a: Vector3, b: Vector3, need: (along: number) => number = () => BODY_RADIUS): boolean {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(length / (CELL / 2)));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const cell = this.cellAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
      if (cell < 0) return false;
      const required = need(t * length);
      if (required <= 0 ? this.solid[cell] === 1 : this.clearance[cell]! < required - 1e-6)
        return false;
    }
    return true;
  }
}

/** A fixed way between two floors or buildings, such as a stair or a walkway. */
export interface WalkLink {
  readonly from: NavPoint;
  readonly to: NavPoint;
  /** The points walked in between, from `from` to `to`. */
  readonly via: readonly NavPoint[];
}

export interface WalkPlanner {
  /**
   * The shortest walk from one point to another, round everything in the way, over the
   * floors of every storey and the stairs and walkways between them; null when there is
   * none.
   */
  route(from: NavPoint, to: NavPoint): NavPoint[] | null;
}

interface PlacedLink {
  readonly from: number;
  readonly to: number;
  readonly cost: number;
  /** from point, the via points, to point, in order. */
  readonly points: readonly NavPoint[];
}

/** A min-heap of node indices by score. */
class Heap {
  private nodes: number[] = [];
  private scores: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: number, score: number): void {
    const { nodes, scores } = this;
    let at = nodes.length;
    nodes.push(node);
    scores.push(score);
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (scores[parent]! <= score) break;
      nodes[at] = nodes[parent]!;
      scores[at] = scores[parent]!;
      at = parent;
    }
    nodes[at] = node;
    scores[at] = score;
  }

  pop(): number {
    const { nodes, scores } = this;
    const top = nodes[0]!;
    const lastNode = nodes.pop()!;
    const lastScore = scores.pop()!;
    if (nodes.length > 0) {
      let at = 0;
      for (;;) {
        const left = at * 2 + 1;
        if (left >= nodes.length) break;
        const right = left + 1;
        const child = right < nodes.length && scores[right]! < scores[left]! ? right : left;
        if (scores[child]! >= lastScore) break;
        nodes[at] = nodes[child]!;
        scores[at] = scores[child]!;
        at = child;
      }
      nodes[at] = lastNode;
      scores[at] = lastScore;
    }
    return top;
  }
}

const keyOf = (building: string, level: number): string => `${building}#${level}`;

export function createWalkPlanner(
  grids: readonly WalkGrid[],
  links: readonly WalkLink[],
): WalkPlanner {
  // Every cell of every grid is one node: grid g's cells start at offsets[g].
  const offsets: number[] = [];
  let total = 0;
  for (const grid of grids) {
    offsets.push(total);
    total += grid.size;
  }
  const byStorey = new Map(
    grids.map((grid, index) => [keyOf(grid.floor.building, grid.floor.level), index]),
  );
  const gridOf = (node: number): number => {
    let index = grids.length - 1;
    while (index > 0 && offsets[index]! > node) index -= 1;
    return index;
  };

  /** The node a point stands on, snapped to open floor; -1 if it is off every floor. */
  const nodeAt = (point: NavPoint): number => {
    const index = byStorey.get(keyOf(point.building, point.level));
    if (index === undefined) return -1;
    const cell = grids[index]!.nearestOpen(point.position.x, point.position.z);
    return cell < 0 ? -1 : offsets[index]! + cell;
  };

  // Links leave from, and arrive at, the open cells nearest their ends.
  const linksFrom = new Map<number, PlacedLink[]>();
  for (const link of links) {
    const from = nodeAt(link.from);
    const to = nodeAt(link.to);
    if (from < 0 || to < 0) continue;
    const points = [link.from, ...link.via, link.to];
    let cost = 0;
    for (let index = 1; index < points.length; index += 1) {
      cost += points[index]!.position.distanceTo(points[index - 1]!.position);
    }
    for (const [a, b, walked] of [
      [from, to, points],
      [to, from, [...points].reverse()],
    ] as const) {
      const list = linksFrom.get(a) ?? [];
      list.push({ from: a, to: b, cost, points: walked });
      linksFrom.set(a, list);
    }
  }

  // Search state, kept between routes and reset where it was touched.
  const cost = new Float32Array(total).fill(Number.POSITIVE_INFINITY);
  const previous = new Int32Array(total).fill(-1);
  const arrivedBy = new Map<number, PlacedLink>();
  const closed = new Uint8Array(total);
  const touched: number[] = [];
  const at = new Vector3();

  const search = (start: number, goal: number, goalPoint: Vector3): boolean => {
    for (const node of touched) {
      cost[node] = Number.POSITIVE_INFINITY;
      previous[node] = -1;
      closed[node] = 0;
    }
    touched.length = 0;
    arrivedBy.clear();

    const heap = new Heap();
    const estimate = (node: number): number => {
      const index = gridOf(node);
      grids[index]!.centre(node - offsets[index]!, at);
      return Math.hypot(at.x - goalPoint.x, at.z - goalPoint.z);
    };
    cost[start] = 0;
    touched.push(start);
    heap.push(start, estimate(start));
    const reach = (node: number, from: number, through: number, link?: PlacedLink): void => {
      if (through >= cost[node]!) return;
      if (cost[node] === Number.POSITIVE_INFINITY) touched.push(node);
      cost[node] = through;
      previous[node] = from;
      if (link) arrivedBy.set(node, link);
      else arrivedBy.delete(node);
      heap.push(node, through + estimate(node));
    };

    while (heap.size > 0) {
      const node = heap.pop();
      if (closed[node] === 1) continue;
      if (node === goal) return true;
      closed[node] = 1;
      const index = gridOf(node);
      const grid = grids[index]!;
      const offset = offsets[index]!;
      const cell = node - offset;
      const i = cell % grid.cols;
      const j = (cell - i) / grid.cols;
      const here = cost[node]!;
      for (let dj = -1; dj <= 1; dj += 1) {
        for (let di = -1; di <= 1; di += 1) {
          if (di === 0 && dj === 0) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= grid.cols || nj >= grid.rows) continue;
          const next = nj * grid.cols + ni;
          if (grid.open[next] !== 1) continue;
          // No cutting corners past something.
          if (di !== 0 && dj !== 0) {
            if (grid.open[j * grid.cols + ni] !== 1 || grid.open[nj * grid.cols + i] !== 1)
              continue;
          }
          // Dearer near walls and furniture, so walks keep off them where there is room.
          const step = (di !== 0 && dj !== 0 ? DIAGONAL : 1) * CELL;
          const crowding = (grid.crowding[cell]! + grid.crowding[next]!) / 2;
          reach(offset + next, node, here + step * crowding);
        }
      }
      for (const link of linksFrom.get(node) ?? []) reach(link.to, node, here + link.cost, link);
    }
    return false;
  };

  /**
   * Straightens a walk on one floor: from each point, on to the farthest one in sight. A
   * straight stretch must keep as clear of things as the stretch of the walk it replaces
   * (to within a cell), so straightening does not pull a walk the search kept in the middle
   * of a corridor back against its wall. Within `looseStart` and `looseEnd` metres of the
   * ends it need only miss what stands there.
   */
  const straighten = (
    grid: WalkGrid,
    points: Vector3[],
    looseStart: number,
    looseEnd: number,
  ): Vector3[] => {
    if (points.length <= 2) return points;
    const last = points.length - 1;
    // How clear the walk is at each point, up to COMFORT, and how far along it each is.
    const clear = points.map((point) => Math.min(COMFORT, grid.clearanceAt(point.x, point.z)));
    const arc = [0];
    for (let index = 1; index <= last; index += 1) {
      const a = points[index - 1]!;
      const b = points[index]!;
      arc.push(arc[index - 1]! + Math.hypot(b.x - a.x, b.z - a.z));
    }
    const isShortcut = (from: number, to: number): boolean => {
      const a = points[from]!;
      const b = points[to]!;
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      const looseA = from === 0 ? looseStart : 0;
      const looseB = to === last ? looseEnd : 0;
      let at = from;
      return grid.isClear(a, b, (along) => {
        if (along < looseA || length - along < looseB) return 0;
        // The point of the walk as far along it as this is along the line.
        const walked = arc[from]! + (length > 0 ? along / length : 0) * (arc[to]! - arc[from]!);
        while (at < to && arc[at + 1]! <= walked) at += 1;
        const there = Math.min(clear[at]!, clear[Math.min(at + 1, to)]!);
        return Math.max(BODY_RADIUS, there - CELL);
      });
    };
    const kept = [points[0]!];
    let anchor = 0;
    for (let index = 2; index <= last; index += 1) {
      if (!isShortcut(anchor, index)) {
        anchor = index - 1;
        kept.push(points[anchor]!);
      }
    }
    kept.push(points[last]!);
    return kept;
  };

  return {
    route(from, to) {
      const start = nodeAt(from);
      const goal = nodeAt(to);
      if (start < 0 || goal < 0) return null;
      if (!search(start, goal, to.position)) return null;

      const nodes: number[] = [];
      for (let node = goal; node >= 0; node = previous[node]!) {
        nodes.push(node);
        if (node === start) break;
      }
      nodes.reverse();

      // Runs of cells on one floor, joined by the links walked between them.
      const route: NavPoint[] = [];
      const pointOn = (grid: WalkGrid, position: Vector3): NavPoint => ({
        position: position.setY(grid.floor.elevation),
        building: grid.floor.building,
        level: grid.floor.level,
      });
      let run: Vector3[] = [from.position.clone()];
      let looseStart =
        from.position.distanceTo(grids[gridOf(start)]!.centre(start - offsets[gridOf(start)]!)) +
        BODY_RADIUS;
      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index]!;
        const gridIndex = gridOf(node);
        const grid = grids[gridIndex]!;
        const link = arrivedBy.get(node);
        if (link && index > 0) {
          // Close the run on the floor left, walk the link, and start one on the next.
          const left = grids[gridOf(link.from)]!;
          const exit = link.points[0]!;
          run.push(exit.position.clone());
          for (const point of straighten(left, run, looseStart, BODY_RADIUS))
            route.push(pointOn(left, point));
          for (const point of link.points.slice(1, -1))
            route.push({ ...point, position: point.position.clone() });
          const entry = link.points[link.points.length - 1]!;
          run = [entry.position.clone()];
          looseStart = BODY_RADIUS;
        }
        run.push(grid.centre(node - offsets[gridIndex]!));
      }
      const last = grids[gridOf(goal)]!;
      const looseEnd =
        to.position.distanceTo(last.centre(goal - offsets[gridOf(goal)]!)) + BODY_RADIUS;
      run.push(to.position.clone());
      for (const point of straighten(last, run, looseStart, looseEnd))
        route.push(pointOn(last, point));

      // Drop points that repeat the one before.
      return route.filter(
        (point, index) =>
          index === 0 || point.position.distanceTo(route[index - 1]!.position) > 0.02,
      );
    },
  };
}
