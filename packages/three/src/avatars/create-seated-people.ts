import { Vector3, type Object3D } from 'three';

import type { AvatarAppearance } from './create-avatar-kit';
import { createCharacter, type Character, type CharacterModel } from './create-character';

/**
 * The people at the desks, animated: a character typing in every occupied chair, in place of
 * the procedural placeholder the site is built with. They are added to their workstation, so
 * cutting a floor away hides its people with it.
 *
 * Who sits where comes from the twin model; how each person looks is presentation only,
 * chosen from the workstation id so that it is the same on every load.
 */

/** An occupied chair, as the site built it. */
export interface Seat {
  readonly id: string;
  /** The workstation group: seat centre at its origin, the desk towards +Z. */
  readonly station: Object3D;
  /** The procedural person sitting there now, replaced by the character. */
  readonly placeholder: Object3D | null;
  readonly appearance: AvatarAppearance;
}

export interface SeatedPeople {
  readonly count: number;
  /** Animates the people on the floors now shown. */
  update(deltaSeconds: number): void;
  /** Takes the characters out again and puts the placeholders back. */
  dispose(): void;
}

/** The seated typing clip every office character model carries. */
const TYPING = 'Type';
/** The hips bone of a Mixamo rig, as GLTFLoader names it. */
const HIPS = 'mixamorigHips';
/**
 * Where the hips go over the chair: 8 cm behind the seat's centre, towards the backrest,
 * which puts the hands over the keyboard of the desk in front.
 */
const SEAT_BACK = 0.08;

/** Stable small integer from a string (FNV-1a). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Whether an object and every ancestor of it are shown. */
function shown(object: Object3D): boolean {
  for (let o: Object3D | null = object; o !== null; o = o.parent) if (!o.visible) return false;
  return true;
}

/**
 * Where the typing clip puts the hips relative to the feet, from its first frame: each person
 * is moved so that their hips, not their feet, are over the chair.
 */
function hipsOffset(model: CharacterModel): Vector3 {
  const probe = createCharacter(model);
  probe.play(TYPING);
  probe.update(0);
  const hips = probe.partPosition(HIPS) ?? new Vector3();
  probe.dispose();
  return hips;
}

export function seatPeople(
  seats: readonly Seat[],
  models: readonly CharacterModel[],
): SeatedPeople {
  const offsets = models.map(hipsOffset);
  const placed: { readonly character: Character; readonly seat: Seat }[] = [];

  for (const seat of seats) {
    if (models.length === 0) break;
    const h = hash(seat.id);
    const which = h % models.length;
    const model = models[which]!;
    const hips = offsets[which]!;
    const character = createCharacter(model, {
      Suit: seat.appearance.shirt,
      Pants: seat.appearance.shirt,
      Hair: seat.appearance.hair,
    });
    character.root.name = 'person';
    character.root.position.set(-hips.x, 0, -SEAT_BACK - hips.z);
    // Everyone types at their own pace, and not in step.
    character.play(TYPING, (h % 997) / 60);
    character.setPace(0.85 + ((h >>> 17) % 30) / 100);
    // Posed now, rather than standing in the bind pose until the first frame.
    character.update(0);
    if (seat.placeholder) seat.placeholder.visible = false;
    seat.station.add(character.root);
    placed.push({ character, seat });
  }

  return {
    count: placed.length,
    update(deltaSeconds) {
      for (const { character } of placed) {
        if (shown(character.root)) character.update(deltaSeconds);
      }
    },
    dispose() {
      for (const { character, seat } of placed) {
        character.dispose();
        if (seat.placeholder) seat.placeholder.visible = true;
      }
      placed.length = 0;
    },
  };
}
