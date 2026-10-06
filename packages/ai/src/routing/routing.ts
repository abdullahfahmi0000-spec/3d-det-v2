import type { SensitivityClass } from '../sensitivity/sensitivity';

/**
 * Model routing types.
 *
 * Routing maps what a task requires onto what the model catalogue offers, under a policy
 * that is versioned and approved. The policy evaluation itself is implemented alongside
 * the AI platform module; the shapes here exist so that callers cannot route without
 * recording which policy version decided and which model actually served.
 */
export type LatencyClass = 'Interactive' | 'Background' | 'Batch';

export interface TaskRequirements {
  readonly sensitivity: SensitivityClass;
  readonly latency: LatencyClass;
  readonly requiresJudgement: boolean;
}

export interface ModelCatalogueEntry {
  readonly modelId: string;
  readonly providerId: string;
  /** The highest sensitivity class this model is approved to receive. */
  readonly maxSensitivity: SensitivityClass;
}

/**
 * Record of a routing decision, written for every AI invocation.
 *
 * `effectiveSensitivity` is the post-retrieval value, which is the one that governed the
 * choice. Recording the task's own class instead would make the audit trail unable to
 * explain why a given provider was selected.
 */
export interface RoutingDecision {
  readonly policyVersion: string;
  readonly effectiveSensitivity: SensitivityClass;
  readonly selectedModelId: string;
  readonly candidatesConsidered: readonly string[];
  readonly fallbackApplied: boolean;
}
