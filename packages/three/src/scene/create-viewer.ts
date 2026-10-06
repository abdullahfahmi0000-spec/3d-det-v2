import { BoxGeometry, Mesh, MeshStandardMaterial, WebGLRenderer } from 'three';

import { createCamera } from '../camera/create-camera';
import { createScene } from './create-scene';

export interface ViewerHandle {
  /** Stops the animation loop and releases the WebGL context and GPU resources. */
  dispose(): void;
  /** Applies a new drawing-buffer size. */
  resize(width: number, height: number): void;
  /** Frames rendered since start, used by the bootstrap check. */
  frameCount(): number;
}

/**
 * Minimal viewer bootstrap: initialises the WebGL renderer against a canvas, builds the
 * scene and camera, and runs a render loop.
 *
 * This verifies that the rendering pipeline is wired correctly. It is not the digital twin:
 * there is no building, no floor plan and no data here.
 */
export function createViewer(canvas: HTMLCanvasElement): ViewerHandle {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));

  const { scene, content } = createScene();
  const camera = createCamera({ aspect: canvas.clientWidth / Math.max(canvas.clientHeight, 1) });

  const probe = new Mesh(
    new BoxGeometry(4, 4, 4),
    new MeshStandardMaterial({ color: 0x3f7fa6, roughness: 0.45, metalness: 0.1 }),
  );
  probe.name = 'bootstrap-probe';
  probe.position.set(0, 2, 0);
  content.add(probe);

  let frames = 0;
  let running = true;

  const renderFrame = (): void => {
    if (!running) return;
    probe.rotation.y += 0.006;
    probe.rotation.x += 0.002;
    renderer.render(scene, camera);
    frames += 1;
    renderer.setAnimationLoop(renderFrame);
  };

  const resize = (width: number, height: number): void => {
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  resize(canvas.clientWidth || 1, canvas.clientHeight || 1);
  renderer.setAnimationLoop(renderFrame);

  return {
    dispose: () => {
      running = false;
      renderer.setAnimationLoop(null);
      probe.geometry.dispose();
      probe.material.dispose();
      renderer.dispose();
    },
    resize,
    frameCount: () => frames,
  };
}
