import type { O2CDataset } from '../domain/o2c-types';
import type { OrderProgress, StepStatus } from '../domain/order-progress';
import { holderOf, nodeByCode, raciOf, taskOf } from '../domain/organization';
import { NODE_STATE } from '../layout/route-state';
import { dispatchStep } from '../layout/tour-plan';
import { el } from './dom';

export interface FlowBar {
  /**
   * Colours each step by the order's state. With `reached`, only those steps show their
   * state and the rest wait as not started, so a guided walk fills the bar as it goes.
   */
  render(progress: OrderProgress, reached?: ReadonlySet<number>): void;
  /** Marks the step a guided walk is at; null clears it. */
  setCurrent(step: number | null): void;
}

/** Line icons for the kinds of task, drawn on a 24-unit grid. */
const ICONS: Readonly<Record<string, string>> = {
  T_REG_ORDER: 'M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H6.2M9 19.5h.01M17 19.5h.01',
  T_CREDIT: 'M12 3 5 6v5c0 4.4 3 8.1 7 9 4-.9 7-4.6 7-9V6zM9 12l2 2 4-4',
  T_PICK: 'M4 8 12 4l8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  T_DELIVERY_NOTE:
    'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-.01M17 19a1.5 1.5 0 1 0 0-.01',
  T_INVOICE: 'M6 3h9l3 3v15H6zM15 3v3h3M9 11h6M9 15h6',
  T_RECONCILE: 'M3 6h18v12H3zM3 10h18M7 15h3',
};
const FALLBACK_ICON = 'M5 5h14v14H5z';

/**
 * The strip along the bottom of the viewer: every step of the process in order, with the
 * gateway after the first, coloured by the state of the order being shown. Each step is a
 * round icon with its number, the task and who does it, joined to the next by an arrow.
 * Clicking a step reports it.
 */
export function createFlowBar(
  host: HTMLElement,
  dataset: O2CDataset,
  onPick: (step: number) => void,
): FlowBar {
  const items = dataset.steps.map((step) => {
    const task = taskOf(dataset, step);
    const responsible = raciOf(dataset, task.code)?.responsible;
    const holder = responsible ? holderOf(dataset, responsible) : undefined;
    const automated = dataset.uncoveredJobs.some(
      (job) => job.jobCode === responsible && job.coveredByAgent,
    );
    const who = holder?.fullName ?? (automated ? 'Automated' : 'Vacant post');
    const icon = el('span', { className: 'flow-icon' });
    icon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${ICONS[task.code] ?? FALLBACK_ICON}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    icon.append(el('span', { className: 'flow-number', text: String(step.step) }));
    const button = el(
      'button',
      { className: 'flow-item', attributes: { type: 'button' } },
      icon,
      el(
        'span',
        { className: 'flow-text' },
        el('strong', { text: task.name }),
        el('span', {
          text: `${responsible ? (nodeByCode(dataset, responsible)?.name ?? '') : ''} · ${who}`,
        }),
      ),
    );
    button.addEventListener('click', () => onPick(step.step));
    return { step: step.step, button };
  });

  // The goods leaving: shown last, after payment, as the walk shows it.
  const dispatchNumber = dispatchStep(dataset.steps.length);
  const dispatchIcon = el('span', { className: 'flow-icon' });
  dispatchIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${ICONS.T_DELIVERY_NOTE}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  dispatchIcon.append(el('span', { className: 'flow-number', text: String(dispatchNumber) }));
  const dispatchButton = el(
    'button',
    { className: 'flow-item', attributes: { type: 'button' } },
    dispatchIcon,
    el(
      'span',
      { className: 'flow-text' },
      el('strong', { text: 'Dispatch' }),
      el('span', { text: 'Lorry leaves the dock' }),
    ),
  );
  dispatchButton.addEventListener('click', () => onPick(dispatchNumber));
  items.push({ step: dispatchNumber, button: dispatchButton });

  const gateway = el(
    'div',
    { className: 'flow-gateway', attributes: { title: dataset.gateway.name } },
    el('span', { className: 'flow-diamond' }),
    el('span', { className: 'flow-gateway-text', text: dataset.gateway.name }),
  );
  const arrow = (): HTMLElement =>
    el('span', { className: 'flow-arrow', attributes: { 'aria-hidden': 'true' } });

  host.replaceChildren(
    el('h2', { className: 'flow-title', text: `${dataset.process.name} process flow` }),
    el(
      'div',
      { className: 'flow-items' },
      ...items.flatMap((item, index) =>
        index === 0
          ? [item.button, arrow(), gateway, arrow()]
          : [item.button, ...(index < items.length - 1 ? [arrow()] : [])],
      ),
    ),
  );

  return {
    setCurrent(current) {
      for (const { step, button } of items) button.classList.toggle('is-current', step === current);
    },
    render(progress, reached) {
      // The goods leave once the delivery note is issued; a rejected order never ships.
      const shipped = progress.steps.some(
        (step) => step.task.code === 'T_DELIVERY_NOTE' && step.status === 'done',
      );
      const dispatchStatus: StepStatus = shipped
        ? 'done'
        : progress.instance.status === 'Aborted'
          ? 'skipped'
          : 'pending';
      for (const { step, button } of items) {
        const status =
          step === dispatchNumber
            ? dispatchStatus
            : (progress.steps.find((candidate) => candidate.step.step === step)?.status ??
              'pending');
        const shown = !reached || reached.has(step) || status === 'skipped';
        button.dataset.state = shown ? NODE_STATE[status] : 'idle';
        // Dispatch has a lorry to fly to only once the goods have shipped.
        button.disabled = status === 'skipped' || (step === dispatchNumber && status !== 'done');
      }
      const branched = Boolean(progress.branch) && (!reached || reached.has(1));
      gateway.dataset.state = branched ? 'done' : 'idle';
      gateway.title = `${dataset.gateway.name} ${progress.branch ? `→ ${progress.branch}` : ''}`;
    },
  };
}
