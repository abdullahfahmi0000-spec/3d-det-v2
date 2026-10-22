import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { createKeyboardNavigation } from '../camera/keyboard-navigation';
import { isTravelled } from '../process-route/node-style';

const press = (target: EventTarget, type: 'keydown' | 'keyup', key: string): void => {
  target.dispatchEvent(Object.assign(new Event(type), { key }));
};

describe('createKeyboardNavigation', () => {
  const setup = () => {
    const camera = new PerspectiveCamera();
    camera.position.set(0, 10, 10);
    const lookAt = new Vector3(0, 0, 0);
    const keys = new EventTarget();
    const navigation = createKeyboardNavigation(camera, lookAt, keys, { moveSpeed: 10 });
    return { camera, lookAt, keys, navigation };
  };

  it('moves the camera and its look-at point forward on the ground plane', () => {
    const { camera, lookAt, keys, navigation } = setup();

    press(keys, 'keydown', 'ArrowUp');
    expect(navigation.update(1)).toBe(true);

    expect(camera.position.z).toBeCloseTo(0);
    expect(camera.position.y).toBe(10);
    expect(lookAt.z).toBeCloseTo(-10);
  });

  it('turns the view in place', () => {
    const { camera, lookAt, keys, navigation } = setup();

    press(keys, 'keydown', 'ArrowLeft');
    navigation.update(0.5);

    expect(camera.position.toArray()).toEqual([0, 10, 10]);
    expect(lookAt.x).toBeLessThan(0);
  });

  it('does nothing without a key held, and stops listening after dispose', () => {
    const { keys, navigation } = setup();
    expect(navigation.update(1)).toBe(false);

    navigation.dispose();
    press(keys, 'keydown', 'ArrowUp');
    expect(navigation.update(1)).toBe(false);
  });
});

describe('isTravelled', () => {
  it('lights a leg once the stop it leads to has been reached', () => {
    expect(isTravelled('done')).toBe(true);
    expect(isTravelled('active')).toBe(true);
    expect(isTravelled('waiting')).toBe(true);
    expect(isTravelled('rejected')).toBe(true);
    expect(isTravelled('idle')).toBe(false);
    expect(isTravelled('skipped')).toBe(false);
  });
});
