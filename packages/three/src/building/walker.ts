import type { Vector3 } from 'three';

/**
 * Someone walking through the buildings, as the doors see them: where they are, and the
 * whole walk they are on. Doors open for a walk that goes through them, not for someone
 * passing by.
 */
export interface Walker {
  /** Where they are, at their feet. */
  readonly position: Vector3;
  /** The whole walk under way, from where it started to where it ends; empty when standing. */
  readonly route: readonly Vector3[];
}

/** How close to the middle of a doorway a walk must pass to go through it. */
const THROUGH = 0.8;
/** How far above or below a doorway's floor a walk can be and still be on its storey. */
const STOREY_REACH = 1.5;

/** Whether a walk passes through the doorway at `at`, on the doorway's storey. */
export function passesThrough(at: Vector3, route: readonly Vector3[]): boolean {
  for (let index = 1; index < route.length; index += 1) {
    const a = route[index - 1]!;
    const b = route[index]!;
    if (Math.abs(a.y - at.y) >= STOREY_REACH || Math.abs(b.y - at.y) >= STOREY_REACH) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz;
    const t =
      lengthSq < 1e-9
        ? 0
        : Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.z - a.z) * dz) / lengthSq));
    if (Math.hypot(a.x + dx * t - at.x, a.z + dz * t - at.z) < THROUGH) return true;
  }
  return false;
}

/** Whether a walker is at a doorway (within `reach` across the floor) on a walk through it. */
export function isComingThrough(walker: Walker, at: Vector3, reach: number): boolean {
  const { position } = walker;
  return (
    Math.hypot(position.x - at.x, position.z - at.z) < reach &&
    Math.abs(position.y - at.y) < STOREY_REACH &&
    passesThrough(at, walker.route)
  );
}
