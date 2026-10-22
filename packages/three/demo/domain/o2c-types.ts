/**
 * Shape of `data/o2c-demo.json`. Names follow the tables of 01.5 DDL PostgreSQL V62 so the
 * file can later be replaced by API responses without changing the code that reads it.
 */

export type NodeType = 'COMPANY' | 'DEPARTMENT' | 'JOB';

export interface OrgNode {
  readonly code: string;
  readonly name: string;
  readonly type: NodeType;
  /** Parent in the BOM_LINK hierarchy. */
  readonly reportsTo: string | null;
}

export interface Person {
  readonly id: string;
  readonly fullName: string;
  readonly contractType: string;
  readonly jobCode: string;
  readonly since: string;
}

export interface UncoveredJob {
  readonly jobCode: string;
  readonly reason: string;
  readonly coveredByAgent?: boolean;
  readonly agentSince?: string;
  /** How long the job has had no holder. */
  readonly uncoveredWeeks?: number;
  /** Person who does the job's work outside their own role. */
  readonly coveredBy?: string;
}

/** Declared workload of one person on one task (Appendix A, stops 2 and 3). */
export interface Workload {
  readonly personId: string;
  readonly taskCode: string;
  readonly minutesPerTask: number;
  readonly timesPerDay: number;
  readonly loadPercent: number;
  readonly source: string;
}

export interface Transaction {
  readonly code: string;
  readonly name: string;
  readonly type: string;
  readonly system: string;
  readonly behaviour: string;
  readonly status: string;
}

export interface Task {
  readonly code: string;
  readonly name: string;
  readonly category: string;
  readonly frequency: string;
  readonly typicalMinutes: number;
  readonly automatablePercent: number;
  readonly judgement: boolean;
  readonly transaction: string | null;
  /** RACI status when it differs from the declared default, such as `Assumed`. */
  readonly raciStatus?: string;
  /** The assignment is disputed by the people involved. */
  readonly contested?: boolean;
}

export interface RaciAssignment {
  readonly taskCode: string;
  readonly responsible: string;
  readonly accountable: string;
}

export interface BusinessRule {
  readonly code: string;
  readonly name: string;
  readonly type: string;
  readonly status: string;
  readonly effectiveFrom: string;
  readonly ownerJob: string;
  readonly parameters: readonly {
    readonly code: string;
    readonly value: number;
    readonly unit: string;
  }[];
}

export interface ProcessDefinition {
  readonly code: string;
  readonly name: string;
  readonly trigger: string;
  readonly endCondition: string;
  readonly owner: string;
  readonly criticality: string;
  readonly declaredAverageDurationDays: number;
  readonly version: string;
  readonly status: string;
}

export interface ProcessStep {
  readonly step: number;
  readonly taskCode: string;
  readonly marker: 'Start' | 'End' | null;
  readonly durationMinutes: number;
  readonly waitBeforeMinutes: number;
  readonly slaMinutes: number;
  readonly automationNow: number;
  readonly automationTarget: number;
}

export interface Gateway {
  readonly code: string;
  readonly name: string;
  readonly type: string;
  readonly rule: string;
}

export interface GatewayLink {
  readonly direction: 'Incoming' | 'Outgoing';
  readonly step: number;
  readonly label: string | null;
  readonly condition: string | null;
  readonly isDefault: boolean;
}

export interface FlowLink {
  readonly from: number;
  readonly to: number;
}

export type InstanceStatus = 'Running' | 'Completed' | 'Suspended' | 'Aborted';

export interface ProcessInstance {
  readonly id: string;
  readonly orderRef: string;
  readonly customer: string;
  readonly amount: number;
  readonly currency: string;
  readonly startedAt: string;
  readonly status: InstanceStatus;
  readonly outcome: string | null;
}

export type EventType =
  | 'Started'
  | 'Completed'
  | 'Branch_Activated'
  | 'Escalated'
  | 'Approval_Requested'
  | 'Approval_Granted'
  | 'Approval_Rejected'
  | 'Reminder_Sent';

export interface ProcessEvent {
  readonly orderRef: string;
  readonly at: string;
  /** Step number, or null for gateway events. */
  readonly step: number | null;
  readonly type: EventType;
  /** Person id, `AI_AGENT`, or null for system events. */
  readonly by: string | null;
  readonly waitBeforeMinutes: number | null;
  readonly label: string | null;
}

export interface O2CDataset {
  readonly tenant: { readonly code: string; readonly name: string };
  readonly taskCategories: readonly { readonly code: string; readonly name: string }[];
  readonly nodes: readonly OrgNode[];
  readonly persons: readonly Person[];
  readonly uncoveredJobs: readonly UncoveredJob[];
  readonly transactions: readonly Transaction[];
  readonly tasks: readonly Task[];
  readonly raci: readonly RaciAssignment[];
  readonly businessRules: readonly BusinessRule[];
  readonly process: ProcessDefinition;
  readonly steps: readonly ProcessStep[];
  readonly gateway: Gateway;
  readonly gatewayLinks: readonly GatewayLink[];
  readonly flowLinks: readonly FlowLink[];
  readonly instances: readonly ProcessInstance[];
  readonly events: readonly ProcessEvent[];
  readonly workload: readonly Workload[];
}

/** Shape of `data/cost-assumptions.json`: assumed rates, not part of the O2C guide. */
export interface CostAssumptions {
  readonly meta: {
    readonly source: string;
    readonly currency: string;
    readonly annualHours: number;
    readonly basis: string;
  };
  /** Fully loaded hourly cost per job code. */
  readonly hourlyRates: Readonly<Record<string, number>>;
  readonly automation: Readonly<
    Record<string, { readonly costPerRun: number; readonly licencePerYear: number }>
  >;
}

/** The actor id the event log uses for the invoicing AI agent. */
export const AI_AGENT_ID = 'AI_AGENT';
