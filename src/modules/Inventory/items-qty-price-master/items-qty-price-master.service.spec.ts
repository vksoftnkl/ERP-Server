import { HttpException } from '@nestjs/common';
import { ItemQtyPrice, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { SaveItemQtyPriceDto } from './dto/save-item-qty-price.dto';
import { ItemsQtyPriceMasterService } from './items-qty-price-master.service';
import { ItemQtyPriceErrorCode } from './types/item-qty-price-error-codes';

const IQP_ID = '019c6f6c-be87-7a11-8905-36092c46aa01';
const OTHER_IQP_ID = '019c6f6c-be87-7a11-8905-36092c46aa09';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46aa02';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46aa03';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46aa04';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46aa05';
const PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46aa06';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46aa07';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');

const slabRow = (overrides: Partial<ItemQtyPrice> = {}): ItemQtyPrice => ({
  iqpId: IQP_ID,
  iqpCompanyId: null,
  iqpBranchId: null,
  iqpPartyId: null,
  iqpPriceLevel: null,
  iqpItemId: ITEM_ID,
  iqpItemUnitId: UNIT_ID,
  iqpFromQty: new Prisma.Decimal(10),
  iqpToQty: new Prisma.Decimal(50),
  iqpPriceMode: 'P',
  iqpDiscPct: new Prisma.Decimal(5),
  iqpFlatOff: null,
  iqpPrice: null,
  iqpIsTaxIncl: false,
  iqpEffectiveFrom: new Date('2026-04-01T00:00:00.000Z'),
  iqpEffectiveTo: null,
  iqpIsActive: true,
  iqpIsDeleted: false,
  iqpSyncDate: null,
  iqpCreatedBy: USER_ID,
  iqpCreatedOn: CREATED_ON,
  iqpModifiedBy: null,
  iqpModifiedOn: CREATED_ON,
  ...overrides,
});

/** What Prisma hands back for a write: the stored row with the fields the data set. */
const written = (data: Record<string, unknown>) =>
  slabRow(
    Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ) as Partial<ItemQtyPrice>,
  );

const newSlab = (overrides: Partial<SaveItemQtyPriceDto> = {}): SaveItemQtyPriceDto => ({
  iqp_item_id: ITEM_ID,
  iqp_item_unit_id: UNIT_ID,
  iqp_effective_from: '2026-04-01',
  ...overrides,
});

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

const prismaError = (code: string) => Object.assign(new Error(`Prisma ${code}`), { code });

type PrismaMock = {
  itemQtyPrice: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

const makePrisma = (): PrismaMock => {
  const prisma: PrismaMock = {
    itemQtyPrice: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => written(data)),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => written(data)),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (callback: (tx: PrismaMock) => unknown) =>
    callback(prisma),
  );
  return prisma;
};

