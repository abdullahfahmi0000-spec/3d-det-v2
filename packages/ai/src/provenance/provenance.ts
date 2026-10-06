import type { SensitivityClass } from '../sensitivity/sensitivity';

/**
 * Provenance attached to every AI output.
 *
 * A reviewer approving a proposal is part of the security boundary, so they need to see
 * what went into it. `containsUntrustedContext` is set when any source was free text that
 * the platform did not author -- uploaded documents, synced description fields, notes from
 * an external system -- because instructions embedded in such text can shape an output
 * without exceeding any permission.
 */
export interface ContextSource {
  readonly reference: string;
  readonly sensitivity: SensitivityClass;
  readonly trusted: boolean;
}

export interface Provenance {
  readonly sources: readonly ContextSource[];
  readonly containsUntrustedContext: boolean;
  readonly promptHash: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly policyVersion: string;
}

export function summariseSources(sources: readonly ContextSource[]): {
  containsUntrustedContext: boolean;
  sensitivities: readonly SensitivityClass[];
} {
  return {
    containsUntrustedContext: sources.some((source) => !source.trusted),
    sensitivities: sources.map((source) => source.sensitivity),
  };
}
