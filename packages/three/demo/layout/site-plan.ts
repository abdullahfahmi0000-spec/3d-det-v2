import type {
  GroundPoint,
  HallZoneModel,
  PavedAreaModel,
  RackRowModel,
  RoadModel,
  RoomModel,
  Side,
  TrafficModel,
  WorkstationKind,
} from '../../src/viewer-contract/twin-model';

/**
 * Where everything is drawn. This is presentation configuration: the dataset says which
 * jobs, people and orders exist; this file says which building, floor and desk they are
 * at. Office and hall coordinates are local to the building (centred on its footprint),
 * site coordinates are world metres with +Z towards the road.
 */

export const OFFICE_ID = 'HQ';
export const HALL_ID = 'HALL';

export const OFFICE = {
  title: 'Head office',
  center: [-42, -2] as GroundPoint,
  size: [48, 26] as GroundPoint,
  floorHeight: 4,
  entrance: 'south' as Side,
};

/** The office corridor: one east-west spine between the north and south rooms. */
export const OFFICE_CORRIDORS: readonly (readonly GroundPoint[])[] = [
  [
    [-23.3, -1],
    [23.3, -1],
  ],
];

export interface FloorPlan {
  readonly level: number;
  /** Short code used in seat numbers, such as GF-SAL-01. */
  readonly code: string;
  readonly title: string;
  /** Department the floor houses, if any; the navigator lists it under the floor. */
  readonly department: string | null;
  readonly rooms: readonly RoomModel[];
}

const core = (level: number): RoomModel => ({
  id: `core-${level}`,
  kind: 'core',
  title: 'Stairs and lifts',
  center: [0, -8],
  size: [10, 10],
  door: 'south',
});

export const FLOORS: readonly FloorPlan[] = [
  {
    level: 0,
    code: 'GF',
    title: 'Ground floor',
    department: 'DEP_SALES',
    rooms: [
      core(0),
      {
        id: 'LOB',
        kind: 'lobby',
        title: 'Reception',
        center: [0, 7],
        size: [14, 12],
        door: 'south',
      },
      {
        id: 'SMO',
        kind: 'office',
        title: 'Sales manager',
        center: [-19.5, -8],
        size: [9, 10],
        door: 'south',
      },
      {
        id: 'CMR',
        kind: 'meeting',
        title: 'Customer meeting room',
        center: [-10, -8],
        size: [10, 10],
        door: 'south',
      },
      {
        id: 'SAL',
        kind: 'open-office',
        title: 'Sales office',
        center: [-15.5, 7],
        size: [17, 12],
        door: 'north',
      },
      {
        id: 'TRN',
        kind: 'meeting',
        title: 'Training room',
        center: [10, -8],
        size: [10, 10],
        door: 'south',
      },
      {
        id: 'MAIL',
        kind: 'service',
        title: 'Copy and mail room',
        center: [19.5, -8],
        size: [9, 10],
        door: 'south',
      },
      { id: 'CAF', kind: 'break', title: 'Café', center: [15.5, 7], size: [17, 12], door: 'north' },
    ],
  },
  {
    level: 1,
    code: '1F',
    title: 'First floor',
    department: 'DEP_FIN',
    rooms: [
      core(1),
      {
        id: 'ARC',
        kind: 'archive',
        title: 'Finance archive',
        center: [-19.5, -8],
        size: [9, 10],
        door: 'south',
      },
      {
        id: 'FMR',
        kind: 'meeting',
        title: 'Finance meeting room',
        center: [-10, -8],
        size: [10, 10],
        door: 'south',
      },
      {
        id: 'HAO',
        kind: 'office',
        title: 'Head of administration',
        center: [10, -8],
        size: [10, 10],
        door: 'south',
      },
      {
        id: 'CFO',
        kind: 'office',
        title: 'CFO office',
        center: [19.5, -8],
        size: [9, 10],
        door: 'south',
      },
      {
        id: 'FIN',
        kind: 'open-office',
        title: 'Finance office',
        center: [-8, 7],
        size: [32, 12],
        door: 'north',
      },
      {
        id: 'BRD',
        kind: 'boardroom',
        title: 'Boardroom',
        center: [16, 7],
        size: [16, 12],
        door: 'north',
      },
    ],
  },
  {
    level: 2,
    code: '2F',
    title: 'Second floor',
    department: null,
    rooms: [
      core(2),
      {
        id: 'WSR',
        kind: 'meeting',
        title: 'Workshop room',
        center: [-14.5, -8],
        size: [19, 10],
        door: 'south',
      },
      {
        id: 'IT',
        kind: 'service',
        title: 'IT and server room',
        center: [10, -8],
        size: [10, 10],
        door: 'south',
      },
      {
        id: 'QR',
        kind: 'office',
        title: 'Quiet room',
        center: [19.5, -8],
        size: [9, 10],
        door: 'south',
      },
      {
        id: 'HOT',
        kind: 'open-office',
        title: 'Shared desks',
        center: [-10, 7],
        size: [28, 12],
        door: 'north',
      },
      {
        id: 'LNG',
        kind: 'break',
        title: 'Staff lounge',
        center: [14, 7],
        size: [20, 12],
        door: 'north',
      },
    ],
  },
];

