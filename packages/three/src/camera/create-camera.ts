import { PerspectiveCamera } from 'three';

export interface CameraOptions {
  readonly fov?: number;
  readonly aspect?: number;
  readonly near?: number;
  readonly far?: number;
}

/**
 * Builds the viewer camera. Framing distances are solved from the camera's own field of
 * view and aspect ratio rather than from tuned constants, so a non-square site frames
 * correctly.
 */
export function createCamera(options: CameraOptions = {}): PerspectiveCamera {
  const camera = new PerspectiveCamera(
    options.fov ?? 55,
    options.aspect ?? 1,
    options.near ?? 0.1,
    options.far ?? 2000,
  );
  camera.position.set(12, 9, 16);
  camera.lookAt(0, 0, 0);
  return camera;
}

/** Vertical distance required to frame `height` metres at the camera's field of view. */
export function distanceToFrame(camera: PerspectiveCamera, height: number): number {
  const halfFovRadians = (camera.fov * Math.PI) / 360;
  return height / 2 / Math.tan(halfFovRadians);
}
