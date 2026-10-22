import type {
  ProcessNodeState,
  RouteLegModel,
  RouteModel,
  RouteStopModel,
} from '../../src/viewer-contract/twin-model';
import { AI_AGENT_ID, type O2CDataset } from '../domain/o2c-types';
import { minutesBetween, type OrderProgress, type StepStatus } from '../domain/order-progress';
import { holderOf, nodeByCode, personById, raciOf } from '../domain/organization';
import { formatDate, formatDuration, formatMoney } from '../ui/format';
import { HALL, JOB_SEATS } from './site-plan';
import { truckId } from './twin-layout';

export const NODE_STATE: Readonly<Record<StepStatus, ProcessNodeState>> = {
  pending: 'idle',
  'in-progress': 'active',
  'awaiting-approval': 'waiting',
  done: 'done',
  rejected: 'rejected',
  skipped: 'skipped',
};

export const STATUS_LABEL: Readonly<Record<StepStatus, string>> = {
  pending: 'Not started',
  'in-progress': 'In progress',
  'awaiting-approval': 'Awaiting approval',
  done: 'Done',
  rejected: 'Rejected',
  skipped: 'Skipped',
};

/** The workstation a job's work is drawn at: its holder's desk, or the job's own post. */
export function stationOfJob(dataset: O2CDataset, jobCode: string): string {
  return holderOf(dataset, jobCode)?.id ?? jobCode;
}

/**
 * The path one order takes through the twin: a stop at the Responsible job's desk for each
 * step it passes, an extra stop at the approver when the step was escalated, and the lorry
 * at the dock once the delivery note is out. A rejected order stops where it was rejected.
 */
export function toRoute(dataset: O2CDataset, progress: OrderProgress): RouteModel {
  const stops: RouteStopModel[] = [];
  const { instance } = progress;
  const dockIndex = dataset.instances.indexOf(instance);

  for (const step of progress.steps) {
    if (step.status === 'skipped') continue;
    const raci = raciOf(dataset, step.task.code);
    if (!raci) continue;

    const started = step.events.find((event) => event.type === 'Started');
    const completed = step.events.find((event) => event.type === 'Completed');
    const actor = (completed ?? started)?.by ?? null;
    const actorName =
      actor === AI_AGENT_ID
        ? 'Automated'
        : actor
          ? (personById(dataset, actor)?.fullName ?? actor)
          : null;

    // Where the step is shown: at whoever did it when the job's own post is empty, as long
    // as that person has a desk of their own. Workstations exist for held, seated jobs, and
    // each goes to the job's first holder, so a second person sharing the job has none.
    // Otherwise the stop stays at the post, which always has a workstation.
    const holder = holderOf(dataset, raci.responsible);
    const standIn =
      !holder && actor && actor !== AI_AGENT_ID ? personById(dataset, actor) : undefined;
    const coveredBy =
      standIn && JOB_SEATS[standIn.jobCode] && holderOf(dataset, standIn.jobCode)?.id === standIn.id
        ? standIn.id
        : null;
    stops.push({
      id: `step-${step.step.step}`,
      anchor: coveredBy ?? stationOfJob(dataset, raci.responsible),
      marker: String(step.step.step),
      title: step.task.name,
      subtitle:
        step.status === 'pending'
          ? 'Not reached'
          : started && completed
            ? `${actorName} · ${formatDuration(minutesBetween(started.at, completed.at))}`
            : (actorName ?? STATUS_LABEL[step.status]),
      state: NODE_STATE[step.status],
    });

    const requested = step.events.find((event) => event.type === 'Approval_Requested');
    if (requested) {
      const decision = step.events.find(
        (event) => event.type === 'Approval_Granted' || event.type === 'Approval_Rejected',
      );
      const approver = holderOf(dataset, raci.accountable);
      const reminder = step.events.find((event) => event.type === 'Reminder_Sent');
      stops.push({
        id: `approval-${step.step.step}`,
        anchor: approver?.id ?? raci.accountable,
        marker: decision?.type === 'Approval_Rejected' ? '✕' : decision ? '✓' : '…',
        title: `${nodeByCode(dataset, raci.accountable)?.name ?? 'Approver'} approval`,
        subtitle: decision
          ? `${decision.type === 'Approval_Granted' ? 'Approved' : 'Rejected'} after ${formatDuration(minutesBetween(requested.at, decision.at))}`
          : `Pending since ${formatDate(requested.at)}${reminder ? ' · reminder sent' : ''}`,
        state: decision?.type === 'Approval_Rejected' ? 'rejected' : decision ? 'done' : 'waiting',
      });
      if (decision?.type === 'Approval_Rejected') break;
    }

    if (step.step.step === 4 && step.status === 'done' && completed) {
      stops.push({
        id: 'dispatch',
        anchor: truckId(instance.orderRef),
        marker: '→',
        title: `Dispatched · dock ${dockIndex + 1}`,
        subtitle: `Lorry left ${formatDate(completed.at)}`,
        state: 'done',
      });
    }
    if (step.status === 'rejected') break;
  }

  const legs: RouteLegModel[] = stops.slice(1).map((stop, index) => ({
    from: stops[index]!.id,
    to: stop.id,
    state: stop.state,
  }));

  // The card sits on the open stop, or on the last finished one once the order is closed.
  const open = stops.find(
    (stop) => stop.state === 'waiting' || stop.state === 'active' || stop.state === 'rejected',
  );
  const anchor = open ?? [...stops].reverse().find((stop) => stop.state === 'done');

  return {
    stops:
      dockIndex < HALL.dockOffsets.length ? stops : stops.filter((stop) => stop.id !== 'dispatch'),
    legs,
    badge: anchor
      ? {
          stopId: anchor.id,
          title: instance.orderRef,
          lines: [
            instance.customer,
            formatMoney(instance.amount, instance.currency),
            progress.current
              ? `${progress.current.task.name}: ${STATUS_LABEL[progress.current.status]}`
              : `${instance.status} · ${progress.elapsedDays.toFixed(1)} days`,
          ],
        }
      : null,
  };
}
