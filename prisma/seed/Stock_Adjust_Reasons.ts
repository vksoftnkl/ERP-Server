import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const UNIT_UQC_LIST = [
  { uqc: 'BAG', unit: 'Bags' },
  { uqc: 'BAL', unit: 'Bale' },
  { uqc: 'BDL', unit: 'Bundles' },
  { uqc: 'BKL', unit: 'Buckles' },
  { uqc: 'BOU', unit: 'Billions of Units' },
  { uqc: 'BOX', unit: 'Box' },
  { uqc: 'BTL', unit: 'Bottles' },
  { uqc: 'BUN', unit: 'Bunches' },
  { uqc: 'CAN', unit: 'Cans' },
  { uqc: 'CBM', unit: 'Cubic Meter' },
  { uqc: 'CCM', unit: 'Cubic Centimeter' },
  { uqc: 'CMS', unit: 'Centimeter' },
  { uqc: 'CTN', unit: 'Cartons' },
  { uqc: 'DOZ', unit: 'Dozen' },
  { uqc: 'DRM', unit: 'Drums' },
  { uqc: 'GGR', unit: 'Great Gross' },
  { uqc: 'GMS', unit: 'Grams' },
  { uqc: 'GRS', unit: 'Gross' },
  { uqc: 'GYD', unit: 'Gross Yards' },
  { uqc: 'KGS', unit: 'Kilograms' },
  { uqc: 'KLR', unit: 'Kiloliter' },
  { uqc: 'KME', unit: 'Kilometre' },
  { uqc: 'MLT', unit: 'Millilitre' },
  { uqc: 'MTR', unit: 'Meters' },
  { uqc: 'MTS', unit: 'Metric Tons' },
  { uqc: 'NOS', unit: 'Numbers' },
  { uqc: 'PAC', unit: 'Packs' },
  { uqc: 'PCS', unit: 'Pieces' },
  { uqc: 'PRS', unit: 'Pairs' },
  { uqc: 'QTL', unit: 'Quintal' },
  { uqc: 'ROL', unit: 'Rolls' },
  { uqc: 'SET', unit: 'Sets' },
  { uqc: 'SQF', unit: 'Square Feet' },
  { uqc: 'SQM', unit: 'Square Meters' },
  { uqc: 'SQY', unit: 'Square Yards' },
  { uqc: 'TBS', unit: 'Tablets' },
  { uqc: 'TGM', unit: 'Ten Gross' },
  { uqc: 'THD', unit: 'Thousands' },
  { uqc: 'TON', unit: 'Tonnes' },
  { uqc: 'TUB', unit: 'Tubes' },
  { uqc: 'UGS', unit: 'US Gallons' },
  { uqc: 'UNT', unit: 'Units' },
  { uqc: 'YDS', unit: 'Yards' },
  { uqc: 'OTH', unit: 'Others' },
] as const;

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

  for (const unit of UNIT_UQC_LIST) {
    const existingUnit = await prisma.itemGstUnits.findFirst({
      where: {
        itemGstUnitCode: unit.uqc,
      },
      select: {
        itemGstUnitId: true,
      },
    });

    if (existingUnit) {
      await prisma.itemGstUnits.update({
        where: {
          itemGstUnitId: existingUnit.itemGstUnitId,
        },
        data: {
          itemGstUnitName: unit.unit,
          itemGstUnitModifiedOn: new Date(),
        },
      });
      continue;
    }

    await prisma.itemGstUnits.create({
      data: {
        itemGstUnitCode: unit.uqc,
        itemGstUnitName: unit.unit,
      },
    });
  }
  console.log('GST unit UQC data seeded successfully');
}
main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
