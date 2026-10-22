import type { EntityRef } from './events';

/**
 * The digital-twin layout the viewer draws: the site, its buildings, floors and rooms, the
 * workstations people sit at, the warehouse racks, the trucks and the process route.
 *
 * Everything here is already resolved by the presentation layer: positions, titles, KPI
 * texts and states. The viewer turns it into geometry and never decides what it means.
 */

/** A position on the ground plane, as `[x, z]` in metres. */
export type GroundPoint = readonly [number, number];

/** An axis-aligned rectangle on the ground: centre and size (width along X, depth along Z). */
export interface GroundRect {
  readonly center: GroundPoint;
  readonly size: GroundPoint;
}

export type Side = 'north' | 'south' | 'east' | 'west';

// ---------------------------------------------------------------------------------------
// Site

/** `driveway` is asphalt laid over the pavement where a drive crosses it. */
export type PavedKind = 'plaza' | 'asphalt' | 'path' | 'driveway';

export interface PavedAreaModel extends GroundRect {
  readonly kind: PavedKind;
}

export interface RoadModel {
  readonly from: GroundPoint;
  readonly to: GroundPoint;
  readonly width: number;
}

export interface ParkingModel extends GroundRect {
  /** Bays are laid in two rows facing a central aisle along X. */
  readonly bays: number;
  /** Bays with a parked car, by index. */
  readonly occupied: readonly number[];
}

export type VehicleKind = 'truck' | 'van' | 'car';

/** A vehicle driving a looping path; it reappears at the start once it reaches the end. */
export interface TrafficModel {
  readonly kind: VehicleKind;
  readonly path: readonly GroundPoint[];
  /** Metres per second. */
  readonly speed: number;
  /** Start position along the path, as a fraction of its length. */
  readonly phase: number;
  readonly color: number;
}

export interface SiteModel {
  readonly lawn: GroundRect;
  readonly paved: readonly PavedAreaModel[];
  readonly roads: readonly RoadModel[];
  readonly parking: readonly ParkingModel[];
  readonly trees: readonly GroundPoint[];
  readonly benches: readonly { readonly position: GroundPoint; readonly heading: number }[];
  readonly traffic: readonly TrafficModel[];
}

// ---------------------------------------------------------------------------------------
// Buildings

export type RoomKind =
  | 'office'
  | 'open-office'
  | 'meeting'
  | 'boardroom'
  | 'lobby'
  | 'break'
  | 'core'
  | 'service'
  | 'archive';

export interface RoomModel extends GroundRect {
  /** Rooms are positioned in their building's local frame, centred on the footprint. */
  readonly id: string;
  readonly kind: RoomKind;
  readonly title: string;
  /** The partition that gets a door; null for open areas without partitions. */
  readonly door: Side | null;
}

export interface FloorModel {
  readonly entity: EntityRef;
  readonly level: number;
  readonly title: string;
  /** Short floor code shown on the plan, such as `GF` or `1F`. */
  readonly code?: string;
  /** What the floor houses, such as a department. */
  readonly subtitle?: string;
  readonly rooms: readonly RoomModel[];
  /**
   * Centre lines of the corridors, in the building's local frame. People walking between
   * rooms follow them; each room's door is joined to the nearest one.
   */
  readonly corridors?: readonly (readonly GroundPoint[])[];
}

export interface OfficeBuildingModel extends GroundRect {
  readonly entity: EntityRef;
  readonly title: string;
  readonly subtitle: string;
  readonly floorHeight: number;
  /** Ground floor first. */
  readonly floors: readonly FloorModel[];
  /** Façade the main entrance is on. */
  readonly entrance: Side;
  /** Lettering over the entrance. */
  readonly signage: string;
  /** Extra automatic doors in the ground-floor façade, such as where a walkway arrives. */
  readonly doors?: readonly { readonly side: Side; readonly offset: number }[];
}

export type HallZoneKind = 'storage' | 'picking' | 'packing' | 'production' | 'staging';

export interface HallZoneModel extends GroundRect {
  readonly id: string;
  readonly kind: HallZoneKind;
  readonly title: string;
}

/** A run of pallet racking along X, in the hall's local frame. */
export interface RackRowModel {
  readonly center: GroundPoint;
  /** Bays along the row; each bay is 2.7 m wide. */
  readonly bays: number;
  readonly levels: number;
  /** Fill ratio of the pallet positions, 0 to 1. */
  readonly fill: number;
}

export interface DockModel {
  /** Position along the dock wall, in the hall's local X. */
  readonly offset: number;
  readonly title: string;
  readonly lines: readonly string[];
  /** A truck backed up to the door, or null for an empty bay. */
  readonly truck: { readonly entity: EntityRef; readonly cabColor: number } | null;
  /** Pallets staged inside the door. */
  readonly staged: number;
  readonly tone: LabelTone;
}

export interface HallModel extends GroundRect {
  readonly entity: EntityRef;
  readonly title: string;
  readonly subtitle: string;
  readonly height: number;
  readonly zones: readonly HallZoneModel[];
  readonly rackRows: readonly RackRowModel[];
  /** Offices built inside the hall, in its local frame. */
  readonly rooms: readonly RoomModel[];
  /** Wall the loading docks are on. */
  readonly dockSide: Side;
  readonly docks: readonly DockModel[];
  /** Centre lines of the walking aisles, in the hall's local frame. */
  readonly aisles?: readonly (readonly GroundPoint[])[];
  /** Personnel doors in the walls, as a side and a position along it. */
  readonly doors?: readonly { readonly side: Side; readonly offset: number }[];
}

/** A covered glass walkway between two buildings, on the ground. */
export interface WalkwayModel {
  readonly from: GroundPoint;
  readonly to: GroundPoint;
  readonly width: number;
}

// ---------------------------------------------------------------------------------------
// People and workstations

/**
 * Who sits at a workstation: a person, an automated service that does the job, a job with
 * no holder, or a free seat with no job at all.
 */
export type WorkstationOccupant = 'person' | 'automated' | 'vacant' | 'free';

export type WorkstationKind = 'desk' | 'executive' | 'standing';

export type LabelTone = 'neutral' | 'good' | 'warn' | 'bad';

export interface WorkstationModel {
  readonly entity: EntityRef;
  readonly occupant: WorkstationOccupant;
  readonly kind: WorkstationKind;
  /** Building entity id and floor level the workstation is on. */
  readonly building: string;
  readonly level: number;
  /** World position of the seat. */
  readonly position: GroundPoint;
  /** Direction the occupant faces, in radians around Y; 0 faces +Z. */
  readonly heading: number;
  readonly title: string;
  readonly subtitle: string;
  /** Short monospace line under the subtitle, such as a seat code or a KPI summary. */
  readonly detail: string;
  readonly tone: LabelTone;
  readonly appearance: {
    readonly shirt: number;
    readonly skin: number;
    readonly hair: number;
  };
}

export interface CompanyModel {
  readonly entity: EntityRef;
  readonly title: string;
}

/**
 * A numbered card over an area of the site in the overview, such as "1 Sales and
 * administration" with the tasks done there.
 */
export interface CalloutModel {
  readonly number: number;
  readonly title: string;
  readonly lines: readonly string[];
  readonly position: GroundPoint;
  /** Height of the card's anchor above the ground. */
  readonly height: number;
  readonly accent: number;
}

export interface TwinViewModel {
  readonly company: CompanyModel;
  readonly callouts?: readonly CalloutModel[];
  readonly site: SiteModel;
  readonly offices: readonly OfficeBuildingModel[];
  readonly halls: readonly HallModel[];
  readonly walkways: readonly WalkwayModel[];
  readonly workstations: readonly WorkstationModel[];
}

// ---------------------------------------------------------------------------------------
// View and process route

/** Which part of the twin is opened up: everything, one building, or one floor of it. */
export interface ViewModeModel {
  readonly building: string | null;
  /** Floor level to cut the building away at; null shows the whole building. */
  readonly level: number | null;
  /**
   * Shows every floor and roof in place, for moving through the inside of the buildings
   * the way a visitor would, with ceilings overhead.
   */
  readonly interior?: boolean;
  /**
   * The plan view from above: `building` and `level` give the office floor that is
   * opened up, and every hall is shown without its roof.
   */
  readonly plan?: boolean;
}

/** Display state of one process node for the order being shown. */
export type ProcessNodeState = 'idle' | 'done' | 'active' | 'waiting' | 'rejected' | 'skipped';

export interface RouteStopModel {
  readonly id: string;
  /** Workstation entity id the stop is drawn at. */
  readonly anchor: string;
  /** Short marker text, such as the step number. */
  readonly marker: string;
  readonly title: string;
  readonly subtitle: string;
  readonly state: ProcessNodeState;
}

export interface RouteLegModel {
  readonly from: string;
  readonly to: string;
  readonly state: ProcessNodeState;
}

/** The path one order takes through the building, from desk to desk. */
export interface RouteModel {
  readonly stops: readonly RouteStopModel[];
  readonly legs: readonly RouteLegModel[];
  /** Order card shown over one stop. */
  readonly badge: {
    readonly stopId: string;
    readonly title: string;
    readonly lines: readonly string[];
  } | null;
}

export const emptyRoute = (): RouteModel => ({ stops: [], legs: [], badge: null });

/** Stable key for looking an entity up in a registry. */
export const entityKey = (entity: EntityRef): string => `${entity.kind}:${entity.id}`;
