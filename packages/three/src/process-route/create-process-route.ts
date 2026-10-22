import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  QuadraticBezierCurve3,
  RepeatWrapping,
  RingGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  type Texture,
} from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { createLabel, detachLabels, updateLabel } from '../overlays/create-label';
import type { ProcessNodeState, RouteModel } from '../viewer-contract/twin-model';
import { isTravelled, NODE_STYLES } from './node-style';

export interface ProcessRoute {
  readonly root: Group;
  /**
   * Redraws the route; `anchors` gives the world point of each stop's anchor. Stops whose
   * anchor is in `labelled` already show on that anchor's own label, so they get no label
   * of their own.
   */
  setRoute(
    route: RouteModel,
    anchors: ReadonlyMap<string, Vector3>,
    labelled?: ReadonlySet<string>,
  ): void;
  /** Animates the route; stop labels shrink to their marker when the camera is far. */
  update(elapsed: number, cameraPosition: Vector3): void;
  dispose(): void;
}

const TUBE_RADIUS = 0.08;
const FLOW_SPEED = 0.6;
/** Height of the order card above its stop, clear of the person's own label. */
const BADGE_LIFT = 5.5;
/** Beyond this distance a stop shows only its numbered marker. */
const COMPACT_DISTANCE = 70;

interface Leg {
  readonly mesh: Mesh<TubeGeometry, MeshBasicMaterial>;
  readonly texture: Texture | null;
  readonly curve: QuadraticBezierCurve3;
}

interface Stop {
  readonly ring: Mesh<RingGeometry, MeshBasicMaterial>;
  readonly state: ProcessNodeState;
}

/**
 * Draws the path one order takes through the building: an arc from desk to desk for each
 * hand-over, a numbered marker at each stop and the order card over the current one.
 *
 * Arcs are drawn over the building (no depth test), like a route on a map, so the path
 * stays readable when it runs between floors. Travelled legs carry moving chevrons.
 */
export function createProcessRoute(): ProcessRoute {
  const root = new Group();
  root.name = 'process-route';
  root.renderOrder = 10;

  const flow = typeof document === 'undefined' ? null : createFlowTexture();
  const ringGeometry = new RingGeometry(0.5, 0.7, 40);
  ringGeometry.rotateX(-Math.PI / 2);

  let legs: Leg[] = [];
  let stops: Stop[] = [];
  const badge = createLabel({ variant: 'badge', title: '' });
  badge.visible = false;
  root.add(badge);
  const labels: CSS2DObject[] = [];

  const clear = (): void => {
    for (const leg of legs) {
      leg.mesh.geometry.dispose();
      leg.mesh.material.dispose();
      leg.texture?.dispose();
      root.remove(leg.mesh);
    }
    for (const stop of stops) {
      stop.ring.material.dispose();
      root.remove(stop.ring);
    }
    for (const label of labels) {
      detachLabels(label);
      root.remove(label);
    }
    legs = [];
    stops = [];
    labels.length = 0;
  };

  return {
    root,
    setRoute(route, anchors, labelled = new Set()) {
      clear();

      const stopPoints = new Map<string, Vector3>();
      for (const stop of route.stops) {
        const anchor = anchors.get(stop.anchor);
        if (!anchor) continue;
        stopPoints.set(stop.id, anchor);

        const style = NODE_STYLES[stop.state];
        const ring = new Mesh(
          ringGeometry,
          new MeshBasicMaterial({
            color: style.color,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
            depthWrite: false,
          }),
        );
        ring.position.set(anchor.x, anchor.y - 1.38, anchor.z);
        ring.renderOrder = 11;
        root.add(ring);
        stops.push({ ring, state: stop.state });
        if (labelled.has(stop.anchor)) continue;

        const label = createLabel({
          variant: 'stop',
          title: stop.title,
          lines: stop.subtitle ? [stop.subtitle] : [],
          marker: stop.marker,
        });
        label.element.dataset.state = stop.state;
        label.center.set(-0.08, 0.5);
        label.position.set(anchor.x, anchor.y - 0.2, anchor.z);
        root.add(label);
        labels.push(label);
      }

      for (const leg of route.legs) {
        const from = stopPoints.get(leg.from);
        const to = stopPoints.get(leg.to);
        if (!from || !to || from.distanceTo(to) < 0.5) continue;
        legs.push(buildLeg(root, from, to, leg.state, flow));
      }

      const anchor = route.badge ? stopPoints.get(route.badge.stopId) : undefined;
      badge.visible = Boolean(route.badge && anchor);
      if (route.badge && anchor) {
        updateLabel(badge, {
          variant: 'badge',
          title: route.badge.title,
          lines: route.badge.lines,
        });
        badge.position.set(anchor.x, anchor.y + BADGE_LIFT, anchor.z);
      }
    },
    update(elapsed, cameraPosition) {
      for (const label of labels) {
        const far = label.position.distanceTo(cameraPosition) > COMPACT_DISTANCE;
        label.element.classList.toggle('is-far', far);
      }
      for (const leg of legs) {
        if (leg.texture) leg.texture.offset.x = -elapsed * FLOW_SPEED;
      }
      const wave = 0.5 + 0.5 * Math.sin(elapsed * 3.2);
      for (const stop of stops) {
        if (!NODE_STYLES[stop.state].pulse) continue;
        stop.ring.scale.setScalar(1 + wave * 0.35);
        stop.ring.material.opacity = 0.95 - wave * 0.5;
      }
    },
    dispose() {
      clear();
      detachLabels(badge);
      ringGeometry.dispose();
      flow?.dispose();
    },
  };
}

function buildLeg(
  root: Group,
  from: Vector3,
  to: Vector3,
  state: ProcessNodeState,
  flow: Texture | null,
): Leg {
  const distance = from.distanceTo(to);
  const lift = Math.min(16, Math.max(2.5, distance * 0.28));
  const control = from.clone().lerp(to, 0.5);
  control.y = Math.max(from.y, to.y) + lift;
  const curve = new QuadraticBezierCurve3(from.clone(), control, to.clone());
  const geometry = new TubeGeometry(
    curve,
    Math.max(24, Math.round(distance * 1.5)),
    TUBE_RADIUS,
    8,
  );

  const travelled = isTravelled(state);
  const texture = travelled && flow ? flow.clone() : null;
  if (texture) {
    texture.repeat.set(Math.max(1, curve.getLength() / 2.2), 1);
    texture.needsUpdate = true;
  }
  const material = new MeshBasicMaterial({
    color: NODE_STYLES[state].color,
    map: texture,
    transparent: true,
    opacity: travelled ? 0.95 : 0.35,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 10;
  mesh.name = 'route-leg';
  root.add(mesh);
  return { mesh, texture, curve };
}

/** Light chevrons on a tinted band; the tube's colour shows through the gaps. */
function createFlowTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'rgb(200,200,200)';
  context.fillRect(0, 0, 128, 32);
  context.fillStyle = 'rgb(255,255,255)';
  context.beginPath();
  context.moveTo(40, 0);
  context.lineTo(72, 16);
  context.lineTo(40, 32);
  context.lineTo(60, 32);
  context.lineTo(92, 16);
  context.lineTo(60, 0);
  context.closePath();
  context.fill();

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
