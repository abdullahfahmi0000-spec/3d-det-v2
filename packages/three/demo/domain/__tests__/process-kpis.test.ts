import { describe, expect, it } from 'vitest';

import { dataset } from '../dataset';
import { computeProcessKpis } from '../process-kpis';

/** Expected figures are the ones printed in the O2C demo data guide. */
describe('computeProcessKpis', () => {
  const kpis = computeProcessKpis(dataset);

  it('matches the guide on measured waits before each step', () => {
    const measured = Object.fromEntries(
      kpis.stepWaits.map((wait) => [wait.step, Math.round(wait.measuredMinutes ?? 0)]),
    );
    expect(measured).toEqual({ 2: 2841, 3: 2251, 4: 535, 5: 619, 6: 27258 });
  });

  it('averages about 22 days per completed order against 5 declared', () => {
    expect(kpis.completedOrders).toBe(3);
    expect(kpis.averageCycleDays).toBeCloseTo(22, 0);
    expect(kpis.declaredDays).toBe(5);
  });

  it('counts the AI agent share of completed events', () => {
    expect(kpis.agentCompletedEvents).toBe(3);
    expect(kpis.completedEvents).toBe(18);
  });

  it('counts open, rejected and uncovered', () => {
    expect(kpis.openOrders).toBe(1);
    expect(kpis.rejectedOrders).toBe(1);
    expect(kpis.uncoveredJobs).toBe(2);
  });
});

describe('dataset', () => {
  it('holds the 52 events of the guide', () => {
    expect(dataset.events).toHaveLength(52);
  });
});
