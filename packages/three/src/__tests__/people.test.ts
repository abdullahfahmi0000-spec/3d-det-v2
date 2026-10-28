import {
  AnimationClip,
  Bone,
  Box3,
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
  VectorKeyframeTrack,
  type Material,
  type MeshStandardMaterial as StandardMaterial,
} from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { Materials } from '../assets/materials';
import { createCharacter, type CharacterModel } from '../avatars/create-character';
import { createProcessAvatar, WALK_SPEED } from '../avatars/create-process-avatar';
import { seatPeople, type Seat } from '../avatars/create-seated-people';
import { buildRoom, insideFacade, receptionLayout, stairOpening } from '../building/create-room';
import { createSwingDoors } from '../building/create-swing-doors';
import { ShapeBatch, solidsOf } from '../building/shape-batch';
import { isComingThrough, passesThrough } from '../building/walker';
import type { RoomModel } from '../viewer-contract/twin-model';

/**
 * A stand-in for a converted Mixamo character: one skinned box on a hips bone with a right
 * hand, and a still clip per name that holds the hips at `hips`.
 */
function fakeCharacter(clips: readonly string[], hips = new Vector3(0, 0.9, 0)): CharacterModel {
  const root = new Bone();
  root.name = 'mixamorigHips';
  root.position.copy(hips);
  const hand = new Bone();
  hand.name = 'mixamorigRightHand';
  hand.position.set(0.3, 0.4, 0);
  root.add(hand);

  const geometry = new BoxGeometry(0.4, 1.8, 0.3);
  const count = geometry.attributes.position!.count;
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
  geometry.setAttribute(
    'skinWeight',
    new Float32BufferAttribute(
      Array.from({ length: count * 4 }, (_, index) => (index % 4 === 0 ? 1 : 0)),
      4,
    ),
  );
  const body = new SkinnedMesh(geometry, new MeshStandardMaterial());
  body.name = 'Ch23_Suit';
  const scene = new Group();
  scene.add(root, body);
  scene.updateMatrixWorld(true);
  body.bind(new Skeleton([root, hand]));

  const held = hips.toArray();
  return {
    scene,
    clips: clips.map(
      (name) =>
        new AnimationClip(name, 1, [
          new VectorKeyframeTrack('mixamorigHips.position', [0, 1], [...held, ...held]),
        ]),
    ),
  };
}

const at = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

describe('walkers and doorways', () => {
  const doorway = at(0, 0, 0);

  it('knows a walk through a doorway from one that passes it by', () => {
    expect(passesThrough(doorway, [at(0, 0, -3), at(0, 0, 3)])).toBe(true);
    // Along the corridor, two metres from the door.
    expect(passesThrough(doorway, [at(-5, 0, 2), at(5, 0, 2)])).toBe(false);
    // Through the same spot a storey up.
    expect(passesThrough(doorway, [at(0, 4, -3), at(0, 4, 3)])).toBe(false);
    expect(passesThrough(doorway, [])).toBe(false);
  });

  it('lets a door open only for someone near it on a walk through it', () => {
    const route = [at(0, 0, -6), at(0, 0, 6)];
    expect(isComingThrough({ position: at(0, 0, -2), route }, doorway, 2.8)).toBe(true);
    expect(isComingThrough({ position: at(0, 0, -5), route }, doorway, 2.8)).toBe(false);
    expect(isComingThrough({ position: at(0, 0, -2), route: [] }, doorway, 2.8)).toBe(false);
  });
});

