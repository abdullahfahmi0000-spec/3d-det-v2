import {
  BoxGeometry,
  BufferAttribute,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Collects static shapes and merges them into one mesh per material, so a furnished floor
 * costs a handful of draw calls instead of thousands.
 *
 * Shapes are placed relative to a transform stack: `push` moves and turns the origin,
 * `pop` restores it, which lets a piece of furniture be described in its own frame.
 */
export class ShapeBatch {
  private readonly parts = new Map<Material, BufferGeometry[]>();
  private readonly stack: Matrix4[] = [];
  private current = new Matrix4();

  /** Moves the origin to `(x, y, z)` and turns it by `rotationY`, relative to the current one. */
  push(x: number, y: number, z: number, rotationY = 0): this {
    this.stack.push(this.current.clone());
    this.current.multiply(
      new Matrix4().compose(
        new Vector3(x, y, z),
        new Quaternion().setFromAxisAngle(Y_AXIS, rotationY),
        UNIT_SCALE,
      ),
    );
    return this;
  }

  pop(): this {
    this.current = this.stack.pop() ?? new Matrix4();
    return this;
  }

  /** A box of the given size centred on `(x, y, z)`. */
  box(
    width: number,
    height: number,
    depth: number,
    material: Material,
    x: number,
    y: number,
    z: number,
    rotationY = 0,
  ): this {
    const local = new Matrix4().compose(
      new Vector3(x, y, z),
      new Quaternion().setFromAxisAngle(Y_AXIS, rotationY),
      new Vector3(width, height, depth),
    );
    return this.add(UNIT_BOX, material, local);
  }

  /** A box whose bottom face rests at height `y`. */
  block(
    width: number,
    height: number,
    depth: number,
    material: Material,
    x: number,
    y: number,
    z: number,
    rotationY = 0,
  ): this {
    return this.box(width, height, depth, material, x, y + height / 2, z, rotationY);
  }

  /** An upright cylinder centred on `(x, y, z)`. */
  cylinder(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    material: Material,
    x: number,
    y: number,
    z: number,
    segments = 14,
  ): this {
    const geometry = cylinderGeometry(radiusTop, radiusBottom, segments);
    const local = new Matrix4().compose(
      new Vector3(x, y, z),
      new Quaternion(),
      new Vector3(1, height, 1),
    );
    return this.add(geometry, material, local);
  }

  /** A cylinder lying along X, such as a wheel or a roller. */
  roller(
    radius: number,
    length: number,
    material: Material,
    x: number,
    y: number,
    z: number,
    alongZ = false,
    segments = 16,
  ): this {
    const geometry = cylinderGeometry(radius, radius, segments);
    const turn = new Quaternion().setFromAxisAngle(alongZ ? X_AXIS : Z_AXIS, Math.PI / 2);
    const local = new Matrix4().compose(new Vector3(x, y, z), turn, new Vector3(1, length, 1));
    return this.add(geometry, material, local);
  }

  /** A sphere, optionally squashed, centred on `(x, y, z)`. */
  sphere(radius: number, material: Material, x: number, y: number, z: number, scaleY = 1): this {
    const local = new Matrix4().compose(
      new Vector3(x, y, z),
      new Quaternion(),
      new Vector3(radius, radius * scaleY, radius),
    );
    return this.add(UNIT_SPHERE, material, local);
  }

  /** Any geometry under a local transform. */
  add(geometry: BufferGeometry, material: Material, local: Matrix4): this {
    const placed = geometry
      .clone()
      .applyMatrix4(new Matrix4().multiplyMatrices(this.current, local));
    let list = this.parts.get(material);
    if (!list) {
      list = [];
      this.parts.set(material, list);
    }
    list.push(placed);
    return this;
  }

  get isEmpty(): boolean {
    return this.parts.size === 0;
  }

  /** Merges everything added so far into a group with one mesh per material. */
  build(name: string): Group {
    const group = new Group();
    group.name = name;
    for (const [material, geometries] of this.parts) {
      const merged = mergeGeometries(geometries.map(stripGroups), false);
      for (const geometry of geometries) geometry.dispose();
      if (!merged) continue;

      const tile = material.userData.uvTile as number | undefined;
      if (tile) projectWorldUv(merged, tile);

      const mesh = new Mesh(merged, material);
      mesh.name = `${name}:${material.name || material.uuid.slice(0, 6)}`;
      mesh.castShadow = !material.transparent;
      mesh.receiveShadow = true;
      // Glazing lets clicks through to what is behind it.
      mesh.userData.pickThrough = material.transparent;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}

const Y_AXIS = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const UNIT_SCALE = new Vector3(1, 1, 1);
const UNIT_BOX = new BoxGeometry(1, 1, 1);
const UNIT_SPHERE = new SphereGeometry(1, 14, 10);
const cylinders = new Map<string, CylinderGeometry>();

/** Unit-height cylinders are shared by radius, so scaling only changes their height. */
function cylinderGeometry(
  radiusTop: number,
  radiusBottom: number,
  segments: number,
): CylinderGeometry {
  const key = `${radiusTop}:${radiusBottom}:${segments}`;
  let geometry = cylinders.get(key);
  if (!geometry) {
    geometry = new CylinderGeometry(radiusTop, radiusBottom, 1, segments);
    cylinders.set(key, geometry);
  }
  return geometry;
}

/** Built-in geometries carry draw groups for multi-material use, which merging does not need. */
function stripGroups(geometry: BufferGeometry): BufferGeometry {
  geometry.clearGroups();
  return geometry;
}

/**
 * Replaces the UVs with a projection of world position, so a tiled texture (carpet,
 * cladding, asphalt) keeps the same scale on every surface whatever its size. Each vertex
 * is projected along the axis its normal is closest to.
 */
export function projectWorldUv(geometry: BufferGeometry, tile: number): void {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  if (!position || !normal) return;

  const uv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const nx = Math.abs(normal.getX(index));
    const ny = Math.abs(normal.getY(index));
    const nz = Math.abs(normal.getZ(index));

    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) {
      u = x;
      v = z;
    } else if (nx >= nz) {
      u = z;
      v = y;
    } else {
      u = x;
      v = y;
    }
    uv[index * 2] = u / tile;
    uv[index * 2 + 1] = v / tile;
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
}
