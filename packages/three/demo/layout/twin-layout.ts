import type {
  CalloutModel,
  DockModel,
  LabelTone,
  TwinViewModel,
  WorkstationModel,
} from '../../src/viewer-contract/twin-model';
import { AI_AGENT_ID, type O2CDataset } from '../domain/o2c-types';
import type { JobKpis } from '../domain/people-kpis';
import { holderOf, nodeByCode, personById } from '../domain/organization';
import { formatDate } from '../ui/format';
import {
  FLOORS,
  FREE_SEATS,
  HALL,
  HALL_AISLES,
  HALL_DOORS,
  HALL_ID,
  HALL_ROOMS,
  HALL_ZONES,
  JOB_SEATS,
  OFFICE,
  OFFICE_CORRIDORS,
  OFFICE_ID,
  RACK_ROWS,
  SITE,
  TRAFFIC,
  treePoints,
  type SeatPlan,
} from './site-plan';

/** Neutral workwear and office colours; nothing here is derived from who the person is. */
const SHIRTS = [0x2f4a6d, 0xe6e4df, 0x66788a, 0x7e3a3a, 0x3f5e4a, 0xc9b89c, 0x41454d, 0x7b9cc4];
const SKIN = [0xe2b694, 0xc68f68, 0xf0cba8, 0x9a6545, 0xd9a77f];
const HAIR = [0x2a1d15, 0x4b3427, 0x161616, 0x7b5b3d, 0xa39e96];
const TRUCK_CABS = [0xe9eaeb, 0x23395b, 0x9e2b25, 0x3d4a3f, 0xd7d9db];

export const truckId = (orderRef: string): string => `TRUCK-${orderRef}`;

/** The walkway between the office and the hall runs east-west at this Z. */
const WALKWAY_Z = -3;

/**
 * Numbered cards over the three areas the order passes through, listing what is done
 * there, for the site overview.
 */
function callouts(dataset: O2CDataset): CalloutModel[] {
  const tasksIn = (...categories: string[]): string[] =>
    dataset.steps
      .map((step) => dataset.tasks.find((task) => task.code === step.taskCode))
      .filter((task) => task !== undefined && categories.includes(task.category))
      .map((task) => task!.name);
  const delivered = dataset.instances.filter((instance) =>
    dataset.events.some(
      (event) =>
        event.orderRef === instance.orderRef && event.step === 4 && event.type === 'Completed',
    ),
  ).length;
  const held = dataset.instances.filter((instance) => instance.status === 'Suspended').length;
  const top = OFFICE.floorHeight * FLOORS.length + 0.45;
  return [
    {
      number: 1,
      title: 'Sales and administration',
      lines: tasksIn('SALES', 'FINANCE'),
      position: [OFFICE.center[0] - 6, OFFICE.center[1] - 4],
      height: top + 7,
      accent: 0x3b82d6,
    },
    {
      number: 2,
      title: 'Production and warehouse',
      lines: ['Assembly cell · make to order', ...tasksIn('LOGISTICS')],
      position: [HALL.center[0] - 4, HALL.center[1] - 8],
      height: 1.2 + HALL.height + 7,
      accent: 0xe0862a,
    },
    {
      number: 3,
      title: 'Dispatch to customers',
      lines: [
        `${delivered} orders loaded and shipped`,
        `${held} on hold · awaiting credit approval`,
        'Invoice and payment follow',
      ],
      position: [HALL.center[0] + HALL.size[0] / 2 - 6, HALL.center[1] + HALL.size[1] / 2 + 14],
      height: 6,
      accent: 0x3fa676,
    },
  ];
}