describe('createSwingDoors', () => {
  // A door hinged at the origin, its leaf along +X, so the doorway's middle is (0.5, 0, 0).
  const setup = () => {
    const doors = createSwingDoors(
      [{ hinge: new Matrix4(), width: 1, height: 2.1, swing: Math.PI / 2 }],
      new MeshStandardMaterial(),
    );
    doors.root.updateMatrixWorld(true);
    return doors;
  };

  it('swings open for someone walking through it, and shuts once they are well past', () => {
    const doors = setup();
    const route = [at(0.5, 0, -4), at(0.5, 0, 10)];

    doors.update(0.1, [{ position: at(0.5, 0, -4), route }]);
    expect(doors.openness()[0]).toBe(0);
    doors.update(0.175, [{ position: at(0.5, 0, -3), route }]);
    expect(doors.openness()[0]).toBeCloseTo(0.5);
    doors.update(1, [{ position: at(0.5, 0, -1), route }]);
    expect(doors.openness()[0]).toBe(1);
    expect(doors.leaves[0]!.parent!.rotation.y).toBeCloseTo(Math.PI / 2);

    // Still open for the camera following a few steps behind them...
    doors.update(1, [{ position: at(0.5, 0, 4.5), route }]);
    expect(doors.openness()[0]).toBe(1);
    // ...and shut once they are well into the room.
    doors.update(1, [{ position: at(0.5, 0, 8), route }]);
    expect(doors.openness()[0]).toBe(0);
  });

  it('swings into the room whichever way its wall faces', () => {
    // Hung on a wall turned half round, like a room's north wall: the room is toward +Z.
    const doors = createSwingDoors(
      [{ hinge: new Matrix4().makeRotationY(Math.PI), width: 1, height: 2.1, swing: Math.PI / 2 }],
      new MeshStandardMaterial(),
    );
    doors.root.updateMatrixWorld(true);
    const route = [at(-0.5, 0, -4), at(-0.5, 0, 4)];
    doors.update(1, [{ position: at(-0.5, 0, -1), route }]);
    doors.root.updateMatrixWorld(true);
    const tip = new Vector3(1, 0, 0).applyMatrix4(doors.leaves[0]!.parent!.matrixWorld);
    expect(tip.x).toBeCloseTo(0);
    expect(tip.z).toBeCloseTo(1);
  });

  it('stays shut for someone walking past it', () => {
    const doors = setup();
    const route = [at(-5, 0, 2), at(5, 0, 2)];
    doors.update(1, [{ position: at(0.5, 0, 2), route }]);
    expect(doors.openness()[0]).toBe(0);
  });
});

