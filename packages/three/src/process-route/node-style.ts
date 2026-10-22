import type { ProcessNodeState } from '../viewer-contract/twin-model';

export interface NodeStyle {
  readonly color: number;
  /** Whether the stop marker pulses to draw the eye. */
  readonly pulse: boolean;
}

/**
 * How each state is drawn. Purely visual: the state itself comes from the host. The
 * colours match the host page's status colours so a stop reads the same in 3D and in 2D.
 */
export const NODE_STYLES: Readonly<Record<ProcessNodeState, NodeStyle>> = {
  idle: { color: 0x8c939b, pulse: false },
  done: { color: 0x3fa676, pulse: false },
  active: { color: 0x3b82d6, pulse: true },
  waiting: { color: 0xe0a03a, pulse: true },
  rejected: { color: 0xd4554d, pulse: false },
  skipped: { color: 0x5c636b, pulse: false },
};

/**
 * Whether the order has travelled a leg of its route. A leg carries the state of the stop
 * it leads to, so it is travelled once that stop has been reached at all.
 */
export function isTravelled(state: ProcessNodeState): boolean {
  return state !== 'idle' && state !== 'skipped';
}
