import type { EntityRef } from '../../src/viewer-contract/events';
import type { WorkstationModel } from '../../src/viewer-contract/twin-model';
import { AI_AGENT_ID, type CostAssumptions, type O2CDataset } from '../domain/o2c-types';
import { computeOrderProgress } from '../domain/order-progress';
import type { JobKpis } from '../domain/people-kpis';
import { STATUS_LABEL } from '../layout/route-state';
import { departmentOf, holderOf, nodeByCode, personById } from '../domain/organization';
import { FLOORS, HALL, OFFICE_ID } from '../layout/site-plan';
import { detailList, el } from './dom';
import { formatDate, formatDuration, formatMoney } from './format';

export interface PeoplePanel {
  /** Shows the detail card for a person, a job post or a free desk; null clears it. */
  show(entity: EntityRef | null): void;
}

/**
 * The People tab: a card with the selected person's KPIs, cost and responsibilities, and
 * below it everyone in the organisation, grouped by department. Clicking a row reports
 * the workstation so the 3D view can fly to it.
 */
export function createPeoplePanel(
  host: HTMLElement,
  dataset: O2CDataset,
  jobKpis: readonly JobKpis[],
  costs: CostAssumptions,
  workstations: readonly WorkstationModel[],
  onPick: (entity: EntityRef) => void,
): PeoplePanel {
  const detail = el('section', { className: 'panel-section person-detail' });
  const rows = new Map<string, HTMLButtonElement>();
  const currency = costs.meta.currency;

  const departments = dataset.nodes.filter((node) => node.type === 'DEPARTMENT');
  const list = el(
    'section',
    { className: 'panel-section' },
    el('h2', { className: 'section-title', text: 'Organisation' }),
    ...departments.map((department) => {
      const jobs = jobKpis.filter(
        (kpis) => departmentOf(dataset, kpis.jobCode)?.code === department.code,
      );
      return el(
        'div',
        { className: 'people-group' },
        el('h3', { className: 'people-group-title', text: department.name }),
        ...jobs.map((kpis) => {
          const station = workstations.find(
            (candidate) => stationKey(candidate.entity) === stationKey(entityOf(dataset, kpis)),
          );
          const holder = holderOf(dataset, kpis.jobCode);
          const job = nodeByCode(dataset, kpis.jobCode)!;
          const row = el(
            'button',
            { className: 'person-row', attributes: { type: 'button' } },
            el('span', {
              className: `initials occupant-${station?.occupant ?? 'vacant'}`,
              text: initials(holder?.fullName ?? job.name),
            }),
            el(
              'span',
              { className: 'person-row-text' },
              el('strong', {
                text:
                  holder?.fullName ??
                  (kpis.actorId === AI_AGENT_ID ? 'Automated service' : 'Vacant'),
              }),
              el('span', { text: job.name }),
            ),
            el('span', { className: 'tone-dot', dataset: { tone: station?.tone ?? 'neutral' } }),
            el('span', {
              className: 'person-row-rate',
              text:
                kpis.hourlyRate !== null && holder
                  ? `€${kpis.hourlyRate}/h`
                  : kpis.actorId === AI_AGENT_ID
                    ? 'per run'
                    : '—',
            }),
          );
          const entity = entityOf(dataset, kpis);
          row.addEventListener('click', () => onPick(entity));
          rows.set(stationKey(entity), row);
          return row;
        }),
      );
    }),
    el('p', { className: 'footnote', text: `Hourly rates: ${costs.meta.source}` }),
  );

  host.replaceChildren(detail, list);

  const tile = (
    label: string,
    value: string,
    note: string,
    tone: 'neutral' | 'warn' | 'bad' | 'good' = 'neutral',
  ): HTMLElement =>
    el(
      'div',
      { className: 'kpi-tile', dataset: { tone } },
      el('span', { className: 'kpi-label', text: label }),
      el('strong', { className: 'kpi-value', text: value }),
      el('span', { className: 'kpi-note', text: note }),
    );

  const renderJob = (kpis: JobKpis): void => {
    const job = nodeByCode(dataset, kpis.jobCode)!;
    const holder = holderOf(dataset, kpis.jobCode);
    const uncovered = dataset.uncoveredJobs.find((entry) => entry.jobCode === kpis.jobCode);
    const isAgent = kpis.actorId === AI_AGENT_ID;
    const flags: HTMLElement[] = [];

    if ((kpis.loadPercent ?? 0) > 100) {
      const workload = dataset.workload.find((entry) => entry.personId === holder?.id);
      flags.push(
        flag(
          'bad',
          `Over capacity: load ${kpis.loadPercent}%`,
          workload
            ? `${workload.minutesPerTask} min × ${workload.timesPerDay} a day on ${(
                dataset.tasks.find((task) => task.code === workload.taskCode)?.name ??
                workload.taskCode
              ).toLowerCase()}`
            : '',
        ),
      );
    }
    for (const order of kpis.openOrders) {
      flags.push(flag('warn', `${order} is waiting on this desk`, waitingReason(dataset, order)));
    }
    if (kpis.outOfRole > 0) {
      flags.push(
        flag(
          'warn',
          `${kpis.outOfRole} steps done outside the role`,
          outOfRoleReason(dataset, kpis),
        ),
      );
    }
    if (!holder && !isAgent) {
      const coveredBy = uncovered?.coveredBy
        ? personById(dataset, uncovered.coveredBy)?.fullName
        : null;
      flags.push(
        flag(
          'bad',
          `Vacant for ${uncovered?.uncoveredWeeks ?? '?'} weeks`,
          coveredBy ? `Work done by ${coveredBy} out of scope` : (uncovered?.reason ?? ''),
        ),
      );
    }
    for (const task of kpis.responsibleFor.filter((candidate) => candidate.contested)) {
      flags.push(
        flag(
          'warn',
          `RACI on “${task.name}” is ${task.raciStatus ?? 'assumed'} and contested`,
          'Responsibility needs confirming',
        ),
      );
    }

    const handling = kpis.averageHandlingMinutes;
    const typical = kpis.typicalMinutes;
    const wait = kpis.averageWaitMinutes;
    const declared = kpis.declaredWaitMinutes;
    const waitRatio = wait !== null && declared ? wait / declared : null;

    detail.replaceChildren(
      el(
        'div',
        { className: 'person-head' },
        el('span', {
          className: `initials large occupant-${holder ? 'person' : isAgent ? 'automated' : 'vacant'}`,
          text: initials(holder?.fullName ?? job.name),
        }),
        el(
          'div',
          {},
          el('span', {
            className: 'eyebrow',
            text: departmentOf(dataset, kpis.jobCode)?.name ?? '',
          }),
          el('strong', {
            className: 'person-name',
            text: holder?.fullName ?? (isAgent ? 'Automated invoicing' : 'Vacant post'),
          }),
          el('span', { className: 'person-job', text: job.name }),
        ),
      ),
      ...flags,
      el(
        'div',
        { className: 'kpi-grid' },
        tile(
          'Steps completed',
          String(kpis.completed),
          `across ${dataset.instances.length} orders`,
        ),
        tile(
          'Avg handling',
          handling === null ? 'n/a' : formatDuration(handling),
          typical === null ? 'no steps' : `typical ${formatDuration(typical)}`,
          handling !== null && typical !== null && handling > typical * 1.3 ? 'warn' : 'neutral',
        ),
        tile(
          'Avg wait before',
          wait === null ? 'n/a' : formatDuration(wait),
          declared === null
            ? 'no steps started'
            : `declared ${formatDuration(declared)}${waitRatio ? ` · ${waitRatio.toFixed(1)}×` : ''}`,
          waitRatio !== null && waitRatio > 4
            ? 'bad'
            : waitRatio !== null && waitRatio > 2
              ? 'warn'
              : 'neutral',
        ),
        tile(
          'SLA breaches',
          String(kpis.slaBreaches),
          'steps started after SLA',
          kpis.slaBreaches > 0 ? 'bad' : 'good',
        ),
        isAgent
          ? tile(
              'Cost per run',
              formatMoney(costs.automation[kpis.jobCode]?.costPerRun ?? 0, currency),
              'assumed',
              'neutral',
            )
          : tile(
              'Hourly cost',
              kpis.hourlyRate === null ? 'n/a' : `€${kpis.hourlyRate}`,
              'fully loaded · assumed',
            ),
        tile(
          isAgent ? 'Licence per year' : 'Annual cost',
          kpis.annualCost === null ? 'n/a' : formatMoney(kpis.annualCost, currency),
          isAgent ? 'assumed' : holder ? `${costs.meta.annualHours} h · assumed` : 'no holder',
        ),
        tile(
          'Cost on these orders',
          formatMoney(kpis.costOnOrders, currency),
          'hands-on time in the log',
        ),
        tile(
          'Load',
          kpis.loadPercent === null ? 'n/a' : `${kpis.loadPercent}%`,
          kpis.loadPercent === null ? 'not declared' : 'declared',
          (kpis.loadPercent ?? 0) > 100 ? 'bad' : 'neutral',
        ),
      ),
      ...(kpis.approvals.granted + kpis.approvals.rejected > 0
        ? [
            el(
              'div',
              { className: 'kpi-grid single' },
              tile(
                'Approvals',
                `${kpis.approvals.granted} granted · ${kpis.approvals.rejected} rejected`,
                kpis.approvals.averageDecisionMinutes === null
                  ? ''
                  : `avg decision ${formatDuration(kpis.approvals.averageDecisionMinutes)}`,
              ),
            ),
          ]
        : []),
      detailList([
        ['Responsible (R)', kpis.responsibleFor.map((task) => task.name).join(', ') || 'None'],
        ['Accountable (A)', kpis.accountableFor.map((task) => task.name).join(', ') || 'None'],
        [
          'In the job since',
          holder
            ? formatDate(holder.since)
            : isAgent && uncovered?.agentSince
              ? formatDate(uncovered.agentSince)
              : '—',
        ],
        ['Contract', holder?.contractType ?? '—'],
        ['Reports to', reportsTo(dataset, kpis.jobCode)],
        ['Employee id', holder?.id ?? '—'],
      ]),
    );
  };

  const clear = (): void => {
    detail.replaceChildren(
      el('h2', { className: 'section-title', text: 'Selection' }),
      el('p', {
        className: 'empty',
        text: 'Click a desk in the building, or a name below, to see that person’s KPIs and cost.',
      }),
    );
  };
  clear();

  return {
    show(entity) {
      for (const [key, row] of rows)
        row.classList.toggle('active', entity !== null && key === stationKey(entity));
      if (!entity) return clear();

      if (entity.kind === 'seat') {
        const station = workstations.find((candidate) => candidate.entity.id === entity.id);
        detail.replaceChildren(
          el('h2', { className: 'section-title', text: 'Free desk' }),
          detailList([
            ['Seat', entity.id],
            ['Floor', station ? floorName(station) : '—'],
            ['Assigned job', 'None'],
          ]),
        );
        return;
      }
      const kpis = jobKpis.find((candidate) =>
        entity.kind === 'person'
          ? candidate.actorId === entity.id
          : entity.kind === 'job' && candidate.jobCode === entity.id,
      );
      if (kpis) renderJob(kpis);
      else clear();
    },
  };
}

