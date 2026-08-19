/**
 * Standalone entry point kept for `tsx prisma/seed/Stock_Adjust_Reasons.ts`.
 *
 * The data and the write logic now live in
 * src/database/seed/seeds/stock-adjust-reasons.seed.ts, so the same seed runs from
 * the deploy runner (which the compiled app can reach — this folder is only
 * TypeScript source) and from here.
 *
 * To run every seed instead of just this one: `npm run seed:run`.
 */
import { PrismaClient } from '@prisma/client';
import { stockAdjustReasonsSeed } from '../../src/database/seed/seeds/stock-adjust-reasons.seed';

const prisma = new PrismaClient();

stockAdjustReasonsSeed
  .run(prisma)
  .then(() => {
    console.log('Stock adjustment reasons and GST unit UQC data seeded successfully');
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
