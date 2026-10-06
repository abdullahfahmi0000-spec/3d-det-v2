import { describe, expect, it } from 'vitest';

import { createCamera, distanceToFrame } from '../camera/create-camera';
import { createScene } from '../scene/create-scene';
import { emptySceneViewModel } from '../viewer-contract/view-model';

describe('createScene', () => {
  it('builds a lit scene with a separate content group', () => {
    const { scene, content } = createScene();

    expect(scene.getObjectByName('ambient')).toBeDefined();
    expect(scene.getObjectByName('sun')).toBeDefined();
    expect(scene.getObjectByName('content')).toBe(content);
    expect(content.children).toHaveLength(0);
  });

  it('can omit the reference grid', () => {
    const { scene } = createScene({ showGrid: false });
    expect(scene.getObjectByName('grid')).toBeUndefined();
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
