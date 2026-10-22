import { Vector3 } from 'three';

import type {
  GroundPoint,
  GroundRect,
  RoomModel,
  TwinViewModel,
  WorkstationModel,
} from '../viewer-contract/twin-model';
import { fromRoomFrame, roomFrame, stairLayout } from './create-room';
import { pointOnSide, sideFrame } from './frames';

/** A point on a walk, with the storey it is on so the view can follow the walker. */
export interface NavPoint {
  readonly position: Vector3;
  readonly building: string;
  readonly level: number;
}

export interface Navigation {
  /**
   * The walk from one place to another: workstation entity ids or truck entity ids. It
   * runs through doors, along corridors, up and down stairs and across walkways. Null when
   * either place is unknown or unreachable.
   */
  route(from: string, to: string): NavPoint[] | null;
  /** Where a visitor stands at a place, and the direction they face (radians, 0 is +Z). */
  visit(place: string): { readonly point: NavPoint; readonly facing: number } | null;
}

export interface NavigationInput {
  readonly model: TwinViewModel;
  /** Finished-floor height of a storey, by building entity id and level. */
  readonly elevation: (building: string, level: number) => number;
}

interface Node {
  readonly id: number;
  readonly point: NavPoint;
}

interface Edge {
  readonly to: number;
  readonly cost: number;
  /** Points walked between the two nodes, such as the steps of a stair. */
  readonly via: readonly NavPoint[];
}

/** How far a door's walking points sit inside and outside the doorway. */
const DOOR_CLEARANCE = 0.75;
/** Climbing is slower than walking, so routes avoid needless stairs. */
const STAIR_COST = 2.5;

/**
 * Builds the walking network of the twin from its model: corridor and aisle centre lines,
 * a node inside and outside each room door, a stair between each pair of storeys, the
 * walkways between buildings, and a standing point beside every workstation and inside
 * every loading dock. Routes are shortest paths over it.
 */
