import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const StockAdjList = [
    {
      sarCode: 'SHORTAGE',
      sarName: 'Physical Shortage',
      sarReasonKind: 'SHORTAGE',
      sarDefaultResolution: 'ADJUST_LOSS_GAIN',
      sarAffectsAccounts: true,
    },
    {
      sarCode: 'EXCESS',
      sarName: 'Physical Excess',
      sarReasonKind: 'EXCESS',
      sarDefaultResolution: 'ADJUST_LOSS_GAIN',
      sarAffectsAccounts: true,
    },
    {
      sarCode: 'BRAND_SWAP',
      sarName: 'Wrong Brand Selected',
      sarReasonKind: 'BRAND_SWAP',
      sarDefaultResolution: 'RECLASSIFY',
      sarAffectsAccounts: false,
    },
    {
      sarCode: 'BATCH_SWAP',
      sarName: 'Wrong Batch Selected',
      sarReasonKind: 'BATCH_SWAP',
      sarDefaultResolution: 'RECLASSIFY',
      sarAffectsAccounts: false,
    },
    {
      sarCode: 'UNIT_ERROR',
      sarName: 'Wrong Unit Conversion',
      sarReasonKind: 'UNIT_ERROR',
      sarDefaultResolution: 'CORRECT_SOURCE_DOC',
      sarAffectsAccounts: false,
    },
    {
      sarCode: 'DAMAGE',
      sarName: 'Damage / Expired Stock',
      sarReasonKind: 'DAMAGE',
      sarDefaultResolution: 'ADJUST_LOSS_GAIN',
      sarAffectsAccounts: true,
    },
    {
      sarCode: 'PILFERAGE',
      sarName: 'Pilferage / Theft',
      sarReasonKind: 'PILFERAGE',
      sarDefaultResolution: 'ADJUST_LOSS_GAIN',
      sarAffectsAccounts: true,
    },
    {
      sarCode: 'COUNT_ERROR',
      sarName: 'Counting Error',
      sarReasonKind: 'COUNTING_ERROR',
      sarDefaultResolution: 'RECOUNT_REQUIRED',
      sarAffectsAccounts: false,
    },
    {
      sarCode: 'UNPOSTED',
      sarName: 'Unposted Sale / Purchase',
      sarReasonKind: 'UNPOSTED_DOCUMENT',
      sarDefaultResolution: 'CORRECT_SOURCE_DOC',
      sarAffectsAccounts: false,
    },
  ];
  for (const reason of StockAdjList) {
    await prisma.stockAdjReason.upsert({
      where: {
        sarCode: reason.sarCode,
      },
      update: {
        sarName: reason.sarName,
        sarReasonKind: reason.sarReasonKind,
        sarDefaultResolution: reason.sarDefaultResolution,
        sarAffectsAccounts: reason.sarAffectsAccounts,
        sarModifiedOn: new Date(),
      },
      create: {
        sarCode: reason.sarCode,
        sarName: reason.sarName,
        sarReasonKind: reason.sarReasonKind,
        sarDefaultResolution: reason.sarDefaultResolution,
        sarAffectsAccounts: reason.sarAffectsAccounts,
        sarIsActive: true,
        sarIsDeleted: false,
      },
    });
  }
  console.log('Stock adjustment reasons seeded successfully');
}
main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });