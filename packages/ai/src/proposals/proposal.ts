import type { Provenance } from '../provenance/provenance';

/**
 * A proposed change produced by an AI agent.
 *
 * AI does not write authoritative state. It proposes; the platform records the proposal
 * with its provenance; a human promotes it. A rejected proposal is retained, because the
 * rejection is itself part of the audit trail.
 */
export type ProposalStatus = 'PENDING' | 'PROMOTED' | 'REJECTED';

export interface Proposal<TPayload = unknown> {
  readonly id: string;
  readonly status: ProposalStatus;
  readonly resourceType: string;
  readonly payload: TPayload;
  readonly provenance: Provenance;
  readonly createdAt: Date;
}

/** Proposals that must not be promoted by a single reviewer acting alone. */
export function requiresSecondApprover(proposal: Proposal): boolean {
  return proposal.provenance.containsUntrustedContext;
}
