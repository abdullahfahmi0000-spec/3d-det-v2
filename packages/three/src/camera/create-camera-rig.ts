import {
  Box3,
  CatmullRomCurve3,
  MathUtils,
  MOUSE,
  Sphere,
  Vector3,
  type PerspectiveCamera,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createKeyboardNavigation } from './keyboard-navigation';

export interface CameraRig {
  update(deltaSeconds: number): void;
  /**
   * Glides the camera to frame `bounds`; `onSettled` runs when it arrives. With `pitch`
   * (radians down from the horizontal) the camera also tilts to that angle, keeping its
   * heading; without it, the viewing direction is kept.
   */
  frame(bounds: Box3, options?: FrameOptions): void;
  /** Glides back to the opening view. */
  reset(onSettled?: () => void): void;
  /** Replaces the opening view, such as once the twin's extent is known. */
  setHome(position: Vector3, target: Vector3): void;
  /**
   * Moves the camera along a path, as someone walking it would see: through every point
   * in turn, looking a few metres ahead, then easing onto `finish`. The view cannot be
   * dragged meanwhile. Returns the seconds it takes.
   */
  glide(points: readonly Vector3[], options: GlideOptions): number;
  /** Holds a glide where it is, or lets it carry on. */
  pauseGlide(paused: boolean): void;
  /**
   * Map mode, for the top view: left-drag pans, the wheel zooms, and the view does not
   * rotate or tilt.
   */
  setMapMode(enabled: boolean): void;
  /** Flies straight to a camera position and target. */
  moveTo(position: Vector3, target: Vector3, onSettled?: () => void): void;
  dispose(): void;
}

export interface CameraRigOptions {
  readonly home: { readonly position: Vector3; readonly target: Vector3 };
}

export interface FrameOptions {
  readonly pitch?: number;
  /** Multiplies the distance that just fits the bounds; below 1 crops in tighter. */
  readonly zoom?: number;
  /** Direction the camera looks from, in radians around Y; kept as it is when omitted. */
  readonly heading?: number;
  /**
   * Share of the view, across and down, that is not covered by the host page's panels.
   * The bounds are fitted into that share instead of the whole view.
   */
  readonly visible?: { readonly x: number; readonly y: number };
  readonly onSettled?: () => void;
}

export interface GlideOptions {
  /** Metres per second along the path. */
  readonly speed: number;
  /** Long paths speed up so they take no longer than this. */
  readonly maxSeconds?: number;
  /** Where the camera ends up and what it looks at once it arrives. */
  readonly finish: { readonly position: Vector3; readonly target: Vector3 };
  readonly onArrive?: () => void;
}

interface Glide {
  readonly curve: CatmullRomCurve3;
  readonly length: number;
  readonly seconds: number;
  readonly startTarget: Vector3;
  readonly finish: GlideOptions['finish'];
  readonly onArrive: (() => void) | undefined;
  elapsed: number;
  /** Direction the camera faces while gliding, in radians around Y. */
  heading: number;
}

const FLIGHT_SECONDS = 1.1;
/** How far ahead a gliding camera looks, and how far below its own height. */
const GLIDE_LOOK = { ahead: 5, drop: 0.7, minFlat: 0.8, turnRate: 1.5 } as const;
const MIN_GLIDE_SECONDS = 2.5;
/** In map mode the camera stays within this angle of straight down. */
export const MAP_TILT = 0.02;
const MIN_FRAMING_DISTANCE = 9;

interface Flight {
  readonly fromPosition: Vector3;
  readonly fromTarget: Vector3;
  readonly toPosition: Vector3;
  readonly toTarget: Vector3;
  readonly onSettled: (() => void) | undefined;
  elapsed: number;
}

/**
 * Combines mouse orbit/zoom/pan (OrbitControls), arrow-key navigation and animated
 * framing of a target. Pressing an arrow key cancels a flight in progress.
 */
