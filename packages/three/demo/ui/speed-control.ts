import { el } from './dom';

/** Speeds the avatar can walk at, as multiples of a real walking pace. */
const SPEEDS = [0.5, 1, 1.5, 2, 3, 4, 5] as const;

/**
 * A slider for how fast the process avatar walks, from half a real walking pace to five
 * times it, shown as "2×". `onChange` runs with each new speed.
 */
export function createSpeedControl(
  initial: number,
  onChange: (speed: number) => void,
): HTMLElement {
  const input = el('input', {
    className: 'tour-speed-input',
    attributes: {
      type: 'range',
      min: '0',
      max: String(SPEEDS.length - 1),
      step: '1',
      'aria-label': 'Avatar walking speed',
    },
  });
  const value = el('output', { className: 'tour-speed-value' });
  const nearest = SPEEDS.reduce(
    (best, speed, index) =>
      Math.abs(speed - initial) < Math.abs(SPEEDS[best]! - initial) ? index : best,
    0,
  );
  input.value = String(nearest);

  const show = (): number => {
    const speed = SPEEDS[Number(input.value)] ?? initial;
    value.textContent = `${speed}×`;
    input.setAttribute('aria-valuetext', `${speed} times walking pace`);
    return speed;
  };
  show();
  input.addEventListener('input', () => onChange(show()));

  return el(
    'label',
    { className: 'tour-speed', attributes: { title: 'How fast the avatar walks' } },
    el('span', { className: 'tour-speed-label', text: 'Speed' }),
    input,
    value,
  );
}
