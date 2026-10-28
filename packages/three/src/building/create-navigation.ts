import { Vector3, type Box3 } from 'three';

import type {
  GroundPoint,
  GroundRect,
  RoomModel,
  TwinViewModel,
  WorkstationModel,
} from '../viewer-contract/twin-model';
import { fromRoomFrame, insideFacade, roomFrame, stairLayout } from './create-room';
import { createWalkPlanner, WalkGrid, type WalkLink } from './create-walk-grid';
import { pointOnSide, sideFrame } from './frames';

/** A point on a walk, with the storey it is on so the view can follow the walker. */
export interface NavPoint {
  readonly position: Vector3;
  readonly building: string;
  readonly level: number;
}

export interface Navigation {
  /**
   * The shortest walk from one place to another: workstation entity ids, truck entity ids
   * or `entrance:<building>`. It goes round everything standing in the buildings
   * (furniture, walls, the leaves of open doors), keeping clear of them where there is room,
   * through doorways, up and down stairs and across walkways. Null when either place is
   * unknown or unreachable.
   */
  route(from: string, to: string): NavPoint[] | null;
  /** Where a visitor stands at a place, and the direction they face (radians, 0 is +Z). */
  visit(place: string): { readonly point: NavPoint; readonly facing: number } | null;
}

export interface NavigationInput {
  readonly model: TwinViewModel;
  /** Finished-floor height of a storey, by building entity id and level. */
  readonly elevation: (building: string, level: number) => number;
  /**
   * What stands in a building, by entity id, in world coordinates: the boxes of what it is
   * built of (see `solidsOf`).
   */
  readonly obstacles: (building: string) => readonly Box3[];
}

/** How far outside the doorway the building's entrance is. */
const DOOR_CLEARANCE = 0.75;
/** Where someone arriving by stair steps off it: this far in front of the top step. */
const STAIR_LANDING = 0.6;
/** How far inside a building a walkway's end is, past its door. */
const WALKWAY_INSIDE = 1.4;
/**
 * The steps at the high end of a walkway, up to the floor of the building there: how many,
 * and how deep each is. Shared with the walkway's geometry, so feet land on the steps.
 */
export const WALKWAY_STEPS = 3;
export const WALKWAY_TREAD = 0.4;

/**
 * Builds the walking of the twin from its model and what stands in its buildings: each
 * storey's floor as a grid to walk round things on (see `create-walk-grid.ts`), the stairs
 * between storeys and the walkways between buildings, and a standing point beside every
 * workstation and inside every loading dock. Routes are the shortest walks over them.
 */
