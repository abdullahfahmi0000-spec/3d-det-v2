import { describe, expect, it } from 'vitest';

import { costAssumptions, dataset } from '../../domain/dataset';
import { computeOrderProgress } from '../../domain/order-progress';
import { computeJobKpis } from '../../domain/people-kpis';
import { toRoute } from '../route-state';
import { HALL_ID, OFFICE_ID } from '../site-plan';
import { buildTwinModel, truckId } from '../twin-layout';

const jobKpis = computeJobKpis(dataset, costAssumptions);
const twin = buildTwinModel(dataset, jobKpis);

describe('buildTwinModel', () => {
  it('gives every job a workstation, marking the automated job and the vacant post', () => {
    const jobs = twin.workstations.filter((station) => station.occupant !== 'free');
    expect(jobs).toHaveLength(10);

    const occupants = Object.fromEntries(
      jobs.map((station) => [station.entity.id, station.occupant]),
    );
    expect(occupants.JOB_INVOICING).toBe('automated');
    expect(occupants.JOB_WAREHOUSE).toBe('vacant');
    expect(occupants.E001).toBe('person');
  });

  it('seats sales and finance in the office and logistics in the hall', () => {
    const where = (id: string) => twin.workstations.find((station) => station.entity.id === id);
    expect(where('E001')).toMatchObject({ building: OFFICE_ID, level: 0 });
    expect(where('E006')).toMatchObject({ building: OFFICE_ID, level: 1 });
    expect(where('E003')).toMatchObject({ building: HALL_ID, level: 0 });
  });

  it('puts every workstation inside the footprint of its building', () => {
    const footprints: Record<string, { center: readonly number[]; size: readonly number[] }> = {
      [OFFICE_ID]: twin.offices[0]!,
      [HALL_ID]: twin.halls[0]!,
    };
    for (const station of twin.workstations) {
      const { center, size } = footprints[station.building]!;
      expect(Math.abs(station.position[0] - center[0]!)).toBeLessThan(size[0]! / 2);
      expect(Math.abs(station.position[1] - center[1]!)).toBeLessThan(size[1]! / 2);
    }
  });

  it('docks a lorry for each order whose delivery note was issued', () => {
    const docks = twin.halls[0]!.docks;
    expect(docks.filter((dock) => dock.truck).map((dock) => dock.truck!.entity.id)).toEqual([
      truckId('SO-1001'),
      truckId('SO-1002'),
      truckId('SO-1003'),
    ]);
    expect(docks[3]?.tone).toBe('warn');
    expect(docks[4]?.tone).toBe('bad');
  });

  it('flags the overloaded order entry desk', () => {
    const giulia = twin.workstations.find((station) => station.entity.id === 'E001');
    expect(giulia?.tone).toBe('bad');
    expect(giulia?.detail).toContain('load 118%');
  });
});

describe('toRoute', () => {
  it('stops a suspended order at the CFO, with the remaining steps not reached', () => {
    const route = toRoute(dataset, computeOrderProgress(dataset, 'SO-1004'));

    const approval = route.stops.find((stop) => stop.id === 'approval-2');
    expect(approval).toMatchObject({ anchor: 'E006', state: 'waiting' });
    expect(route.badge?.stopId).toBe('step-2');
    expect(route.stops.filter((stop) => stop.state === 'idle').map((stop) => stop.id)).toEqual([
      'step-3',
      'step-4',
      'step-5',
      'step-6',
    ]);
  });

  it('routes a small order past the credit check to the dock and the invoicing service', () => {
    // Picking is shown at Paolo Neri, who did it, not at the empty Warehouse Operator post.
    const route = toRoute(dataset, computeOrderProgress(dataset, 'SO-1003'));

    expect(route.stops.map((stop) => stop.anchor)).toEqual([
      'E001',
      'E003',
      'E003',
      truckId('SO-1003'),
      'JOB_INVOICING',
      'E004',
    ]);
    expect(route.legs).toHaveLength(route.stops.length - 1);
    expect(route.badge?.stopId).toBe('step-6');
  });

  it('keeps a step at its post when whoever covered it has no desk of their own', () => {
    // A temporary worker with no seated job picks SO-1001 instead of Paolo Neri.
    const temp = {
      ...dataset.persons[0]!,
      id: 'E999',
      fullName: 'Temp Worker',
      jobCode: 'JOB_TEMP',
    };
    const withTemp = {
      ...dataset,
      persons: [...dataset.persons, temp],
      events: dataset.events.map((event) =>
        event.orderRef === 'SO-1001' && event.step === 3 ? { ...event, by: 'E999' } : event,
      ),
    };
    const route = toRoute(withTemp, computeOrderProgress(withTemp, 'SO-1001'));
    expect(route.stops.find((stop) => stop.id === 'step-3')?.anchor).toBe('JOB_WAREHOUSE');
  });

  it('keeps a step at its post when whoever covered it shares a job and so has no desk', () => {
    // A second order entry clerk picks SO-1001; the order entry desk belongs to the first.
    const second = {
      ...dataset.persons[0]!,
      id: 'E998',
      fullName: 'Second Clerk',
      jobCode: 'JOB_ORDER_ENTRY',
    };
    const withSecond = {
      ...dataset,
      persons: [...dataset.persons, second],
      events: dataset.events.map((event) =>
        event.orderRef === 'SO-1001' && event.step === 3 ? { ...event, by: 'E998' } : event,
      ),
    };
    const route = toRoute(withSecond, computeOrderProgress(withSecond, 'SO-1001'));
    expect(route.stops.find((stop) => stop.id === 'step-3')?.anchor).toBe('JOB_WAREHOUSE');
  });

  it('ends a rejected order at the rejection', () => {
    const route = toRoute(dataset, computeOrderProgress(dataset, 'SO-1005'));
    expect(route.stops.at(-1)).toMatchObject({ id: 'approval-2', state: 'rejected' });
  });
});
