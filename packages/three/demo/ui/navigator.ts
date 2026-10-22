import type { PlaceSummary } from '../layout/site-summary';
import { el } from './dom';

export interface Navigator {
  setActive(key: string): void;
}

/**
 * The building and floor list in the top-left corner, grouped by building. Picking an
 * entry reports it; the active entry is highlighted.
 */
export function createNavigator(
  host: HTMLElement,
  places: readonly PlaceSummary[],
  onPick: (place: PlaceSummary) => void,
): Navigator {
  const buttons = new Map<string, HTMLButtonElement>();
  const groups = new Map<string, PlaceSummary[]>();
  for (const place of places) groups.set(place.group, [...(groups.get(place.group) ?? []), place]);

  host.replaceChildren(
    el('h2', { className: 'panel-title', text: 'Buildings' }),
    ...[...groups].map(([group, entries]) =>
      el(
        'section',
        { className: 'nav-group' },
        el('h3', { className: 'nav-group-title', text: group }),
        ...entries.map((place) => {
          const button = el(
            'button',
            { className: 'nav-item', attributes: { type: 'button' } },
            el(
              'span',
              { className: 'nav-item-text' },
              el('strong', { text: place.key === 'site' ? 'Site overview' : place.title }),
              el('span', {
                text: place.key === 'site' ? `${places.length - 1} areas` : place.subtitle,
              }),
            ),
            el('span', {
              className: 'nav-count',
              text: place.seats > 0 ? `${place.seats} desks` : `${place.rooms} rooms`,
            }),
          );
          button.addEventListener('click', () => onPick(place));
          buttons.set(place.key, button);
          return button;
        }),
      ),
    ),
  );

  return {
    setActive(key) {
      for (const [entry, button] of buttons) {
        button.classList.toggle('active', entry === key);
        button.setAttribute('aria-pressed', String(entry === key));
      }
    },
  };
}
