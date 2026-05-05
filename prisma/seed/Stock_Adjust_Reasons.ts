import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const StockAdjList = [
    {
      adjCode: 'SHORTAGE',
      adjName: 'Physical Shortage',
      adjReason: 'SHORTAGE',
      adjResolution: 'ADJUST_LOSS_GAIN',
      adjAffectAcc: true,
    },
    {
      adjCode: 'EXCESS',
      adjName: 'Physical Excess',
      adjReason: 'EXCESS',
      adjResolution: 'ADJUST_LOSS_GAIN',
      adjAffectAcc: true,
    },
    {
      adjCode: 'BRAND_SWAP',
      adjName: 'Wrong Brand Selected',
      adjReason: 'BRAND_SWAP',
      adjResolution: 'RECLASSIFY',
      adjAffectAcc: false,
    },
    {
      adjCode: 'BATCH_SWAP',
      adjName: 'Wrong Batch Selected',
      adjReason: 'BATCH_SWAP',
      adjResolution: 'RECLASSIFY',
      adjAffectAcc: false,
    },
    {
      adjCode: 'UNIT_ERROR',
      adjName: 'Wrong Unit Conversion',
      adjReason: 'UNIT_ERROR',
      adjResolution: 'CORRECT_SOURCE_DOC',
      adjAffectAcc: false,
    },
    {
      adjCode: 'DAMAGE',
      adjName: 'Damage / Expired Stock',
      adjReason: 'DAMAGE',
      adjResolution: 'ADJUST_LOSS_GAIN',
      adjAffectAcc: true,
    },
    {
      adjCode: 'PILFERAGE',
      adjName: 'Pilferage / Theft',
      adjReason: 'PILFERAGE',
      adjResolution: 'ADJUST_LOSS_GAIN',
      adjAffectAcc: true,
    },
    {
      adjCode: 'COUNT_ERROR',
      adjName: 'Counting Error',
      adjReason: 'COUNTING_ERROR',
      adjResolution: 'RECOUNT_REQUIRED',
      adjAffectAcc: false,
    },
    {
      adjCode: 'UNPOSTED',
      adjName: 'Unposted Sale / Purchase',
      adjReason: 'UNPOSTED_DOCUMENT',
      adjResolution: 'CORRECT_SOURCE_DOC',
      adjAffectAcc: false,
    },
  ];

  for (const reason of StockAdjList) {
    await prisma.stockAdjReason.upsert({
      where: {
        adjCode: reason.adjCode,
      },
      update: {
        adjName: reason.adjName,
        adjReason: reason.adjReason,
        adjResolution: reason.adjResolution,
        adjAffectAcc: reason.adjAffectAcc,
        adjModifiedOn: new Date(),
      },
      create: {
        adjCode: reason.adjCode,
        adjName: reason.adjName,
        adjReason: reason.adjReason,
        adjResolution: reason.adjResolution,
        adjAffectAcc: reason.adjAffectAcc,
        adjIsActive: true,
        adjIsDeleted: false,
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