/** Builds the twin the viewer draws from the dataset, the job KPIs and the site plan. */
export function buildTwinModel(dataset: O2CDataset, jobKpis: readonly JobKpis[]): TwinViewModel {
  const workstations = [
    ...dataset.nodes
      .filter((node) => node.type === 'JOB' && JOB_SEATS[node.code])
      .map((job) => jobWorkstation(dataset, job.code, jobKpis)),
    ...freeWorkstations(),
  ];

  const officeRect = { center: OFFICE.center, size: OFFICE.size };
  const hallRect = { center: HALL.center, size: HALL.size };
  const blocked = [officeRect, hallRect, ...SITE.paved, ...SITE.parking];

  return {
    company: { entity: { kind: 'company', id: dataset.tenant.code }, title: dataset.tenant.name },
    site: {
      lawn: SITE.lawn,
      paved: SITE.paved,
      roads: SITE.roads,
      parking: SITE.parking,
      trees: treePoints(blocked),
      benches: SITE.benches,
      traffic: TRAFFIC,
    },
    offices: [
      {
        entity: { kind: 'building', id: OFFICE_ID },
        title: OFFICE.title,
        subtitle: `${FLOORS.length} floors · sales, finance and administration`,
        center: OFFICE.center,
        size: OFFICE.size,
        floorHeight: OFFICE.floorHeight,
        entrance: OFFICE.entrance,
        signage: dataset.tenant.name,
        // Where the walkway from the hall arrives: the east front, on the corridor.
        doors: [{ side: 'east', offset: OFFICE.center[1] - WALKWAY_Z }],
        floors: FLOORS.map((floor) => ({
          entity: { kind: 'floor', id: `${OFFICE_ID}-${floor.code}` },
          level: floor.level,
          title: floor.title,
          code: floor.code,
          subtitle: floor.department
            ? (nodeByCode(dataset, floor.department)?.name ?? floor.department)
            : 'Shared spaces',
          rooms: floor.rooms,
          corridors: OFFICE_CORRIDORS,
        })),
      },
    ],
    halls: [
      {
        entity: { kind: 'building', id: HALL_ID },
        title: HALL.title,
        subtitle: `${HALL.size[0]} × ${HALL.size[1]} m · ${HALL.dockOffsets.length} loading docks`,
        center: HALL.center,
        size: HALL.size,
        height: HALL.height,
        zones: HALL_ZONES,
        rackRows: RACK_ROWS,
        rooms: HALL_ROOMS,
        dockSide: HALL.dockSide,
        aisles: HALL_AISLES,
        doors: HALL_DOORS,
        docks: docks(dataset),
      },
    ],
    callouts: callouts(dataset),
    walkways: [
      {
        from: [OFFICE.center[0] + OFFICE.size[0] / 2, WALKWAY_Z],
        to: [HALL.center[0] - HALL.size[0] / 2, WALKWAY_Z],
        width: 3,
      },
    ],
    workstations,
  };
}

/** Converts a seat to world coordinates. */
function worldPosition(seat: SeatPlan): readonly [number, number] {
  const origin = seat.building === OFFICE_ID ? OFFICE.center : HALL.center;
  return [origin[0] + seat.position[0], origin[1] + seat.position[1]];
}

function jobWorkstation(
  dataset: O2CDataset,
  jobCode: string,
  jobKpis: readonly JobKpis[],
): WorkstationModel {
  const seat = JOB_SEATS[jobCode]!;
  const job = nodeByCode(dataset, jobCode)!;
  const kpis = jobKpis.find((entry) => entry.jobCode === jobCode);
  const holder = holderOf(dataset, jobCode);
  const uncovered = dataset.uncoveredJobs.find((entry) => entry.jobCode === jobCode);
  const base = {
    kind: seat.kind,
    building: seat.building,
    level: seat.level,
    position: worldPosition(seat),
    heading: seat.heading,
  };

  if (holder) {
    const index = dataset.persons.indexOf(holder);
    return {
      ...base,
      entity: { kind: 'person', id: holder.id },
      occupant: 'person',
      title: holder.fullName,
      subtitle: job.name,
      detail: personDetail(kpis),
      tone: personTone(kpis),
      appearance: {
        shirt: SHIRTS[index % SHIRTS.length]!,
        skin: SKIN[(index * 3) % SKIN.length]!,
        hair: HAIR[(index * 2 + 1) % HAIR.length]!,
      },
    };
  }

  const appearance = { shirt: 0, skin: 0, hair: 0 };
  if (kpis?.actorId === AI_AGENT_ID) {
    return {
      ...base,
      entity: { kind: 'job', id: jobCode },
      occupant: 'automated',
      title: job.name,
      subtitle: `Automated since ${uncovered?.agentSince ? formatDate(uncovered.agentSince) : '—'}`,
      detail: `${kpis.completed} invoices · avg ${formatMinutes(kpis.averageHandlingMinutes)}`,
      tone: 'neutral',
      appearance,
    };
  }

  const coveredBy = uncovered?.coveredBy ? personById(dataset, uncovered.coveredBy) : undefined;
  return {
    ...base,
    entity: { kind: 'job', id: jobCode },
    occupant: 'vacant',
    title: job.name,
    subtitle: uncovered?.uncoveredWeeks ? `Vacant · ${uncovered.uncoveredWeeks} weeks` : 'Vacant',
    detail: coveredBy ? `Covered by ${coveredBy.fullName}` : 'No holder',
    tone: 'bad',
    appearance,
  };
}

