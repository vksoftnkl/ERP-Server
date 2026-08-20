import type { TsSeed } from '../seed.types';

/**
 * Seeds written in TypeScript, run through Prisma after every SQL file in
 * `prisma/seed/seed.manifest.json` — in the order listed here.
 *
 * Currently empty: the stock adjustment reasons and GST UQC units that used to live
 * here are now SQL seeds (Stock_Adjust_Reasons.sql, Item_Gst_Units.sql), exported
 * with `npm run seed:export:masters` like the rest of the reference data.
 *
 * Reach for a TypeScript seed only when the data needs application logic a SQL file
 * cannot express; otherwise add a .sql file to prisma/seed, which the runner picks
 * up on its own. Keep any seed added here idempotent (upsert / find-then-write),
 * because `mode: 'always'` means it runs on every deploy.
 */
export const TS_SEEDS: TsSeed[] = [];
