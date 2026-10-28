# loaders

glTF 2.0 / GLB loading with Draco geometry (`create-gltf-loader.ts`). The host serves
three.js's Draco decoder (`draco_decoder.wasm`, `draco_wasm_wrapper.js`) at
`DRACO_DECODER_PATH` or a path it passes.

KTX2 texture transcoding is not implemented: the converted models carry WebP textures.
