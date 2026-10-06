import { AmbientLight, Color, DirectionalLight, GridHelper, Group, Scene } from 'three';

export interface SceneOptions {
  readonly background?: number;
  readonly showGrid?: boolean;
}

/**
 * Builds the scene graph. Pure: it allocates no WebGL context, so it is assertable in a
 * headless test. The renderer is created separately in `create-viewer.ts`.
 *
 * `content` is the group that building geometry, desks and avatars are added to, kept
 * separate from lighting so that swapping the loaded model never disturbs the lighting rig.
 */
export interface BuiltScene {
  readonly scene: Scene;
  readonly content: Group;
}

export function createScene(options: SceneOptions = {}): BuiltScene {
  const scene = new Scene();
  scene.background = new Color(options.background ?? 0x0f1115);

  const ambient = new AmbientLight(0xffffff, 1.35);
  ambient.name = 'ambient';
  scene.add(ambient);

  const sun = new DirectionalLight(0xffffff, 0.5);
  sun.name = 'sun';
  sun.position.set(30, 45, 20);
  scene.add(sun);

  const content = new Group();
  content.name = 'content';
  scene.add(content);

  if (options.showGrid !== false) {
    const grid = new GridHelper(40, 40, 0x2a3340, 0x1a2129);
    grid.name = 'grid';
    scene.add(grid);
  }

  return { scene, content };
}