export function createNavigation({ model, elevation }: NavigationInput): Navigation {
  const nodes: Node[] = [];
  const edges = new Map<number, Edge[]>();
  const places = new Map<string, { node: Node; facing: number }>();

  const addNode = (point: NavPoint): Node => {
    const node = { id: nodes.length, point };
    nodes.push(node);
    edges.set(node.id, []);
    return node;
  };
  const link = (a: Node, b: Node, via: readonly NavPoint[] = [], weight = 1): void => {
    const path = [a.point, ...via, b.point];
    let length = 0;
    for (let index = 1; index < path.length; index += 1) {
      length += path[index]!.position.distanceTo(path[index - 1]!.position);
    }
    edges.get(a.id)!.push({ to: b.id, cost: length * weight, via });
    edges.get(b.id)!.push({ to: a.id, cost: length * weight, via: [...via].reverse() });
  };

  /** One storey's corridors, which doors and desks are joined to at their nearest point. */
  const storeyNets = new Map<string, CorridorNet>();
  const netFor = (building: string, level: number): CorridorNet | undefined =>
    storeyNets.get(`${building}#${level}`);

  // Offices: corridors, rooms and stairs on each floor.
  for (const office of model.offices) {
    const building = office.entity.id;
    const toWorld = localToWorld(office, (level) => elevation(building, level), building);

    for (const floor of office.floors) {
      const net = new CorridorNet(addNode, link, (local) => toWorld(local, floor.level));
      for (const corridor of floor.corridors ?? []) net.addLine(corridor);
      storeyNets.set(`${building}#${floor.level}`, net);
    }

    for (const floor of office.floors) {
      const net = netFor(building, floor.level)!;
      const insides = new Map<string, Node>();
      for (const room of floor.rooms) {
        if (room.kind === 'core') continue;
        const door = doorPoints(room);
        if (!door) continue;
        const inside = addNode(toWorld(door.inside, floor.level));
        const outside = addNode(toWorld(door.outside, floor.level));
        link(inside, outside);
        net.attach(outside);
        insides.set(room.id, inside);
        // The building's entrance is outside the lobby door, facing in.
        if (room.kind === 'lobby' && floor.level === 0) {
          const inward = inside.point.position.clone().sub(outside.point.position);
          places.set(`entrance:${building}`, {
            node: outside,
            facing: Math.atan2(inward.x, inward.z),
          });
        }
      }

      // Each stair climbs from this floor's first flight to the next floor's landing.
      const core = floor.rooms.find((room) => room.kind === 'core');
      const above = office.floors.find((candidate) => candidate.level === floor.level + 1);
      const aboveNet = above ? netFor(building, above.level) : undefined;
      if (core && above && aboveNet) {
        const stairs = stairLayout(core);
        const at = (x: number, z: number, height: number): NavPoint => ({
          ...toWorld(fromRoomFrame(core, x, z), floor.level),
          position: toWorld(fromRoomFrame(core, x, z), floor.level).position.setY(height),
        });
        const low = elevation(building, floor.level);
        const high = elevation(building, above.level);
        const middle = (low + high) / 2;
        const bottom = addNode(
          toWorld(fromRoomFrame(core, stairs.firstFlight, stairs.front + 0.8), floor.level),
        );
        const top = addNode(
          toWorld(fromRoomFrame(core, stairs.secondFlight, stairs.front + 0.8), above.level),
        );
        net.attach(bottom);
        aboveNet.attach(top);
        // Every point on the stair belongs to the lower floor, which is the one opened up
        // while someone is on it (the floor above would hide the flights).
        link(
          bottom,
          top,
          [
            at(stairs.firstFlight, stairs.front - 1.1, low),
            at(stairs.firstFlight, stairs.back + 1.2, middle),
            at(stairs.firstFlight, stairs.back + 0.6, middle),
            at(stairs.secondFlight, stairs.back + 0.6, middle),
            at(stairs.secondFlight, stairs.back + 1.2, middle),
            at(stairs.secondFlight, stairs.front - 1.1, high),
          ],
          STAIR_COST,
        );
      }

      for (const station of model.workstations) {
        if (station.building !== building || station.level !== floor.level) continue;
        const room = floor.rooms.find((candidate) =>
          contains(candidate, toLocal(office, station.position)),
        );
        addStation(
          station,
          room ? insides.get(room.id) : undefined,
          net,
          toWorld,
          floor.level,
          office,
        );
      }
    }
  }

  // Halls: aisles, rooms built inside, docks and the posts on the floor.
  for (const hall of model.halls) {
    const building = hall.entity.id;
    const toWorld = localToWorld(hall, () => elevation(building, 0), building);
    const net = new CorridorNet(addNode, link, (local) => toWorld(local, 0));
    for (const aisle of hall.aisles ?? []) net.addLine(aisle);
    storeyNets.set(`${building}#0`, net);

    const insides = new Map<string, Node>();
    for (const room of hall.rooms) {
      const door = doorPoints(room);
      if (!door) continue;
      const inside = addNode(toWorld(door.inside, 0));
      const outside = addNode(toWorld(door.outside, 0));
      link(inside, outside);
      net.attach(outside);
      insides.set(room.id, inside);
    }

    // A visitor waits just inside the dock door, facing the truck outside.
    const [width, depth] = hall.size;
    const facingOut = sideFrame(hall.dockSide, width, depth, 0).place[3];
    for (const dock of hall.docks) {
      if (!dock.truck) continue;
      const node = addNode(toWorld(pointOnSide(hall.dockSide, width, depth, dock.offset, -2.2), 0));
      net.attach(node);
      places.set(dock.truck.entity.id, { node, facing: facingOut });
    }

    for (const station of model.workstations) {
      if (station.building !== building) continue;
      const room = hall.rooms.find((candidate) =>
        contains(candidate, toLocal(hall, station.position)),
      );
      addStation(station, room ? insides.get(room.id) : undefined, net, toWorld, 0, hall);
    }
  }

  // Walkways join the nearest corridor point of the buildings at either end.
  for (const walkway of model.walkways) {
    const ends = [walkway.from, walkway.to].map((end, index) => {
      const other = index === 0 ? walkway.to : walkway.from;
      const owner = [...model.offices, ...model.halls].find((building) =>
        contains(
          { center: building.center, size: [building.size[0] + 2, building.size[1] + 2] },
          end,
        ),
      );
      if (!owner) return null;
      const building = owner.entity.id;
      const height = elevation(building, 0);
      // Step a little inside the building, away from the walkway.
      const direction = new Vector3(end[0] - other[0], 0, end[1] - other[1]).normalize();
      const inside = new Vector3(end[0], height, end[1]).addScaledVector(direction, 1.4);
      const node = addNode({ position: inside, building, level: 0 });
      netFor(building, 0)?.attach(node);
      return { node, end, height, building };
    });
    const [start, finish] = ends;
    if (!start || !finish) continue;
    // Flat along the walkway at the lower floor's height, then a few steps up at the end.
    const lowEnd = start.height <= finish.height ? start : finish;
    const highEnd = lowEnd === start ? finish : start;
    const along = new Vector3(highEnd.end[0] - lowEnd.end[0], 0, highEnd.end[1] - lowEnd.end[1]);
    const length = along.length();
    along.normalize();
    const at = (distance: number, height: number): NavPoint => ({
      position: new Vector3(lowEnd.end[0], height, lowEnd.end[1]).addScaledVector(along, distance),
      building: lowEnd.building,
      level: 0,
    });
    const via = [
      at(0, lowEnd.height),
      at(length - 1.4, lowEnd.height),
      { ...at(length, highEnd.height), building: highEnd.building },
    ];
    link(lowEnd.node, highEnd.node, via);
  }

  for (const net of storeyNets.values()) net.finish();

  /**
   * Joins a workstation to the network at the spot a visitor would stand: beside and just
   * behind the chair, approached along the open lane behind the row of desks.
   */
  function addStation(
    station: WorkstationModel,
    roomInside: Node | undefined,
    net: CorridorNet,
    toWorld: (local: GroundPoint, level: number) => NavPoint,
    level: number,
    building: GroundRect,
  ): void {
    if (station.occupant === 'free') return;
    const forward = new Vector3(Math.sin(station.heading), 0, Math.cos(station.heading));
    const right = new Vector3(Math.cos(station.heading), 0, -Math.sin(station.heading));
    const seat = new Vector3(station.position[0], 0, station.position[1]);

    const side = station.kind === 'executive' ? 1.3 : station.kind === 'standing' ? 1.0 : 0.9;
    const back = station.kind === 'standing' ? 0 : 0.55;
    const standing = seat.clone().addScaledVector(forward, -back).addScaledVector(right, -side);
    const local = (point: Vector3): GroundPoint => toLocal(building, [point.x, point.z]);
    const visitor = addNode(toWorld(local(standing), level));
    const facing = Math.atan2(seat.x - standing.x, seat.z - standing.z);
    places.set(station.entity.id, { node: visitor, facing });

    if (!roomInside) {
      net.attach(visitor);
      return;
    }
    // From the door, turn into the lane behind the chairs (desks), or walk up the side
    // of the desk first (executive desks, whose back is against the credenza).
    const door = roomInside.point.position;
    const corner =
      station.kind === 'executive'
        ? standing.clone().addScaledVector(forward, -forward.dot(standing.clone().sub(door)))
        : standing.clone().addScaledVector(right, right.dot(door.clone().sub(standing)));
    const cornerNode = addNode(toWorld(local(corner), level));
    link(roomInside, cornerNode);
    link(cornerNode, visitor);
  }

  return {
    route(from, to) {
      const start = places.get(from)?.node;
      const goal = places.get(to)?.node;
      if (!start || !goal) return null;
      const path = shortestPath(nodes.length, edges, start.id, goal.id);
      if (!path) return null;
      const points: NavPoint[] = [start.point];
      for (const step of path) {
        points.push(...step.via, nodes[step.to]!.point);
      }
      return points;
    },
    visit(place) {
      const found = places.get(place);
      return found ? { point: found.node.point, facing: found.facing } : null;
    },
  };
}