export const HALL = {
  title: 'Production and warehouse',
  center: [30, -6] as GroundPoint,
  size: [70, 44] as GroundPoint,
  height: 9.6,
  dockSide: 'south' as Side,
  /** Dock door positions along the south wall, one per order in the event log. */
  dockOffsets: [4, 10, 16, 22, 28],
  department: 'DEP_LOG',
};

export const HALL_ZONES: readonly HallZoneModel[] = [
  {
    id: 'STO',
    kind: 'storage',
    title: 'Finished goods storage',
    center: [-13, -11.5],
    size: [42, 19],
  },
  {
    id: 'PRD',
    kind: 'production',
    title: 'Assembly cell · make to order',
    center: [21.5, -12.5],
    size: [23, 17],
  },
  { id: 'PCK', kind: 'picking', title: 'Picking area', center: [-19.5, 5.5], size: [27, 11] },
  { id: 'PAK', kind: 'packing', title: 'Packing', center: [3, 5.5], size: [14, 11] },
  { id: 'RAW', kind: 'storage', title: 'Raw materials', center: [22.5, 5], size: [21, 9] },
  { id: 'DSP', kind: 'staging', title: 'Dispatch staging', center: [16, 16.5], size: [30, 8] },
];

/**
 * Walking aisles in the hall: the cross aisle between storage and picking (in from the
 * walkway door), a side aisle past packing, and the aisle along the dock staging lanes.
 */
export const HALL_AISLES: readonly (readonly GroundPoint[])[] = [
  [
    [-33.4, 3],
    [-31, -1],
    [33, -1],
  ],
  [
    [-6, -1],
    [-6, 12],
  ],
  [
    [-33, 12],
    [33, 12],
  ],
];

/** The personnel door where the walkway from the office arrives, on the west wall. */
export const HALL_DOORS = [{ side: 'west' as Side, offset: 3 }];

const rack = (z: number, levels = 5): RackRowModel => ({
  center: [-13, z],
  bays: 14,
  levels,
  fill: 0.82,
});

export const RACK_ROWS: readonly RackRowModel[] = [
  rack(-20.3),
  rack(-16),
  rack(-14.9),
  rack(-10.6),
  rack(-9.5),
  rack(-5.2, 4),
];

export const HALL_ROOMS: readonly RoomModel[] = [
  {
    id: 'SHP',
    kind: 'office',
    title: 'Shipping office',
    center: [-28, 17.5],
    size: [14, 9],
    door: 'north',
  },
];

// ---------------------------------------------------------------------------------------
// Seats

export interface SeatPlan {
  readonly building: typeof OFFICE_ID | typeof HALL_ID;
  readonly level: number;
  readonly room: string;
  readonly position: GroundPoint;
  readonly heading: number;
  readonly kind: WorkstationKind;
}

