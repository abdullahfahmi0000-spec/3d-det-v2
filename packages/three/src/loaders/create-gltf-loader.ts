import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Where the host serves three.js's Draco decoder (`draco_decoder.wasm` and
 * `draco_wasm_wrapper.js`, from `three/examples/jsm/libs/draco/gltf/`). The converted
 * models carry Draco-compressed geometry (3DV-14).
 */
export const DRACO_DECODER_PATH = '/draco/';

const dracoLoaders = new Map<string, DRACOLoader>();

/** A GLTFLoader that also reads Draco-compressed geometry. One decoder per path is shared. */
export function createGltfLoader(dracoPath: string = DRACO_DECODER_PATH): GLTFLoader {
  let draco = dracoLoaders.get(dracoPath);
  if (!draco) {
    draco = new DRACOLoader().setDecoderPath(dracoPath);
    dracoLoaders.set(dracoPath, draco);
  }
  return new GLTFLoader().setDRACOLoader(draco);
}
