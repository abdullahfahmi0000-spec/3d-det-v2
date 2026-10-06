/**
 * Outcome of an authorisation check.
 *
 * The permission model itself is owned by the authorisation module and is not implemented
 * here. This file provides only the decision value and the combination rule, because the
 * combination rule is an architectural invariant: an explicit denial must always win,
 * whatever order the contributing decisions arrive in.
 */
export type AuthorizationEffect = 'ALLOW' | 'DENY';

export interface AuthorizationDecision {
  readonly effect: AuthorizationEffect;
  /** Identifies what produced this decision, for audit and debugging. */
  readonly source: string;
}

export const allow = (source: string): AuthorizationDecision => ({ effect: 'ALLOW', source });

export const deny = (source: string): AuthorizationDecision => ({ effect: 'DENY', source });

/**
 * Combines contributing decisions. Deny takes precedence over allow, and an empty input
 * denies, so a resource with no applicable decision is closed rather than open.
 */
export function combineDecisions(
  decisions: readonly AuthorizationDecision[],
): AuthorizationDecision {
  const denial = decisions.find((decision) => decision.effect === 'DENY');
  if (denial !== undefined) {
    return denial;
  }
  const grant = decisions.find((decision) => decision.effect === 'ALLOW');
  return grant ?? deny('default-deny');
}
