import {
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';

import { SEATED_HEAD_HEIGHT } from '../avatars/proportions';

export interface Pointer {
  readonly root: Group;
  /**
   * Points at one person: `head` is the point just above their head. With `seat` a ring is
   * also drawn on the floor round their chair. `null` hides the pointer.
   */
  show(head: Vector3 | null, seat?: boolean): void;
  /** Animates the pointer; in the top view the ring grows so it reads from far above. */
  update(elapsed: number, topView: boolean): void;
}

const COLOR = 0xf5b400;

/**
 * Picks out exactly one person, where a desk pod seats several: a bobbing pin above their
 * head and a pulsing ring round their chair. Both are drawn over everything, so they show
 * through ceilings and from straight above.
 */
export function createPointer(): Pointer {
  const root = new Group();
  root.name = 'pointer';
  root.visible = false;

  const material = new MeshBasicMaterial({
    color: COLOR,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const ringMaterial = material.clone();

  // A map-pin: a ball on a cone pointing down at the head.
  const pin = new Group();
  const tip = new Mesh(new ConeGeometry(0.22, 0.6, 20), material);
  tip.rotation.x = Math.PI;
  tip.position.y = 0.3;
  const ball = new Mesh(new SphereGeometry(0.28, 20, 14), material);
  ball.position.y = 0.72;
  pin.add(tip, ball);

  const ringGeometry = new RingGeometry(0.62, 0.78, 48);
  ringGeometry.rotateX(-Math.PI / 2);
  const ring = new Mesh(ringGeometry, ringMaterial);

  for (const mesh of [tip, ball, ring]) mesh.renderOrder = 20;
  root.add(pin, ring);

  let base = new Vector3();
  let withSeat = false;

  return {
    root,
    show(head, seat = true) {
      root.visible = head !== null;
      if (!head) return;
      base = head.clone();
      withSeat = seat;
      ring.visible = seat;
      ring.position.set(head.x, head.y - SEATED_HEAD_HEIGHT + 0.06, head.z);
    },
    update(elapsed, topView) {
      if (!root.visible) return;
      const bob = Math.abs(Math.sin(elapsed * 3)) * 0.25;
      pin.position.set(base.x, base.y + 0.35 + bob, base.z);
      // From straight above the pin is a dot, so it is drawn larger there.
      pin.scale.setScalar(topView ? 1.6 : 1);
      if (!withSeat) return;
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4);
      ring.scale.setScalar((topView ? 1.25 : 1) * (1 + pulse * 0.18));
      ringMaterial.opacity = 0.95 - pulse * 0.45;
    },
  };
}
