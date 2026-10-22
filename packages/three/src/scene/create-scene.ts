import {
  BackSide,
  BufferAttribute,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  SphereGeometry,
} from 'three';

import { createRoadNetwork, type RoadNetworkOptions } from './create-road-network';

export interface SceneOptions {
  /** Colour of the sky at the horizon, which is also the fog colour. */
  readonly horizon?: number;
  /** Colour of the sky overhead. */
  readonly zenith?: number;
  readonly groundColor?: number;
  /** Side length of the square ground plane, in metres. */
  readonly groundSize?: number;
  /** A grid of roads; omitted, the scene has none and the twin brings its own. */
  readonly roads?: RoadNetworkOptions;
}

/**
 * Builds the scene graph. Pure: it allocates no WebGL context, so it is assertable in a
 * headless test. The renderer is created separately in `create-viewer.ts`.
 *
 * `content` is the group that the twin (buildings, people, process route) is added to,
 * kept separate from lighting and terrain so that reloading the twin never disturbs them.
 */
export interface BuiltScene {
  readonly scene: Scene;
  readonly content: Group;
}

/** Half-size of the area the sun's shadow covers, in metres. */
const SHADOW_EXTENT = 125;
const SKY_RADIUS = 1800;

export const DEFAULT_HORIZON = 0xdfe6ec;
export const DEFAULT_ZENITH = 0x7ea6cf;

export function createScene(options: SceneOptions = {}): BuiltScene {
  const horizon = new Color(options.horizon ?? DEFAULT_HORIZON);
  const zenith = new Color(options.zenith ?? DEFAULT_ZENITH);

  const scene = new Scene();
  scene.background = horizon.clone();
  scene.fog = new Fog(horizon.clone(), 280, 1200);
  scene.add(createSkyDome(horizon, zenith));

  const skyLight = new HemisphereLight(0xe8eff6, 0x5d6a4d, 1.15);
  skyLight.name = 'sky-light';
  scene.add(skyLight);

  // Late-morning sun from the south-west, so façades facing the camera are lit.
  const sun = new DirectionalLight(0xfff0db, 2.9);
  sun.name = 'sun';
  sun.position.set(-95, 150, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -SHADOW_EXTENT;
  sun.shadow.camera.right = SHADOW_EXTENT;
  sun.shadow.camera.top = SHADOW_EXTENT;
  sun.shadow.camera.bottom = -SHADOW_EXTENT;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const size = options.groundSize ?? 4000;
  const ground = new Mesh(
    new PlaneGeometry(size, size),
    new MeshStandardMaterial({ color: options.groundColor ?? 0x6f8a52, roughness: 1 }),
  );
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  if (options.roads) scene.add(createRoadNetwork(options.roads));

  const content = new Group();
  content.name = 'content';
  scene.add(content);

  return { scene, content };
}

/** A sphere around the camera shading from the horizon colour up to the zenith colour. */
function createSkyDome(horizon: Color, zenith: Color): Mesh {
  const geometry = new SphereGeometry(SKY_RADIUS, 32, 16);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const color = new Color();
  for (let index = 0; index < position.count; index += 1) {
    const height = Math.max(0, position.getY(index) / SKY_RADIUS);
    color.copy(horizon).lerp(zenith, Math.pow(height, 0.6));
    color.toArray(colors, index * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));

  const dome = new Mesh(
    geometry,
    new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false }),
  );
  dome.name = 'sky';
  dome.renderOrder = -1;
  return dome;
}
