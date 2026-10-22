import { Raycaster, Vector2, type Camera, type Object3D } from 'three';

import type { EntityRef } from '../viewer-contract/events';

export interface Picker {
  dispose(): void;
}

export type PickHandler = (entity: EntityRef | null, object: Object3D | null) => void;

/** Pointer travel, in pixels, beyond which a press counts as a drag rather than a click. */
const CLICK_TOLERANCE = 5;

/**
 * Turns clicks on the canvas into picks. An object is pickable when it, or one of its
 * ancestors, carries `userData.selectable` with an entity reference; drags (camera
 * orbiting) are ignored. Hidden objects (a floor cut away) and see-through surfaces marked
 * `userData.pickThrough` (glazing) never stop a click.
 */
export function createPicker(
  element: HTMLElement,
  camera: Camera,
  roots: () => readonly Object3D[],
  onPick: PickHandler,
): Picker {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let pressedAt: { x: number; y: number } | null = null;

  const onPointerDown = (event: PointerEvent): void => {
    pressedAt = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!pressedAt) return;
    const travel = Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y);
    pressedAt = null;
    if (travel > CLICK_TOLERANCE) return;

    const rect = element.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);

    for (const hit of raycaster.intersectObjects([...roots()], true)) {
      if (hit.object.userData.pickThrough || !isShown(hit.object)) continue;
      const selectable = findSelectable(hit.object);
      if (selectable) {
        onPick(selectable.userData.selectable as EntityRef, selectable);
        return;
      }
    }
    onPick(null, null);
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointerup', onPointerUp);

  return {
    dispose() {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointerup', onPointerUp);
    },
  };
}

function findSelectable(object: Object3D): Object3D | null {
  for (let current: Object3D | null = object; current; current = current.parent) {
    if (current.userData.selectable) return current;
  }
  return null;
}

/** Three.js raycasts hidden objects too, so visibility is checked up the hierarchy. */
function isShown(object: Object3D): boolean {
  for (let current: Object3D | null = object; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
}
