import {
  CanvasTexture,
  DoubleSide,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type MeshStandardMaterialParameters,
  type Texture,
} from 'three';

import { seededRandom } from './seeded-random';

/**
 * One shared material set for the whole twin, so buildings, furniture and vehicles read as
 * one place. Colours follow real finishes: white precast concrete, anodised aluminium,
 * blue-grey glazing, oak desks, steel cladding and painted racking.
 *
 * Materials with `userData.uvTile` get world-projected UVs when batched, so their texture
 * keeps a true scale (one repeat every `uvTile` metres).
 */
export type Materials = ReturnType<typeof createMaterials>;

export function createMaterials() {
  const textures = createTextures();
  const make = (
    name: string,
    parameters: MeshStandardMaterialParameters,
    uvTile?: number,
  ): MeshStandardMaterial => {
    const material = new MeshStandardMaterial(parameters);
    material.name = name;
    if (uvTile) material.userData.uvTile = uvTile;
    return material;
  };

  return {
    // Ground and site
    grass: make('grass', { color: 0x7d9a5b, roughness: 1, map: textures.grass }, 6),
    asphalt: make('asphalt', { color: 0x4a4e54, roughness: 0.95, map: textures.asphalt }, 5),
    yard: make('yard', { color: 0x63676d, roughness: 0.95, map: textures.asphalt }, 5),
    paving: make('paving', { color: 0xd4d0c8, roughness: 0.9, map: textures.paving }, 2.4),
    curb: make('curb', { color: 0xc9c8c3, roughness: 0.85 }),
    roadLine: make('road-line', { color: 0xf1f1ee, roughness: 0.7 }),
    roadLineYellow: make('road-line-yellow', { color: 0xe3b62c, roughness: 0.7 }),
    hedge: make('hedge', { color: 0x4f7340, roughness: 0.95, flatShading: true }),

    // Office building
    concrete: make('concrete', { color: 0xf1efea, roughness: 0.82, map: textures.concrete }, 3),
    plinth: make('plinth', { color: 0xa9a7a2, roughness: 0.9 }),
    aluminium: make('aluminium', { color: 0x3c4148, roughness: 0.35, metalness: 0.7 }),
    aluminiumLight: make('aluminium-light', { color: 0xc6cace, roughness: 0.3, metalness: 0.75 }),
    facadeGlass: make('facade-glass', {
      color: 0x6f8ea3,
      roughness: 0.04,
      metalness: 0.85,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: DoubleSide,
    }),
    partitionGlass: make('partition-glass', {
      color: 0xdbe8ef,
      roughness: 0.05,
      metalness: 0.2,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: DoubleSide,
    }),
    frostBand: make('frost-band', {
      color: 0xffffff,
      roughness: 0.6,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: DoubleSide,
    }),
    slab: make('slab', { color: 0xd3d1cc, roughness: 0.9 }),
    vinyl: make('vinyl', { color: 0xd9dad8, roughness: 0.75 }),
    carpet: make('carpet', { color: 0x8f959b, roughness: 1, map: textures.carpet }, 1.5),
    carpetDark: make('carpet-dark', { color: 0x666d75, roughness: 1, map: textures.carpet }, 1.5),
    stone: make('stone', { color: 0xe8e4dc, roughness: 0.45, map: textures.paving }, 1.2),
    oakFloor: make('oak-floor', { color: 0xc4a37b, roughness: 0.7, map: textures.planks }, 2),
    wallPaint: make('wall-paint', { color: 0xeeece7, roughness: 0.9 }),
    coreWall: make('core-wall', { color: 0xd6d3cc, roughness: 0.85 }),
    gravel: make('gravel', { color: 0x9c9e9f, roughness: 1, map: textures.asphalt }, 3),
    plantRoom: make('plant-room', { color: 0xb6babd, roughness: 0.6, metalness: 0.3 }),
    solar: make('solar', { color: 0x1f2a38, roughness: 0.25, metalness: 0.6 }),
    signage: make('signage', { color: 0xffffff, roughness: 0.6 }),

    // Furniture
    oak: make('oak', { color: 0xc9a675, roughness: 0.6 }),
    deskWhite: make('desk-white', { color: 0xf3f2ef, roughness: 0.5 }),
    steelBlack: make('steel-black', { color: 0x26292e, roughness: 0.45, metalness: 0.6 }),
    chairFabric: make('chair-fabric', { color: 0x30353b, roughness: 0.95 }),
    chairMesh: make('chair-mesh', { color: 0x4a4f56, roughness: 0.9 }),
    leather: make('leather', { color: 0x3a2c25, roughness: 0.55 }),
    sofa: make('sofa', { color: 0x6a7682, roughness: 0.95 }),
    sofaWarm: make('sofa-warm', { color: 0xa0826d, roughness: 0.95 }),
    screenOff: make('screen-off', { color: 0x15181c, roughness: 0.25, metalness: 0.4 }),
    screenOn: make('screen-on', {
      color: 0x1b2430,
      emissive: 0xa9c2d6,
      emissiveIntensity: 0.55,
      roughness: 0.3,
    }),
    plastic: make('plastic', { color: 0x2c2f33, roughness: 0.5 }),
    paper: make('paper', { color: 0xf7f6f2, roughness: 0.9 }),
    ceramicPot: make('ceramic-pot', { color: 0xe9e6df, roughness: 0.5 }),
    terracotta: make('terracotta', { color: 0x8c6a52, roughness: 0.8 }),
    foliage: make('foliage', { color: 0x46733d, roughness: 0.9, flatShading: true }),
    foliageLight: make('foliage-light', { color: 0x6b9452, roughness: 0.9, flatShading: true }),
    doorWood: make('door-wood', { color: 0xa47e56, roughness: 0.6 }),
    steelDoor: make('steel-door', { color: 0xa9aeb3, roughness: 0.35, metalness: 0.7 }),
    whiteboard: make('whiteboard', { color: 0xfafafa, roughness: 0.25 }),
    cabinet: make('cabinet', { color: 0xe4e3df, roughness: 0.55 }),
    kitchen: make('kitchen', { color: 0x5c6670, roughness: 0.5 }),
    countertop: make('countertop', { color: 0xe9e7e2, roughness: 0.3 }),

    // Hall, racking and production
    epoxy: make('epoxy', { color: 0xa8adb1, roughness: 0.55, map: textures.concrete }, 4),
    cladding: make(
      'cladding',
      { color: 0xc8cdd2, roughness: 0.55, metalness: 0.35, map: textures.ribs },
      1,
    ),
    claddingDark: make(
      'cladding-dark',
      { color: 0x59616b, roughness: 0.5, metalness: 0.4, map: textures.ribs },
      1,
    ),
    roofSheet: make(
      'roof-sheet',
      { color: 0x9aa0a6, roughness: 0.6, metalness: 0.3, map: textures.ribs },
      1,
    ),
    skylight: make('skylight', {
      color: 0xe9f0f4,
      roughness: 0.3,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
    steelColumn: make('steel-column', { color: 0x6c737b, roughness: 0.5, metalness: 0.5 }),
    rackUpright: make('rack-upright', { color: 0x2d5b94, roughness: 0.5, metalness: 0.4 }),
    rackBeam: make('rack-beam', { color: 0xdc6a1e, roughness: 0.5, metalness: 0.3 }),
    pallet: make('pallet', { color: 0xb38f5f, roughness: 0.9 }),
    carton: make('carton', { color: 0xc59d6d, roughness: 0.9 }),
    cartonDark: make('carton-dark', { color: 0xa8825a, roughness: 0.9 }),
    shrinkWrap: make('shrink-wrap', {
      color: 0xe3e8ea,
      roughness: 0.25,
      transparent: true,
      opacity: 0.6,
    }),
    floorYellow: make('floor-yellow', { color: 0xe2b52a, roughness: 0.6 }),
    floorWhite: make('floor-white', { color: 0xf0f0ec, roughness: 0.6 }),
    floorAmber: make('floor-amber', { color: 0xd98a1c, roughness: 0.6 }),
    machine: make('machine', { color: 0xdfe1e2, roughness: 0.45, metalness: 0.3 }),
    machineDark: make('machine-dark', { color: 0x3b4249, roughness: 0.45, metalness: 0.4 }),
    machineAccent: make('machine-accent', { color: 0x2f6d8f, roughness: 0.4, metalness: 0.3 }),
    machineWindow: make('machine-window', {
      color: 0x22303a,
      roughness: 0.1,
      metalness: 0.5,
      transparent: true,
      opacity: 0.75,
    }),
    roller: make('roller', { color: 0xb7bcc0, roughness: 0.3, metalness: 0.8 }),
    dockDoor: make(
      'dock-door',
      { color: 0xd7dadd, roughness: 0.5, metalness: 0.35, map: textures.slats },
      0.6,
    ),
    dockShelter: make('dock-shelter', { color: 0x1d1f22, roughness: 0.9 }),
    dockOpen: make('dock-open', { color: 0x15171a, roughness: 1 }),
    bumper: make('bumper', { color: 0x111214, roughness: 0.9 }),
    safetyYellow: make('safety-yellow', { color: 0xe7b416, roughness: 0.55 }),

    // Vehicles
    tyre: make('tyre', { color: 0x1a1b1d, roughness: 0.9 }),
    rim: make('rim', { color: 0xb9bdc1, roughness: 0.3, metalness: 0.85 }),
    chassis: make('chassis', { color: 0x25282c, roughness: 0.7, metalness: 0.4 }),
    trailer: make(
      'trailer',
      { color: 0xf0f1f2, roughness: 0.45, metalness: 0.2, map: textures.ribs },
      1.2,
    ),
    vehicleGlass: make('vehicle-glass', { color: 0x1d2630, roughness: 0.05, metalness: 0.7 }),
    ceilingLight: make('ceiling-light', {
      color: 0xffffff,
      emissive: 0xfff8ec,
      emissiveIntensity: 1.1,
      roughness: 0.4,
    }),
    lightFront: make('light-front', {
      color: 0xfafaf5,
      emissive: 0xfff7e0,
      emissiveIntensity: 0.4,
    }),
    lightRear: make('light-rear', { color: 0xa11d1d, emissive: 0x6b0f0f, emissiveIntensity: 0.5 }),
    forklift: make('forklift', { color: 0xe0a21d, roughness: 0.5, metalness: 0.2 }),

    // Trees
    bark: make('bark', { color: 0x6a5240, roughness: 0.95 }),
  } as const;
}

// ---------------------------------------------------------------------------------------
// Procedural textures. Each is mostly light grey with subtle variation, so it multiplies
// the material colour instead of replacing it.

interface TextureSet {
  readonly grass: Texture | null;
  readonly asphalt: Texture | null;
  readonly paving: Texture | null;
  readonly concrete: Texture | null;
  readonly carpet: Texture | null;
  readonly planks: Texture | null;
  readonly ribs: Texture | null;
  readonly slats: Texture | null;
}

function createTextures(): TextureSet {
  if (typeof document === 'undefined') {
    return {
      grass: null,
      asphalt: null,
      paving: null,
      concrete: null,
      carpet: null,
      planks: null,
      ribs: null,
      slats: null,
    };
  }
  return {
    grass: paint(1, 256, (context, size, random) => {
      speckle(context, size, random, 9000, 0.5, [205, 255]);
      for (let index = 0; index < 18; index += 1) {
        const x = random() * size;
        const y = random() * size;
        const gradient = context.createRadialGradient(x, y, 0, x, y, 30 + random() * 50);
        gradient.addColorStop(0, `rgba(${random() < 0.5 ? '255,255,235' : '200,215,190'},0.25)`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
      }
    }),
    asphalt: paint(2, 256, (context, size, random) => {
      speckle(context, size, random, 14000, 1, [190, 255]);
    }),
    paving: paint(3, 256, (context, size, random) => {
      speckle(context, size, random, 4000, 1, [225, 255]);
      context.strokeStyle = 'rgba(120,115,105,0.45)';
      context.lineWidth = 2;
      const step = size / 4;
      for (let row = 0; row < 4; row += 1) {
        const offset = row % 2 === 0 ? 0 : step / 2;
        context.beginPath();
        context.moveTo(0, row * step);
        context.lineTo(size, row * step);
        context.stroke();
        for (let column = 0; column <= 4; column += 1) {
          context.beginPath();
          context.moveTo(column * step + offset, row * step);
          context.lineTo(column * step + offset, (row + 1) * step);
          context.stroke();
        }
      }
    }),
    concrete: paint(4, 256, (context, size, random) => {
      speckle(context, size, random, 6000, 1, [228, 255]);
    }),
    carpet: paint(5, 128, (context, size, random) => {
      speckle(context, size, random, 7000, 1, [200, 255]);
      context.strokeStyle = 'rgba(90,90,90,0.18)';
      context.lineWidth = 1;
      context.strokeRect(0.5, 0.5, size - 1, size - 1);
    }),
    planks: paint(6, 256, (context, size, random) => {
      const rows = 8;
      for (let row = 0; row < rows; row += 1) {
        const shade = 215 + Math.floor(random() * 40);
        context.fillStyle = `rgb(${shade},${shade},${shade})`;
        context.fillRect(0, (row * size) / rows, size, size / rows);
        context.fillStyle = 'rgba(80,60,40,0.35)';
        context.fillRect(0, (row * size) / rows, size, 1.5);
        context.fillRect(((row * 97) % 7) * (size / 7), (row * size) / rows, 1.5, size / rows);
      }
    }),
    ribs: paint(7, 128, (context, size) => {
      context.fillStyle = 'rgb(242,242,242)';
      context.fillRect(0, 0, size, size);
      const ribs = 4;
      for (let rib = 0; rib < ribs; rib += 1) {
        const x = (rib * size) / ribs;
        const gradient = context.createLinearGradient(x, 0, x + size / ribs, 0);
        gradient.addColorStop(0, 'rgb(205,205,205)');
        gradient.addColorStop(0.18, 'rgb(255,255,255)');
        gradient.addColorStop(0.32, 'rgb(225,225,225)');
        gradient.addColorStop(1, 'rgb(240,240,240)');
        context.fillStyle = gradient;
        context.fillRect(x, 0, size / ribs, size);
      }
    }),
    slats: paint(8, 64, (context, size) => {
      context.fillStyle = 'rgb(245,245,245)';
      context.fillRect(0, 0, size, size);
      context.fillStyle = 'rgb(185,185,185)';
      context.fillRect(0, size - 3, size, 3);
    }),
  };
}

type Painter = (context: CanvasRenderingContext2D, size: number, random: () => number) => void;

/** Paints a tiling texture; `seed` gives each texture its own noise. */
function paint(seed: number, size: number, painter: Painter): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'rgb(240,240,240)';
  context.fillRect(0, 0, size, size);
  painter(context, size, seededRandom(seed * 7919 + size));

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function speckle(
  context: CanvasRenderingContext2D,
  size: number,
  random: () => number,
  count: number,
  dot: number,
  [low, high]: readonly [number, number],
): void {
  for (let index = 0; index < count; index += 1) {
    const shade = Math.floor(low + random() * (high - low));
    context.fillStyle = `rgb(${shade},${shade},${shade})`;
    context.fillRect(random() * size, random() * size, dot + random(), dot + random());
  }
}
