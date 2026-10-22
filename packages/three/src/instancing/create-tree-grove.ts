import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';

import { seededRandom } from '../assets/seeded-random';
import type { GroundPoint } from '../viewer-contract/twin-model';

const TRUNK_HEIGHT = 2.6;
const FOLIAGE = [0x557a3e, 0x4a6e38, 0x66894a, 0x3f6233, 0x6f8f4c];

/**
 * Draws every tree with a few instanced meshes, so a whole grove costs four draw calls.
 * Most trees are broadleaf with a two-lobed crown; about one in five is a conifer. Size,
 * lean and shade vary per tree from a seeded generator, so the grove is stable.
 */
export function createTreeGrove(points: readonly GroundPoint[]): Group {
  const grove = new Group();
  grove.name = 'trees';
  const random = seededRandom(points.length * 7 + 3);

  const trunkGeometry = new CylinderGeometry(0.14, 0.24, TRUNK_HEIGHT, 7);
  trunkGeometry.translate(0, TRUNK_HEIGHT / 2, 0);
  const crownGeometry = new IcosahedronGeometry(1.7, 1);
  const coneGeometry = new ConeGeometry(1.5, 5.5, 9);

  const trunkMaterial = new MeshStandardMaterial({ color: 0x5e4a3a, roughness: 0.95 });
  const crownMaterial = new MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const coneMaterial = new MeshStandardMaterial({
    color: 0x3d5a35,
    roughness: 0.9,
    flatShading: true,
  });

  const trunks = new InstancedMesh(trunkGeometry, trunkMaterial, points.length);
  const crowns = new InstancedMesh(crownGeometry, crownMaterial, points.length * 2);
  const cones = new InstancedMesh(coneGeometry, coneMaterial, points.length);

  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const position = new Vector3();
  const color = new Color();
  let crownCount = 0;
  let coneCount = 0;

  points.forEach(([x, z], index) => {
    const size = 0.75 + random() * 0.6;
    rotation.setFromAxisAngle(new Vector3(0, 1, 0), random() * Math.PI * 2);
    scale.setScalar(size);
    trunks.setMatrixAt(index, matrix.compose(position.set(x, 0, z), rotation, scale));

    if (random() < 0.2) {
      scale.set(size, size * (0.9 + random() * 0.4), size);
      position.set(x, (TRUNK_HEIGHT * 0.4 + 2.75) * size, z);
      cones.setMatrixAt(coneCount, matrix.compose(position, rotation, scale));
      coneCount += 1;
      return;
    }
    for (const lobe of [0, 1]) {
      const lobeSize = size * (lobe === 0 ? 1 : 0.7);
      scale.set(lobeSize * 1.05, lobeSize * (0.95 + random() * 0.2), lobeSize * 1.05);
      position.set(
        x + (lobe === 0 ? 0 : (random() - 0.5) * 1.6 * size),
        (TRUNK_HEIGHT + 1.1 + lobe * 0.9) * size,
        z + (lobe === 0 ? 0 : (random() - 0.5) * 1.6 * size),
      );
      crowns.setMatrixAt(crownCount, matrix.compose(position, rotation, scale));
      crowns.setColorAt(crownCount, color.setHex(FOLIAGE[Math.floor(random() * FOLIAGE.length)]!));
      crownCount += 1;
    }
  });
  crowns.count = crownCount;
  cones.count = coneCount;

  for (const mesh of [trunks, crowns, cones]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  grove.add(trunks, crowns, cones);
  return grove;
}
