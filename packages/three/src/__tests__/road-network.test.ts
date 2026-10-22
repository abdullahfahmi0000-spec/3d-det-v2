import { Mesh } from 'three';
import { describe, expect, it } from 'vitest';

import { createRoadNetwork } from '../scene/create-road-network';

describe('createRoadNetwork', () => {
  it('lays one asphalt strip per road in each direction', () => {
    const network = createRoadNetwork({ roadsPerAxis: 3, spacing: 50, roadWidth: 10 });
    const asphalt = network.children
      .flatMap((direction) => direction.children)
      .filter((child): child is Mesh => child instanceof Mesh)
      .filter((mesh) => mesh.position.y === 0.02);

    expect(asphalt).toHaveLength(6);
  });

  it('turns the second set of roads a quarter turn', () => {
    const [eastWest, northSouth] = createRoadNetwork().children;
    expect(eastWest?.rotation.y).toBe(0);
    expect(northSouth?.rotation.y).toBeCloseTo(Math.PI / 2);
  });
});
