import { describe, expect, it } from 'vitest';

import { dataset } from '../dataset';
import { computeOrderProgress } from '../order-progress';

const statuses = (orderRef: string): string[] =>
  computeOrderProgress(dataset, orderRef).steps.map((step) => step.status);

describe('computeOrderProgress', () => {
  it('skips the credit check for an order at or under the threshold', () => {
    expect(statuses('SO-1001')).toEqual(['done', 'skipped', 'done', 'done', 'done', 'done']);

    const progress = computeOrderProgress(dataset, 'SO-1001');
    expect(progress.applicableSteps).toBe(5);
    expect(progress.completedSteps).toBe(5);
    expect(progress.current).toBeNull();
  });

  it('runs a large order through the credit check', () => {
    expect(statuses('SO-1002')).toEqual(['done', 'done', 'done', 'done', 'done', 'done']);
  });

  it('holds an order whose approval is still requested, waiting on the CFO', () => {
    const progress = computeOrderProgress(dataset, 'SO-1004');

    expect(progress.current?.task.code).toBe('T_CREDIT');
    expect(progress.current?.status).toBe('awaiting-approval');
    expect(progress.waitingOn).toBe('E006');
  });

  it('stops an order the CFO rejected', () => {
    const progress = computeOrderProgress(dataset, 'SO-1005');

    expect(statuses('SO-1005')).toEqual([
      'done',
      'rejected',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
    expect(progress.current?.status).toBe('rejected');
  });

  it('measures elapsed time from the first to the last event', () => {
    // 1 Sep 09:00 to 24 Sep 11:15.
    expect(computeOrderProgress(dataset, 'SO-1001').elapsedDays).toBeCloseTo(23.09, 2);
  });

  it('rejects an unknown order', () => {
    expect(() => computeOrderProgress(dataset, 'SO-9999')).toThrow('Unknown order');
  });
});
