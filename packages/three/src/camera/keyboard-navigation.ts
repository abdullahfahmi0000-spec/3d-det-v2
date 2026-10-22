import { Vector3, type PerspectiveCamera } from 'three';

export interface KeyboardNavigationOptions {
  /** Forward/back speed in metres per second. */
  readonly moveSpeed?: number;
  /** Turn speed in radians per second. */
  readonly turnSpeed?: number;
}

export interface KeyboardNavigation {
  /**
   * Advances the camera by `deltaSeconds` according to the keys currently held.
   * Returns true when the camera moved.
   */
  update(deltaSeconds: number): boolean;
  /** Removes the keyboard listeners. */
  dispose(): void;
}

const NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const UP = new Vector3(0, 1, 0);

/** Arrow keys inside a form field belong to that field, not to the camera. */
function isFormField(target: EventTarget | null): boolean {
  return (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
  );
}

/**
 * Arrow-key navigation around a look-at point: Up/Down move the camera and the point it
 * looks at along the view direction on the ground plane, Left/Right turn the view in place.
 * Height is kept, so the camera glides over the scene. Movement is frame-rate independent.
 */
export function createKeyboardNavigation(
  camera: PerspectiveCamera,
  lookAt: Vector3,
  eventTarget: EventTarget = window,
  options: KeyboardNavigationOptions = {},
): KeyboardNavigation {
  const moveSpeed = options.moveSpeed ?? 30;
  const turnSpeed = options.turnSpeed ?? 1.2;
  const pressed = new Set<string>();
  const forward = new Vector3();
  const offset = new Vector3();

  const onKeyDown = (event: Event): void => {
    const { key } = event as KeyboardEvent;
    if (!NAVIGATION_KEYS.has(key) || isFormField(event.target)) return;
    event.preventDefault();
    pressed.add(key);
  };
  const onKeyUp = (event: Event): void => {
    pressed.delete((event as KeyboardEvent).key);
  };
  const onBlur = (): void => pressed.clear();

  eventTarget.addEventListener('keydown', onKeyDown);
  eventTarget.addEventListener('keyup', onKeyUp);
  eventTarget.addEventListener('blur', onBlur);

  const axis = (positive: string, negative: string): number =>
    Number(pressed.has(positive)) - Number(pressed.has(negative));

  return {
    update(deltaSeconds) {
      const turn = axis('ArrowLeft', 'ArrowRight');
      const move = axis('ArrowUp', 'ArrowDown');
      if (turn === 0 && move === 0) return false;

      if (turn !== 0) {
        offset
          .subVectors(lookAt, camera.position)
          .applyAxisAngle(UP, turn * turnSpeed * deltaSeconds);
        lookAt.addVectors(camera.position, offset);
      }

      if (move !== 0) {
        forward.subVectors(lookAt, camera.position).setY(0).normalize();
        forward.multiplyScalar(move * moveSpeed * deltaSeconds);
        camera.position.add(forward);
        lookAt.add(forward);
      }

      camera.lookAt(lookAt);
      return true;
    },
    dispose() {
      eventTarget.removeEventListener('keydown', onKeyDown);
      eventTarget.removeEventListener('keyup', onKeyUp);
      eventTarget.removeEventListener('blur', onBlur);
      pressed.clear();
    },
  };
}
