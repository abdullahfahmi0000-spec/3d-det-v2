import { CatmullRomCurve3, Group, Vector3 } from 'three';

import type { VehicleKit } from '../assets/create-vehicle-kit';
import type { TrafficModel } from '../viewer-contract/twin-model';

export interface Traffic {
  readonly root: Group;
  update(elapsed: number): void;
}

/**
 * Vehicles driving looping paths on the site: lorries leaving the yard with deliveries,
 * vans and cars passing on the road. Paths are smoothed through their corners, and each
 * vehicle faces the way it travels. A path should start and end far enough away that the
 * jump back to the start happens in the fog.
 */
export function createTraffic(models: readonly TrafficModel[], vehicles: VehicleKit): Traffic {
  const root = new Group();
  root.name = 'traffic';

  const movers = models
    .filter((model) => model.path.length >= 2)
    .map((model) => {
      const curve = new CatmullRomCurve3(
        model.path.map(([x, z]) => new Vector3(x, 0, z)),
        false,
        'centripetal',
        0.2,
      );
      const vehicle =
        model.kind === 'truck'
          ? vehicles.truck(model.color)
          : model.kind === 'van'
            ? vehicles.van(model.color)
            : vehicles.car(model.color);
      root.add(vehicle);
      return { model, curve, length: curve.getLength(), vehicle };
    });

  const point = new Vector3();
  const tangent = new Vector3();

  return {
    root,
    update(elapsed) {
      for (const { model, curve, length, vehicle } of movers) {
        const distance = (model.phase * length + elapsed * model.speed) % length;
        const t = distance / length;
        curve.getPointAt(t, point);
        curve.getTangentAt(t, tangent);
        vehicle.position.copy(point);
        vehicle.rotation.y = Math.atan2(tangent.x, tangent.z);
      }
    },
  };
}