const FACING_ROOM = Math.PI;

/** Where each job sits. Every job of the org chart has a place, held or not. */
export const JOB_SEATS: Readonly<Record<string, SeatPlan>> = {
  JOB_SALES_MGR: office(0, 'SMO', [-19.5, -9.4], 0, 'executive'),
  JOB_ORDER_ENTRY: office(0, 'SAL', [-18.4, 5.45], 0, 'desk'),
  JOB_CFO: office(1, 'CFO', [19.5, -9.4], 0, 'executive'),
  JOB_HEAD_ADMIN: office(1, 'HAO', [10, -9.4], 0, 'executive'),
  JOB_CREDIT: office(1, 'FIN', [-18.9, 5.45], 0, 'desk'),
  JOB_COLLECTIONS: office(1, 'FIN', [-17.1, 7.55], FACING_ROOM, 'desk'),
  JOB_INVOICING: office(1, 'FIN', [-10.9, 5.45], 0, 'desk'),
  JOB_HEAD_LOG: hall('SHP', [-31.5, 16.4], FACING_ROOM, 'executive'),
  JOB_SHIPPING: hall('SHP', [-25, 16.1], FACING_ROOM, 'desk'),
  JOB_WAREHOUSE: hall('PCK', [-9.5, 8.6], FACING_ROOM, 'standing'),
};

/** Desks with no job: two-by-two pods in the open offices. */
export const FREE_SEATS: readonly SeatPlan[] = [
  ...pod(0, 'SAL', -17.5, 6.5, 2).filter((seat) => !samePlace(seat, JOB_SEATS.JOB_ORDER_ENTRY!)),
  ...pod(0, 'SAL', -12, 6.5, 2),
  ...pod(1, 'FIN', -18, 6.5, 2).filter(
    (seat) =>
      !samePlace(seat, JOB_SEATS.JOB_CREDIT!) && !samePlace(seat, JOB_SEATS.JOB_COLLECTIONS!),
  ),
  ...pod(1, 'FIN', -10, 6.5, 2).filter((seat) => !samePlace(seat, JOB_SEATS.JOB_INVOICING!)),
  ...pod(2, 'HOT', -16, 6.5, 2),
  hall('SHP', [-23.2, 16.1], FACING_ROOM, 'desk'),
];

function office(
  level: number,
  room: string,
  position: GroundPoint,
  heading: number,
  kind: WorkstationKind,
): SeatPlan {
  return { building: OFFICE_ID, level, room, position, heading, kind };
}

function hall(
  room: string,
  position: GroundPoint,
  heading: number,
  kind: WorkstationKind,
): SeatPlan {
  return { building: HALL_ID, level: 0, room, position, heading, kind };
}

/** Desks in facing pairs: `columns` wide, centred on `(x, z)`. */
function pod(level: number, room: string, x: number, z: number, columns: number): SeatPlan[] {
  const seats: SeatPlan[] = [];
  for (let column = 0; column < columns; column += 1) {
    const cx = Math.round((x + (column - (columns - 1) / 2) * 1.75) * 100) / 100;
    seats.push(office(level, room, [cx, z - 1.05], 0, 'desk'));
    seats.push(office(level, room, [cx, z + 1.05], FACING_ROOM, 'desk'));
  }
  return seats;
}

function samePlace(a: SeatPlan, b: SeatPlan): boolean {
  return (
    a.building === b.building &&
    a.level === b.level &&
    Math.abs(a.position[0] - b.position[0]) < 0.6 &&
    Math.abs(a.position[1] - b.position[1]) < 0.6
  );
}

// ---------------------------------------------------------------------------------------
// Site

export const ROAD_Z = 58;

