/**
 * The complete outward surface of the viewer.
 *
 * The viewer renders and reports; it does not decide. No threshold, cost calculation or
 * coverage rule belongs inside it, which is what keeps the same overlay values reusable by
 * the two-dimensional views (`docs/adr/ADR-002-threejs-rendering.md`).
 */
export interface EntityRef {
  readonly kind: string;
  readonly id: string;
}

export type OverlayId = string;

export type ViewerEvent =
  /** The user picked something. */
  | { readonly type: 'select'; readonly entity: EntityRef }
  /** The camera is moving to, or has settled on, an entity. */
  | { readonly type: 'focus'; readonly entity: EntityRef; readonly settled: boolean }
  /** Hover or multi-selection set changed. */
  | { readonly type: 'highlight'; readonly entities: readonly EntityRef[] }
  /** An overlay layer was shown or hidden. */
  | { readonly type: 'overlay'; readonly layer: OverlayId; readonly visible: boolean }
  /** The displayed scenario, or scenario comparison pair, changed. */
  | {
      readonly type: 'scenario';
      readonly asIs: string;
      readonly toBe: string | null;
    };

export type ViewerEventHandler = (event: ViewerEvent) => void;
