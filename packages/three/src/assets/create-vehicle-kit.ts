import { Group, MeshStandardMaterial, type Mesh } from 'three';

import { ShapeBatch } from '../building/shape-batch';
import type { Materials } from './materials';

export interface VehicleKit {
  /** An articulated lorry, 16.5 m long; origin at its centre on the ground, cab towards +Z. */
  truck(cabColor: number): Group;
  /** A panel van, 6 m long, facing +Z. */
  van(color: number): Group;
  /** A hatchback, 4.4 m long, facing +Z. */
  car(color: number): Group;
  /** A counterbalance forklift with its forks towards +Z. */
  forklift(): Group;
}

export const TRUCK_LENGTH = 16.5;

/**
 * Procedural vehicles. Each kind and colour is batched once into a few meshes and then
 * cloned, so every copy shares its geometry with the first.
 */
export function createVehicleKit(m: Materials): VehicleKit {
  const paints = new Map<number, MeshStandardMaterial>();
  const paint = (color: number): MeshStandardMaterial => {
    let material = paints.get(color);
    if (!material) {
      material = new MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 });
      material.name = `paint-${color.toString(16)}`;
      paints.set(color, material);
    }
    return material;
  };

  const templates = new Map<string, Group>();
  const instance = (key: string, build: (b: ShapeBatch) => void): Group => {
    let template = templates.get(key);
    if (!template) {
      const batch = new ShapeBatch();
      build(batch);
      template = batch.build(key);
      templates.set(key, template);
    }
    const copy = new Group();
    copy.name = key;
    for (const child of template.children) {
      const mesh = (child as Mesh).clone();
      mesh.castShadow = true;
      copy.add(mesh);
    }
    return copy;
  };

  const wheel = (b: ShapeBatch, x: number, z: number, radius: number, width: number): void => {
    b.roller(radius, width, m.tyre, x, radius, z, false, 18);
    b.roller(radius * 0.55, width + 0.02, m.rim, x, radius, z, false, 12);
  };

  return {
    truck(cabColor) {
      return instance(`truck-${cabColor}`, (b) => {
        const cab = paint(cabColor);
        const rear = -TRUCK_LENGTH / 2;

        // Semi-trailer: box body, underframe, rear doors and three axles.
        b.block(2.55, 2.75, 13.6, m.trailer, 0, 1.3, rear + 6.8);
        b.block(2.57, 0.12, 13.62, m.aluminiumLight, 0, 4.05, rear + 6.8);
        b.block(2.57, 0.18, 13.62, m.chassis, 0, 1.18, rear + 6.8);
        for (const x of [-0.5, 0.5]) b.block(0.18, 0.3, 12.8, m.chassis, x, 0.95, rear + 6.8);
        b.box(0.04, 2.6, 0.03, m.aluminium, 0, 2.65, rear - 0.01);
        for (const x of [-0.7, 0.7]) b.box(0.05, 2.6, 0.05, m.aluminiumLight, x, 2.65, rear - 0.02);
        b.box(2.4, 0.12, 0.12, m.chassis, 0, 0.62, rear + 0.25);
        for (const x of [-1.05, 1.05]) b.box(0.25, 0.14, 0.04, m.lightRear, x, 1.12, rear - 0.01);
        for (const z of [rear + 1.35, rear + 2.65, rear + 3.95]) {
          for (const x of [-1.0, 1.0]) wheel(b, x, z, 0.5, 0.42);
          b.roller(0.08, 2.0, m.chassis, 0, 0.5, z);
        }
        for (const x of [-0.8, 0.8]) b.block(0.12, 1.0, 0.12, m.chassis, x, 0.1, rear + 10.6);
        b.block(0.1, 0.5, 6, m.aluminiumLight, -1.25, 0.65, rear + 7.5);
        b.block(0.1, 0.5, 6, m.aluminiumLight, 1.25, 0.65, rear + 7.5);

        // Tractor unit.
        const front = TRUCK_LENGTH / 2;
        b.block(0.95, 0.32, 7.4, m.chassis, 0, 0.72, front - 3.9);
        b.block(2.45, 2.55, 2.25, cab, 0, 1.3, front - 1.15);
        b.block(2.35, 0.65, 1.7, cab, 0, 3.85, front - 1.3);
        b.box(2.15, 0.95, 0.04, m.vehicleGlass, 0, 3.0, front - 0.02);
        for (const x of [-1.23, 1.23]) b.box(0.03, 0.75, 0.9, m.vehicleGlass, x, 3.05, front - 0.6);
        b.box(1.7, 0.8, 0.04, m.chassis, 0, 1.95, front - 0.01);
        for (let slat = 0; slat < 4; slat += 1) {
          b.box(1.6, 0.04, 0.05, m.aluminiumLight, 0, 1.68 + slat * 0.18, front);
        }
        b.box(2.5, 0.42, 0.3, m.chassis, 0, 0.95, front - 0.05);
        for (const x of [-0.95, 0.95]) b.box(0.36, 0.16, 0.05, m.lightFront, x, 1.35, front + 0.01);
        for (const x of [-1.42, 1.42]) {
          b.box(0.05, 0.05, 0.5, m.chassis, x * 0.92, 3.1, front - 0.35);
          b.box(0.1, 0.42, 0.2, m.chassis, x, 2.95, front - 0.15);
        }
        for (const x of [-1.0, 1.0])
          b.roller(0.3, 1.3, m.aluminiumLight, x, 0.85, front - 4.3, true);
        b.block(2.2, 0.7, 0.1, m.chassis, 0, 1.0, front - 2.35);
        wheel(b, -1.05, front - 1.35, 0.52, 0.36);
        wheel(b, 1.05, front - 1.35, 0.52, 0.36);
        for (const z of [front - 5.6, front - 6.95]) {
          for (const x of [-1.0, 1.0]) wheel(b, x, z, 0.52, 0.45);
        }
        for (const x of [-1.15, 1.15]) b.box(0.4, 0.06, 0.95, m.chassis, x, 1.12, front - 1.35);
      });
    },
    van(color) {
      return instance(`van-${color}`, (b) => {
        const body = paint(color);
        b.block(2.0, 2.15, 4.4, body, 0, 0.45, -0.7);
        b.block(1.95, 1.1, 1.5, body, 0, 0.45, 2.2);
        b.box(1.85, 0.7, 0.9, body, 0, 1.75, 1.75, 0);
        b.box(1.75, 0.6, 0.04, m.vehicleGlass, 0, 1.8, 2.2);
        for (const x of [-1.0, 1.0]) b.box(0.03, 0.5, 0.8, m.vehicleGlass, x, 1.85, 1.6);
        b.box(1.95, 0.25, 0.15, m.chassis, 0, 0.55, 2.98);
        for (const x of [-0.7, 0.7]) b.box(0.3, 0.12, 0.04, m.lightFront, x, 1.15, 2.96);
        for (const x of [-0.85, 0.85]) b.box(0.18, 0.3, 0.04, m.lightRear, x, 1.2, -2.92);
        for (const z of [2.0, -2.0]) {
          for (const x of [-0.92, 0.92]) wheel(b, x, z, 0.36, 0.26);
        }
      });
    },
    car(color) {
      return instance(`car-${color}`, (b) => {
        const body = paint(color);
        b.block(1.78, 0.62, 4.3, body, 0, 0.28, 0);
        b.block(1.7, 0.08, 4.2, body, 0, 0.9, 0);
        b.block(1.58, 0.5, 2.3, m.vehicleGlass, 0, 0.95, -0.25);
        b.block(1.52, 0.06, 2.0, body, 0, 1.45, -0.3);
        for (const x of [-0.82, 0.82]) b.block(0.08, 0.5, 0.1, body, x, 0.95, 0.85);
        b.box(1.78, 0.18, 0.12, m.chassis, 0, 0.38, 2.15);
        b.box(1.78, 0.18, 0.12, m.chassis, 0, 0.38, -2.15);
        for (const x of [-0.6, 0.6]) {
          b.box(0.34, 0.1, 0.04, m.lightFront, x, 0.75, 2.16);
          b.box(0.34, 0.1, 0.04, m.lightRear, x, 0.8, -2.16);
        }
        for (const z of [1.35, -1.35]) {
          for (const x of [-0.8, 0.8]) wheel(b, x, z, 0.32, 0.22);
        }
      });
    },
    forklift() {
      return instance('forklift', (b) => {
        b.block(1.1, 0.95, 1.9, m.forklift, 0, 0.3, -0.2);
        b.block(1.12, 0.75, 0.6, m.steelBlack, 0, 0.35, -1.05);
        b.block(0.5, 0.12, 0.5, m.chairFabric, 0, 1.25, -0.35);
        b.block(0.5, 0.45, 0.1, m.chairFabric, 0, 1.3, -0.62);
        for (const [x, z] of [
          [-0.5, 0.4],
          [0.5, 0.4],
          [-0.5, -0.85],
          [0.5, -0.85],
        ] as const) {
          b.block(0.06, 1.0, 0.06, m.steelBlack, x, 1.25, z);
        }
        b.block(1.1, 0.06, 1.35, m.steelBlack, 0, 2.25, -0.22);
        for (const x of [-0.35, 0.35]) b.block(0.1, 2.5, 0.12, m.steelBlack, x, 0.1, 0.85);
        b.block(0.9, 0.5, 0.06, m.steelBlack, 0, 0.15, 0.95);
        for (const x of [-0.25, 0.25]) b.block(0.1, 0.05, 1.1, m.steelBlack, x, 0.1, 1.5);
        for (const [x, z, radius] of [
          [-0.5, 0.55, 0.3],
          [0.5, 0.55, 0.3],
          [-0.5, -0.8, 0.25],
          [0.5, -0.8, 0.25],
        ] as const) {
          wheel(b, x, z, radius, 0.22);
        }
      });
    },
  };
}