describe('buildRoom', () => {
  // Materials only need to be distinct objects here.
  const materials = new Map<PropertyKey, Material>();
  const m = new Proxy({} as Materials, {
    get: (_, key) => {
      if (!materials.has(key)) materials.set(key, new MeshStandardMaterial());
      return materials.get(key);
    },
  });
  const room = (kind: RoomModel['kind']): RoomModel => ({
    id: kind,
    kind,
    title: kind,
    center: [0, 0],
    size: [10, 10],
    door: 'south',
  });

  it('records the door to hang, instead of building it standing open', () => {
    const spots: Parameters<typeof createSwingDoors>[0][number][] = [];
    buildRoom(new ShapeBatch(), m, room('office'), { size: [40, 30] }, 0, 3.7, { doors: spots });
    expect(spots).toHaveLength(1);
    // Hinged in the south partition, half a door's width from its middle.
    const hinge = new Vector3().setFromMatrixPosition(spots[0]!.hinge);
    expect(hinge.z).toBeCloseTo(4.95);
    expect(Math.abs(hinge.x)).toBeCloseTo(0.5);
  });

  it('climbs a core stair to the finished floor above', () => {
    const batch = new ShapeBatch();
    buildRoom(batch, m, room('core'), { size: [40, 30] }, 0, 3.7, { climb: 4 });
    const stone = batch
      .build('core')
      .children.find((child) => (child as Mesh).material === m.stone) as Mesh;
    stone.geometry.computeBoundingBox();
    expect(stone.geometry.boundingBox!.max.y).toBeCloseTo(4);
  });

  it('keeps walls and furniture of a room on the facade clear of its columns and glazing', () => {
    const building = { size: [40, 30] as const };
    for (const kind of ['office', 'break', 'meeting', 'core'] as const) {
      const batch = new ShapeBatch();
      // Against the north facade, at z = -15.
      buildRoom(batch, m, { ...room(kind), center: [0, -10] }, building, 0, 3.7);
      const group = batch.build(kind);
      group.updateMatrixWorld(true);
      const standing = solidsOf(group).filter((solid) => solid.max.y - solid.min.y > 0.05);
      expect(standing.length).toBeGreaterThan(0);
      for (const solid of standing) expect(solid.min.z).toBeGreaterThan(-15 + 0.29);
    }
  });

  it('builds a stair core in which nothing runs into anything else', () => {
    const batch = new ShapeBatch();
    buildRoom(batch, m, room('core'), { size: [40, 30] }, 0, 3.7, { climb: 4 });
    const group = batch.build('core');
    group.updateMatrixWorld(true);
    // Everything but the floor finish (up to 3 cm), which things stand in.
    const solids = solidsOf(group).filter((solid) => solid.max.y > 0.035);
    const clashes: string[] = [];
    solids.forEach((a, i) =>
      solids.slice(i + 1).forEach((b) => {
        const dx = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
        const dy = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
        const dz = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
        if (dx > 0.01 && dy > 0.01 && dz > 0.01)
          clashes.push(`${a.min.toArray()} / ${b.min.toArray()}`);
      }),
    );
    expect(clashes).toEqual([]);
  });

  it('builds no stair on the top floor, where it would climb into the roof', () => {
    const stoneOf = (stairUp: boolean): Mesh | undefined => {
      const batch = new ShapeBatch();
      buildRoom(batch, m, room('core'), { size: [40, 30] }, 0, 3.7, { climb: 4, stairUp });
      return batch.build('core').children.find((child) => (child as Mesh).material === m.stone) as
        Mesh | undefined;
    };
    expect(stoneOf(true)).toBeDefined();
    expect(stoneOf(false)).toBeUndefined();
  });

  it('seats the receptionist in the reception chair, facing the counter and the door', () => {
    const building = { size: [40, 30] as const };
    // A lobby on the south facade, its door out through it, as at the head office.
    const lobby = { ...room('lobby'), center: [0, 9] as const };
    const batch = new ShapeBatch();
    buildRoom(batch, m, lobby, building, 0, 3.7);
    const group = batch.build('lobby');
    group.updateMatrixWorld(true);
    const solids = solidsOf(group);
    const { seat, rotation } = receptionLayout(insideFacade(lobby, building));
    const standsAt = (x: number, y: number, z: number): Box3 | undefined =>
      solids.find((solid) => solid.containsPoint(new Vector3(x, y, z)));

    // The chair's seat cushion is where the receptionist sits...
    expect(standsAt(seat[0], 0.46, seat[1])).toBeDefined();
    // ...and the counter is a little way in front of it, towards the door (south, +Z).
    expect(Math.cos(rotation)).toBeCloseTo(1);
    const counter = standsAt(seat[0], 1.12, seat[1] + 1);
    expect(counter).toBeDefined();
    expect(counter!.max.y).toBeCloseTo(1.14);
  });

  it('leaves the floor of a core open over the stair coming up from below', () => {
    const building = { size: [40, 30] as const };
    const core = { ...room('core'), center: [0, -10] as const };
    const batch = new ShapeBatch();
    buildRoom(batch, m, core, building, 4, 3.7, { climb: 4, stairBelow: true });
    const group = batch.build('core');
    group.updateMatrixWorld(true);
    const hole = stairOpening(insideFacade(core, building));
    const middle = new Vector3((hole.minX + hole.maxX) / 2, 4.01, (hole.minZ + hole.maxZ) / 2);
    const floors = solidsOf(group).filter((solid) => solid.max.y < 4.05);
    expect(floors.length).toBeGreaterThan(0);
    expect(floors.some((solid) => solid.containsPoint(middle))).toBe(false);
  });
});

describe('createCharacter', () => {
  it('tints the clothes by part and plays one clip at a time', () => {
    const character = createCharacter(fakeCharacter(['Walk', 'Idle']), { Suit: 0xff0000 });
    const suit = character.root.getObjectByName('Ch23_Suit') as SkinnedMesh;
    expect((suit.material as StandardMaterial).color.getHex()).toBe(0xff0000);

    expect(character.playing).toBeNull();
    character.play('Walk');
    character.play('Idle');
    expect(character.playing).toBe('Idle');
    expect(character.has('Type')).toBe(false);
  });
});

describe('seatPeople', () => {
  const seat = (id: string): Seat => {
    const station = new Group();
    const placeholder = new Group();
    station.add(placeholder);
    return {
      id,
      station,
      placeholder,
      appearance: { shirt: 0x336699, skin: 0xd9a066, hair: 0x2b1d14 },
    };
  };

  it('sits a typing character in each chair, hips over the seat, in place of the placeholder', () => {
    const seats = [seat('A'), seat('B')];
    const people = seatPeople(seats, [fakeCharacter(['Type'], at(0.1, 0.5, -0.2))]);

    expect(people.count).toBe(2);
    for (const { station, placeholder } of seats) {
      expect(placeholder!.visible).toBe(false);
      const person = station.children.find((child) => child.name === 'person')!;
      person.updateMatrixWorld(true);
      const hips = station.worldToLocal(
        person.getObjectByName('mixamorigHips')!.getWorldPosition(new Vector3()),
      );
      // Centred on the seat, a little back toward the backrest.
      expect(hips.x).toBeCloseTo(0);
      expect(hips.z).toBeCloseTo(-0.08);
    }

    people.dispose();
    for (const { station, placeholder } of seats) {
      expect(placeholder!.visible).toBe(true);
      expect(station.children.some((child) => child.name === 'person')).toBe(false);
    }
  });

  it('seats nobody without a model', () => {
    expect(seatPeople([seat('A')], []).count).toBe(0);
  });
});