export const SITE = {
  lawn: { center: [2, 6] as GroundPoint, size: [176, 92] as GroundPoint },
  roads: [{ from: [-700, ROAD_Z], to: [700, ROAD_Z], width: 10 }] as readonly RoadModel[],
  paved: [
    { kind: 'plaza', center: [-42, 15.6], size: [30, 9] },
    { kind: 'path', center: [-42, 21.3], size: [4, 2.6] },
    { kind: 'path', center: [-42, -17.2], size: [54, 3] },
    { kind: 'path', center: [-68.2, -2], size: [3, 33.5] },
    { kind: 'asphalt', center: [48, 33], size: [38, 34] },
    { kind: 'asphalt', center: [30, -30.5], size: [74, 5] },
    { kind: 'driveway', center: [48, 51.5], size: [12, 3.2] },
    { kind: 'driveway', center: [-47, 46], size: [7, 13] },
  ] as readonly PavedAreaModel[],
  parking: [
    {
      center: [-47, 31] as GroundPoint,
      size: [44, 17] as GroundPoint,
      bays: 30,
      occupied: [0, 1, 3, 4, 5, 8, 9, 12, 15, 16, 18, 21, 22, 26, 27],
    },
  ],
  benches: [
    { position: [-53, 17.5] as GroundPoint, heading: 0 },
    { position: [-31, 17.5] as GroundPoint, heading: 0 },
    { position: [-48, 13] as GroundPoint, heading: Math.PI },
  ],
};

const lane = { eastbound: ROAD_Z + 2.5, westbound: ROAD_Z - 2.5 };
const east = (z: number): GroundPoint[] => [
  [-650, z],
  [650, z],
];
const west = (z: number): GroundPoint[] => [
  [650, z],
  [-650, z],
];

export const TRAFFIC: readonly TrafficModel[] = [
  { kind: 'truck', path: east(lane.eastbound), speed: 12, phase: 0.47, color: 0x23395b },
  { kind: 'truck', path: west(lane.westbound), speed: 11, phase: 0.62, color: 0xe9eaeb },
  { kind: 'van', path: east(lane.eastbound), speed: 14, phase: 0.2, color: 0xf2f2f0 },
  { kind: 'van', path: west(lane.westbound), speed: 13, phase: 0.33, color: 0xc9ccd0 },
  { kind: 'car', path: east(lane.eastbound), speed: 15, phase: 0.75, color: 0x2b2d31 },
  { kind: 'car', path: west(lane.westbound), speed: 16, phase: 0.05, color: 0x8d939a },
  { kind: 'car', path: west(lane.westbound), speed: 15, phase: 0.5, color: 0x6b1f22 },
  { kind: 'car', path: east(lane.eastbound), speed: 16, phase: 0.92, color: 0xe8e8e6 },
];

/** Trees along the lawn edges, around the car park and in a copse by the office. */
export function treePoints(
  blocked: readonly { center: GroundPoint; size: GroundPoint }[],
): GroundPoint[] {
  const points: GroundPoint[] = [];
  const add = (x: number, z: number): void => {
    const clear = blocked.every(
      ({ center: [cx, cz], size: [sx, sz] }) =>
        Math.abs(x - cx) > sx / 2 + 2.5 || Math.abs(z - cz) > sz / 2 + 2.5,
    );
    if (clear) points.push([x, z]);
  };
  for (let x = -82; x <= 86; x += 8.5) add(x + ((x * 7) % 3), -37 + ((x * 3) % 2));
  for (let x = -80; x <= 86; x += 11) add(x, 48.5);
  for (let z = -30; z <= 46; z += 8) {
    add(-81 + ((z * 5) % 3), z);
    add(84 - ((z * 3) % 2), z);
  }
  for (let x = -68; x <= -26; x += 7) add(x, 42.5);
  for (const [x, z] of [
    [-76, -24],
    [-73, -28],
    [-78, -14],
    [-12, 21],
    [-8, 27],
    [-15, 33],
    [-5, 38],
    [-11, 44],
    [10, 25],
    [16, 31],
    [20, 40],
    [8, 43],
    [72, 22],
    [76, 30],
    [75, 40],
  ] as const) {
    add(x, z);
  }
  return points;
}