/** Why an order is waiting: the step it is at, its status, and any reminder sent for it. */
function waitingReason(dataset: O2CDataset, orderRef: string): string {
  const { current } = computeOrderProgress(dataset, orderRef);
  if (!current) return '';
  const reminded = current.events.some((event) => event.type === 'Reminder_Sent');
  return `${current.task.name}: ${STATUS_LABEL[current.status].toLowerCase()}${reminded ? ', reminder sent' : ''}`;
}

/** Which tasks were done outside the role, and for which job, noting when that job is vacant. */
function outOfRoleReason(dataset: O2CDataset, kpis: JobKpis): string {
  return kpis.outOfRoleWork
    .map(({ task, job }) => {
      const name = nodeByCode(dataset, job)?.name ?? job;
      const vacant =
        !holderOf(dataset, job) && dataset.uncoveredJobs.some((entry) => entry.jobCode === job);
      return `${task.name}, for the ${name} job${vacant ? ', which is vacant' : ''}`;
    })
    .join('; ');
}

function flag(tone: 'warn' | 'bad', title: string, note: string): HTMLElement {
  return el(
    'div',
    { className: 'flag', dataset: { tone } },
    el('strong', { text: title }),
    note ? el('span', { text: note }) : null,
  );
}

function entityOf(dataset: O2CDataset, kpis: JobKpis): EntityRef {
  const holder = holderOf(dataset, kpis.jobCode);
  return holder ? { kind: 'person', id: holder.id } : { kind: 'job', id: kpis.jobCode };
}

const stationKey = (entity: EntityRef): string => `${entity.kind}:${entity.id}`;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => /^[A-Za-z]/.test(part))
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

function reportsTo(dataset: O2CDataset, jobCode: string): string {
  const parent = nodeByCode(dataset, nodeByCode(dataset, jobCode)?.reportsTo ?? '');
  if (!parent) return '—';
  const holder = holderOf(dataset, parent.code);
  return holder ? `${holder.fullName} (${parent.name})` : parent.name;
}

function floorName(station: WorkstationModel): string {
  if (station.building !== OFFICE_ID) return HALL.title;
  return FLOORS.find((floor) => floor.level === station.level)?.title ?? `Level ${station.level}`;
}
