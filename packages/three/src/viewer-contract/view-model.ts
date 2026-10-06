import type { EntityRef, OverlayId } from './events';

/**
 * Everything the viewer needs in order to draw, and nothing it would need in order to
 * decide. Overlay values arrive already resolved, so the rule that produced them lives in
 * one place on the server instead of being reimplemented per surface.
 */
export interface GeometryRef {
  /** Location of the glTF 2.0 / GLB asset. */
  readonly url: string;
  readonly contentHash: string;
}

export interface Placement {
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
}

export interface DeskPlacement extends Placement {
  readonly id: string;
  readonly storey: number;
  readonly occupant: EntityRef | null;
}

export interface AvatarPlacement extends Placement {
  readonly id: string;
  readonly deskId: string | null;
  readonly model: GeometryRef;
}

export interface SceneViewModel {
  readonly shell: GeometryRef | null;
  readonly desks: readonly DeskPlacement[];
  readonly avatars: readonly AvatarPlacement[];
  /** Pre-computed, colour-ready values per entity. */
  readonly overlays: Readonly<Record<OverlayId, Readonly<Record<string, number>>>>;
}

export const emptySceneViewModel = (): SceneViewModel => ({
  shell: null,
  desks: [],
  avatars: [],
  overlays: {},
});
