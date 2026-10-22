import costs from '../data/cost-assumptions.json';
import raw from '../data/o2c-demo.json';
import type { CostAssumptions, O2CDataset } from './o2c-types';

/**
 * The demo dataset. JSON imports are typed loosely (every string is `string`), so the file
 * is asserted to the dataset shape once, here, at the boundary.
 */
export const dataset = raw as O2CDataset;

/** Labour cost rates. These are assumptions for the demo, not data from the O2C guide. */
export const costAssumptions = costs as CostAssumptions;
