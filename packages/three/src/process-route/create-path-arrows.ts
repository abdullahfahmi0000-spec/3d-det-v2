import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RepeatWrapping,
  ShapeGeometry,
  Shape,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from 'three';

import type { ProcessNodeState } from '../viewer-contract/twin-model';
import { NODE_STYLES } from './node-style';

export interface PathArrow {
  /** Total length of the path, in metres. */
  readonly length: number;
  /** Draws the path from its start up to `fraction` of its length (0 to 1). */
  reveal(fraction: number): void;
  setState(state: ProcessNodeState): void;
}

export interface PathArrows {
  readonly root: Group;
  /** Lays a wayfinding line on the floor along `points`, initially undrawn. */
  add(points: readonly Vector3[], state: ProcessNodeState): PathArrow;
  clear(): void;
  update(elapsed: number): void;
  dispose(): void;
}

const WIDTH = 0.55;
/** Height above the floor, clear of rugs and floor finishes. */
const LIFT = 0.07;
const STAIR_LIFT = 0.22;
/** The line is resampled at this spacing so it bends smoothly and draws evenly. */
const SAMPLE = 0.4;
/** One chevron every this many metres, moving forward at FLOW metres per second. */
const CHEVRON = 1.4;
const FLOW = 1.2;

/**
 * Wayfinding lines on the floor, like the coloured arrows painted in hospitals and
 * warehouses: a ribbon with chevrons moving along it and an arrowhead at its tip. Each
 * line can be drawn progressively, so it grows from one desk to the next.
 */
export function createPathArrows(): PathArrows {
  const root = new Group();
  root.name = 'path-arrows';
  const chevrons = typeof document === 'undefined' ? null : createChevronTexture();
  const headShape = new Shape();
  headShape.moveTo(-0.55, 0);
  headShape.lineTo(0.55, 0);
  headShape.lineTo(0, 0.9);
  headShape.closePath();
  const headGeometry = new ShapeGeometry(headShape);
  // Laid flat with its tip towards +Z, the direction it is turned to.
  headGeometry.rotateX(Math.PI / 2);

  const built: { mesh: Mesh<BufferGeometry, MeshBasicMaterial>; head: Mesh }[] = [];
  const clear = (): void => {
    for (const { mesh, head } of built) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      root.remove(mesh, head);
    }
    built.length = 0;
  };

  return {
    root,
    add(points, state) {
      const samples = resample(points);
      const geometry = ribbon(samples);
      const material = new MeshBasicMaterial({
        color: NODE_STYLES[state].color,
        map: chevrons,
        transparent: true,
        opacity: 0.92,
        side: DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      const mesh = new Mesh(geometry, material);
      mesh.name = 'path-arrow';
      mesh.renderOrder = 5;
      const head = new Mesh(headGeometry, material);
      head.renderOrder = 5;
      root.add(mesh, head);
      built.push({ mesh, head });

      const lengths = [0];
      for (let index = 1; index < samples.length; index += 1) {
        lengths.push(lengths[index - 1]! + samples[index]!.distanceTo(samples[index - 1]!));
      }
      const length = lengths[lengths.length - 1] ?? 0;

      const place = (fraction: number): void => {
        const reach = Math.max(0, Math.min(1, fraction)) * length;
        let segment = 0;
        while (segment < lengths.length - 2 && lengths[segment + 1]! <= reach) segment += 1;
        geometry.setDrawRange(0, reach <= 0 ? 0 : (segment + 1) * 6);

        // The arrowhead rides the tip of the drawn line.
        const from = samples[segment]!;
        const to = samples[Math.min(segment + 1, samples.length - 1)]!;
        const span = lengths[segment + 1]! - lengths[segment]! || 1;
        const tip = from.clone().lerp(to, Math.min(1, (reach - lengths[segment]!) / span));
        head.position.set(tip.x, tip.y + LIFT + 0.005, tip.z);
        head.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
        head.visible = reach > 0.2;
      };
      place(0);

      return {
        length,
        reveal: place,
        setState(next) {
          material.color.setHex(NODE_STYLES[next].color);
          material.opacity = next === 'done' ? 0.6 : 0.92;
        },
      };
    },
    clear,
    update(elapsed) {
      if (chevrons) chevrons.offset.x = -(elapsed * FLOW) / CHEVRON;
    },
    dispose() {
      clear();
      headGeometry.dispose();
      chevrons?.dispose();
    },
  };
}

/** Points along the path every SAMPLE metres, keeping every corner. */
function resample(points: readonly Vector3[]): Vector3[] {
  const result: Vector3[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const steps = Math.max(1, Math.ceil(from.distanceTo(to) / SAMPLE));
    for (let step = 0; step < steps; step += 1) result.push(from.clone().lerp(to, step / steps));
  }
  const last = points[points.length - 1];
  if (last) result.push(last.clone());
  return result;
}

/**
 * A flat strip along the samples, `WIDTH` wide, with U running along it in metres so the
 * chevron texture keeps its size. Two triangles per segment, so drawing the first k
 * segments is a draw range of 6k indices.
 */
function ribbon(samples: readonly Vector3[]): BufferGeometry {
  const positions = new Float32Array(samples.length * 2 * 3);
  const uvs = new Float32Array(samples.length * 2 * 2);
  let travelled = 0;
  samples.forEach((point, index) => {
    const previous = samples[Math.max(0, index - 1)]!;
    const next = samples[Math.min(samples.length - 1, index + 1)]!;
    const along = next.clone().sub(previous).setY(0);
    if (along.lengthSq() === 0) along.set(0, 0, 1);
    along.normalize();
    const side = new Vector3(along.z, 0, -along.x).multiplyScalar(WIDTH / 2);
    // On a stair the line rides over the step nosings instead of cutting through them.
    const run = Math.hypot(next.x - previous.x, next.z - previous.z);
    const lift = run > 0 && Math.abs(next.y - previous.y) / run > 0.1 ? STAIR_LIFT : LIFT;
    if (index > 0) travelled += point.distanceTo(samples[index - 1]!);
    for (const [offset, sign] of [
      [0, 1],
      [1, -1],
    ] as const) {
      const at = (index * 2 + offset) * 3;
      positions[at] = point.x + side.x * sign;
      positions[at + 1] = point.y + lift;
      positions[at + 2] = point.z + side.z * sign;
      uvs[(index * 2 + offset) * 2] = travelled / CHEVRON;
      uvs[(index * 2 + offset) * 2 + 1] = offset;
    }
  });
  const indices: number[] = [];
  for (let index = 0; index < samples.length - 1; index += 1) {
    const a = index * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

/** A light chevron on a slightly darker band; the line's colour tints both. */
function createChevronTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'rgb(170,170,170)';
  context.fillRect(0, 0, 128, 64);
  context.fillStyle = 'rgb(255,255,255)';
  context.beginPath();
  context.moveTo(34, 6);
  context.lineTo(78, 32);
  context.lineTo(34, 58);
  context.lineTo(56, 58);
  context.lineTo(100, 32);
  context.lineTo(56, 6);
  context.closePath();
  context.fill();
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