describe('ItemsQtyPriceMasterService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let grid: {
    loadCandidates: jest.Mock;
    filterPrimaryFromTable: jest.Mock;
    validateBaseSql: jest.Mock;
    runPagedQuery: jest.Mock;
  };
  let context: { getUserId: jest.Mock };
  let service: ItemsQtyPriceMasterService;

  beforeEach(() => {
    prisma = makePrisma();
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    grid = {
      loadCandidates: jest.fn().mockResolvedValue([]),
      filterPrimaryFromTable: jest.fn((grids: unknown[]) => grids),
      validateBaseSql: jest.fn(() => ({ isValid: true, normalizedSql: 'SELECT 1' })),
      runPagedQuery: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new ItemsQtyPriceMasterService(
      prisma as unknown as PrismaService,
      audit as never,
      grid as never,
      context as never,
    );
  });

  const createdData = () =>
    (prisma.itemQtyPrice.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  // ── save: create ──────────────────────────────────────────────────────────
  describe('save — create (no iqp_id)', () => {
    it('creates the slab as the request user, writing only the fields sent, and audits it', async () => {
      const payload = await service.save(
        newSlab({ iqp_from_qty: 10, iqp_to_qty: 50, iqp_price_mode: 'P', iqp_disc_pct: 5 }),
      );

      expect(prisma.itemQtyPrice.create).toHaveBeenCalledWith({
        data: {
          iqpItemId: ITEM_ID,
          iqpItemUnitId: UNIT_ID,
          iqpEffectiveFrom: new Date('2026-04-01'),
          iqpCreatedOn: expect.any(Date),
          iqpCreatedBy: USER_ID,
          iqpFromQty: 10,
          iqpToQty: 50,
          iqpPriceMode: 'P',
          iqpDiscPct: 5,
        },
        include: expect.objectContaining({
          item: { select: { itemNameEn: true } },
          itemUnitConversion: { select: { unit: { select: { unit_name: true } } } },
        }),
      });
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'New',
          tableName: 'item qty price',
          screenName: 'Item Qty Price Master',
          pk: IQP_ID,
          displayName: `${ITEM_ID}:${UNIT_ID}:LALL:[10-50)`,
          originalRecord: null,
          modifiedRecord: payload,
          userId: USER_ID,
          notes: 'Item qty price created',
        }),
        prisma,
      );
      expect(payload).toMatchObject({ iqp_id: IQP_ID, iqp_from_qty: 10, iqp_to_qty: 50 });
    });

    it('takes the creator named in the body over the request user', async () => {
      await service.save(newSlab({ iqp_created_by: 'importer' }));

      expect(createdData().iqpCreatedBy).toBe('importer');
    });

    it('falls back to the default actor when nobody is named and no user is logged in', async () => {
      context.getUserId.mockReturnValue(null);

      await service.save(newSlab());

      expect(createdData().iqpCreatedBy).toBe(DEFAULT_ACTOR);
    });

    it('writes the scope, an explicit null included, and parses the optional dates', async () => {
      await service.save(
        newSlab({
          iqp_company_id: COMPANY_ID,
          iqp_branch_id: BRANCH_ID,
          iqp_party_id: null,
          iqp_price_level: 2,
          iqp_price_mode: 'R',
          iqp_flat_off: 2.5,
          iqp_effective_to: '2026-06-30',
          iqp_sync_date: null,
          iqp_is_tax_incl: true,
          iqp_is_active: false,
        }),
      );

      expect(createdData()).toMatchObject({
        iqpCompanyId: COMPANY_ID,
        iqpBranchId: BRANCH_ID,
        iqpPartyId: null,
        iqpPriceLevel: 2,
        iqpPriceMode: 'R',
        iqpFlatOff: 2.5,
        iqpEffectiveTo: new Date('2026-06-30'),
        iqpSyncDate: null,
        iqpIsTaxIncl: true,
        iqpIsActive: false,
      });
    });

    it('names an open-ended slab of a price level "L<level>:[from-ABOVE)" in the audit', async () => {
      prisma.itemQtyPrice.create.mockResolvedValueOnce(
        slabRow({ iqpPriceLevel: 2, iqpFromQty: new Prisma.Decimal(100), iqpToQty: null }),
      );

      await service.save(newSlab({ iqp_from_qty: 100, iqp_to_qty: null, iqp_price_level: 2 }));

      expect(auditEntry().displayName).toBe(`${ITEM_ID}:${UNIT_ID}:L2:[100-ABOVE)`);
    });

    it('accepts a one-day window and an open-ended slab', async () => {
      await expect(
        service.save(newSlab({ iqp_effective_to: '2026-04-01', iqp_to_qty: null })),
      ).resolves.toMatchObject({ iqp_id: IQP_ID });
    });

    it.each([
      [
        'an effective-from that is not a date',
        { iqp_effective_from: 'not-a-date' },
        'iqp_effective_from',
        ItemQtyPriceErrorCode.DATE_INVALID,
      ],
      [
        'an effective-to that is not a date',
        { iqp_effective_to: 'soon' },
        'iqp_effective_to',
        ItemQtyPriceErrorCode.DATE_INVALID,
      ],
      [
        'a sync date that is not a date',
        { iqp_sync_date: 'yesterday' },
        'iqp_sync_date',
        ItemQtyPriceErrorCode.DATE_INVALID,
      ],
      [
        'an effective-to before the effective-from',
        { iqp_effective_to: '2026-03-31' },
        'iqp_effective_to',
        ItemQtyPriceErrorCode.DATE_RANGE_INVALID,
      ],
      [
        'an upper bound equal to the lower one',
        { iqp_from_qty: 10, iqp_to_qty: 10 },
        'iqp_to_qty',
        ItemQtyPriceErrorCode.QTY_RANGE_INVALID,
      ],
      [
        'an upper bound below the lower one',
        { iqp_from_qty: 10, iqp_to_qty: 5 },
        'iqp_to_qty',
        ItemQtyPriceErrorCode.QTY_RANGE_INVALID,
      ],
      [
        'an upper bound of 0 when the lower one defaults to 0',
        { iqp_to_qty: 0 },
        'iqp_to_qty',
        ItemQtyPriceErrorCode.QTY_RANGE_INVALID,
      ],
    ])('refuses %s and creates nothing', async (_label, overrides, field, code) => {
      const refusal = await refusalOf(service.save(newSlab(overrides)));

      expect(refusal).toMatchObject({ status: 400, body: { errors: [{ field, code }] } });
      expect(prisma.itemQtyPrice.create).not.toHaveBeenCalled();
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });
  });

  // ── save: batches and the caller's transaction ────────────────────────────
  describe('save — batches', () => {
    it('saves an array in one transaction and answers an array in the same order', async () => {
      prisma.itemQtyPrice.create
        .mockResolvedValueOnce(slabRow({ iqpId: IQP_ID }))
        .mockResolvedValueOnce(slabRow({ iqpId: OTHER_IQP_ID }));

      const payloads = await service.save([newSlab(), newSlab({ iqp_from_qty: 50 })]);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(payloads.map((p) => p.iqp_id)).toEqual([IQP_ID, OTHER_IQP_ID]);
    });

    it('answers a single payload, not an array, for a single slab', async () => {
      await expect(service.save(newSlab())).resolves.not.toBeInstanceOf(Array);
    });

    it("runs inside the caller's transaction instead of opening its own", async () => {
      const tx = makePrisma();

      await service.save([newSlab()], tx as unknown as Prisma.TransactionClient);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.itemQtyPrice.create).toHaveBeenCalledTimes(1);
      expect(audit.logEntityChange).toHaveBeenCalledWith(expect.anything(), tx);
    });

    it('fails the whole batch when one slab is refused', async () => {
      const refusal = await refusalOf(
        service.save([newSlab(), newSlab({ iqp_from_qty: 9, iqp_to_qty: 1 })]),
      );

      expect(refusal.status).toBe(400);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── save: update ──────────────────────────────────────────────────────────
  describe('save — update (iqp_id present)', () => {
    it('refuses an id with no live slab', async () => {
      const refusal = await refusalOf(service.save(newSlab({ iqp_id: IQP_ID })));

      expect(prisma.itemQtyPrice.findFirst).toHaveBeenCalledWith({
        where: { iqpId: IQP_ID, iqpIsDeleted: false },
        include: expect.any(Object),
      });
      expect(refusal).toMatchObject({
        status: 404,
        body: {
          message: 'Item qty price not found',
          errors: [
            {
              field: 'iqp_id',
              code: ItemQtyPriceErrorCode.NOT_FOUND,
              message: `No item qty price found with id ${IQP_ID}`,
            },
          ],
        },
      });
      expect(prisma.itemQtyPrice.update).not.toHaveBeenCalled();
    });

    it('updates the slab as the request user and audits the before and after', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValue(slabRow());

      const payload = await service.save(
        newSlab({ iqp_id: IQP_ID, iqp_price_mode: 'F', iqp_price: 99 }),
      );

      expect(prisma.itemQtyPrice.update).toHaveBeenCalledWith({
        where: { iqpId: IQP_ID },
        data: {
          iqpItemId: ITEM_ID,
          iqpItemUnitId: UNIT_ID,
          iqpEffectiveFrom: new Date('2026-04-01'),
          iqpModifiedOn: expect.any(Date),
          iqpModifiedBy: USER_ID,
          iqpPriceMode: 'F',
          iqpPrice: 99,
        },
        include: expect.any(Object),
      });
      expect(prisma.itemQtyPrice.create).not.toHaveBeenCalled();
      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: IQP_ID,
        originalRecord: expect.objectContaining({ iqp_price_mode: 'P', iqp_price: null }),
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Item qty price updated',
      });
    });

    it('takes the modifier named in the body over the request user', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValue(slabRow());

      await service.save(newSlab({ iqp_id: IQP_ID, iqp_modified_by: 'importer' }));

      expect(prisma.itemQtyPrice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ iqpModifiedBy: 'importer' }) as object,
        }),
      );
      expect(auditEntry().userId).toBe('importer');
    });

    it('checks the bounds and the window an update sends against each other', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValue(slabRow());

      const qty = await refusalOf(
        service.save(newSlab({ iqp_id: IQP_ID, iqp_from_qty: 30, iqp_to_qty: 20 })),
      );
      const dates = await refusalOf(
        service.save(newSlab({ iqp_id: IQP_ID, iqp_effective_to: '2026-01-01' })),
      );

      expect(qty).toMatchObject({
        status: 400,
        body: { errors: [{ code: ItemQtyPriceErrorCode.QTY_RANGE_INVALID }] },
      });
      expect(dates).toMatchObject({
        status: 400,
        body: { errors: [{ code: ItemQtyPriceErrorCode.DATE_RANGE_INVALID }] },
      });
      expect(prisma.itemQtyPrice.update).not.toHaveBeenCalled();
    });

    it('lets an update open the slab up by clearing its upper bound', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValue(slabRow());

      await service.save(newSlab({ iqp_id: IQP_ID, iqp_from_qty: 80, iqp_to_qty: null }));

      expect(prisma.itemQtyPrice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ iqpFromQty: 80, iqpToQty: null }) as object,
        }),
      );
    });
  });

  // ── write errors ──────────────────────────────────────────────────────────
  describe('database refusals', () => {
    it('answers a unique-index race (P2002) with a 409 on iqp_item_id', async () => {
      prisma.itemQtyPrice.create.mockRejectedValue(prismaError('P2002'));

      const refusal = await refusalOf(service.save(newSlab()));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'Item qty price already exists',
          errors: [{ field: 'iqp_item_id', code: ItemQtyPriceErrorCode.DUPLICATE }],
        },
      });
    });

    it('answers a missing reference (P2003) with a 400', async () => {
      prisma.itemQtyPrice.create.mockRejectedValue(prismaError('P2003'));

      const refusal = await refusalOf(service.save(newSlab()));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          message: 'Invalid relation reference',
          errors: [{ field: 'iqp_item_id', code: ItemQtyPriceErrorCode.REFERENCE_NOT_FOUND }],
        },
      });
    });

    it('rethrows any other database failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.itemQtyPrice.create.mockRejectedValue(failure);

      await expect(service.save(newSlab())).rejects.toBe(failure);
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('returns the live slab with every number, date and resolved name', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValue({
        ...slabRow({
          iqpCompanyId: COMPANY_ID,
          iqpBranchId: BRANCH_ID,
          iqpPartyId: PARTY_ID,
          iqpPriceLevel: 1,
          iqpFlatOff: new Prisma.Decimal('2.50'),
          iqpPrice: new Prisma.Decimal('120.75'),
          iqpEffectiveTo: new Date('2026-06-30T00:00:00.000Z'),
          iqpSyncDate: new Date('2026-10-02T00:00:00.000Z'),
        }),
        item: { itemNameEn: 'Soap 100g' },
        itemUnitConversion: { unit: { unit_name: 'Box' } },
        company: { compName: 'Zeta Traders' },
        branch: { brName: 'Main' },
        priceLevel: { iplName: 'Wholesale' },
        party: { cusName: 'Ravi Stores' },
      });

      await expect(service.getById(IQP_ID)).resolves.toEqual({
        iqp_id: IQP_ID,
        iqp_company_id: COMPANY_ID,
        iqp_branch_id: BRANCH_ID,
        iqp_party_id: PARTY_ID,
        iqp_price_level: 1,
        iqp_item_id: ITEM_ID,
        iqp_item_unit_id: UNIT_ID,
        iqp_from_qty: 10,
        iqp_to_qty: 50,
        iqp_price_mode: 'P',
        iqp_disc_pct: 5,
        iqp_flat_off: 2.5,
        iqp_price: 120.75,
        iqp_is_tax_incl: false,
        iqp_effective_from: '2026-04-01T00:00:00.000Z',
        iqp_effective_to: '2026-06-30T00:00:00.000Z',
        iqp_is_active: true,
        iqp_is_deleted: false,
        iqp_sync_date: '2026-10-02T00:00:00.000Z',
        iqp_created_on: CREATED_ON.toISOString(),
        iqp_created_by: USER_ID,
        iqp_modified_on: CREATED_ON.toISOString(),
        iqp_modified_by: null,
        iqp_item_name: 'Soap 100g',
        iqp_unit_name: 'Box',
        iqp_company_name: 'Zeta Traders',
        iqp_branch_name: 'Main',
        iqp_price_level_name: 'Wholesale',
        iqp_party_name: 'Ravi Stores',
      });
      expect(prisma.itemQtyPrice.findFirst).toHaveBeenCalledWith({
        where: { iqpId: IQP_ID, iqpIsDeleted: false },
        include: {
          item: { select: { itemNameEn: true } },
          itemUnitConversion: { select: { unit: { select: { unit_name: true } } } },
          company: { select: { compName: true } },
          branch: { select: { brName: true } },
          priceLevel: { select: { iplName: true } },
          party: { select: { cusName: true } },
        },
      });
    });

    it('answers null names for relations the slab does not have', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValue({
        ...slabRow(),
        item: null,
        itemUnitConversion: { unit: null },
        company: null,
      });

      await expect(service.getById(IQP_ID)).resolves.toMatchObject({
        iqp_item_name: null,
        iqp_unit_name: null,
        iqp_company_name: null,
        iqp_branch_name: null,
        iqp_price_level_name: null,
        iqp_party_name: null,
      });
    });

    it('refuses an id with no live slab', async () => {
      const refusal = await refusalOf(service.getById(IQP_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: ItemQtyPriceErrorCode.NOT_FOUND }] },
      });
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────
  describe('list', () => {
    it('serves the configured grid when one exists, and reads no rows itself', async () => {
      grid.loadCandidates.mockResolvedValue([{ gridId: 3n, gridSql: 'SELECT * FROM iqp' }]);
      grid.runPagedQuery.mockResolvedValue({ items: [{ iqp_id: IQP_ID }], total: 1 });

      await expect(service.list({ search: 'soap' })).resolves.toEqual({
        items: [{ iqp_id: IQP_ID }],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      });
      expect(grid.loadCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'item qty price' }),
      );
      expect(grid.runPagedQuery).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'item_qty_price_grid', search: 'soap', skip: 0 }),
      );
      expect(prisma.itemQtyPrice.findMany).not.toHaveBeenCalled();
    });

    it('falls back to the live slabs, laddered by item, unit and lower bound', async () => {
      prisma.itemQtyPrice.count.mockResolvedValue(1);
      prisma.itemQtyPrice.findMany.mockResolvedValue([slabRow()]);

      const result = await service.list({});

      expect(prisma.itemQtyPrice.count).toHaveBeenCalledWith({ where: { iqpIsDeleted: false } });
      expect(prisma.itemQtyPrice.findMany).toHaveBeenCalledWith({
        where: { iqpIsDeleted: false },
        include: expect.any(Object),
        orderBy: [
          { iqpItemId: 'asc' },
          { iqpItemUnitId: 'asc' },
          { iqpFromQty: 'asc' },
          { iqpId: 'asc' },
        ],
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        items: [expect.objectContaining({ iqp_id: IQP_ID, iqp_item_name: null })],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      });
    });

    it('filters the fallback by every filter sent, false and 0 included, on the page asked for', async () => {
      await service.list({
        iqp_item_id: ITEM_ID,
        iqp_item_unit_id: UNIT_ID,
        iqp_company_id: COMPANY_ID,
        iqp_branch_id: BRANCH_ID,
        iqp_party_id: PARTY_ID,
        iqp_price_level: 0,
        iqp_is_active: false,
        page: 3,
        limit: 10,
      });

      expect(prisma.itemQtyPrice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            iqpIsDeleted: false,
            iqpItemId: ITEM_ID,
            iqpItemUnitId: UNIT_ID,
            iqpCompanyId: COMPANY_ID,
            iqpBranchId: BRANCH_ID,
            iqpPartyId: PARTY_ID,
            iqpPriceLevel: 0,
            iqpIsActive: false,
          },
          skip: 20,
          take: 10,
        }),
      );
    });
  });

  // ── softDelete / restore ──────────────────────────────────────────────────
  describe('softDelete', () => {
    it('deletes a live slab with a guarded write and audits it as a cancel', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValue(slabRow());

      await expect(service.softDelete(IQP_ID)).resolves.toEqual({
        iqp_id: IQP_ID,
        deleted: true,
      });

      // Found whatever its state, so restore can share the read.
      expect(prisma.itemQtyPrice.findFirst).toHaveBeenCalledWith({
        where: { iqpId: IQP_ID },
        include: expect.any(Object),
      });
      expect(prisma.itemQtyPrice.updateMany).toHaveBeenCalledWith({
        where: { iqpId: IQP_ID, iqpIsDeleted: false },
        data: { iqpIsDeleted: true, iqpModifiedOn: expect.any(Date), iqpModifiedBy: USER_ID },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        pk: IQP_ID,
        displayName: `${ITEM_ID}:${UNIT_ID}:LALL:[10-50)`,
        originalRecord: expect.objectContaining({ iqp_is_deleted: false }),
        modifiedRecord: expect.objectContaining({ iqp_is_deleted: true, iqp_modified_by: USER_ID }),
        userId: USER_ID,
        notes: 'Item qty price soft deleted',
      });
    });

    it('refuses a slab that is already deleted with a 409 that points at restore', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValue(slabRow({ iqpIsDeleted: true }));

      const refusal = await refusalOf(service.softDelete(IQP_ID));

      expect(refusal).toEqual({
        status: 409,
        body: {
          success: false,
          message: 'This qty price slab is already deleted',
          errors: [
            {
              field: 'iqp_id',
              code: ItemQtyPriceErrorCode.ALREADY_DELETED,
              message: 'Nothing to delete. To bring it back use POST /item-qty-prices/restore.',
            },
          ],
        },
      });
      expect(prisma.itemQtyPrice.updateMany).not.toHaveBeenCalled();
    });

    it('refuses an id with no slab', async () => {
      const refusal = await refusalOf(service.softDelete(IQP_ID));

      expect(refusal.status).toBe(404);
    });

    it('refuses when the slab changed between the read and the write', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValue(slabRow());
      prisma.itemQtyPrice.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(IQP_ID));

      expect(refusal.status).toBe(404);
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('stamps the default actor when nobody is logged in', async () => {
      context.getUserId.mockReturnValue(null);
      prisma.itemQtyPrice.findFirst.mockResolvedValue(slabRow());

      await service.softDelete(IQP_ID);

      expect(prisma.itemQtyPrice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ iqpModifiedBy: DEFAULT_ACTOR }) as object,
        }),
      );
      expect(auditEntry().userId).toBe(DEFAULT_ACTOR);
    });

    it('deletes a batch in one transaction and answers an array', async () => {
      prisma.itemQtyPrice.findFirst
        .mockResolvedValueOnce(slabRow({ iqpId: IQP_ID }))
        .mockResolvedValueOnce(slabRow({ iqpId: OTHER_IQP_ID }));

      await expect(service.softDelete([IQP_ID, OTHER_IQP_ID])).resolves.toEqual([
        { iqp_id: IQP_ID, deleted: true },
        { iqp_id: OTHER_IQP_ID, deleted: true },
      ]);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('fails the whole batch at the first slab it cannot delete', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValueOnce(slabRow()).mockResolvedValueOnce(null);

      const refusal = await refusalOf(service.softDelete([IQP_ID, OTHER_IQP_ID]));

      expect(refusal.status).toBe(404);
    });
  });

  describe('restore', () => {
    it('brings a deleted slab back with a guarded write and audits it as an update', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValue(slabRow({ iqpIsDeleted: true }));

      await expect(service.restore(IQP_ID)).resolves.toEqual({ iqp_id: IQP_ID, deleted: false });

      expect(prisma.itemQtyPrice.updateMany).toHaveBeenCalledWith({
        where: { iqpId: IQP_ID, iqpIsDeleted: true },
        data: { iqpIsDeleted: false, iqpModifiedOn: expect.any(Date), iqpModifiedBy: USER_ID },
      });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        notes: 'Item qty price restored',
        modifiedRecord: expect.objectContaining({ iqp_is_deleted: false }),
      });
    });

    it('refuses a slab that is not deleted with a 409', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValue(slabRow());

      const refusal = await refusalOf(service.restore(IQP_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'This qty price slab is not deleted',
          errors: [{ code: ItemQtyPriceErrorCode.NOT_DELETED, message: 'Nothing to restore.' }],
        },
      });
    });

    it('answers a live slab already holding the same key (P2002) with a 409', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValue(slabRow({ iqpIsDeleted: true }));
      prisma.itemQtyPrice.updateMany.mockRejectedValue(prismaError('P2002'));

      const refusal = await refusalOf(service.restore(IQP_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: ItemQtyPriceErrorCode.DUPLICATE }] },
      });
    });

    it('restores a batch and answers an array', async () => {
      prisma.itemQtyPrice.findFirst.mockResolvedValue(slabRow({ iqpIsDeleted: true }));

      await expect(service.restore([IQP_ID])).resolves.toEqual([
        { iqp_id: IQP_ID, deleted: false },
      ]);
    });
  });
});
