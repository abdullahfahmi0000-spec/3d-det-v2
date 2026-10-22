import type {
  TwinViewModel,
  ViewModeModel,
  WorkstationModel,
} from '../../src/viewer-contract/twin-model';
import type { O2CDataset } from '../domain/o2c-types';
import { nodeByCode } from '../domain/organization';
import { FLOORS, HALL, HALL_ID, HALL_ROOMS, HALL_ZONES, OFFICE_ID } from './site-plan';

/** One entry of the building navigator and the figures shown for it. */
export interface PlaceSummary {
  readonly key: string;
  readonly view: ViewModeModel;
  /** Navigator group heading this entry belongs to. */
  readonly group: string;
  readonly title: string;
  readonly subtitle: string;
  readonly rooms: number;
  readonly seats: number;
  readonly people: number;
  readonly jobs: number;
  readonly vacant: number;
  readonly automated: number;
  /** Names of the people working there, for the summary card. */
  readonly names: readonly string[];
}

export const viewKey = (view: ViewModeModel): string =>
  view.building === null
    ? 'site'
    : view.level === null
      ? view.building
      : `${view.building}#${view.level}`;

/** The places the navigator lists: the site, the office and each of its floors, the hall. */
export function summarisePlaces(dataset: O2CDataset, twin: TwinViewModel): PlaceSummary[] {
  const office = twin.offices[0]!;
  const hall = twin.halls[0]!;
  const summary = (
    view: ViewModeModel,
    group: string,
    title: string,
    subtitle: string,
    rooms: number,
    stations: readonly WorkstationModel[],
  ): PlaceSummary => {
    const holders = stations.filter((station) => station.occupant === 'person');
    return {
      key: viewKey(view),
      view,
      group,
      title,
      subtitle,
      rooms,
      seats: stations.filter((station) => station.kind !== 'standing').length,
      people: holders.length,
      jobs: stations.filter((station) => station.occupant !== 'free').length,
      vacant: stations.filter((station) => station.occupant === 'vacant').length,
      automated: stations.filter((station) => station.occupant === 'automated').length,
      names: holders.map((station) => station.title),
    };
  };

  const inOffice = twin.workstations.filter((station) => station.building === OFFICE_ID);
  const inHall = twin.workstations.filter((station) => station.building === HALL_ID);
  const officeRooms = FLOORS.reduce(
    (count, floor) => count + floor.rooms.filter((room) => room.kind !== 'core').length,
    0,
  );

  return [
    summary(
      { building: null, level: null },
      'Site',
      twin.company.title,
      'Head office, production and warehouse',
      officeRooms + HALL_ROOMS.length + HALL_ZONES.length,
      twin.workstations,
    ),
    summary(
      { building: OFFICE_ID, level: null },
      office.title,
      'Whole building',
      office.subtitle,
      officeRooms,
      inOffice,
    ),
    ...[...FLOORS].reverse().map((floor) =>
      summary(
        { building: OFFICE_ID, level: floor.level },
        office.title,
        floor.title,
        floor.department
          ? (nodeByCode(dataset, floor.department)?.name ?? floor.department)
          : 'Shared spaces',
        floor.rooms.filter((room) => room.kind !== 'core').length,
        inOffice.filter((station) => station.level === floor.level),
      ),
    ),
    summary(
      { building: HALL_ID, level: null },
      hall.title,
      'Hall floor',
      `${nodeByCode(dataset, HALL.department)?.name ?? 'Logistics'} · ${hall.subtitle}`,
      HALL_ROOMS.length + HALL_ZONES.length,
      inHall,
    ),
  ];
}
