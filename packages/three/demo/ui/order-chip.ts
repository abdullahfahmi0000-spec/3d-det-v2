import type { RouteModel } from '../../src/viewer-contract/twin-model';
import { el } from './dom';

/** The chip over the 3D view naming the order whose route is drawn. */
export function renderOrderChip(host: HTMLElement, badge: RouteModel['badge']): void {
  if (!badge) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const [customer, amount, status] = badge.lines;
  host.replaceChildren(
    el('span', { className: 'order-chip-label', text: 'Route of' }),
    el('strong', { text: badge.title }),
    el('span', { text: [customer, amount].filter(Boolean).join(' · ') }),
    ...(status ? [el('span', { className: 'order-chip-status', text: status })] : []),
  );
}
