import {
  AI_AGENT_ID,
  type CostAssumptions,
  type O2CDataset,
  type ProcessEvent,
} from '../domain/o2c-types';
import { minutesBetween, type OrderProgress, type StepProgress } from '../domain/order-progress';
import type { JobKpis, OrderCost } from '../domain/people-kpis';
import {
  categoryName,
  departmentOf,
  holderOf,
  nodeByCode,
  personById,
  raciOf,
} from '../domain/organization';
import { STATUS_LABEL } from '../layout/route-state';
import { dispatchStep, type TourScene } from '../layout/tour-plan';
import { el } from './dom';
import { formatDate, formatDateTime, formatDuration, formatMoney } from './format';

export interface TourContext {
  readonly dataset: O2CDataset;
  readonly progress: OrderProgress;
  readonly jobKpis: readonly JobKpis[];
  readonly costs: CostAssumptions;
  readonly orderCost: OrderCost | undefined;
}

type Row = readonly [label: string, value: string, tone?: 'good' | 'warn' | 'bad'];

/**
 * The card pinned beside the person who receives the order, once the avatar has walked in to
 * their desk. It comes in through the systems (mail, portal or EDI), to whoever registers it:
 * the first step's person.
 */
export function arrivalCard(
  context: TourContext,
  scene: Extract<TourScene, { kind: 'stop' }>,
): HTMLElement {
  const { dataset } = context;
  const { instance } = context.progress;
  const started = find(scene.step.events, 'Started');
  const clerk =
    started?.by && started.by !== AI_AGENT_ID ? personById(dataset, started.by) : undefined;
  const job = clerk ? nodeByCode(dataset, clerk.jobCode)?.name : undefined;
  return card(
    '✉',
    'in-progress',
    'New order received',
    `${instance.orderRef} from ${instance.customer}`,
    clerk ? person(clerk.fullName, [job, 'registers it'], 'person') : null,
    [
      ['Arrived', formatDateTime(instance.startedAt)],
      ['Amount', formatMoney(instance.amount, instance.currency)],
    ],
    [],
  );
}

/** The card pinned beside a person (or the lorry) while the walk stops there. */
export function stopCard(
  context: TourContext,
  scene: Extract<TourScene, { kind: 'stop' | 'dispatch' }>,
): HTMLElement {
  if (scene.kind === 'dispatch') return dispatchCard(context, scene.step);
  return scene.isApproval ? approvalCard(context, scene.step) : stepCard(context, scene.step);
}

