import { describe, expect, it } from 'vitest';

import { createNavigation } from '../../../src/building/create-navigation';
import { costAssumptions, dataset } from '../../domain/dataset';
import { computeJobKpis } from '../../domain/people-kpis';
import { HALL_ID, OFFICE_ID } from '../site-plan';
import { buildTwinModel, truckId } from '../twin-layout';

const twin = buildTwinModel(dataset, computeJobKpis(dataset, costAssumptions));
const OFFICE_FLOOR = 0.45;
const STOREY = 4;
const HALL_FLOOR = 1.2;
const navigation = createNavigation({
  model: twin,
  elevation: (building, level) =>
    building === OFFICE_ID ? OFFICE_FLOOR + level * STOREY : HALL_FLOOR,
});

const longestStep = (path: readonly { position: { distanceTo(other: unknown): number } }[]) =>
  Math.max(
    ...path.slice(1).map((point, index) => point.position.distanceTo(path[index]!.position)),
  );

describe('createNavigation', () => {
  it('walks from the sales office up the stairs to the finance office', () => {
    const path = navigation.route('E001', 'E002')!;
    expect(path).not.toBeNull();
    expect(path[0]).toMatchObject({ building: OFFICE_ID, level: 0 });
    expect(path.at(-1)).toMatchObject({ building: OFFICE_ID, level: 1 });

    // Somewhere on the way the walker is half a storey up: on the stair landing.
    const landing = OFFICE_FLOOR + STOREY / 2;
    expect(path.some((point) => Math.abs(point.position.y - landing) < 0.01)).toBe(true);
    // And it climbs, never jumps: no single step is longer than a corridor stretch.
    expect(longestStep(path)).toBeLessThan(30);
  });

  it('keeps a walk on one floor off the stairs', () => {
    const path = navigation.route('E002', 'E006')!;
    expect(path.every((point) => point.level === 1)).toBe(true);
    expect(path.every((point) => Math.abs(point.position.y - (OFFICE_FLOOR + STOREY)) < 0.01)).toBe(
      true,
    );
  });

  it('crosses the walkway into the hall and up to its raised floor', () => {
    const path = navigation.route('E004', truckId('SO-1002'))!;
    expect(path.at(-1)).toMatchObject({ building: HALL_ID, level: 0 });
    expect(path.at(-1)!.position.y).toBeCloseTo(HALL_FLOOR);
    expect(path.some((point) => point.building === OFFICE_ID && point.level === 0)).toBe(true);
  });

  it('starts at the main entrance, outside the lobby, and walks in to the sales office', () => {
    const entrance = navigation.visit('entrance:' + OFFICE_ID)!;
    const office = twin.offices[0]!;
    // Outside the south façade, where the canopy is.
    expect(entrance.point.position.z).toBeGreaterThan(office.center[1] + office.size[1] / 2);
    const path = navigation.route('entrance:' + OFFICE_ID, 'E001')!;
    expect(path.every((point) => point.level === 0)).toBe(true);
  });

  it('stands a visitor beside each desk, facing the person', () => {
    const visit = navigation.visit('E006')!;
    const seat = twin.workstations.find((station) => station.entity.id === 'E006')!;
    const gap = Math.hypot(
      visit.point.position.x - seat.position[0],
      visit.point.position.z - seat.position[1],
    );
    expect(gap).toBeGreaterThan(0.8);
    expect(gap).toBeLessThan(2);
    const towardsSeat = Math.atan2(
      seat.position[0] - visit.point.position.x,
      seat.position[1] - visit.point.position.z,
    );
    expect(visit.facing).toBeCloseTo(towardsSeat);
  });
});