export function createNavigation({ model, elevation, obstacles }: NavigationInput): Navigation {
  const places = new Map<string, { point: NavPoint; facing: number }>();
  const grids: WalkGrid[] = [];
  const links: WalkLink[] = [];

  const floorOf = (building: GroundRect, id: string, level: number): WalkGrid =>
    new WalkGrid(
      {
        building: id,
        level,
        elevation: elevation(id, level),
        minX: building.center[0] - building.size[0] / 2,
        maxX: building.center[0] + building.size[0] / 2,
        minZ: building.center[1] - building.size[1] / 2,
        maxZ: building.center[1] + building.size[1] / 2,
      },
      obstacles(id),
    );

  for (const office of model.offices) {
    const building = office.entity.id;
    const toWorld = localToWorld(office, (level) => elevation(building, level), building);

    for (const floor of office.floors) {
      grids.push(floorOf(office, building, floor.level));

      // The building's entrance is outside the lobby door, facing in.
      const lobby = floor.level === 0 && floor.rooms.find((room) => room.kind === 'lobby');
      const door = lobby ? doorPoints(insideFacade(lobby, office)) : null;
      if (door) {
        const outside = toWorld(door.outside, 0);
        const inward = toWorld(door.inside, 0).position.sub(outside.position);
        places.set(`entrance:${building}`, {
          point: outside,
          facing: Math.atan2(inward.x, inward.z),
        });
      }

      // Each stair climbs from in front of this floor's first flight to the floor above,
      // stepping off in front of its top step.
      const coreRoom = floor.rooms.find((room) => room.kind === 'core');
      const above = office.floors.find((candidate) => candidate.level === floor.level + 1);
      if (coreRoom && above) {
        const core = insideFacade(coreRoom, office);
        const stairs = stairLayout(core);
        const low = elevation(building, floor.level);
        const high = elevation(building, above.level);
        const middle = (low + high) / 2;
        // Every point on the stair belongs to the lower floor, which is the one opened up
        // while someone is on it (the floor above would hide the flights).
        const at = (x: number, z: number, height: number, level = floor.level): NavPoint => {
          const point = toWorld(fromRoomFrame(core, x, z), level);
          return { ...point, position: point.position.setY(height) };
        };
        // Each flight is walked along the line through the middle of its treads, so feet
        // land on steps.
        const half = stairs.going / 2;
        links.push({
          from: at(stairs.firstFlight, stairs.flightFront + STAIR_LANDING, low),
          via: [
            at(stairs.firstFlight, stairs.flightFront + half, low),
            at(stairs.firstFlight, stairs.flightBack + half, middle),
            at(stairs.firstFlight, stairs.back + 0.6, middle),
            at(stairs.secondFlight, stairs.back + 0.6, middle),
            at(stairs.secondFlight, stairs.flightBack - half, middle),
            at(stairs.secondFlight, stairs.flightFront - half, high),
          ],
          to: at(stairs.secondFlight, stairs.flightFront + STAIR_LANDING, high, above.level),
        });
      }

      for (const station of model.workstations) {
        if (station.building !== building || station.level !== floor.level) continue;
        addStation(station, toWorld, floor.level, office);
      }
    }
  }

  for (const hall of model.halls) {
    const building = hall.entity.id;
    const toWorld = localToWorld(hall, () => elevation(building, 0), building);
    grids.push(floorOf(hall, building, 0));

    // A visitor waits just inside the dock door, facing the truck outside.
    const [width, depth] = hall.size;
    const facingOut = sideFrame(hall.dockSide, width, depth, 0).place[3];
    for (const dock of hall.docks) {
      if (!dock.truck) continue;
      places.set(dock.truck.entity.id, {
        point: toWorld(pointOnSide(hall.dockSide, width, depth, dock.offset, -2.2), 0),
        facing: facingOut,
      });
    }

    for (const station of model.workstations) {
      if (station.building !== building) continue;
      addStation(station, toWorld, 0, hall);
    }
  }

  // Walkways run between doors of the buildings at either end, flat at the lower floor's
  // height, then a few steps up at the end.
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
      const inside = new Vector3(end[0], height, end[1]).addScaledVector(direction, WALKWAY_INSIDE);
      return { point: { position: inside, building, level: 0 }, end, height, building };
    });
    const [start, finish] = ends;
    if (!start || !finish) continue;
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
    // Up the steps through the middle of each.
    const rise = (highEnd.height - lowEnd.height) / WALKWAY_STEPS;
    const steps = Array.from({ length: WALKWAY_STEPS }, (_, index) =>
      at(
        length - (WALKWAY_STEPS - index - 0.5) * WALKWAY_TREAD,
        lowEnd.height + rise * (index + 1),
      ),
    );
    links.push({
      from: lowEnd.point,
      via: [
        at(0, lowEnd.height),
        at(length - WALKWAY_STEPS * WALKWAY_TREAD - 0.2, lowEnd.height),
        ...steps,
        { ...at(length, highEnd.height), building: highEnd.building },
      ],
      to: highEnd.point,
    });
  }

  const planner = createWalkPlanner(grids, links);

  /**
   * The spot a visitor to a workstation stands at: beside and just behind the chair,
   * facing the seat.
   */
  function addStation(
    station: WorkstationModel,
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
    places.set(station.entity.id, {
      point: toWorld(toLocal(building, [standing.x, standing.z]), level),
      facing: Math.atan2(seat.x - standing.x, seat.z - standing.z),
    });
  }

  return {
    route(from, to) {
      const start = places.get(from);
      const goal = places.get(to);
      if (!start || !goal) return null;
      return planner.route(start.point, goal.point);
    },
    visit(place) {
      const found = places.get(place);
      return found
        ? {
            point: { ...found.point, position: found.point.position.clone() },
            facing: found.facing,
          }
        : null;
    },
  };
}

// ---------------------------------------------------------------------------------------

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
