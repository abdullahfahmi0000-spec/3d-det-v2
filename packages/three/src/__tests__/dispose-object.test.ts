import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { disposeObject } from '../scene/dispose-object';

describe('disposeObject', () => {
  it('disposes the geometries, materials and textures under a root, each once', () => {
    const map = new Texture();
    const emissiveMap = new Texture();
    const material = new MeshStandardMaterial({ map, emissiveMap });
    const geometry = new BoxGeometry();
    const root = new Group();
    // Two meshes share the geometry and the material.
    root.add(new Mesh(geometry, material), new Mesh(geometry, material));

    const spies = [map, emissiveMap, material, geometry].map((resource) =>
      vi.spyOn(resource, 'dispose'),
    );
    disposeObject(root);

    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });
});
