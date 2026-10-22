import { Box3, Mesh, MeshBasicMaterial, RingGeometry, Vector3, type Object3D } from 'three';

export interface SelectionMarker {
  readonly mesh: Mesh;
  /** Rings the given object on the ground, or hides the marker for `null`. */
  show(target: Object3D | null): void;
  update(elapsed: number): void;
}

const MARKER_COLOR = 0x3b82d6;
const MARKER_PADDING = 1;

/** A pulsing ring on the ground around the selected object. */
export function createSelectionMarker(): SelectionMarker {
  const geometry = new RingGeometry(0.88, 1, 64);
  geometry.rotateX(-Math.PI / 2);
  const material = new MeshBasicMaterial({
    color: MARKER_COLOR,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'selection-marker';
  mesh.visible = false;
  mesh.renderOrder = 1;

  const bounds = new Box3();
  const size = new Vector3();
  const centre = new Vector3();

  return {
    mesh,
    show(target) {
      mesh.visible = target !== null;
      if (!target) return;

      bounds.setFromObject(target);
      bounds.getSize(size);
      bounds.getCenter(centre);
      mesh.position.set(centre.x, bounds.min.y + 0.25, centre.z);
      mesh.scale.setScalar(Math.max(size.x, size.z) / 2 + MARKER_PADDING);
    },
    update(elapsed) {
      material.opacity = 0.55 + 0.35 * Math.sin(elapsed * 3);
    },
  };
}