/** One compact line of the person's most telling figures. */
function personDetail(kpis: JobKpis | undefined): string {
  if (!kpis) return '';
  const parts: string[] = [];
  if (kpis.hourlyRate !== null) parts.push(`€${kpis.hourlyRate}/h`);
  if (kpis.loadPercent !== null) parts.push(`load ${kpis.loadPercent}%`);
  if (kpis.openOrders.length > 0) parts.push(`${kpis.openOrders.length} pending`);
  if (kpis.outOfRole > 0) parts.push(`${kpis.outOfRole} out of role`);
  if (parts.length < 3) parts.push(`${kpis.completed} steps`);
  return parts.join(' · ');
}

function personTone(kpis: JobKpis | undefined): LabelTone {
  if (!kpis) return 'neutral';
  if ((kpis.loadPercent ?? 0) > 100) return 'bad';
  if (kpis.openOrders.length > 0 || kpis.outOfRole > 0) return 'warn';
  return 'good';
}

function freeWorkstations(): WorkstationModel[] {
  const counters = new Map<string, number>();
  return FREE_SEATS.map((seat): WorkstationModel => {
    const floor =
      seat.building === OFFICE_ID ? FLOORS.find((plan) => plan.level === seat.level)?.code : 'HL';
    const key = `${floor}-${seat.room}`;
    const number = (counters.get(key) ?? 0) + 1;
    counters.set(key, number);
    const code = `${key}-${String(number).padStart(2, '0')}`;
    return {
      entity: { kind: 'seat', id: code },
      occupant: 'free',
      kind: seat.kind,
      building: seat.building,
      level: seat.level,
      position: worldPosition(seat),
      heading: seat.heading,
      title: 'Free desk',
      subtitle: 'No job assigned',
      detail: code,
      tone: 'neutral',
      appearance: { shirt: 0, skin: 0, hair: 0 },
    };
  });
}

/**
 * One dock per order. An order whose delivery note was issued has its lorry at the door;
 * a held order has its goods staged inside; a rejected one has an empty bay.
 */
function docks(dataset: O2CDataset): DockModel[] {
  return dataset.instances.slice(0, HALL.dockOffsets.length).map((instance, index): DockModel => {
    const offset = HALL.dockOffsets[index]!;
    const title = `D${index + 1} · ${instance.orderRef}`;
    const delivered = dataset.events.find(
      (event) =>
        event.orderRef === instance.orderRef && event.step === 4 && event.type === 'Completed',
    );
    if (delivered) {
      return {
        offset,
        title,
        lines: [`Dispatched ${formatDate(delivered.at)}`],
        truck: {
          entity: { kind: 'truck', id: truckId(instance.orderRef) },
          cabColor: TRUCK_CABS[index % TRUCK_CABS.length]!,
        },
        staged: 0,
        tone: 'good',
      };
    }
    const held = instance.status === 'Suspended' || instance.status === 'Running';
    return {
      offset,
      title,
      lines: [held ? 'On hold · credit approval' : 'Cancelled · credit rejected'],
      truck: null,
      staged: held ? 4 : 0,
      tone: held ? 'warn' : 'bad',
    };
  });
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return 'n/a';
  return `${Math.round(minutes * 10) / 10} min`;
}
