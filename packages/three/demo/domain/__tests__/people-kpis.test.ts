import { describe, expect, it } from 'vitest';

import { costAssumptions, dataset } from '../dataset';
import { computeJobKpis, computeOrderCosts } from '../people-kpis';

describe('computeJobKpis', () => {
  const kpis = computeJobKpis(dataset, costAssumptions);
  const of = (job: string) => kpis.find((entry) => entry.jobCode === job)!;

  it('finds the CFO approvals and the order still waiting on them', () => {
    const cfo = of('JOB_CFO');
    expect(cfo.approvals).toMatchObject({ granted: 1, rejected: 1 });
    expect(cfo.openOrders).toEqual(['SO-1004']);
  });

  it('counts picking done by the shipping clerk as work outside the role', () => {
    const shipping = of('JOB_SHIPPING');
    expect(shipping.completed).toBe(6);
    expect(shipping.outOfRole).toBe(3);
    // The work is named from the data: picking, which belongs to the Warehouse Operator job.
    expect(shipping.outOfRoleWork.map(({ task, job }) => [task.code, job])).toEqual([
      ['T_PICK', 'JOB_WAREHOUSE'],
    ]);
  });

  it('measures credit-check handling without the time spent waiting on the CFO', () => {
    // SO-1002: 14:10 to 16:05, less the 14:26 to 16:00 approval wait, is 21 minutes.
    expect(of('JOB_CREDIT').averageHandlingMinutes).toBeCloseTo(21);
  });

  it('costs the automated job per run and leaves the vacant job without cost', () => {
    expect(of('JOB_INVOICING')).toMatchObject({
      actorId: 'AI_AGENT',
      completed: 3,
      hourlyRate: null,
    });
    expect(of('JOB_WAREHOUSE')).toMatchObject({ actorId: null, completed: 0, annualCost: null });
  });

  it('takes the declared load from the guide', () => {
    expect(of('JOB_ORDER_ENTRY').loadPercent).toBe(118);
  });
});

describe('computeOrderCosts', () => {
  it('prices the credit check only for orders that went through it', () => {
    const costs = computeOrderCosts(dataset, costAssumptions);
    const small = costs.find((cost) => cost.orderRef === 'SO-1001')!;
    const large = costs.find((cost) => cost.orderRef === 'SO-1002')!;
    expect(large.declared).toBeGreaterThan(small.declared);
    expect(small.measured).toBeGreaterThan(0);
  });
});
