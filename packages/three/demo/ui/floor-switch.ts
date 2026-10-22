import type { ViewModeModel } from '../../src/viewer-contract/twin-model';
import { FLOORS, HALL, HALL_ID, OFFICE, OFFICE_ID } from '../layout/site-plan';
import { el } from './dom';

export interface FloorSwitch {
  setVisible(visible: boolean): void;
  /** Marks the floor the plan shows. */
  setCurrent(building: string, level: number | null): void;
}

/**
 * The 2D view's floor picker, like the buttons in a lift: one per office floor, top floor
 * first, and one for the hall. It also says which floor the plan shows, as an address.
 */
export function createFloorSwitch(
  host: HTMLElement,
  onPick: (view: ViewModeModel) => void,
): FloorSwitch {
  const address = el('div', { className: 'floor-address' });
  const buttons = new Map<string, HTMLButtonElement>();
  const button = (
    key: string,
    code: string,
    title: string,
    view: ViewModeModel,
  ): HTMLButtonElement => {
    const item = el(
      'button',
      { className: 'floor-button', attributes: { type: 'button', title } },
      el('strong', { text: code }),
    );
    item.addEventListener('click', () => onPick(view));
    buttons.set(key, item);
    return item;
  };

  host.replaceChildren(
    el('span', { className: 'floor-switch-label', text: OFFICE.title }),
    ...[...FLOORS].reverse().map((floor) =>
      button(`${OFFICE_ID}#${floor.level}`, floor.code, floor.title, {
        building: OFFICE_ID,
        level: floor.level,
      }),
    ),
    el('span', { className: 'floor-switch-label', text: 'Hall' }),
    button(HALL_ID, 'H', HALL.title, { building: HALL_ID, level: null }),
    address,
  );
  host.hidden = true;

  return {
    setVisible(visible) {
      host.hidden = !visible;
    },
    setCurrent(building, level) {
      const isHall = building === HALL_ID;
      const key = isHall ? HALL_ID : `${OFFICE_ID}#${level ?? 0}`;
      for (const [id, item] of buttons) item.classList.toggle('active', id === key);
      const floor = FLOORS.find((candidate) => candidate.level === (level ?? 0));
      address.replaceChildren(
        el('span', {
          className: 'floor-address-code',
          text: isHall ? 'HALL' : (floor?.code ?? ''),
        }),
        el('span', {
          text: isHall ? HALL.title : `${OFFICE.title} · ${floor?.title ?? ''}`,
        }),
      );
    },
  };
}
