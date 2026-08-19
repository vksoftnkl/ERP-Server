import type { TsSeed } from '../seed.types';
import { stockAdjustReasonsSeed } from './stock-adjust-reasons.seed';

/**
 * Seeds written in TypeScript, run through Prisma after every SQL file in
 * `prisma/seed/seed.manifest.json` — in the order listed here.
 *
 * Add a new one by exporting a `TsSeed` from this folder and appending it below.
 * Keep it idempotent (upsert / find-then-write), because `mode: 'always'` means it
 * runs on every deploy.
 */
export const TS_SEEDS: TsSeed[] = [stockAdjustReasonsSeed];

export { stockAdjustReasonsSeed };
