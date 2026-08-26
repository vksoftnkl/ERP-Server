import type { TsSeed } from '../seed.types';
import { printerProfilesSeed } from './printer-profiles.seed';
import { reportTemplatesSeed } from './report-templates.seed';

/**
 * Seeds written in TypeScript, run through Prisma after every SQL file in
 * `prisma/seed/seed.manifest.json` — in the order listed here.
 *
 * Reach for a TypeScript seed only when the data needs application logic a SQL file
 * cannot express; otherwise add a .sql file to prisma/seed, which the runner picks
 * up on its own. Keep any seed added here idempotent (upsert / find-then-write),
 * because `mode: 'always'` means it runs on every deploy.
 *
 * The two report seeds qualify on exactly that test: the print templates are built
 * by TypeScript functions that derive their column grids arithmetically and are
 * validated against a zod contract before being written, which a SQL blob of
 * pre-computed coordinates could neither express nor check.
 */
export const TS_SEEDS: TsSeed[] = [
  // Profiles first: a template seed is independent of them, but a fresh install
  // that fails halfway is more useful with the printer catalogue already in.
  printerProfilesSeed,
  reportTemplatesSeed,
];