function stepCard(context: TourContext, progress: StepProgress): HTMLElement {
  const { dataset, costs } = context;
  const { step, task, events, status } = progress;
  const raci = raciOf(dataset, task.code);
  const responsibleJob = raci ? nodeByCode(dataset, raci.responsible) : undefined;
  const started = find(events, 'Started');
  const completed = find(events, 'Completed');
  const requested = find(events, 'Approval_Requested');
  const decided = events.find(
    (event) => event.type === 'Approval_Granted' || event.type === 'Approval_Rejected',
  );
  const actor = (completed ?? started)?.by ?? null;
  const actorPerson = actor && actor !== AI_AGENT_ID ? personById(dataset, actor) : undefined;
  const automated = actor === AI_AGENT_ID;

  // Who is shown: the person who did it, or the post itself when nobody holds it.
  const holder = raci ? holderOf(dataset, raci.responsible) : undefined;
  const name = automated
    ? 'Automated invoicing'
    : (actorPerson?.fullName ?? holder?.fullName ?? 'Vacant post');
  const job = actorPerson ? nodeByCode(dataset, actorPerson.jobCode)?.name : responsibleJob?.name;

  let handsOn: number | null =
    started && completed ? minutesBetween(started.at, completed.at) : null;
  if (handsOn !== null && requested && decided) handsOn -= minutesBetween(requested.at, decided.at);
  const actorJob = automated ? raci?.responsible : actorPerson?.jobCode;
  const rate = actorJob ? costs.hourlyRates[actorJob] : undefined;
  const cost = automated
    ? (costs.automation[actorJob ?? '']?.costPerRun ?? null)
    : handsOn !== null && rate !== undefined
      ? (handsOn / 60) * rate
      : null;

  const rows: Row[] = [];
  if (started) rows.push(['Started', formatDateTime(started.at)]);
  if (started?.waitBeforeMinutes) {
    const late = started.waitBeforeMinutes > step.slaMinutes;
    const ratio = step.waitBeforeMinutes ? started.waitBeforeMinutes / step.waitBeforeMinutes : 0;
    rows.push([
      'Waited',
      `${formatDuration(started.waitBeforeMinutes)} · declared ${formatDuration(step.waitBeforeMinutes)}${late ? ' · over SLA' : ''}`,
      late ? 'bad' : ratio > 2 ? 'warn' : undefined,
    ]);
  }
  if (handsOn !== null)
    rows.push([
      'Hands-on',
      `${formatDuration(handsOn)} · typical ${formatDuration(task.typicalMinutes)}`,
    ]);
  if (requested && !completed && status === 'awaiting-approval') {
    rows.push(['Escalated', `${formatDateTime(requested.at)} · waiting on approval`, 'warn']);
  }
  const escalation = find(events, 'Escalated');
  if (escalation) rows.push(['Escalation', escalation.label ?? 'Above limit', 'warn']);
  if (task.transaction) {
    const transaction = dataset.transactions.find(
      (candidate) => candidate.code === task.transaction,
    );
    rows.push([
      'System',
      `${task.transaction}${transaction && transaction.behaviour !== 'Standard' ? ` · ${transaction.behaviour}` : ''}`,
    ]);
  }
  if (cost !== null) {
    rows.push([
      'Cost',
      automated
        ? `${formatMoney(cost, costs.meta.currency)} per run`
        : `${formatMoney(cost, costs.meta.currency)} at €${rate}/h`,
    ]);
  }
  rows.push(['Automation', `${step.automationNow}% now · ${step.automationTarget}% target`]);

  const notes: HTMLElement[] = [];
  if (automated) {
    const since = dataset.uncoveredJobs.find(
      (entry) => entry.jobCode === raci?.responsible,
    )?.agentSince;
    notes.push(
      note(
        'warn',
        `No one sits at this desk: the ${responsibleJob?.name ?? 'job'} post is covered by an automated service${since ? ` since ${formatDate(since)}` : ''}.`,
      ),
    );
  }
  if (actorPerson && raci && actorPerson.jobCode !== raci.responsible) {
    const uncovered = dataset.uncoveredJobs.find((entry) => entry.jobCode === raci.responsible);
    notes.push(
      note(
        'warn',
        `Done outside the role: ${responsibleJob?.name ?? 'the job'} is vacant${uncovered?.uncoveredWeeks ? ` for ${uncovered.uncoveredWeeks} weeks` : ''}.`,
      ),
    );
  }
  const load = dataset.workload.find((entry) => entry.personId === actorPerson?.id);
  if (load && load.loadPercent > 100) {
    notes.push(
      note(
        'bad',
        `Load ${load.loadPercent}%: ${load.minutesPerTask} min × ${load.timesPerDay} orders a day.`,
      ),
    );
  }
  if (task.contested)
    notes.push(note('warn', `Responsibility is ${task.raciStatus ?? 'assumed'} and contested.`));

  return card(
    String(step.step),
    status,
    task.name,
    `${categoryName(dataset, task.category)} · ${STATUS_LABEL[status]}`,
    person(
      name,
      [job, actorPerson ? departmentOf(dataset, actorPerson.jobCode)?.name : undefined],
      automated ? 'automated' : actorPerson || holder ? 'person' : 'vacant',
    ),
    rows,
    notes,
  );
}

function approvalCard(context: TourContext, progress: StepProgress): HTMLElement {
  const { dataset } = context;
  const { events, task } = progress;
  const raci = raciOf(dataset, task.code);
  const approver = raci ? holderOf(dataset, raci.accountable) : undefined;
  const job = raci ? nodeByCode(dataset, raci.accountable)?.name : undefined;
  const requested = find(events, 'Approval_Requested');
  const decision = events.find(
    (event) => event.type === 'Approval_Granted' || event.type === 'Approval_Rejected',
  );
  const reminder = find(events, 'Reminder_Sent');
  const rule = dataset.businessRules.find((candidate) => candidate.code === dataset.gateway.rule);
  const threshold = rule?.parameters[0];
  const kpis = context.jobKpis.find((entry) => entry.jobCode === raci?.accountable);
  const instance = context.progress.instance;
  const status =
    decision?.type === 'Approval_Rejected' ? 'rejected' : decision ? 'done' : 'awaiting-approval';

  const rows: Row[] = [];
  if (requested) rows.push(['Requested', formatDateTime(requested.at)]);
  if (decision && requested) {
    rows.push([
      decision.type === 'Approval_Granted' ? 'Approved' : 'Rejected',
      `${formatDateTime(decision.at)} · after ${formatDuration(minutesBetween(requested.at, decision.at))}`,
      decision.type === 'Approval_Granted' ? 'good' : 'bad',
    ]);
  } else if (requested) {
    const lastEvent = context.progress.events.at(-1);
    rows.push([
      'Waiting',
      lastEvent
        ? `${formatDuration(minutesBetween(requested.at, lastEvent.at))} so far`
        : 'pending',
      'warn',
    ]);
  }
  if (reminder) rows.push(['Reminder', formatDateTime(reminder.at), 'warn']);
  if (rule && threshold) {
    rows.push(['Rule', `${rule.name} · ${formatMoney(threshold.value, threshold.unit)}`]);
  }
  rows.push(['Order', formatMoney(instance.amount, instance.currency)]);
  if (kpis?.hourlyRate)
    rows.push([
      'Cost',
      `€${kpis.hourlyRate}/h · ${kpis.approvals.granted} granted, ${kpis.approvals.rejected} rejected`,
    ]);

  return card(
    decision?.type === 'Approval_Rejected' ? '✕' : decision ? '✓' : '…',
    status,
    `${job ?? 'Approver'} approval`,
    `${rule?.name ?? 'Approval'} · ${decision ? (decision.label ?? '') : 'Awaiting decision'}`,
    person(
      approver?.fullName ?? 'Vacant post',
      [job, raci ? departmentOf(dataset, raci.accountable)?.name : undefined],
      approver ? 'person' : 'vacant',
    ),
    rows,
    [],
  );
}

