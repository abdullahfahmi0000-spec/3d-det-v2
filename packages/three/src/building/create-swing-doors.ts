import {
  Box3,
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type Material,
  type Object3D,
} from 'three';

import { isComingThrough, type Walker } from './walker';

/**
 * The timber doors of the glazed rooms. They stay shut, and swing open into the room as
 * someone walking a route through them reaches them, then close behind them.
 */

/** Where a door hangs, as `buildRoom` records it: its hinge, shut, in the floor's frame. */
export interface DoorSpot {
  /** The hinge at floor level; the leaf reaches along the matrix's +X when shut. */
  readonly hinge: Matrix4;
  readonly width: number;
  readonly height: number;
  /** How far it turns to open, in radians; it opens towards its local -Z. */
  readonly swing: number;
}

export interface SwingDoors {
  readonly root: Group;
  readonly count: number;
  /** The leaves themselves, for a camera to keep in front of. */
  readonly leaves: readonly Object3D[];
  /** How far each door is open, from 0 (shut) to 1. */
  openness(): number[];
  /**
   * The room each leaf takes up when open, in world coordinates, for walks to go round.
   * The world matrices must be up to date.
   */
  openBoxes(): Box3[];
  update(deltaSeconds: number, walkers: readonly Walker[]): void;
  dispose(): void;
}

/**
 * How near across the floor a walker on a route through a door must be for it to open, and
 * how far past it they go before it shuts: far enough for a camera following a few steps
 * behind them to come through too.
 */
const REACH = 4;
const KEEP_OPEN = 7;
/** Seconds from shut to fully open: open before even a fast walk (5x) reaches it. */
const OPEN_SECONDS = 0.35;
const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);

export function createSwingDoors(spots: readonly DoorSpot[], leaf: Material): SwingDoors {
  const root = new Group();
  root.name = 'room-doors';
  const geometries = new Map<string, BoxGeometry>();

  const doors = spots.map((spot) => {
    const key = `${spot.width}x${spot.height}`;
    let geometry = geometries.get(key);
    if (!geometry) {
      geometry = new BoxGeometry(spot.width, spot.height, 0.04).translate(
        spot.width / 2,
        spot.height / 2,
        0,
      );
      geometries.set(key, geometry);
    }
    const pivot = new Group();
    const position = new Vector3();
    const rotation = new Quaternion();
    spot.hinge.decompose(position, rotation, new Vector3());
    pivot.position.copy(position);
    pivot.quaternion.copy(rotation);
    const mesh = new Mesh(geometry, leaf);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
    root.add(pivot);
    // Turned as a quaternion: a wall turned half round reads back as Euler angles of
    // (pi, 0, pi), on which adding to `rotation.y` would swing the door the wrong way.
    return { pivot, spot, shut: rotation, open: 0, centre: null as Vector3 | null };
  });

  const swing = new Quaternion();
  return {
    root,
    count: doors.length,
    leaves: doors.map((door) => door.pivot.children[0]!),
    openness: () => doors.map((door) => door.open),
    openBoxes: () =>
      doors.map((door) => {
        const open = door.shut.clone().multiply(swing.setFromAxisAngle(UP, door.spot.swing));
        const local = new Matrix4().compose(door.pivot.position, open, ONE);
        return new Box3(
          new Vector3(0, 0, -0.02),
          new Vector3(door.spot.width, door.spot.height, 0.02),
        ).applyMatrix4(local.premultiply(root.matrixWorld));
      }),
    update(deltaSeconds, walkers) {
      const step = deltaSeconds / OPEN_SECONDS;
      for (const door of doors) {
        // The middle of the doorway, in the world, measured once while the door is shut.
        if (door.centre === null) {
          door.pivot.updateWorldMatrix(true, false);
          door.centre = new Vector3(door.spot.width / 2, 0, 0).applyMatrix4(door.pivot.matrixWorld);
        }
        const at = door.centre;
        const reach = door.open > 0 ? KEEP_OPEN : REACH;
        const wanted = walkers.some((walker) => isComingThrough(walker, at, reach)) ? 1 : 0;
        if (door.open === wanted) continue;
        door.open =
          wanted > door.open ? Math.min(1, door.open + step) : Math.max(0, door.open - step);
        const eased = door.open * door.open * (3 - 2 * door.open);
        door.pivot.quaternion
          .copy(door.shut)
          .multiply(swing.setFromAxisAngle(UP, door.spot.swing * eased));
      }
    },
    dispose() {
      geometries.forEach((geometry) => geometry.dispose());
      root.removeFromParent();
    },
  };
}