describe('createProcessAvatar', () => {
  const model = () => fakeCharacter(['Walk', 'Idle', 'Talk']);

  it('walks a route at its walking pace, empty-handed, then talks at the desk', () => {
    const avatar = createProcessAvatar(model());
    expect(avatar.root.visible).toBe(false);
    expect(avatar.carrying).toBe(false);
    expect(avatar.root.getObjectByName('order-folder')!.visible).toBe(false);

    const arrived = vi.fn();
    const seconds = avatar.walk([at(0, 0, 0), at(0, 0, 4), at(3, 0, 4)], {
      facing: Math.PI,
      onArrive: arrived,
    });
    expect(seconds).toBeCloseTo(7 / WALK_SPEED);
    expect(avatar.root.visible).toBe(true);
    expect(avatar.walker.route).toHaveLength(3);

    avatar.update(1);
    expect(avatar.clip).toBe('Walk');
    expect(avatar.root.position.z).toBeCloseTo(WALK_SPEED);

    for (let step = 0; step < 10; step += 1) avatar.update(0.5);
    expect(arrived).toHaveBeenCalledTimes(1);
    expect(avatar.root.position.distanceTo(at(3, 0, 4))).toBeLessThan(1e-6);
    expect(avatar.clip).toBe('Talk');
    expect(avatar.walking).toBe(false);
    expect(avatar.walker.route).toHaveLength(0);
  });

  it('walks long routes faster, within a limit', () => {
    const avatar = createProcessAvatar(model());
    expect(avatar.walk([at(0, 0, 0), at(0, 0, 100)], { maxSeconds: 20 })).toBeCloseTo(20);
    // Beyond three and a half times its pace it runs long rather than skate.
    expect(avatar.walk([at(0, 0, 0), at(0, 0, 200)], { maxSeconds: 20 })).toBeCloseTo(
      200 / WALK_SPEED / 3.5,
    );
  });

  it('changes pace at once when its speed is set, a walk under way too', () => {
    const avatar = createProcessAvatar(model());
    avatar.setSpeed(2);
    expect(avatar.walk([at(0, 0, 0), at(0, 0, 40)])).toBeCloseTo(40 / WALK_SPEED / 2);
    avatar.update(1);
    expect(avatar.root.position.z).toBeCloseTo(WALK_SPEED * 2);
    avatar.setSpeed(4);
    avatar.update(1);
    expect(avatar.root.position.z).toBeCloseTo(WALK_SPEED * 6);
  });

  it('carries the order in its hand only when told to, through a walk and a stand', () => {
    const avatar = createProcessAvatar(model());
    const folder = avatar.root.getObjectByName('order-folder')!;
    const hand = avatar.root.getObjectByName('mixamorigRightHand')!;
    avatar.setCarrying(true);
    expect(avatar.carrying).toBe(true);
    expect(folder.visible).toBe(true);
    expect(folder.parent).toBe(hand);

    avatar.walk([at(0, 0, 0), at(0, 0, 4)]);
    for (let step = 0; step < 6; step += 1) avatar.update(0.5);
    expect(avatar.clip).toBe('Talk');
    expect(avatar.carrying).toBe(true);

    avatar.placeAt(at(1, 0, 0), 0, 'Talk');
    avatar.setCarrying(false);
    expect(folder.visible).toBe(false);
    expect(avatar.clip).toBe('Talk');
  });

  it('holds still while paused, and drops the walk when hidden', () => {
    const avatar = createProcessAvatar(model());
    const arrived = vi.fn();
    avatar.walk([at(0, 0, 0), at(0, 0, 4)], { onArrive: arrived });
    avatar.setPaused(true);
    avatar.update(5);
    expect(avatar.root.position.z).toBe(0);

    avatar.setPaused(false);
    avatar.hide();
    avatar.update(5);
    expect(avatar.root.visible).toBe(false);
    expect(arrived).not.toHaveBeenCalled();
  });
});
