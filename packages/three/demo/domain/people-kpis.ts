import { AI_AGENT_ID, type CostAssumptions, type O2CDataset, type Task } from './o2c-types';
import { computeOrderProgress, minutesBetween } from './order-progress';
import { agentJobCode, holderOf } from './organization';

/**
 * What each job holder did in the event log, what it cost, and where they hold the
 * process up. One entry per job; `actorId` is the person holding it, the AI agent for an
 * automated job, or null for a vacant job.
 */
export interface JobKpis {
  readonly jobCode: string;
  readonly actorId: string | null;
  readonly responsibleFor: readonly Task[];
  readonly accountableFor: readonly Task[];
  /** Steps this actor completed. */
  readonly completed: number;
  /** Completed steps whose task belongs to another job (work done outside the role). */
  readonly outOfRole: number;
  /** The tasks done outside the role, with the job each one belongs to. */
  readonly outOfRoleWork: readonly { readonly task: Task; readonly job: string }[];
  /** Average hands-on minutes per completed step, excluding time spent waiting on approval. */
  readonly averageHandlingMinutes: number | null;
  /** Average of the declared typical minutes for the same steps. */
  readonly typicalMinutes: number | null;
  /** Average wait before the steps this actor started, against the declared wait. */
  readonly averageWaitMinutes: number | null;
  readonly declaredWaitMinutes: number | null;
  /** Steps started after their SLA had already run out. */
  readonly slaBreaches: number;
  readonly approvals: {
    readonly granted: number;
    readonly rejected: number;
    /** Average minutes from the approval request to the decision. */
    readonly averageDecisionMinutes: number | null;
  };
  /** Orders that are waiting on this actor now. */
  readonly openOrders: readonly string[];
  /** Declared load of the job holder, where the guide gives one. */
  readonly loadPercent: number | null;
  readonly hourlyRate: number | null;
  readonly annualCost: number | null;
  /** Labour cost of the hands-on time recorded in the event log. */
  readonly costOnOrders: number;
}

export interface OrderCost {
  readonly orderRef: string;
  /** Hands-on minutes multiplied by each actor's rate, plus automation runs. */
  readonly measured: number;
  /** Typical minutes of the steps the order passes, at the Responsible job's rate. */
  readonly declared: number;
}

interface StepRecord {
  readonly orderRef: string;
  readonly step: number;
  readonly startedBy: string | null;
  readonly completedBy: string | null;
  readonly handlingMinutes: number | null;
  readonly waitMinutes: number | null;
}