function dispatchCard(context: TourContext, progress: StepProgress): HTMLElement {
  const { dataset } = context;
  const { instance } = context.progress;
  const completed = find(progress.events, 'Completed');
  const clerk = completed?.by ? personById(dataset, completed.by) : undefined;
  const transaction = dataset.transactions.find(
    (candidate) => candidate.code === progress.task.transaction,
  );
  const dock = dataset.instances.indexOf(instance) + 1;
  const invoice = context.progress.steps.find((step) => step.task.code === 'T_INVOICE');
  const payment = context.progress.steps.find((step) => step.task.code === 'T_RECONCILE');
  const doneAt = (step: StepProgress | undefined): string | null => {
    const event = step ? find(step.events, 'Completed') : undefined;
    return event ? formatDate(event.at) : null;
  };

  const rows: Row[] = [
    ['Customer', instance.customer],
    ['Dock', `Dock ${dock}`],
  ];
  if (completed) rows.push(['Left', formatDateTime(completed.at), 'good']);
  if (clerk) rows.push(['Released by', clerk.fullName]);
  if (transaction) rows.push(['System', `${transaction.code} · ${transaction.behaviour}`]);
  const invoiced = doneAt(invoice);
  const paid = doneAt(payment);
  if (invoiced) rows.push(['Invoiced', invoiced]);
  if (paid) rows.push(['Paid', paid, 'good']);

  return card(
    String(dispatchStep(dataset.steps.length)),
    'done',
    `${instance.orderRef} on its way`,
    `Delivery note issued · ${formatMoney(instance.amount, instance.currency)}`,
    null,
    rows,
    [],
  );
}

