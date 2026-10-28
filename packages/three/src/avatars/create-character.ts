import {
  AnimationMixer,
  Color,
  Group,
  LoopRepeat,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { createGltfLoader } from '../loaders/create-gltf-loader';

/**
 * Animated people: Mixamo characters converted to GLB by `scripts/blender/build_character.py`,
 * each a skinned mesh with its recorded clips (Walk, Idle, Talk, Type). A character is one
 * person: its own copy of the skeleton, and a mixer that plays the clips on it.
 */

/** A loaded character model: the skinned scene and its clips, cloned once per person. */
export interface CharacterModel {
  readonly scene: Object3D;
  readonly clips: readonly AnimationClip[];
}

export type CharacterLoader = (name: string) => Promise<CharacterModel>;

/** Loads `${baseUrl}${name}.glb` with its animations. */
export function gltfCharacterLoader(baseUrl: string, dracoPath?: string): CharacterLoader {
  const loader = createGltfLoader(dracoPath);
  return async (name) => {
    const gltf = await loader.loadAsync(`${baseUrl}${name}.glb`);
    return { scene: gltf.scene, clips: gltf.animations };
  };
}

/**
 * Colours multiplied into one person's clothes and hair, by the last part of the mesh's name
 * (Mixamo names them `Ch23_Suit`, `Ch23_Shirt`, ...). Presentation only.
 */
export type Outfit = Partial<Record<'Suit' | 'Pants' | 'Shirt' | 'Hair' | 'Tie', number>>;

export interface Character {
  /** Place and turn this; the model inside faces +Z with its feet at the origin. */
  readonly root: Group;
  /** The clip playing now, or null. */
  readonly playing: string | null;
  /** Whether the model has a clip of that name. */
  has(clip: string): boolean;
  /**
   * Cross-fades to a looping clip. `at` starts it part-way, in seconds, so that people
   * playing the same clip are not in step. Asking for the clip already playing does nothing.
   */
  play(clip: string, at?: number): void;
  /** Speed of the clip playing now, 1 being as recorded. */
  setPace(timeScale: number): void;
  update(deltaSeconds: number): void;
  /** Where a bone or mesh is, relative to the character's root. */
  partPosition(name: string): Vector3 | null;
  /** A bone or mesh by name, such as `mixamorigRightHand`. */
  part(name: string): Object3D | undefined;
  /** Releases what this person owns: the mixer's state and any tinted materials. */
  dispose(): void;
}

const FADE_SECONDS = 0.3;

export function createCharacter(model: CharacterModel, outfit: Outfit = {}): Character {
  const root = new Group();
  const body = cloneSkinned(model.scene);
  const ownMaterials: Material[] = [];
  body.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh !== true) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // A skinned mesh's bounds are its bind pose: a seated or walking pose leaves them, and the
    // person would vanish at the edge of the screen.
    mesh.frustumCulled = false;
    const part = mesh.name.split('_').at(-1) as keyof Outfit | undefined;
    const tint = part === undefined ? undefined : outfit[part];
    if (tint === undefined) return;
    const material = (mesh.material as MeshStandardMaterial).clone();
    material.color = new Color(tint);
    mesh.material = material;
    ownMaterials.push(material);
  });
  root.add(body);

  const mixer = new AnimationMixer(body);
  const actions = new Map<string, AnimationAction>(
    model.clips.map((clip) => [clip.name, mixer.clipAction(clip)]),
  );
  let current: AnimationAction | null = null;

  return {
    root,
    get playing() {
      return current?.getClip().name ?? null;
    },
    has: (clip) => actions.has(clip),
    play(clip, at) {
      const next = actions.get(clip);
      if (!next || next === current) return;
      next.reset();
      next.setLoop(LoopRepeat, Infinity);
      if (at !== undefined) next.time = at % next.getClip().duration;
      next.play();
      if (current) next.crossFadeFrom(current, FADE_SECONDS, false);
      current = next;
    },
    setPace(timeScale) {
      if (current) current.timeScale = timeScale;
    },
    update: (deltaSeconds) => mixer.update(deltaSeconds),
    part: (name) => root.getObjectByName(name),
    partPosition(name) {
      const part = root.getObjectByName(name);
      if (!part) return null;
      root.updateMatrixWorld(true);
      return root.worldToLocal(part.getWorldPosition(new Vector3()));
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(body);
      for (const material of ownMaterials) material.dispose();
      root.removeFromParent();
    },
  };
}

/** Releases a loaded character model's geometry, materials and textures. */
export function disposeCharacterModel(model: CharacterModel): void {
  model.scene.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh !== true) return;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      (material as MeshStandardMaterial).map?.dispose();
      material.dispose();
    }
  });
}
