import { BoxGeometry, Group, Mesh, Vector3, type Material } from 'three';

export interface SlidingDoor {
  readonly root: Group;
  /** Opens the door while the camera is near it and closes it again once it has gone. */
  update(deltaSeconds: number, cameraPosition: Vector3): void;
}

export interface SlidingDoorOptions {
  /** Width of the opening the two leaves close, in metres. */
  readonly width: number;
  readonly height: number;
  readonly leaf: Material;
  readonly frame: Material;
}

/** How near the camera has to come for the door to open, and how fast it moves. */
const OPEN_DISTANCE = 8;
const OPEN_HEIGHT = 5;
const SPEED = 1.6;

/**
 * An automatic bi-parting door: two leaves in a frame that slide apart into the wall as
 * someone comes near, like the doors of an office lobby or a warehouse personnel door.
 * Built in its own frame: the opening runs along X, centred on the origin, floor at y = 0.
 */
export function createSlidingDoor(options: SlidingDoorOptions): SlidingDoor {
  const root = new Group();
  root.name = 'sliding-door';
  const { width, height } = options;
  const leafWidth = width / 2;

  const leafGeometry = new BoxGeometry(leafWidth - 0.04, height - 0.08, 0.05);
  const railGeometry = new BoxGeometry(leafWidth, 0.06, 0.07);
  const stileGeometry = new BoxGeometry(0.06, height - 0.08, 0.07);

  const leaves = [-1, 1].map((side) => {
    const leaf = new Group();
    const panel = new Mesh(leafGeometry, options.leaf);
    panel.position.y = height / 2;
    leaf.add(panel);
    for (const y of [0.05, height - 0.05]) {
      const rail = new Mesh(railGeometry, options.frame);
      rail.position.y = y;
      leaf.add(rail);
    }
    for (const x of [-leafWidth / 2 + 0.03, leafWidth / 2 - 0.03]) {
      const stile = new Mesh(stileGeometry, options.frame);
      stile.position.set(x, height / 2, 0);
      leaf.add(stile);
    }
    leaf.userData.side = side;
    root.add(leaf);
    return leaf;
  });

  const header = new Mesh(new BoxGeometry(width + 0.3, 0.22, 0.24), options.frame);
  header.position.y = height + 0.11;
  root.add(header);

  let open = 0;
  const centre = new Vector3();
  const place = (): void => {
    for (const leaf of leaves) {
      const side = leaf.userData.side as number;
      leaf.position.x = side * (leafWidth / 2 + open * (leafWidth - 0.1));
    }
  };
  place();

  return {
    root,
    update(deltaSeconds, cameraPosition) {
      root.getWorldPosition(centre);
      const near =
        Math.hypot(cameraPosition.x - centre.x, cameraPosition.z - centre.z) < OPEN_DISTANCE &&
        Math.abs(cameraPosition.y - centre.y) < OPEN_HEIGHT;
      const target = near ? 1 : 0;
      if (open === target) return;
      const step = SPEED * deltaSeconds;
      open = target > open ? Math.min(target, open + step) : Math.max(target, open - step);
      place();
    },
  };
}
