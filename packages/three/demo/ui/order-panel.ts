import { AI_AGENT_ID, type O2CDataset, type ProcessEvent } from '../domain/o2c-types';
import { minutesBetween, type OrderProgress, type StepProgress } from '../domain/order-progress';
import type { OrderCost } from '../domain/people-kpis';
import { categoryName, personById } from '../domain/organization';
import { STATUS_LABEL } from '../layout/route-state';
import { detailList, el } from './dom';
import { formatDateTime, formatDuration, formatMoney } from './format';

export interface OrderPanel {
  render(progress: OrderProgress): void;
}

/**
 * The Order tab: an order picker, the order's details and cost, and a timeline of every
 * step with who did it, how long it took and how long it waited against what is declared.
 * Clicking a step reports it, so the 3D view can fly to that desk.
 */
export function createOrderPanel(
  host: HTMLElement,
  dataset: O2CDataset,
  costs: readonly OrderCost[],
  currency: string,
  initialOrder: string,
  onOrderChange: (orderRef: string) => void,
  onStepPick: (step: number) => void,
): OrderPanel {
  const picker = el(
    'select',
    { className: 'field', attributes: { 'aria-label': 'Order' } },
    ...dataset.instances.map((instance) =>
      el('option', {
        text: `${instance.orderRef} · ${instance.customer}`,
        attributes: { value: instance.orderRef },
      }),
    ),
  );
  picker.value = initialOrder;
  picker.addEventListener('change', () => onOrderChange(picker.value));

  const summary = el('div');
  const timeline = el('ol', { className: 'timeline' });

  host.replaceChildren(
    el(
      'section',
      { className: 'panel-section' },
      el('h2', { className: 'section-title', text: 'Customer order' }),
      picker,
      summary,
    ),
    el(
      'section',
      { className: 'panel-section' },
      el('h2', { className: 'section-title', text: 'Path through the process' }),
      timeline,
    ),
  );

  return {
    render(progress) {
      const { instance } = progress;
      picker.value = instance.orderRef;
      const cost = costs.find((entry) => entry.orderRef === instance.orderRef);

      summary.replaceChildren(
        el(
          'div',
          { className: 'order-head' },
          el('strong', {
            className: 'order-amount',
            text: formatMoney(instance.amount, instance.currency),
          }),
          el('span', {
            className: `status-pill status-${instance.status.toLowerCase()}`,
            text: instance.status,
          }),
        ),
        detailList([
          ['Customer', instance.customer],
          ['Received', formatDateTime(instance.startedAt)],
          ['Instance', instance.id],
          ['Route', progress.branch ? `Gateway: ${progress.branch}` : 'Before the gateway'],
          ['Steps done', `${progress.completedSteps} of ${progress.applicableSteps}`],
          [
            'Elapsed',
            `${progress.elapsedDays.toFixed(1)} days · ${dataset.process.declaredAverageDurationDays} declared`,
          ],
          [
            'Labour cost',
            cost
              ? `${formatMoney(cost.measured, currency)} · ${formatMoney(cost.declared, currency)} declared`
              : '—',
          ],
        ]),
      );

      timeline.replaceChildren(
        ...progress.steps.map((step) => timelineItem(dataset, step, onStepPick)),
      );
    },
  };
}

function timelineItem(
  dataset: O2CDataset,
  progress: StepProgress,
  onStepPick: (step: number) => void,
): HTMLElement {
  const { step, task, events, status } = progress;
  const started = events.find((event) => event.type === 'Started');
  const completed = events.find((event) => event.type === 'Completed');
  const actor = (completed ?? started)?.by ?? null;

  const facts: (HTMLElement | null)[] = [];
  if (status === 'skipped') {
    facts.push(el('span', { text: 'Not needed on this branch' }));
  } else if (status === 'pending') {
    facts.push(
      el('span', { text: `Not started · declared wait ${formatDuration(step.waitBeforeMinutes)}` }),
    );
  } else {
    facts.push(
      el('span', {
        text: `${actorName(dataset, actor)} · ${started ? formatDateTime(started.at) : ''}`,
      }),
    );
    if (started?.waitBeforeMinutes) {
      const ratio =
        step.waitBeforeMinutes > 0 ? started.waitBeforeMinutes / step.waitBeforeMinutes : 0;
      const late = started.waitBeforeMinutes > step.slaMinutes;
      facts.push(
        el(
          'span',
          { className: late ? 'fact bad' : ratio > 2 ? 'fact warn' : 'fact' },
          `Waited ${formatDuration(started.waitBeforeMinutes)} · declared ${formatDuration(step.waitBeforeMinutes)}`,
          late ? ' · over SLA' : '',
        ),
      );
    }
    if (started && completed) {
      facts.push(
        el('span', {
          className: 'fact',
          text: `Took ${formatDuration(minutesBetween(started.at, completed.at))} · typical ${formatDuration(task.typicalMinutes)}`,
        }),
      );
    }
    for (const event of events.filter(isSideEvent)) facts.push(sideEvent(dataset, event, events));
  }

  const button = el(
    'button',
    {
      className: `timeline-item state-${status}`,
      attributes: { type: 'button', title: `Show ${task.name} in the building` },
    },
    el('span', { className: 'timeline-marker', text: String(step.step) }),
    el(
      'span',
      { className: 'timeline-body' },
      el(
        'span',
        { className: 'timeline-head' },
        el('strong', { text: task.name }),
        el('span', { className: 'timeline-status', text: STATUS_LABEL[status] }),
      ),
      el('span', { className: 'timeline-meta', text: categoryName(dataset, task.category) }),
      ...facts,
    ),
  );
  button.disabled = status === 'skipped';
  button.addEventListener('click', () => onStepPick(step.step));
  return el('li', {}, button);
}

const isSideEvent = (event: ProcessEvent): boolean =>
  event.type === 'Escalated' ||
  event.type === 'Approval_Granted' ||
  event.type === 'Approval_Rejected' ||
  event.type === 'Reminder_Sent';

function sideEvent(
  dataset: O2CDataset,
  event: ProcessEvent,
  events: readonly ProcessEvent[],
): HTMLElement {
  const request = events.find((candidate) => candidate.type === 'Approval_Requested');
  const after = request ? ` after ${formatDuration(minutesBetween(request.at, event.at))}` : '';
  switch (event.type) {
    case 'Escalated':
      return el('span', { className: 'fact warn', text: `Escalated: ${event.label ?? ''}` });
    case 'Approval_Granted':
      return el('span', {
        className: 'fact good',
        text: `Approved by ${actorName(dataset, event.by)}${after}`,
      });
    case 'Approval_Rejected':
      return el('span', {
        className: 'fact bad',
        text: `Rejected by ${actorName(dataset, event.by)}${after}`,
      });
    default:
      return el('span', {
        className: 'fact warn',
        text: `${event.label ?? 'Reminder'} sent ${formatDateTime(event.at)}`,
      });
  }
}

function actorName(dataset: O2CDataset, actor: string | null): string {
  if (actor === AI_AGENT_ID) return 'Automated invoicing';
  if (!actor) return 'System';
  return personById(dataset, actor)?.fullName ?? actor;
}
