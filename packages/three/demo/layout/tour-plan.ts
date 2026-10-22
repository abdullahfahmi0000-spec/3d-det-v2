import type { EntityRef } from '../../src/viewer-contract/events';
import type {
  RouteModel,
  RouteStopModel,
  TwinViewModel,
  ViewModeModel,
} from '../../src/viewer-contract/twin-model';
import type { OrderProgress, StepProgress } from '../domain/order-progress';
import { HALL_ID, OFFICE_ID } from './site-plan';

/**
 * One scene of the guided walk through an order: the opening, a stop at each desk the
 * order passed, the lorry leaving with the goods, and the outcome.
 */
export type TourScene =
  | { readonly kind: 'intro' }
  | {
      readonly kind: 'stop';
      readonly stop: RouteStopModel;
      /** The step the stop belongs to; an approval stop belongs to the step it unblocks. */
      readonly step: StepProgress;
      readonly isApproval: boolean;
      readonly entity: EntityRef;
      readonly view: ViewModeModel;
      /** The previous stop, for the parcel to travel from; null at the first stop. */
      readonly from: string | null;
    }
  | {
      readonly kind: 'dispatch';
      readonly stop: RouteStopModel;
      readonly step: StepProgress;
      readonly truck: EntityRef;
      readonly view: ViewModeModel;
      readonly from: string | null;
    }
  | { readonly kind: 'outcome' };

/**
 * Plans the walk: every stop the order actually reached, in order, then the dispatch of
 * its lorry (shown last, after the people), then the outcome. Stops the order has not
 * reached are left out, so a held or rejected order ends where it stopped.
 */
export function planTour(
  progress: OrderProgress,
  route: RouteModel,
  twin: TwinViewModel,
): TourScene[] {
  const scenes: TourScene[] = [{ kind: 'intro' }];
  const stepOf = (stop: RouteStopModel): StepProgress | undefined => {
    const number = Number(/^(?:step|approval)-(\d+)$/.exec(stop.id)?.[1]);
    return progress.steps.find((step) => step.step.step === number);
  };

  let previous: string | null = null;
  let dispatch: TourScene | null = null;
  for (const [index, stop] of route.stops.entries()) {
    if (stop.state === 'idle' || stop.state === 'skipped') continue;

    if (stop.id === 'dispatch') {
      const before = route.stops[index - 1];
      const step = before ? stepOf(before) : undefined;
      if (step) {
        dispatch = {
          kind: 'dispatch',
          stop,
          step,
          truck: { kind: 'truck', id: stop.anchor },
          view: { building: HALL_ID, level: null },
          from: before?.id ?? null,
        };
      }
      continue;
    }

    const step = stepOf(stop);
    const station = twin.workstations.find((candidate) => candidate.entity.id === stop.anchor);
    if (!step || !station) continue;
    scenes.push({
      kind: 'stop',
      stop,
      step,
      isApproval: stop.id.startsWith('approval-'),
      entity: station.entity,
      view: {
        building: station.building,
        level: station.building === OFFICE_ID ? station.level : null,
      },
      from: previous,
    });
    previous = stop.id;
  }

  if (dispatch) scenes.push(dispatch);
  scenes.push({ kind: 'outcome' });
  return scenes;
}

/** The number the dispatch of the goods carries in the flow, after the process's own steps. */
export const dispatchStep = (stepCount: number): number => stepCount + 1;

export function sceneTitle(scene: TourScene): string {
  switch (scene.kind) {
    case 'intro':
      return 'Order received';
    case 'stop':
      return scene.stop.title;
    case 'dispatch':
      return 'Dispatch';
    case 'outcome':
      return 'Outcome';
  }
}
