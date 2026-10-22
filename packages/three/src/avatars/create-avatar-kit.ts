import {
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type BufferGeometry,
} from 'three';

export interface AvatarAppearance {
  readonly shirt: number;
  readonly skin: number;
  readonly hair: number;
}

export interface AvatarKit {
  /**
   * A person seated on a chair whose seat centre is at the origin, facing +Z towards a
   * desk. `variant` picks a hair style and trouser colour so a room does not look cloned.
   */
  seated(appearance: AvatarAppearance, variant: number): Group;
  /** Gentle idle motion: breathing and the odd turn of the head. */
  update(elapsed: number): void;
}

const TROUSERS = [0x2b3038, 0x3a4250, 0x4b4f55, 0x2f3a4a, 0x6e6455];
const SHOES = [0x1c1d1f, 0x3b2a20, 0x2a2c30];

/** Real proportions for a seated adult of about 1.75 m. */
export function createAvatarKit(): AvatarKit {
  const geometry = {
    thigh: capsule(0.075, 0.36),
    shin: capsule(0.062, 0.36),
    torso: capsule(0.16, 0.3),
    upperArm: capsule(0.052, 0.22),
    forearm: capsule(0.046, 0.24),
    hand: new SphereGeometry(0.045, 10, 8),
    neck: new CylinderGeometry(0.048, 0.055, 0.1, 10),
    head: new SphereGeometry(0.105, 18, 14),
    hairShort: new SphereGeometry(0.112, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairLong: new CapsuleGeometry(0.1, 0.16, 4, 12),
    shoe: new CylinderGeometry(0.05, 0.055, 0.24, 10),
    pelvis: capsule(0.13, 0.12),
  };
  geometry.shoe.rotateX(Math.PI / 2);
  geometry.thigh.rotateX(Math.PI / 2);
  geometry.forearm.rotateX(Math.PI / 2);
  geometry.pelvis.rotateZ(Math.PI / 2);

  const materials = new Map<number, MeshStandardMaterial>();
  const material = (color: number, roughness = 0.85): MeshStandardMaterial => {
    let cached = materials.get(color);
    if (!cached) {
      cached = new MeshStandardMaterial({ color, roughness });
      materials.set(color, cached);
    }
    return cached;
  };

  const torsos: { readonly mesh: Group; readonly phase: number }[] = [];
  const heads: { readonly mesh: Mesh; readonly phase: number }[] = [];

  const part = (
    parent: Group,
    shape: BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    rotationX = 0,
  ): Mesh => {
    const mesh = new Mesh(shape, material(color));
    mesh.position.set(x, y, z);
    mesh.rotation.x = rotationX;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  return {
    seated(appearance, variant) {
      const person = new Group();
      person.name = 'person';
      const trousers = TROUSERS[variant % TROUSERS.length]!;
      const shoes = SHOES[variant % SHOES.length]!;

      part(person, geometry.pelvis, trousers, 0, 0.55, 0.0);
      for (const side of [-1, 1]) {
        part(person, geometry.thigh, trousers, side * 0.1, 0.55, 0.2);
        part(person, geometry.shin, trousers, side * 0.1, 0.3, 0.42);
        part(person, geometry.shoe, shoes, side * 0.1, 0.05, 0.5);
      }

      // The upper body is its own group so it can breathe and lean as one.
      const upper = new Group();
      upper.position.set(0, 0.6, -0.04);
      person.add(upper);

      const torso = part(upper, geometry.torso, appearance.shirt, 0, 0.3, 0);
      torso.scale.set(1.12, 1, 0.78);
      for (const side of [-1, 1]) {
        part(upper, geometry.upperArm, appearance.shirt, side * 0.21, 0.36, 0.05, -0.35);
        part(upper, geometry.forearm, appearance.shirt, side * 0.18, 0.2, 0.28);
        part(upper, geometry.hand, appearance.skin, side * 0.16, 0.2, 0.44);
      }
      part(upper, geometry.neck, appearance.skin, 0, 0.6, 0);

      const head = part(upper, geometry.head, appearance.skin, 0, 0.72, 0.01);
      head.scale.set(0.95, 1.08, 1);
      const hair = new Mesh(geometry.hairShort, material(appearance.hair, 0.95));
      hair.position.set(0, 0.025, -0.008);
      head.add(hair);
      if (variant % 3 === 1) {
        const long = new Mesh(geometry.hairLong, material(appearance.hair, 0.95));
        long.position.set(0, -0.08, -0.06);
        long.scale.set(1.05, 1, 0.6);
        head.add(long);
      }

      torsos.push({ mesh: upper, phase: variant * 1.7 });
      heads.push({ mesh: head, phase: variant * 2.3 });
      return person;
    },
    update(elapsed) {
      for (const { mesh, phase } of torsos) {
        mesh.scale.y = 1 + Math.sin(elapsed * 1.6 + phase) * 0.008;
        mesh.rotation.x = 0.05 + Math.sin(elapsed * 0.4 + phase) * 0.02;
      }
      for (const { mesh, phase } of heads) {
        // Mostly still, with an occasional glance to the side.
        const glance = Math.max(0, Math.sin(elapsed * 0.23 + phase) - 0.85) * 3;
        mesh.rotation.y = glance * Math.sin(phase);
      }
    },
  };
}

function capsule(radius: number, length: number): CapsuleGeometry {
  return new CapsuleGeometry(radius, length, 4, 12);
}
