import { describe, expect, it } from 'vitest';

import { costAssumptions, dataset } from '../../domain/dataset';
import { computeOrderProgress } from '../../domain/order-progress';
import { computeJobKpis } from '../../domain/people-kpis';
import { toRoute } from '../route-state';
import { intakeOf, planTour } from '../tour-plan';
import { buildTwinModel, truckId } from '../twin-layout';

const twin = buildTwinModel(dataset, computeJobKpis(dataset, costAssumptions));
const plan = (orderRef: string) => {
  const progress = computeOrderProgress(dataset, orderRef);
  return planTour(progress, toRoute(dataset, progress), twin);
};
const describeScenes = (orderRef: string) =>
  plan(orderRef).map((scene) =>
    scene.kind === 'stop'
      ? scene.entity.id
      : scene.kind === 'dispatch'
        ? scene.truck.id
        : scene.kind,
  );

describe('planTour', () => {
  it('walks a large order through the credit check and the CFO, then dispatches it last', () => {
    expect(describeScenes('SO-1002')).toEqual([
      'intro',
      'E001',
      'E002',
      'E006',
      'E003',
      'E003',
      'JOB_INVOICING',
      'E004',
      truckId('SO-1002'),
      'outcome',
    ]);
  });

  it('receives every order at the desk of whoever registered it', () => {
    for (const instance of dataset.instances) {
      const registered = dataset.events.find(
        (event) =>
          event.orderRef === instance.orderRef && event.step === 1 && event.type === 'Started',
      );
      expect(intakeOf(plan(instance.orderRef))?.entity.id).toBe(registered?.by);
    }
  });

  it('sends the parcel from each stop to the next', () => {
    const scenes = plan('SO-1002');
    const froms = scenes.flatMap((scene) => (scene.kind === 'stop' ? [scene.from] : []));
    expect(froms.slice(0, 3)).toEqual([null, 'step-1', 'step-2']);
    const dispatch = scenes.find((scene) => scene.kind === 'dispatch');
    expect(dispatch && 'from' in dispatch ? dispatch.from : null).toBe('step-4');
  });

  it('ends a held order at the CFO, with no dispatch', () => {
    expect(describeScenes('SO-1004')).toEqual(['intro', 'E001', 'E002', 'E006', 'outcome']);
  });

  it('ends a rejected order at the rejection', () => {
    expect(describeScenes('SO-1005')).toEqual(['intro', 'E001', 'E002', 'E006', 'outcome']);
  });

  it('shows each step where it was done: at the stand-in for a vacant post, at the service for an automated one', () => {
    const anchors = plan('SO-1001').flatMap((scene) =>
      scene.kind === 'stop' ? [[scene.step.task.code, scene.stop.anchor]] : [],
    );
    expect(Object.fromEntries(anchors)).toMatchObject({
      T_PICK: 'E003',
      T_INVOICE: 'JOB_INVOICING',
    });
  });

  it('opens the right floor or the hall for each stop', () => {
    const views = plan('SO-1003').flatMap((scene) =>
      scene.kind === 'stop' || scene.kind === 'dispatch' ? [scene.view] : [],
    );
    expect(views[0]).toEqual({ building: 'HQ', level: 0 });
    expect(views[1]).toEqual({ building: 'HALL', level: null });
    expect(views.at(-1)).toEqual({ building: 'HALL', level: null });
  });
});
