import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';

import type { Walker } from '../building/walker';
import { createCharacter, type CharacterModel } from './create-character';

/**
 * The process avatar (SRS AVT-01, 3DV-07): a person who follows the order from the desk of
 * one step to the desk of the next, along the walking network's route through doors,
 * corridors, stairs and walkways. Between desks the order travels in the systems, so it walks
 * empty-handed; it carries the order itself, as a document folder, only when told to (to the
 * lorry that ships the goods).
 *
 * Drawn by an animated character (see `create-character.ts`) with its recorded clips: Walk
 * while it walks, Idle while it waits, Talk with the person at a desk once there. Forward is
 * +Z. It is also a `Walker`, so the doors on its way open for it.
 */
export interface ProcessAvatar {
  /** Add this to the scene; it is placed in world coordinates. */
  readonly root: Group;
  /** Whether a walk is under way. */
  readonly walking: boolean;
  /** The clip playing now, such as 'Walk'. */
  readonly clip: string | null;
  /** Where it is and the walk it is on, for the doors. */
  readonly walker: Walker;
  /** Whether it carries the order in its hand. */
  readonly carrying: boolean;
  /**
   * Stands it at a spot, facing `facing` (radians, 0 is +Z), playing `clip` (Idle unless
   * told otherwise), and drops any walk.
   */
  placeAt(position: Vector3, facing: number, clip?: 'Talk' | 'Idle'): void;
  /** Puts the order in its hand, as a folder, or takes it away. Empty-handed at first. */
  setCarrying(carrying: boolean): void;
  /**
   * Walks it along `points`, from the first to the last; it turns to `facing` once there
   * and `onArrive` runs. With `maxSeconds`, long walks are walked faster so that none takes
   * longer. Returns the seconds the walk takes.
   */
  walk(points: readonly Vector3[], options?: WalkOptions): number;
  /**
   * How fast it walks, as a multiple of a real walking pace (1, the default). The
   * animation speeds up with it, and a walk under way changes pace at once.
   */
  setSpeed(multiplier: number): void;
  /** Holds a walk where it is, or lets it carry on. */
  setPaused(paused: boolean): void;
  hide(): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

export interface WalkOptions {
  /** Direction to face once there, in radians; kept as it arrives when omitted. */
  readonly facing?: number;
  readonly maxSeconds?: number;
  /** What to play once there: Talk (a word with whoever sits at the desk) by default. */
  readonly then?: 'Talk' | 'Idle';
  readonly onArrive?: () => void;
}

/**
 * Walking pace in m/s: the Walk clip's own, one stride every half cycle with its root
 * motion stripped, so the feet do not slide.
 */
export const WALK_SPEED = 1.73;
/** The fastest a walk is played, as a multiple of real time; beyond it, it runs long. */
const MAX_PACE = 3.5;
/** How fast it turns toward where it is going, in radians per second. */
const TURN_RATE = 6;
/** The bone the folder is held in, as GLTFLoader names a Mixamo rig's. */
const HAND = 'mixamorigRightHand';
const SUIT = 0x8fa9d9;

/** Shortest signed angle from `from` to `to`. */
function angleBetween(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function createProcessAvatar(model: CharacterModel): ProcessAvatar {
  const root = new Group();
  root.name = 'process-avatar';
  const character = createCharacter(model, { Suit: SUIT, Pants: SUIT });
  root.add(character.root);

  const folder = new Mesh(
    new BoxGeometry(0.035, 0.3, 0.23),
    new MeshStandardMaterial({ color: 0xe0a33a, roughness: 0.7 }),
  );
  folder.name = 'order-folder';
  folder.castShadow = true;
  folder.visible = false;
  const hand = character.part(HAND);
  if (hand) {
    // Held by its spine, hanging along the forearm. The hand bone is in the rig's
    // centimetres, so the folder is scaled back to metres.
    const scale = 1 / hand.getWorldScale(new Vector3()).x;
    folder.scale.setScalar(Number.isFinite(scale) ? scale : 1);
    folder.position.set(0, 8, 3);
    hand.add(folder);
  }

  let points: Vector3[] = [];
  /** Distance walked along `points`, and their running lengths. */
  let travelled = 0;
  let lengths: number[] = [];
  /** The speed asked for, the quickening a long walk is given, and the two together. */
  let speed = 1;
  let quicken = 1;
  let pace = 1;
  let paused = false;
  let heading = 0;
  let targetHeading = 0;
  let finalFacing: number | undefined;
  let then: 'Talk' | 'Idle' = 'Talk';
  let arrived: (() => void) | null = null;
  /** The walk under way, whole, for the doors; empty when standing. */
  let route: readonly Vector3[] = [];

  const walker: Walker = {
    position: root.position,
    get route() {
      return route;
    },
  };

  const stand = (clip: 'Talk' | 'Idle'): void => {
    character.play(character.has(clip) ? clip : 'Idle');
    character.setPace(1);
  };

  const stop = (): void => {
    points = [];
    lengths = [];
    travelled = 0;
    route = [];
    arrived = null;
    quicken = 1;
    pace = speed;
  };

  /** The point `distance` along the walk, and the direction there. */
  const along = (distance: number, at: Vector3): Vector3 => {
    let index = 1;
    while (index < lengths.length - 1 && lengths[index]! < distance) index += 1;
    const a = points[index - 1]!;
    const b = points[index]!;
    const span = lengths[index]! - lengths[index - 1]!;
    const t = span > 0 ? Math.min(1, Math.max(0, (distance - lengths[index - 1]!) / span)) : 1;
    at.lerpVectors(a, b, t);
    return b.clone().sub(a);
  };

  const place = (position: Vector3, facing: number): void => {
    stop();
    root.position.copy(position);
    heading = targetHeading = facing;
    finalFacing = undefined;
    root.rotation.y = facing;
    root.visible = true;
  };

  stand('Idle');
  root.visible = false;

  return {
    root,
    get walking() {
      return points.length > 0;
    },
    get clip() {
      return character.playing;
    },
    walker,
    get carrying() {
      return folder.visible;
    },
    placeAt(position, facing, clip = 'Idle') {
      place(position, facing);
      stand(clip);
    },
    setCarrying(carrying) {
      folder.visible = carrying;
    },
    walk(walkPoints, options = {}) {
      stop();
      const first = walkPoints[0];
      if (!first) return 0;
      // Carries on from where it stands if that is the start of the walk.
      if (!root.visible || root.position.distanceTo(first) > 0.5) root.position.copy(first);
      root.visible = true;
      points = walkPoints.map((point) => point.clone());
      lengths = [0];
      for (let index = 1; index < points.length; index += 1) {
        lengths.push(lengths[index - 1]! + points[index]!.distanceTo(points[index - 1]!));
      }
      const length = lengths[lengths.length - 1]!;
      route = points;
      finalFacing = options.facing;
      then = options.then ?? 'Talk';
      arrived = options.onArrive ?? null;
      const seconds = length / WALK_SPEED;
      quicken = Math.min(MAX_PACE, Math.max(1, seconds / (options.maxSeconds ?? Infinity)));
      pace = quicken * speed;
      if (length < 0.01) {
        const done = arrived;
        stop();
        if (finalFacing !== undefined) targetHeading = finalFacing;
        stand(then);
        done?.();
        return 0;
      }
      character.play('Walk');
      character.setPace(pace);
      return seconds / pace;
    },
    setSpeed(multiplier) {
      speed = Math.max(0.05, multiplier);
      pace = quicken * speed;
      if (points.length > 0) character.setPace(pace);
    },
    setPaused(next) {
      paused = next;
    },
    hide() {
      stop();
      root.visible = false;
    },
    update(deltaSeconds) {
      if (!root.visible || paused) return;
      if (points.length > 0) {
        const total = lengths[lengths.length - 1]!;
        travelled = Math.min(total, travelled + WALK_SPEED * pace * deltaSeconds);
        const direction = along(travelled, root.position);
        if (Math.hypot(direction.x, direction.z) > 0.05) {
          targetHeading = Math.atan2(direction.x, direction.z);
        }
        if (travelled >= total) {
          const done = arrived;
          stop();
          if (finalFacing !== undefined) targetHeading = finalFacing;
          // A word with whoever sits at the desk.
          stand(then);
          done?.();
        }
      }
      const turn = angleBetween(heading, targetHeading);
      heading += Math.sign(turn) * Math.min(Math.abs(turn), TURN_RATE * pace * deltaSeconds);
      root.rotation.y = heading;
      character.update(deltaSeconds);
    },
    dispose() {
      folder.geometry.dispose();
      folder.material.dispose();
      character.dispose();
      root.removeFromParent();
    },
  };
}
