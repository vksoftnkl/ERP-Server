import { Prisma, StockTrackPreset } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  lockedFieldErrors,
  presetRuleErrors,
  StockTrackPresetsService,
  type PresetValues,
} from './stock-track-presets.service';
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
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };
  let usage: Record<string, Partial<{ items: number; groups: number; active_items: number; active_groups: number }>>;
  beforeEach(() => {
    prisma = {
      stockTrackPreset: {
        findMany: jest
          .fn<Promise<StockTrackPreset[]>, [Prisma.StockTrackPresetFindManyArgs]>()
          .mockResolvedValue([]),
        findUnique: jest
          .fn<Promise<StockTrackPreset | null>, [Prisma.StockTrackPresetFindUniqueArgs]>()
          .mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }: { data: Partial<StockTrackPreset> }) =>
          Promise.resolve(preset({ ...data, sptId: 'created' })),
        ),
        update: jest.fn(({ where, data }: { where: { sptId: string }; data: Partial<StockTrackPreset> }) =>
          Promise.resolve(preset({ sptCompanyId: COMPANY_ID, ...data, sptId: where.sptId })),
        ),
      },
      // usageOf: one row per id asked for, counts from `usage` (0 when unset).
      $queryRaw: jest.fn((_strings: TemplateStringsArray, ids: string[]) =>
        Promise.resolve(
          ids.map((id) => ({ spt_id: id, items: 0, groups: 0, active_items: 0, active_groups: 0, ...usage[id] })),
        ),
      ),
    };
    usage = {};
    service = new StockTrackPresetsService(
      prisma as unknown as PrismaService,
      {
        getCompanyId: () => COMPANY_ID,
        getUserId: () => '01000000-0000-7000-8000-0000000000a1',
      } as unknown as RequestContextService,
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
  it('narrows to one code, among the company the query names', async () => {
    prisma.stockTrackPreset.findMany.mockResolvedValue([
      preset({ sptId: 'theirs', sptCompanyId: OTHER_COMPANY_ID }),
    ]);
    const { items, meta } = await service.get({ company_id: OTHER_COMPANY_ID, spt_code: 'PHARMA' });
    const where = prisma.stockTrackPreset.findMany.mock.calls[0][0].where;
    expect(where?.sptCode).toBe('PHARMA');
    expect(where?.OR).toEqual([{ sptCompanyId: OTHER_COMPANY_ID }, { sptCompanyId: null }]);
    expect(prisma.stockTrackPreset.findMany.mock.calls[0][0].orderBy).toEqual([
      { sptSortOrder: 'asc' },
      { sptCode: 'asc' },
    ]);
    expect(meta).toEqual({ company_id: OTHER_COMPANY_ID, spt_code: 'PHARMA', count: 1 });
    expect(items[0].spt_id).toBe('theirs');
  });
  it('marks a shared preset fetched by id as no company override, and counts it', async () => {
    prisma.stockTrackPreset.findUnique.mockResolvedValue(preset({ sptId: 'shared' }));
    const { items, meta } = await service.get({ spt_id: 'shared' });
    expect(prisma.stockTrackPreset.findUnique).toHaveBeenCalledWith({ where: { sptId: 'shared' } });
    expect(items[0].spt_is_company_override).toBe(false);
    expect(meta).toEqual({ company_id: COMPANY_ID, spt_id: 'shared', count: 1 });
  });
  it('maps every column of the preset onto the payload', async () => {
    prisma.stockTrackPreset.findMany.mockResolvedValue([
      preset({ sptDescription: 'For pharmacies' }),
    ]);
    const { items } = await service.get({});
    expect(items[0]).toEqual({
      spt_id: '01000000-0000-7000-8000-0000000000e1',
      spt_company_id: null,
      spt_code: 'PHARMA',
      spt_name: 'Pharma',
      spt_description: 'For pharmacies',
      spt_track_batch: true,
      spt_track_mrp: true,
      spt_track_sale_price: false,
      spt_track_expiry: true,
      spt_track_serial: false,
      spt_track_supplier: true,
      spt_track_signature: 'BMEP',
      spt_valuation_method: 'WAVG',
      spt_issue_strategy: 'FEFO',
      spt_allow_negative: 'ALLOW',
      spt_shelf_life_days: null,
      spt_near_expiry_days: 90,
      spt_block_expired_sale: true,
      spt_ageing_basis: 'INWARD_DATE',
      spt_sort_order: 70,
      spt_remarks: null,
      spt_is_company_override: false,
      spt_is_active: true,
      usedByItems: 0,
      usedByGroups: 0,
    });
  });
  it('404s with the preset code and the spt_id field', async () => {
    const error = await service.get({ spt_id: 'missing' }).catch((caught: unknown) => caught);
    expect((error as { getStatus: () => number }).getStatus()).toBe(404);
    expect((error as { getResponse: () => unknown }).getResponse()).toMatchObject({
      errors: [{ field: 'spt_id', code: 'STOCK_PRESET_NOT_FOUND' }],
    });
  });
  it('publishes the signature, so a screen can match a saved policy back to a preset', async () => {
    prisma.stockTrackPreset.findMany.mockResolvedValue([preset()]);
    const { items } = await service.get({});
    expect(items[0].spt_track_signature).toBe('BMEP');
  });

  it('adds usedByItems / usedByGroups from one count over every listed preset', async () => {
    prisma.stockTrackPreset.findMany.mockResolvedValue([
      preset({ sptId: 'p1' }),
      preset({ sptId: 'p2', sptCode: 'BATCH' }),
    ]);
    usage = { p1: { items: 3, groups: 1, active_items: 2, active_groups: 1 } };
    const { items } = await service.get({});
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw.mock.calls[0][1]).toEqual(['p1', 'p2']);
    expect(items.map((i) => [i.spt_id, i.usedByItems, i.usedByGroups])).toEqual([
      ['p1', 3, 1],
      ['p2', 0, 0],
    ]);
  });

  describe('save (notes 159 §4)', () => {
    const OWN_ID = '01000000-0000-7000-8000-0000000000e9';
    const own = (overrides: Partial<StockTrackPreset> = {}) =>
      preset({
        sptId: OWN_ID,
        sptCompanyId: COMPANY_ID,
        sptCode: 'DAIRY',
        sptName: 'Dairy',
        sptTrackBatch: true,
        sptTrackMrp: false,
        sptTrackExpiry: true,
        sptTrackSupplier: false,
        sptValuationMethod: 'LOT_ACTUAL',
        ...overrides,
      });
    const refusal = async (promise: Promise<unknown>) => {
      const error = (await promise.catch((caught: unknown) => caught)) as {
        getStatus: () => number;
        getResponse: () => { errors: Array<{ field: string; code: string; message: string }> };
      };
      return { status: error.getStatus(), errors: error.getResponse().errors };
    };

    it('creates the company row, deriving the valuation from the flags', async () => {
      const saved = await service.save({ companyId: COMPANY_ID, code: 'DAIRY', name: 'Dairy', trackBatch: true, trackExpiry: true });
      const { data } = prisma.stockTrackPreset.create.mock.calls[0][0];
      expect(data).toMatchObject({
        sptCompanyId: COMPANY_ID,
        sptCode: 'DAIRY',
        sptTrackBatch: true,
        sptTrackExpiry: true,
        sptTrackMrp: false,
        sptValuationMethod: 'LOT_ACTUAL',
        sptIssueStrategy: 'FEFO',
        sptAllowNegative: 'ALLOW',
        sptNearExpiryDays: 30,
        sptAgeingBasis: 'INWARD_DATE',
        sptCreatedBy: '01000000-0000-7000-8000-0000000000a1',
      });
      expect(data).not.toHaveProperty('sptTrackSignature');
      expect(saved).toMatchObject({ spt_id: 'created', usedByItems: 0, usedByGroups: 0 });
    });

    it('defaults the issue strategy to FIFO when batches are tracked without expiry', async () => {
      await service.save({ companyId: COMPANY_ID, code: 'LOTS', name: 'Lots', trackBatch: true });
      expect(prisma.stockTrackPreset.create.mock.calls[0][0].data.sptIssueStrategy).toBe('FIFO');
    });

    it('wants a code and a name on a create (422 per field)', async () => {
      const { status, errors } = await refusal(service.save({ companyId: COMPANY_ID }));
      expect(status).toBe(422);
      expect(errors.map((e) => [e.field, e.code])).toEqual([
        ['code', 'STOCK_PRESET_FIELD_REQUIRED'],
        ['name', 'STOCK_PRESET_FIELD_REQUIRED'],
      ]);
      expect(prisma.stockTrackPreset.create).not.toHaveBeenCalled();
    });

    it('refuses a shared preset 409, pointing at the company copy', async () => {
      prisma.stockTrackPreset.findUnique.mockResolvedValue(preset({ sptId: 'shared' }));
      const { status, errors } = await refusal(service.save({ companyId: COMPANY_ID, sptId: 'shared', name: 'Mine' }));
      expect(status).toBe(409);
      expect(errors[0]).toMatchObject({ field: 'sptId', code: 'STOCK_PRESET_SHARED_READ_ONLY' });
      expect(errors[0].message).toMatch(/same code/);
      expect(prisma.stockTrackPreset.update).not.toHaveBeenCalled();
    });

    it("404s another company's preset and a deleted one", async () => {
      prisma.stockTrackPreset.findUnique.mockResolvedValueOnce(own({ sptCompanyId: OTHER_COMPANY_ID }));
      expect((await refusal(service.save({ companyId: COMPANY_ID, sptId: OWN_ID }))).status).toBe(404);
      prisma.stockTrackPreset.findUnique.mockResolvedValueOnce(own({ sptIsDeleted: true }));
      expect((await refusal(service.save({ companyId: COMPANY_ID, sptId: OWN_ID }))).status).toBe(404);
    });

    it('updates only what is sent; a field left out keeps its stored value', async () => {
      prisma.stockTrackPreset.findUnique.mockResolvedValue(own({ sptRemarks: 'kept', sptShelfLifeDays: 7 }));
      await service.save({ companyId: COMPANY_ID, sptId: OWN_ID, name: 'Dairy (chilled)', shelfLifeDays: null });
      const { where, data } = prisma.stockTrackPreset.update.mock.calls[0][0];
      expect(where).toEqual({ sptId: OWN_ID });
      expect(data).toMatchObject({
        sptName: 'Dairy (chilled)',
        sptCode: 'DAIRY',
        sptRemarks: 'kept',
        sptShelfLifeDays: null,
        sptTrackBatch: true,
        sptValuationMethod: 'LOT_ACTUAL',
        sptModifiedBy: '01000000-0000-7000-8000-0000000000a1',
      });
    });

    it('locks the flags, valuation and code once used — 409, one detail per field', async () => {
      prisma.stockTrackPreset.findUnique.mockResolvedValue(own());
      usage = { [OWN_ID]: { items: 2, groups: 1, active_items: 0, active_groups: 0 } };
      const { status, errors } = await refusal(
        service.save({ companyId: COMPANY_ID, sptId: OWN_ID, code: 'DAIRY2', trackExpiry: false, trackMrp: true }),
      );
      expect(status).toBe(409);
      expect(errors.map((e) => [e.field, e.code])).toEqual([
        ['code', 'STOCK_PRESET_IN_USE'],
        ['trackMrp', 'STOCK_PRESET_IN_USE'],
        ['trackExpiry', 'STOCK_PRESET_IN_USE'],
      ]);
      expect(errors[1].message).toMatch(/2 items and 1 item group/);
      expect(prisma.stockTrackPreset.update).not.toHaveBeenCalled();
    });

    it('still edits the policy fields of a used preset', async () => {
      prisma.stockTrackPreset.findUnique.mockResolvedValue(own());
      usage = { [OWN_ID]: { items: 2, groups: 0, active_items: 2, active_groups: 0 } };
      const saved = await service.save({
        companyId: COMPANY_ID,
        sptId: OWN_ID,
        trackBatch: true,
        issueStrategy: 'MANUAL',
        nearExpiryDays: 5,
        blockExpiredSale: true,
        ageingBasis: 'MFG_DATE',
      });
      expect(prisma.stockTrackPreset.update).toHaveBeenCalled();
      expect(saved.usedByItems).toBe(2);
    });

    it('words the three CHECKs as 422s instead of letting the database refuse', async () => {
      const { status, errors } = await refusal(
        service.save({
          companyId: COMPANY_ID,
          code: 'BAD',
          name: 'Bad',
          trackExpiry: true,
          valuationMethod: 'WAVG',
        }),
      );
      expect(status).toBe(422);
      expect(errors.map((e) => [e.field, e.code])).toEqual([
        ['trackExpiry', 'STOCK_PRESET_EXPIRY_NEEDS_BATCH'],
        ['valuationMethod', 'STOCK_PRESET_VALUATION_MISMATCH'],
      ]);
      expect(prisma.stockTrackPreset.create).not.toHaveBeenCalled();
    });

    it('409s a code the company already has', async () => {
      prisma.stockTrackPreset.findFirst.mockResolvedValue({ sptId: 'taken' });
      const { status, errors } = await refusal(service.save({ companyId: COMPANY_ID, code: 'DAIRY', name: 'Dairy' }));
      expect(status).toBe(409);
      expect(errors[0]).toMatchObject({ field: 'code', code: 'STOCK_PRESET_CODE_TAKEN' });
      expect(prisma.stockTrackPreset.findFirst.mock.calls[0][0].where).toMatchObject({
        sptCompanyId: COMPANY_ID,
        sptCode: 'DAIRY',
        sptIsDeleted: false,
      });
    });

    it('turns a unique violation from a racing save into the same 409', async () => {
      prisma.stockTrackPreset.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
      );
      const { status, errors } = await refusal(service.save({ companyId: COMPANY_ID, code: 'DAIRY', name: 'Dairy' }));
      expect(status).toBe(409);
      expect(errors[0].code).toBe('STOCK_PRESET_CODE_TAKEN');
    });

    describe('deactivate', () => {
      it('refuses while an active item or group uses it', async () => {
        prisma.stockTrackPreset.findUnique.mockResolvedValue(own());
        usage = { [OWN_ID]: { items: 3, groups: 0, active_items: 1, active_groups: 0 } };
        const { status, errors } = await refusal(service.deactivate({ companyId: COMPANY_ID, sptId: OWN_ID }));
        expect(status).toBe(409);
        expect(errors[0]).toMatchObject({ field: 'sptId', code: 'STOCK_PRESET_IN_USE' });
        expect(errors[0].message).toMatch(/used by 1 active item;/);
      });

      it('deactivates when only inactive items use it, and reactivates', async () => {
        prisma.stockTrackPreset.findUnique.mockResolvedValue(own());
        usage = { [OWN_ID]: { items: 3, groups: 0, active_items: 0, active_groups: 0 } };
        const off = await service.deactivate({ companyId: COMPANY_ID, sptId: OWN_ID });
        expect(prisma.stockTrackPreset.update.mock.calls[0][0].data.sptIsActive).toBe(false);
        expect(off.spt_is_active).toBe(false);
        const on = await service.deactivate({ companyId: COMPANY_ID, sptId: OWN_ID, reactivate: true });
        expect(on.spt_is_active).toBe(true);
      });

      it('refuses a shared preset', async () => {
        prisma.stockTrackPreset.findUnique.mockResolvedValue(preset());
        const { status, errors } = await refusal(service.deactivate({ companyId: COMPANY_ID, sptId: 'x' }));
        expect(status).toBe(409);
        expect(errors[0].message).toMatch(/cannot be deactivated here/);
      });
    });
  });

  describe('presetRuleErrors / lockedFieldErrors', () => {
    const values = (overrides: Partial<PresetValues> = {}): PresetValues => ({
      code: 'X',
      name: 'X',
      description: null,
      trackBatch: false,
      trackMrp: false,
      trackSalePrice: false,
      trackExpiry: false,
      trackSerial: false,
      trackSupplier: false,
      valuationMethod: 'WAVG',
      issueStrategy: 'FEFO',
      allowNegative: 'ALLOW',
      shelfLifeDays: null,
      nearExpiryDays: 30,
      blockExpiredSale: false,
      ageingBasis: 'INWARD_DATE',
      sortOrder: 0,
      remarks: null,
      ...overrides,
    });

    it('lets FEFO stand on an untracked preset, as ck_spt_fefo_needs_expiry does', () => {
      expect(presetRuleErrors(values())).toEqual([]);
    });

    it('refuses FEFO on batches without expiry', () => {
      expect(
        presetRuleErrors(values({ trackBatch: true, valuationMethod: 'LOT_ACTUAL' })).map((e) => e.code),
      ).toEqual(['STOCK_PRESET_FEFO_NEEDS_EXPIRY']);
    });

    it('wants LOT_ACTUAL for any one tracked flag, WAVG for none', () => {
      expect(presetRuleErrors(values({ trackSerial: true })).map((e) => e.field)).toEqual(['valuationMethod']);
      expect(presetRuleErrors(values({ valuationMethod: 'FIFO' })).map((e) => e.field)).toEqual(['valuationMethod']);
    });

    it('locks nothing on an unused preset', () => {
      const existing = preset({ sptCode: 'X', sptCompanyId: COMPANY_ID });
      expect(lockedFieldErrors(existing, values({ trackSerial: true }), { items: 0, groups: 0, activeItems: 0, activeGroups: 0 })).toEqual([]);
    });

    it('counts a group-only use as a use', () => {
      const existing = preset({ sptCode: 'X', sptValuationMethod: 'LOT_ACTUAL' });
      // preset()'s flags (B, M, E, P) plus serial: only trackSerial changes.
      const next = values({
        trackBatch: true,
        trackMrp: true,
        trackExpiry: true,
        trackSupplier: true,
        trackSerial: true,
        valuationMethod: 'LOT_ACTUAL',
      });
      const errors = lockedFieldErrors(existing, next, { items: 0, groups: 1, activeItems: 0, activeGroups: 0 });
      expect(errors.map((e) => e.field)).toEqual(['trackSerial']);
      expect(errors[0].message).toMatch(/1 item group;/);
    });
  });
});