// ---------------------------------------------------------------------------------------

/**
 * The corridors of one storey. Points attached to it are joined to their nearest spot on
 * a corridor line; once everything is attached, `finish` links the spots along each line
 * in order, so walking along a corridor passes each door rather than detouring.
 */
class CorridorNet {
  private readonly lines: { points: Node[]; stops: { distance: number; node: Node }[] }[] = [];

  constructor(
    private readonly addNode: (point: NavPoint) => Node,
    private readonly link: (a: Node, b: Node) => void,
    private readonly toWorld: (local: GroundPoint) => NavPoint,
  ) {}

  addLine(line: readonly GroundPoint[]): void {
    const points = line.map((point) => this.addNode(this.toWorld(point)));
    let distance = 0;
    const stops = points.map((node, index) => {
      if (index > 0) distance += node.point.position.distanceTo(points[index - 1]!.point.position);
      return { distance, node };
    });
    this.lines.push({ points, stops });
  }

  attach(node: Node): void {
    let best: { line: number; distance: number; point: Vector3; gap: number } | null = null;
    for (const [index, line] of this.lines.entries()) {
      const spot = nearestOnLine(line.points, node.point.position);
      if (spot && (!best || spot.gap < best.gap)) best = { line: index, ...spot };
    }
    if (!best) return;
    const spot = this.addNode({ ...node.point, position: best.point.setY(node.point.position.y) });
    this.lines[best.line]!.stops.push({ distance: best.distance, node: spot });
    this.link(node, spot);
  }

