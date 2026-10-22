import { AI_AGENT_ID, type O2CDataset } from './o2c-types';
import { computeOrderProgress } from './order-progress';
import { taskOf } from './organization';

export interface StepWaitKpi {
  readonly step: number;
  readonly taskName: string;
  readonly declaredMinutes: number;
  /** Average measured wait before the step, or null when no order has reached it. */
  readonly measuredMinutes: number | null;
  readonly samples: number;
}

export interface ProcessKpis {
  readonly declaredDays: number;
  /** Average cycle time of the completed orders, in days. */
  readonly averageCycleDays: number | null;
  readonly completedOrders: number;
  readonly openOrders: number;
  readonly rejectedOrders: number;
  readonly stepWaits: readonly StepWaitKpi[];
  readonly agentCompletedEvents: number;
  readonly completedEvents: number;
  readonly uncoveredJobs: number;
}

/** Declared against measured figures for the process, computed from the event log. */
export function computeProcessKpis(dataset: O2CDataset): ProcessKpis {
  const completed = dataset.instances.filter((instance) => instance.status === 'Completed');
  const cycleDays = completed.map(
    (instance) => computeOrderProgress(dataset, instance.orderRef).elapsedDays,
  );

  const stepWaits = dataset.steps
    .filter((step) => step.waitBeforeMinutes > 0)
    .map((step): StepWaitKpi => {
      const waits = dataset.events
        .filter((event) => event.step === step.step && event.type === 'Started')
        .map((event) => event.waitBeforeMinutes)
        .filter((wait): wait is number => wait !== null);
      return {
        step: step.step,
        taskName: taskOf(dataset, step).name,
        declaredMinutes: step.waitBeforeMinutes,
        measuredMinutes: average(waits),
        samples: waits.length,
      };
    });

  const completedEvents = dataset.events.filter((event) => event.type === 'Completed');

  return {
    declaredDays: dataset.process.declaredAverageDurationDays,
    averageCycleDays: average(cycleDays),
    completedOrders: completed.length,
    openOrders: dataset.instances.filter(
      (instance) => instance.status === 'Suspended' || instance.status === 'Running',
    ).length,
    rejectedOrders: dataset.instances.filter((instance) => instance.status === 'Aborted').length,
    stepWaits,
    agentCompletedEvents: completedEvents.filter((event) => event.by === AI_AGENT_ID).length,
    completedEvents: completedEvents.length,
    uncoveredJobs: dataset.uncoveredJobs.length,
  };
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
