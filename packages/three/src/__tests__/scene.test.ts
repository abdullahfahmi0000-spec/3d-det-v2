import type { Color } from 'three';
import { describe, expect, it } from 'vitest';

import { createCamera, distanceToFrame } from '../camera/create-camera';
import { createScene, DEFAULT_HORIZON } from '../scene/create-scene';
import { emptySceneViewModel } from '../viewer-contract/view-model';

describe('createScene', () => {
  it('builds a lit scene with a separate content group', () => {
    const { scene, content } = createScene();

    expect(scene.getObjectByName('sky-light')).toBeDefined();
    expect(scene.getObjectByName('sun')).toBeDefined();
    expect(scene.getObjectByName('content')).toBe(content);
    expect(content.children).toHaveLength(0);
  });

  it('fills the horizon with the fog colour under a sky dome, over a horizontal ground plane', () => {
    const { scene } = createScene();
    const ground = scene.getObjectByName('ground');

    expect((scene.background as Color).getHex()).toBe(DEFAULT_HORIZON);
    expect(scene.getObjectByName('sky')).toBeDefined();
    expect(ground).toBeDefined();
    expect(ground?.rotation.x).toBeCloseTo(-Math.PI / 2);
  });
});

describe('createCamera', () => {
  it('applies the requested aspect ratio and looks at the origin', () => {
    const camera = createCamera({ aspect: 16 / 9 });
    expect(camera.aspect).toBeCloseTo(16 / 9);
    expect(camera.position.lengthSq()).toBeGreaterThan(0);
  });

  it('solves framing distance from its own field of view', () => {
    const camera = createCamera({ fov: 60 });
    const distance = distanceToFrame(camera, 20);
    expect(distance).toBeCloseTo(10 / Math.tan(Math.PI / 6), 5);
  });
});

describe('emptySceneViewModel', () => {
  it('starts with no geometry and no overlays', () => {
    const model = emptySceneViewModel();
    expect(model.shell).toBeNull();
    expect(model.desks).toEqual([]);
    expect(Object.keys(model.overlays)).toEqual([]);
  });
});