  finish(): void {
    // Where a line ends on another (a side aisle meeting the main one), they join.
    for (const line of this.lines) {
      for (const end of [line.points[0], line.points[line.points.length - 1]]) {
        if (!end) continue;
        for (const other of this.lines) {
          if (other === line) continue;
          const spot = nearestOnLine(other.points, end.point.position);
          if (spot && spot.gap < JOIN_DISTANCE)
            other.stops.push({ distance: spot.distance, node: end });
        }
      }
    }
    for (const line of this.lines) {
      line.stops.sort((a, b) => a.distance - b.distance);
      for (let index = 1; index < line.stops.length; index += 1) {
        this.link(line.stops[index - 1]!.node, line.stops[index]!.node);
      }
    }
  }
}

/** Lines whose ends come this close to another line are joined to it. */
const JOIN_DISTANCE = 0.6;

/** The nearest point on a polyline, its distance along the line and its gap from `point`. */
function nearestOnLine(
  line: readonly Node[],
  point: Vector3,
): { distance: number; point: Vector3; gap: number } | null {
  let best: { distance: number; point: Vector3; gap: number } | null = null;
  let travelled = 0;
  for (let index = 1; index < line.length; index += 1) {
    const a = line[index - 1]!.point.position;
    const b = line[index]!.point.position;
    const segment = b.clone().sub(a);
    const length = segment.length();
    if (length === 0) continue;
    const t = Math.max(0, Math.min(1, point.clone().sub(a).dot(segment) / (length * length)));
    const spot = a.clone().addScaledVector(segment, t);
    const gap = Math.hypot(spot.x - point.x, spot.z - point.z);
    if (!best || gap < best.gap) best = { distance: travelled + t * length, point: spot, gap };
    travelled += length;
  }
  return best;
}

/** Dijkstra over the network; returns the edges walked, in order. */
function shortestPath(
  count: number,
  edges: ReadonlyMap<number, readonly Edge[]>,
  start: number,
  goal: number,
): Edge[] | null {
  const cost = new Array<number>(count).fill(Infinity);
  const previous = new Array<{ from: number; edge: Edge } | null>(count).fill(null);
  const done = new Set<number>();
  cost[start] = 0;
  for (;;) {
    let current = -1;
    for (let index = 0; index < count; index += 1) {
      if (
        !done.has(index) &&
        cost[index]! < Infinity &&
        (current < 0 || cost[index]! < cost[current]!)
      ) {
        current = index;
      }
    }
    if (current < 0) return null;
    if (current === goal) break;
    done.add(current);
    for (const edge of edges.get(current) ?? []) {
      const next = cost[current]! + edge.cost;
      if (next < cost[edge.to]!) {
        cost[edge.to] = next;
        previous[edge.to] = { from: current, edge };
      }
    }
  }
  const path: Edge[] = [];
  for (let at = goal; at !== start;) {
    const step = previous[at];
    if (!step) return null;
    path.unshift(step.edge);
    at = step.from;
  }
  return path;
}

/** Points just inside and just outside the middle of a room's door. */
function doorPoints(room: RoomModel): { inside: GroundPoint; outside: GroundPoint } | null {
  if (!room.door) return null;
  const { depth } = roomFrame(room);
  return {
    inside: fromRoomFrame(room, 0, depth / 2 - DOOR_CLEARANCE),
    outside: fromRoomFrame(room, 0, depth / 2 + DOOR_CLEARANCE),
  };
}

function contains(rect: GroundRect, [x, z]: GroundPoint): boolean {
  return (
    Math.abs(x - rect.center[0]) <= rect.size[0] / 2 &&
    Math.abs(z - rect.center[1]) <= rect.size[1] / 2
  );
}

function toLocal(building: GroundRect, [x, z]: GroundPoint): GroundPoint {
  return [x - building.center[0], z - building.center[1]];
}

function localToWorld(
  building: GroundRect,
  height: (level: number) => number,
  id: string,
): (local: GroundPoint, level: number) => NavPoint {
  return ([x, z], level) => ({
    position: new Vector3(building.center[0] + x, height(level), building.center[1] + z),
    building: id,
    level,
  });
}
