import { Prisma, StockTrackPreset } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { StockTrackPresetsService } from './stock-track-presets.service';
const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const OTHER_COMPANY_ID = '01000000-0000-7000-8000-0000000000c2';
const preset = (overrides: Partial<StockTrackPreset> = {}): StockTrackPreset =>
  ({
    sptId: '01000000-0000-7000-8000-0000000000e1',
    sptCompanyId: null,
    sptCode: 'PHARMA',
    sptName: 'Pharma',
    sptDescription: null,
    sptTrackBatch: true,
    sptTrackMrp: true,
    sptTrackSalePrice: false,
    sptTrackExpiry: true,
    sptTrackSerial: false,
    sptTrackSupplier: true,
    sptTrackSignature: 'BMEP',
    sptValuationMethod: 'WAVG',
    sptIssueStrategy: 'FEFO',
    sptAllowNegative: 'ALLOW',
    sptShelfLifeDays: null,
    sptNearExpiryDays: 90,
    sptBlockExpiredSale: true,
    sptAgeingBasis: 'INWARD_DATE',
    sptSortOrder: 70,
    sptRemarks: null,
    sptIsActive: true,
    sptIsDeleted: false,
    sptSyncDate: null,
    sptCreatedOn: new Date('2026-09-05'),
    sptCreatedBy: null,
    sptModifiedOn: null,
    sptModifiedBy: null,
    ...overrides,
  }) as StockTrackPreset;
describe('StockTrackPresetsService', () => {
  let service: StockTrackPresetsService;
  let prisma: {
    stockTrackPreset: {
      findMany: jest.Mock<Promise<StockTrackPreset[]>, [Prisma.StockTrackPresetFindManyArgs]>;
      findUnique: jest.Mock<
        Promise<StockTrackPreset | null>,
        [Prisma.StockTrackPresetFindUniqueArgs]
      >;
    };
  };
  beforeEach(() => {
    prisma = {
      stockTrackPreset: {
        findMany: jest
          .fn<Promise<StockTrackPreset[]>, [Prisma.StockTrackPresetFindManyArgs]>()
          .mockResolvedValue([]),
        findUnique: jest
          .fn<Promise<StockTrackPreset | null>, [Prisma.StockTrackPresetFindUniqueArgs]>()
          .mockResolvedValue(null),
      },
    };
    service = new StockTrackPresetsService(
      prisma as unknown as PrismaService,
      { getCompanyId: () => COMPANY_ID } as unknown as RequestContextService,
    );
  });
  it('asks only for the company and shared rows, active and not deleted', async () => {
    await service.get({});
    const where = prisma.stockTrackPreset.findMany.mock.calls[0][0].where;
    expect(where?.sptIsActive).toBe(true);
    expect(where?.sptIsDeleted).toBe(false);
    expect(where?.OR).toEqual([{ sptCompanyId: COMPANY_ID }, { sptCompanyId: null }]);
  });
  it('lets a company row override the shared row of the same code', async () => {
    prisma.stockTrackPreset.findMany.mockResolvedValue([
      preset({ sptId: 'shared', sptCompanyId: null, sptNearExpiryDays: 90 }),
      preset({ sptId: 'mine', sptCompanyId: COMPANY_ID, sptNearExpiryDays: 45 }),
      preset({ sptId: 'batch', sptCode: 'BATCH', sptCompanyId: null }),
    ]);
    const { items } = await service.get({});
    expect(items).toHaveLength(2);
    const pharma = items.find((row) => row.spt_code === 'PHARMA');
    expect(pharma?.spt_id).toBe('mine');
    expect(pharma?.spt_near_expiry_days).toBe(45);
    expect(pharma?.spt_is_company_override).toBe(true);
  });
  it('keeps the shared row when the company has no override, whatever order they arrive in', async () => {
    // PostgreSQL orders by spt_sort_order, which says nothing about company —
    // the merge must not depend on the company row arriving second.
    prisma.stockTrackPreset.findMany.mockResolvedValue([
      preset({ sptId: 'mine', sptCompanyId: COMPANY_ID }),
      preset({ sptId: 'shared', sptCompanyId: null }),
    ]);
    const { items } = await service.get({});
    expect(items).toHaveLength(1);
    expect(items[0].spt_id).toBe('mine');
  });
  it('fetches one preset by id without merging, so a saved item shows what it was configured with', async () => {
    // Even a preset from another company, and even one since overridden: the
    // screen has to be able to name the row the item actually points at.
    prisma.stockTrackPreset.findUnique.mockResolvedValue(
      preset({ sptId: 'other', sptCompanyId: OTHER_COMPANY_ID }),
    );
    const { items } = await service.get({ spt_id: 'other' });
    expect(prisma.stockTrackPreset.findMany).not.toHaveBeenCalled();
    expect(items[0].spt_id).toBe('other');
    expect(items[0].spt_is_company_override).toBe(true);
  });
  it('404s on an id that names nothing', async () => {
    await expect(service.get({ spt_id: 'missing' })).rejects.toThrow(/not found/i);
  });
  it('falls back to the request context company when the query omits one', async () => {
    const { meta } = await service.get({});
    expect(meta.company_id).toBe(COMPANY_ID);
  });
  it('publishes the signature, so a screen can match a saved policy back to a preset', async () => {
    prisma.stockTrackPreset.findMany.mockResolvedValue([preset()]);
    const { items } = await service.get({});
    expect(items[0].spt_track_signature).toBe('BMEP');
  });
});
