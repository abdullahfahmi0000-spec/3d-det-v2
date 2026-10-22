import { Line, Mesh, Texture, type BufferGeometry, type Material, type Object3D } from 'three';

/**
 * Releases the GPU resources held by `root` and everything below it: geometries,
 * materials and the textures those materials use (maps, canvas signage). Resources shared
 * between objects are disposed once.
 */
export function disposeObject(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();

  root.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof Line)) return;
    geometries.add(object.geometry);
    const objectMaterials: Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.forEach((material) => materials.add(material));
  });

  const textures = new Set<Texture>();
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof Texture) textures.add(value);
    }
  }

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}
