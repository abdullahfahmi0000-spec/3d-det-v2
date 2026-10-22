import type { PlaceSummary } from '../layout/site-summary';
import { el } from './dom';

/** The summary card in the bottom-left corner for the building or floor in view. */
export function renderBuildingCard(host: HTMLElement, place: PlaceSummary): void {
  const stat = (label: string, value: number, alert = false): HTMLElement =>
    el(
      'div',
      { className: alert && value > 0 ? 'stat alert' : 'stat' },
      el('span', { className: 'stat-label', text: label }),
      el('strong', { className: 'stat-value', text: String(value) }),
    );

  host.replaceChildren(
    el('h2', {
      className: 'card-title',
      text: place.key === 'site' ? place.title : `${place.group}`,
    }),
    el('p', {
      className: 'card-subtitle',
      text: place.key === 'site' ? place.subtitle : `${place.title} · ${place.subtitle}`,
    }),
    el(
      'div',
      { className: 'stat-grid' },
      stat('Rooms', place.rooms),
      stat('Desks', place.seats),
      stat('People', place.people),
      stat('Jobs placed', place.jobs),
      stat('Vacant', place.vacant, true),
      stat('Automated', place.automated),
    ),
    ...(place.names.length > 0
      ? [el('p', { className: 'card-names', text: place.names.join(' · ') })]
      : []),
  );
}