/** Reconstructs, per order and step, who did it, how long it took and how long it waited. */
export function stepRecords(dataset: O2CDataset): StepRecord[] {
  const groups = new Map<string, typeof dataset.events>();
  for (const event of dataset.events) {
    if (event.step === null) continue;
    const key = `${event.orderRef}#${event.step}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return [...groups.values()].map((events) => {
    const find = (type: string) => events.find((event) => event.type === type);
    const started = find('Started');
    const completed = find('Completed');
    const requested = find('Approval_Requested');
    const granted = find('Approval_Granted');

    let handling: number | null = null;
    if (started && completed) {
      handling = minutesBetween(started.at, completed.at);
      if (requested && granted) handling -= minutesBetween(requested.at, granted.at);
    }
    return {
      orderRef: events[0]!.orderRef,
      step: events[0]!.step!,
      startedBy: started?.by ?? null,
      completedBy: completed?.by ?? null,
      handlingMinutes: handling,
      waitMinutes: started?.waitBeforeMinutes ?? null,
    };
  });
}

export function computeJobKpis(dataset: O2CDataset, costs: CostAssumptions): JobKpis[] {
  const records = stepRecords(dataset);
  const agentJob = agentJobCode(dataset);
  const progress = dataset.instances.map((instance) =>
    computeOrderProgress(dataset, instance.orderRef),
  );

  const taskFor = (step: number): Task | undefined => {
    const code = dataset.steps.find((candidate) => candidate.step === step)?.taskCode;
    return dataset.tasks.find((task) => task.code === code);
  };
  const responsibleJob = (taskCode: string): string | undefined =>
    dataset.raci.find((assignment) => assignment.taskCode === taskCode)?.responsible;

  return dataset.nodes
    .filter((node) => node.type === 'JOB')
    .map((job): JobKpis => {
      const holder = holderOf(dataset, job.code);
      const actorId = holder?.id ?? (job.code === agentJob ? AI_AGENT_ID : null);
      const rate = costs.hourlyRates[job.code] ?? null;
      const automation = costs.automation[job.code];
      const isAgent = actorId === AI_AGENT_ID;

      const done = records.filter((record) => actorId !== null && record.completedBy === actorId);
      const started = records.filter((record) => actorId !== null && record.startedBy === actorId);
      const handling = done
        .map((record) => record.handlingMinutes)
        .filter((value): value is number => value !== null);
      const outOfRoleRecords = done.filter((record) => {
        const task = taskFor(record.step);
        return task !== undefined && responsibleJob(task.code) !== job.code;
      });
      const outOfRole = outOfRoleRecords.length;
      const outOfRoleWork = [
        ...new Map(
          outOfRoleRecords.map((record) => {
            const task = taskFor(record.step)!;
            return [task.code, { task, job: responsibleJob(task.code) ?? '' }] as const;
          }),
        ).values(),
      ];

      const waits = started.filter((record) => record.waitMinutes !== null);
      const declaredWaits = waits.map(
        (record) => dataset.steps.find((step) => step.step === record.step)?.waitBeforeMinutes ?? 0,
      );
      const slaBreaches = waits.filter((record) => {
        const sla = dataset.steps.find((step) => step.step === record.step)?.slaMinutes ?? Infinity;
        return (record.waitMinutes ?? 0) > sla;
      }).length;

      const decisions = dataset.events.filter(
        (event) =>
          actorId !== null &&
          event.by === actorId &&
          (event.type === 'Approval_Granted' || event.type === 'Approval_Rejected'),
      );
      const decisionMinutes = decisions
        .map((decision) => {
          const request = dataset.events.find(
            (event) =>
              event.orderRef === decision.orderRef &&
              event.step === decision.step &&
              event.type === 'Approval_Requested',
          );
          return request ? minutesBetween(request.at, decision.at) : null;
        })
        .filter((value): value is number => value !== null);

      const handlingTotal = handling.reduce((sum, value) => sum + value, 0);
      const costOnOrders = isAgent
        ? done.length * (automation?.costPerRun ?? 0)
        : rate === null
          ? 0
          : (handlingTotal / 60) * rate;

      return {
        jobCode: job.code,
        actorId,
        responsibleFor: tasksWhere(dataset, job.code, 'responsible'),
        accountableFor: tasksWhere(dataset, job.code, 'accountable'),
        completed: done.length,
        outOfRole,
        outOfRoleWork,
        averageHandlingMinutes: average(handling),
        typicalMinutes: average(done.map((record) => taskFor(record.step)?.typicalMinutes ?? 0)),
        averageWaitMinutes: average(waits.map((record) => record.waitMinutes ?? 0)),
        declaredWaitMinutes: average(declaredWaits),
        slaBreaches,
        approvals: {
          granted: decisions.filter((event) => event.type === 'Approval_Granted').length,
          rejected: decisions.filter((event) => event.type === 'Approval_Rejected').length,
          averageDecisionMinutes: average(decisionMinutes),
        },
        openOrders: progress
          .filter(
            (order) => order.instance.status === 'Suspended' || order.instance.status === 'Running',
          )
          .filter((order) => actorId !== null && order.waitingOn === actorId)
          .map((order) => order.instance.orderRef),
        loadPercent:
          dataset.workload.find((entry) => holder && entry.personId === holder.id)?.loadPercent ??
          null,
        hourlyRate: isAgent ? null : rate,
        annualCost: isAgent
          ? (automation?.licencePerYear ?? null)
          : rate === null || actorId === null
            ? null
            : rate * costs.meta.annualHours,
        costOnOrders,
      };
    });
}

/** Labour cost of each order, measured from the event log and declared from the model. */
export function computeOrderCosts(dataset: O2CDataset, costs: CostAssumptions): OrderCost[] {
  const records = stepRecords(dataset);
  const agentJob = agentJobCode(dataset);
  const jobOfActor = (actor: string | null): string | undefined =>
    actor === AI_AGENT_ID
      ? agentJob
      : dataset.persons.find((person) => person.id === actor)?.jobCode;

  return dataset.instances.map((instance) => {
    const progress = computeOrderProgress(dataset, instance.orderRef);
    const measured = records
      .filter((record) => record.orderRef === instance.orderRef)
      .reduce((sum, record) => {
        const job = jobOfActor(record.completedBy ?? record.startedBy);
        if (!job) return sum;
        if (record.completedBy === AI_AGENT_ID)
          return sum + (costs.automation[job]?.costPerRun ?? 0);
        return sum + ((record.handlingMinutes ?? 0) / 60) * (costs.hourlyRates[job] ?? 0);
      }, 0);
    const declared = progress.steps
      .filter((step) => step.status !== 'skipped')
      .reduce((sum, step) => {
        const job = dataset.raci.find(
          (assignment) => assignment.taskCode === step.task.code,
        )?.responsible;
        if (!job) return sum;
        if (job === agentJob) return sum + (costs.automation[job]?.costPerRun ?? 0);
        return sum + (step.task.typicalMinutes / 60) * (costs.hourlyRates[job] ?? 0);
      }, 0);
    return { orderRef: instance.orderRef, measured, declared };
  });
}

function tasksWhere(
  dataset: O2CDataset,
  jobCode: string,
  role: 'responsible' | 'accountable',
): Task[] {
  return dataset.raci
    .filter((assignment) => assignment[role] === jobCode)
    .map((assignment) => dataset.tasks.find((task) => task.code === assignment.taskCode))
    .filter((task): task is Task => task !== undefined);
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