/** The closing card: how the order ended and what it cost against what is declared. */
export function outcomeCard(
  context: TourContext,
  onReplay: () => void,
  onClose: () => void,
): HTMLElement {
  const { dataset, progress, orderCost, costs } = context;
  const { instance } = progress;
  const currency = costs.meta.currency;
  const declaredDays = dataset.process.declaredAverageDurationDays;
  const waits = progress.events
    .filter((event) => event.type === 'Started')
    .map((event) => ({ event, minutes: event.waitBeforeMinutes ?? 0 }));
  const waited = waits.reduce((sum, wait) => sum + wait.minutes, 0);
  const elapsedMinutes = progress.elapsedDays * 24 * 60;
  const longest = [...waits].sort((a, b) => b.minutes - a.minutes)[0];
  const longestStep = longest
    ? progress.steps.find((step) => step.step.step === longest.event.step)
    : undefined;

  let tone: 'good' | 'warn' | 'bad';
  let title: string;
  let summary: string;
  if (instance.status === 'Completed') {
    tone = 'good';
    title = 'Order completed';
    summary = `${dataset.process.endCondition}.`;
  } else if (instance.status === 'Aborted') {
    tone = 'bad';
    const rejection = find(progress.events, 'Approval_Rejected');
    const by = rejection?.by ? personById(dataset, rejection.by)?.fullName : undefined;
    title = 'Order rejected';
    summary = `Credit rejected${by ? ` by ${by}` : ''}${rejection ? ` on ${formatDate(rejection.at)}` : ''}. Nothing was picked or shipped.`;
  } else {
    tone = 'warn';
    const waitingOn = progress.waitingOn ? personById(dataset, progress.waitingOn) : undefined;
    const job = waitingOn ? nodeByCode(dataset, waitingOn.jobCode)?.name : undefined;
    title = 'Order on hold';
    summary = `${progress.current?.task.name ?? 'The order'} is waiting on ${waitingOn ? `${waitingOn.fullName} (${job})` : 'a decision'}. ${progress.applicableSteps - progress.completedSteps} steps are still to do.`;
  }

  const stat = (label: string, value: string, note: string, alert = false): HTMLElement =>
    el(
      'div',
      { className: alert ? 'outcome-stat alert' : 'outcome-stat' },
      el('span', { className: 'outcome-stat-label', text: label }),
      el('strong', { text: value }),
      el('span', { className: 'outcome-stat-note', text: note }),
    );

  const replay = el('button', {
    className: 'tool',
    text: 'Play again',
    attributes: { type: 'button' },
  });
  const close = el('button', {
    className: 'tool tool-primary',
    text: 'Close',
    attributes: { type: 'button' },
  });
  replay.addEventListener('click', onReplay);
  close.addEventListener('click', onClose);

  return el(
    'div',
    { className: 'outcome-card', dataset: { tone } },
    el('span', {
      className: 'outcome-eyebrow',
      text: `${instance.orderRef} · ${instance.customer} · ${formatMoney(instance.amount, instance.currency)}`,
    }),
    el('h2', { className: 'outcome-title', text: title }),
    el('p', { className: 'outcome-summary', text: summary }),
    el(
      'div',
      { className: 'outcome-stats' },
      stat(
        instance.status === 'Completed' ? 'Cycle time' : 'Elapsed',
        `${progress.elapsedDays.toFixed(1)} d`,
        `${declaredDays} d declared`,
        progress.elapsedDays > declaredDays,
      ),
      stat(
        'Steps done',
        `${progress.completedSteps} / ${progress.applicableSteps}`,
        progress.branch ? `Gateway: ${progress.branch}` : '',
      ),
      stat(
        'Time spent waiting',
        elapsedMinutes > 0 ? `${Math.round((waited / elapsedMinutes) * 100)}%` : 'n/a',
        `${formatDuration(waited)} between steps`,
        elapsedMinutes > 0 && waited / elapsedMinutes > 0.5,
      ),
      stat(
        'Longest wait',
        longest ? formatDuration(longest.minutes) : 'n/a',
        longestStep ? `before ${longestStep.task.name}` : '',
      ),
      stat(
        'Labour cost',
        orderCost ? formatMoney(orderCost.measured, currency) : 'n/a',
        orderCost ? `${formatMoney(orderCost.declared, currency)} declared · assumed rates` : '',
      ),
    ),
    el('div', { className: 'outcome-actions' }, replay, close),
  );
}

/** The opening caption: the order arriving. */
export function introCaption(context: TourContext): HTMLElement {
  const { instance } = context.progress;
  return el(
    'div',
    { className: 'tour-caption-body' },
    el('span', { className: 'outcome-eyebrow', text: context.dataset.process.trigger }),
    el('strong', { text: `${instance.orderRef} from ${instance.customer}` }),
    el('span', {
      text: `${formatMoney(instance.amount, instance.currency)} · ${formatDateTime(instance.startedAt)} · ${context.progress.branch ? `gateway: ${context.progress.branch}` : ''}`,
    }),
  );
}

// ---------------------------------------------------------------------------------------

function card(
  marker: string,
  status: string,
  title: string,
  subtitle: string,
  personRow: HTMLElement | null,
  rows: readonly Row[],
  notes: readonly HTMLElement[],
): HTMLElement {
  return el(
    'div',
    { className: `tour-card state-${status}` },
    el(
      'div',
      { className: 'tour-card-head' },
      el('span', { className: 'tour-card-marker', text: marker }),
      el('div', {}, el('strong', { text: title }), el('span', { text: subtitle })),
    ),
    personRow,
    el(
      'dl',
      { className: 'tour-card-rows' },
      ...rows.flatMap(([label, value, tone]) => [
        el('dt', { text: label }),
        el('dd', { text: value, dataset: tone ? { tone } : {} }),
      ]),
    ),
    ...notes,
  );
}

function person(
  name: string,
  lines: readonly (string | undefined)[],
  occupant: 'person' | 'automated' | 'vacant',
): HTMLElement {
  return el(
    'div',
    { className: 'tour-card-person' },
    el('span', { className: `initials occupant-${occupant}`, text: initials(name) }),
    el(
      'div',
      {},
      el('strong', { text: name }),
      el('span', { text: lines.filter(Boolean).join(' · ') }),
    ),
  );
}

function note(tone: 'warn' | 'bad', text: string): HTMLElement {
  return el('p', { className: 'tour-card-note', text, dataset: { tone } });
}

function find(
  events: readonly ProcessEvent[],
  type: ProcessEvent['type'],
): ProcessEvent | undefined {
  return events.find((event) => event.type === type);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => /^[A-Za-z]/.test(part))
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
