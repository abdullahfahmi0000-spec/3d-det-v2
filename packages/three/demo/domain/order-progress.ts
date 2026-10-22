import type { O2CDataset, ProcessEvent, ProcessInstance, ProcessStep, Task } from './o2c-types';
import { holderOf, raciOf, taskOf } from './organization';

export type StepStatus =
  'pending' | 'in-progress' | 'awaiting-approval' | 'done' | 'rejected' | 'skipped';

export interface StepProgress {
  readonly step: ProcessStep;
  readonly task: Task;
  readonly status: StepStatus;
  readonly events: readonly ProcessEvent[];
}

export interface OrderProgress {
  readonly instance: ProcessInstance;
  readonly events: readonly ProcessEvent[];
  /** Label of the gateway branch the order took, or null before the gateway. */
  readonly branch: string | null;
  readonly steps: readonly StepProgress[];
  /** Steps the order has to pass, which excludes the branch it did not take. */
  readonly applicableSteps: number;
  readonly completedSteps: number;
  /** Where the order is now: the step in progress, awaiting approval or rejected. */
  readonly current: StepProgress | null;
  /** Person id (or the AI agent id) the current step is waiting on. */
  readonly waitingOn: string | null;
  /** Days from the first to the last recorded event. */
  readonly elapsedDays: number;
}

const OPEN_STATUSES: readonly StepStatus[] = ['in-progress', 'awaiting-approval', 'rejected'];
const MINUTES_PER_DAY = 24 * 60;

/** Reconstructs where one order stands in the process from its event log. */
export function computeOrderProgress(dataset: O2CDataset, orderRef: string): OrderProgress {
  const instance = dataset.instances.find((candidate) => candidate.orderRef === orderRef);
  if (!instance) throw new Error(`Unknown order ${orderRef}`);

  const events = dataset.events.filter((event) => event.orderRef === orderRef);
  const branch = events.find((event) => event.type === 'Branch_Activated')?.label ?? null;
  const skipped = skippedSteps(dataset, branch);

  const steps = dataset.steps.map((step): StepProgress => {
    const stepEvents = events.filter((event) => event.step === step.step);
    return {
      step,
      task: taskOf(dataset, step),
      status: skipped.has(step.step) ? 'skipped' : statusOf(stepEvents),
      events: stepEvents,
    };
  });

  const current = [...steps].reverse().find((step) => OPEN_STATUSES.includes(step.status)) ?? null;

  return {
    instance,
    events,
    branch,
    steps,
    applicableSteps: steps.filter((step) => step.status !== 'skipped').length,
    completedSteps: steps.filter((step) => step.status === 'done').length,
    current,
    waitingOn: current ? waitingOn(dataset, current) : null,
    elapsedDays: elapsedDays(events),
  };
}

function statusOf(events: readonly ProcessEvent[]): StepStatus {
  const has = (type: ProcessEvent['type']): boolean => events.some((event) => event.type === type);

  if (has('Approval_Rejected')) return 'rejected';
  if (has('Completed')) return 'done';
  if (has('Approval_Requested') && !has('Approval_Granted')) return 'awaiting-approval';
  if (has('Started')) return 'in-progress';
  return 'pending';
}

/**
 * Steps that only the untaken gateway branch leads to. A branch target that the flow
 * reaches again later (the credit check hands over to picking) is not skipped.
 */
function skippedSteps(dataset: O2CDataset, branch: string | null): Set<number> {
  if (!branch) return new Set();

  const reachedByFlow = new Set(dataset.flowLinks.map((link) => link.to));
  return new Set(
    dataset.gatewayLinks
      .filter(
        (link) => link.direction === 'Outgoing' && link.label && !branch.startsWith(link.label),
      )
      .map((link) => link.step)
      .filter((step) => !reachedByFlow.has(step)),
  );
}

/**
 * An approval waits on whoever is accountable for the task; any other open step waits on
 * whoever last acted on it.
 */
function waitingOn(dataset: O2CDataset, progress: StepProgress): string | null {
  if (progress.status === 'awaiting-approval') {
    const accountable = raciOf(dataset, progress.task.code)?.accountable;
    return accountable ? (holderOf(dataset, accountable)?.id ?? null) : null;
  }
  const lastActor = [...progress.events].reverse().find((event) => event.by !== null)?.by;
  return lastActor ?? null;
}

function elapsedDays(events: readonly ProcessEvent[]): number {
  const first = events[0];
  const last = events[events.length - 1];
  if (!first || !last) return 0;
  return minutesBetween(first.at, last.at) / MINUTES_PER_DAY;
}

export function minutesBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 60_000;
}