export function createCameraRig(
  camera: PerspectiveCamera,
  domElement: HTMLElement,
  options: CameraRigOptions,
): CameraRig {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = MathUtils.degToRad(85);
  controls.minDistance = 4;
  controls.maxDistance = 650;
  controls.screenSpacePanning = false;

  const home = { position: options.home.position.clone(), target: options.home.target.clone() };
  camera.position.copy(home.position);
  controls.target.copy(home.target);
  controls.update();

  const keyboard = createKeyboardNavigation(camera, controls.target);
  let flight: Flight | null = null;
  let glide: Glide | null = null;
  let gliding = false;

  const smooth = (edge0: number, edge1: number, x: number): number => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  const advanceGlide = (deltaSeconds: number): void => {
    if (!glide || gliding === false) return;
    glide.elapsed += deltaSeconds;
    const time = Math.min(glide.elapsed / glide.seconds, 1);
    // Ease in and out, steady in between.
    const progress = smooth(0, 1, time) * 0.25 + time * 0.75;
    const distance = progress * glide.length;
    glide.curve.getPointAt(progress, camera.position);

    // Look the way the path leads on the level, turning no faster than a person turns their
    // head: on a stair the camera rises straight up the well and keeps facing forward.
    const ahead = glide.curve.getPointAt(Math.min(1, (distance + GLIDE_LOOK.ahead) / glide.length));
    const flat = ahead.sub(camera.position).setY(0);
    if (flat.lengthSq() > GLIDE_LOOK.minFlat ** 2) {
      let turn = Math.atan2(flat.x, flat.z) - glide.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      const limit = GLIDE_LOOK.turnRate * deltaSeconds;
      glide.heading += Math.max(-limit, Math.min(limit, turn));
    }
    const look = camera.position
      .clone()
      .add(
        new Vector3(Math.sin(glide.heading), 0, Math.cos(glide.heading)).multiplyScalar(
          GLIDE_LOOK.ahead,
        ),
      )
      .setY(camera.position.y - GLIDE_LOOK.drop);
    const target = glide.startTarget
      .clone()
      .lerp(look, smooth(0, 0.15, time))
      .lerp(glide.finish.target, smooth(0.72, 1, time));
    controls.target.copy(target);

    if (time === 1) {
      const arrived = glide.onArrive;
      glide = null;
      controls.enabled = true;
      arrived?.();
    }
  };

  const flyTo = (toPosition: Vector3, toTarget: Vector3, onSettled?: () => void): void => {
    flight = {
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPosition,
      toTarget,
      onSettled,
      elapsed: 0,
    };
  };

  const advanceFlight = (deltaSeconds: number): void => {
    if (!flight) return;
    flight.elapsed += deltaSeconds;
    const progress = Math.min(flight.elapsed / FLIGHT_SECONDS, 1);
    const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;

    camera.position.lerpVectors(flight.fromPosition, flight.toPosition, eased);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);

    if (progress === 1) {
      const settled = flight.onSettled;
      flight = null;
      settled?.();
    }
  };

  return {
    update(deltaSeconds) {
      if (glide) {
        advanceGlide(deltaSeconds);
      } else {
        if (keyboard.update(deltaSeconds)) flight = null;
        advanceFlight(deltaSeconds);
      }
      controls.update();
    },
    glide(points, glideOptions) {
      flight = null;
      const curve = new CatmullRomCurve3(
        [camera.position.clone(), ...points, glideOptions.finish.position.clone()],
        false,
        'centripetal',
        0.4,
      );
      const length = curve.getLength();
      const speed = Math.max(glideOptions.speed, length / (glideOptions.maxSeconds ?? Infinity));
      const seconds = Math.max(MIN_GLIDE_SECONDS, length / speed);
      glide = {
        curve,
        length,
        seconds,
        startTarget: controls.target.clone(),
        finish: glideOptions.finish,
        onArrive: glideOptions.onArrive,
        elapsed: 0,
        heading: Math.atan2(
          controls.target.x - camera.position.x,
          controls.target.z - camera.position.z,
        ),
      };
      gliding = true;
      controls.enabled = false;
      return seconds;
    },
    setMapMode(enabled) {
      controls.enableRotate = !enabled;
      controls.mouseButtons.LEFT = enabled ? MOUSE.PAN : MOUSE.ROTATE;
      controls.screenSpacePanning = enabled;
      controls.maxPolarAngle = enabled ? MAP_TILT : MathUtils.degToRad(85);
    },
    pauseGlide(paused) {
      gliding = !paused;
    },
    moveTo(position, target, onSettled) {
      glide = null;
      controls.enabled = true;
      flyTo(position.clone(), target.clone(), onSettled);
    },
    frame(bounds, frameOptions = {}) {
      glide = null;
      controls.enabled = true;
      const sphere = bounds.getBoundingSphere(new Sphere());
      // With a view offset the window shows only part of the full frustum.
      const view = camera.view?.enabled ? camera.view : null;
      const tanY =
        Math.tan(MathUtils.degToRad(camera.fov / 2)) * (view ? view.height / view.fullHeight : 1);
      const aspect = view ? view.width / view.height : camera.aspect;
      const visible = frameOptions.visible ?? { x: 1, y: 1 };
      // Fit the narrower of the two fields of view, so wide screens do not crop the sides.
      const halfFovY = Math.atan(tanY * visible.y);
      const halfFovX = Math.atan(tanY * aspect * visible.x);
      const fit = sphere.radius / Math.sin(Math.min(halfFovY, halfFovX));
      const distance = Math.max(fit * (frameOptions.zoom ?? 1), MIN_FRAMING_DISTANCE);

      // Keep the current heading so the flight feels like a zoom, not a jump.
      const direction = camera.position.clone().sub(controls.target).normalize();
      if (frameOptions.pitch !== undefined) {
        const heading = frameOptions.heading ?? Math.atan2(direction.x, direction.z);
        const pitch = frameOptions.pitch;
        direction.set(
          Math.sin(heading) * Math.cos(pitch),
          Math.sin(pitch),
          Math.cos(heading) * Math.cos(pitch),
        );
      }
      flyTo(
        sphere.center.clone().addScaledVector(direction, distance),
        sphere.center.clone(),
        frameOptions.onSettled,
      );
    },
    reset(onSettled) {
      glide = null;
      controls.enabled = true;
      flyTo(home.position.clone(), home.target.clone(), onSettled);
    },
    setHome(position, target) {
      home.position.copy(position);
      home.target.copy(target);
    },
    dispose() {
      keyboard.dispose();
      controls.dispose();
    },
  };
}
