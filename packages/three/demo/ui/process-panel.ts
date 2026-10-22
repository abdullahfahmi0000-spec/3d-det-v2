import type { CostAssumptions, O2CDataset } from '../domain/o2c-types';
import type { JobKpis, OrderCost } from '../domain/people-kpis';
import type { ProcessKpis } from '../domain/process-kpis';
import { el } from './dom';
import { formatDuration, formatInteger, formatMoney, formatPercent } from './format';

/** The Process KPIs tab: declared against measured figures for the whole process. */
export function renderProcessPanel(
  host: HTMLElement,
  dataset: O2CDataset,
  kpis: ProcessKpis,
  orderCosts: readonly OrderCost[],
  jobKpis: readonly JobKpis[],
  costs: CostAssumptions,
): void {
  const currency = costs.meta.currency;
  const cycle = kpis.averageCycleDays;
  const completed = dataset.instances.filter((instance) => instance.status === 'Completed');
  const completedCosts = orderCosts.filter((cost) =>
    completed.some((instance) => instance.orderRef === cost.orderRef),
  );
  const measuredCost = average(completedCosts.map((cost) => cost.measured));
  const declaredCost = average(completedCosts.map((cost) => cost.declared));
  const breaches = jobKpis.reduce((sum, job) => sum + job.slaBreaches, 0);
  const longest = Math.max(
    ...kpis.stepWaits.map((wait) => Math.max(wait.measuredMinutes ?? 0, wait.declaredMinutes)),
  );

  const tile = (
    label: string,
    value: string,
    note: string,
    tone: 'neutral' | 'warn' | 'bad' = 'neutral',
  ): HTMLElement =>
    el(
      'div',
      { className: 'kpi-tile', dataset: { tone } },
      el('span', { className: 'kpi-label', text: label }),
      el('strong', { className: 'kpi-value', text: value }),
      el('span', { className: 'kpi-note', text: note }),
    );

  host.replaceChildren(
    el(
      'section',
      { className: 'panel-section' },
      el('h2', {
        className: 'section-title',
        text: `${dataset.process.name} · v${dataset.process.version}`,
      }),
      el(
        'div',
        { className: 'kpi-grid' },
        tile(
          'Avg cycle time',
          cycle === null ? 'n/a' : `${cycle.toFixed(1)} d`,
          `${kpis.declaredDays} d declared · ${completed.length} completed`,
          cycle !== null && cycle > kpis.declaredDays * 2 ? 'bad' : 'neutral',
        ),
        tile(
          'Labour per order',
          measuredCost === null ? 'n/a' : formatMoney(measuredCost, currency),
          declaredCost === null
            ? ''
            : `${formatMoney(declaredCost, currency)} declared · assumed rates`,
        ),
        tile(
          'Automated steps',
          formatPercent(kpis.agentCompletedEvents / Math.max(kpis.completedEvents, 1)),
          `${kpis.agentCompletedEvents} of ${kpis.completedEvents} completions`,
        ),
        tile(
          'Orders',
          String(kpis.completedOrders + kpis.openOrders + kpis.rejectedOrders),
          `${kpis.completedOrders} done · ${kpis.openOrders} open · ${kpis.rejectedOrders} rejected`,
        ),
        tile(
          'Uncovered jobs',
          String(kpis.uncoveredJobs),
          'no person holds the job',
          kpis.uncoveredJobs > 0 ? 'warn' : 'neutral',
        ),
        tile(
          'SLA breaches',
          String(breaches),
          'steps started after their SLA',
          breaches > 0 ? 'bad' : 'neutral',
        ),
      ),
    ),
    el(
      'section',
      { className: 'panel-section' },
      el('h2', { className: 'section-title', text: 'Wait before each step' }),
      el(
        'div',
        { className: 'legend-row' },
        el('span', { className: 'legend-swatch declared' }),
        el('span', { text: 'Declared' }),
        el('span', { className: 'legend-swatch measured' }),
        el('span', { text: 'Measured average' }),
      ),
      ...kpis.stepWaits.map((wait) => {
        const ratio =
          wait.measuredMinutes === null ? null : wait.measuredMinutes / wait.declaredMinutes;
        const width = (minutes: number): string => `${Math.max(2, (minutes / longest) * 100)}%`;
        return el(
          'div',
          { className: 'wait-row' },
          el(
            'div',
            { className: 'wait-head' },
            el('strong', { text: `${wait.step}. ${wait.taskName}` }),
            el('span', {
              className: ratio !== null && ratio > 2 ? 'wait-ratio over' : 'wait-ratio',
              text: ratio === null ? 'n/a' : `${ratio.toFixed(1)}×`,
            }),
          ),
          el(
            'div',
            { className: 'wait-bars' },
            el('span', {
              className: 'bar declared',
              attributes: { style: `width:${width(wait.declaredMinutes)}` },
            }),
            el('span', {
              className: 'bar measured',
              attributes: { style: `width:${width(wait.measuredMinutes ?? 0)}` },
            }),
          ),
          el('span', {
            className: 'wait-values',
            text: `${formatDuration(wait.declaredMinutes)} declared · ${
              wait.measuredMinutes === null
                ? 'not measured'
                : `${formatDuration(wait.measuredMinutes)} measured (${formatInteger(wait.measuredMinutes)} min, ${wait.samples} orders)`
            }`,
          }),
        );
      }),
    ),
    el(
      'section',
      { className: 'panel-section' },
      el('h2', { className: 'section-title', text: 'About these figures' }),
      el('p', {
        className: 'footnote',
        text: 'Orders, people and waits are the synthetic O2C demo data (guide of 16 Oct 2026). Cycle time and waits are measured from the 52-event log. Costs use assumed hourly rates, which the guide does not give.',
      }),
    ),
  );
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
