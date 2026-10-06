/**
 * Data sensitivity classification, ordered from least to most restricted.
 *
 * The effective class of a request is the highest class across the task and everything
 * retrieved as grounding context. It must therefore be computed *after* retrieval: a task
 * classified Public that retrieves Confidential material is a Confidential request, and
 * routing it on the task's own class alone would send that material to whatever provider
 * the Public class permits.
 *
 * Which providers each class permits is defined by the routing policy, not here.
 */
export const SENSITIVITY_CLASSES = ['Public', 'Internal', 'Confidential', 'Restricted'] as const;

export type SensitivityClass = (typeof SENSITIVITY_CLASSES)[number];

const RANK: Record<SensitivityClass, number> = {
  Public: 0,
  Internal: 1,
  Confidential: 2,
  Restricted: 3,
};

export const rankOf = (value: SensitivityClass): number => RANK[value];

/** Returns the most restrictive of the given classes. Defaults to `Restricted` when empty. */
export function effectiveSensitivity(
  taskClass: SensitivityClass,
  contextClasses: readonly SensitivityClass[] = [],
): SensitivityClass {
  return [taskClass, ...contextClasses].reduce<SensitivityClass>(
    (highest, candidate) => (RANK[candidate] > RANK[highest] ? candidate : highest),
    taskClass,
  );
}

export const isAtLeast = (value: SensitivityClass, floor: SensitivityClass): boolean =>
  RANK[value] >= RANK[floor];
