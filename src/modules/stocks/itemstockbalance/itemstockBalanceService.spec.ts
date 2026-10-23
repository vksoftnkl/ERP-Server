import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { StockErrorCode } from '../types/stock-error-codes';
import { GetBulkItemStockListQueryDto } from './dto/get-bulk-item-stock-list-query.dto';
import { GetItemBatchStockOptionsQueryDto } from './dto/get-item-batch-stock-options-query.dto';
import { GetItemStockBalanceQueryDto } from './dto/get-item-stock-balance-query.dto';
import { ItemStockBalanceService } from './itemstockBalanceService';

// The database's today (notes 140), read apart from $queryRaw so the stock
// query's mocked rows never answer for it.
jest.mock('src/modules/Inventory/items-price-master/price-period.helper', () => ({
  ...jest.requireActual<object>('src/modules/Inventory/items-price-master/price-period.helper'),
  databaseToday: jest.fn().mockResolvedValue('2026-06-15'),
}));
const TODAY_COLUMN = new Date('2026-06-15T00:00:00.000Z');

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b101';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b102';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46b103';
const OTHER_GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46b104';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46b105';
const OTHER_ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46b106';
/** The unit the caller asks in — a BOX of 12. */
const BOX_UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46b107';
const BOX_IUC_ID = '019c6f6c-be87-7a11-8905-36092c46b108';
const BOX_IPM_ID = '019c6f6c-be87-7a11-8905-36092c46b109';
/** The item's base unit, PCS. */
const PCS_UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46b110';
const PCS_IUC_ID = '019c6f6c-be87-7a11-8905-36092c46b111';
const LOT_A = '019c6f6c-be87-7a11-8905-36092c46b112';
const LOT_B = '019c6f6c-be87-7a11-8905-36092c46b113';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46b114';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');

const D = (value: number | string) => new Prisma.Decimal(value);

const holding = (overrides: Record<string, unknown> = {}) => ({
  sbl_id: 'sbl-a',
  sbl_company_id: COMPANY_ID,
  sbl_branch_id: BRANCH_ID,
  sbl_godown_id: GODOWN_ID,
  sbl_item_id: ITEM_ID,
  sbl_lot_id: LOT_A,
  sbl_base_uom_id: PCS_IUC_ID,
  base_unit_id: PCS_UNIT_ID,
  sbl_bucket: 'SALEABLE',
  sbl_in_qty: D(48),
  sbl_out_qty: D(12),
  sbl_free_in_qty: D(6),
  sbl_free_out_qty: D(0),
  sbl_on_hand_qty: D(36),
  sbl_reserved_qty: D(0),
  sbl_transit_in_qty: D(0),
  sbl_available_qty: D(36),
  sbl_avg_cost_rate: D(10),
  sbl_avg_cost_rate_wot: D('8.5'),
  sbl_stock_value: D(360),
  sbl_stock_value_wot: D(306),
  sbl_last_in_date: new Date('2026-10-02T00:00:00.000Z'),
  sbl_last_out_date: null,
  sbl_sync_date: null,
  sbl_created_on: CREATED_ON,
  sbl_created_by: 'admin',
  sbl_modified_on: null,
  sbl_modified_by: null,
  slt_batch_no: null,
  slt_mfg_date: null,
  slt_expiry_date: null,
  slt_mrp: null,
  slt_serial_no: null,
  slt_track_signature: 'N',
  slt_first_inward_date: null,
  opening_qty: D(24),
  opening_free_qty: D(0),
  opening_value: D(240),
  opening_value_wot: D(204),
  ...overrides,
});

const boxPriceRow = (overrides: Record<string, unknown> = {}) => ({
  ipmId: BOX_IPM_ID,
  ipmUcUnitId: BOX_IUC_ID,
  itemUnitConversion: { iucUnitId: BOX_UNIT_ID, iucUnitFactor: D(12) },
  ...overrides,
});

const balanceQuery = (overrides: Record<string, unknown> = {}) =>
  plainToInstance(GetItemStockBalanceQueryDto, {
    isb_acc_year: '2026-2027',
    isb_company_id: COMPANY_ID,
    isb_branch_id: BRANCH_ID,
    isb_godown_id: GODOWN_ID,
    isb_item_id: ITEM_ID,
    isb_unit_id: BOX_UNIT_ID,
    ...overrides,
  });

const optionsQuery = (overrides: Record<string, unknown> = {}) =>
  plainToInstance(GetItemBatchStockOptionsQueryDto, {
    ibs_acc_year: '2026-2027',
    ibs_company_id: COMPANY_ID,
    ibs_branch_id: BRANCH_ID,
    ibs_godown_id: GODOWN_ID,
    ibs_item_id: ITEM_ID,
    ibs_unit_id: BOX_UNIT_ID,
    ...overrides,
  });

const bulkQuery = (overrides: Record<string, unknown> = {}) =>
  plainToInstance(GetBulkItemStockListQueryDto, {
    isb_acc_year: '2026-2027',
    isb_company_id: COMPANY_ID,
    isb_branch_id: BRANCH_ID,
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

type PrismaMock = {
  $queryRaw: jest.Mock;
  itemPriceMaster: { findMany: jest.Mock };
  itemMaster: { findMany: jest.Mock };
  unit: { findMany: jest.Mock };
  godownLocation: { findMany: jest.Mock };
};

describe('ItemStockBalanceService', () => {
  let prisma: PrismaMock;
  let service: ItemStockBalanceService;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([holding()]),
      itemPriceMaster: { findMany: jest.fn().mockResolvedValue([boxPriceRow()]) },
      itemMaster: { findMany: jest.fn().mockResolvedValue([]) },
      unit: { findMany: jest.fn().mockResolvedValue([]) },
      godownLocation: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new ItemStockBalanceService(prisma as unknown as PrismaService);
  });

  /** A raw query as Postgres would receive it: its text and flattened parameters. */
  const rawQuery = (index = 0) => {
    const [strings, ...values] = prisma.$queryRaw.mock.calls[index] as [
      TemplateStringsArray,
      ...Prisma.Sql[],
    ];
    return Prisma.sql(strings, ...values);
  };

  // ── GET /get ──────────────────────────────────────────────────────────────
  describe('getByScope', () => {
    it('sums the lots of each bucket into one row, in bucket order', async () => {
      prisma.$queryRaw.mockResolvedValue([
        holding({ sbl_id: 'sbl-c', sbl_bucket: 'SALEABLE' }),
        holding({ sbl_id: 'sbl-d', sbl_bucket: 'DAMAGED', sbl_on_hand_qty: D(2) }),
        holding({
          sbl_id: 'sbl-b',
          sbl_lot_id: LOT_B,
          sbl_bucket: 'SALEABLE',
          sbl_in_qty: D(24),
          sbl_out_qty: D(0),
          sbl_free_in_qty: D(0),
          sbl_on_hand_qty: D(24),
          sbl_reserved_qty: D(6),
          sbl_transit_in_qty: D(12),
          sbl_available_qty: D(18),
          sbl_avg_cost_rate: D(12),
          sbl_stock_value: D(288),
          sbl_stock_value_wot: D(240),
          sbl_last_in_date: new Date('2026-10-05T00:00:00.000Z'),
          sbl_last_out_date: new Date('2026-10-06T00:00:00.000Z'),
          sbl_sync_date: new Date('2026-10-07T00:00:00.000Z'),
          sbl_created_on: new Date('2026-09-30T00:00:00.000Z'),
          sbl_modified_on: new Date('2026-10-08T00:00:00.000Z'),
          slt_track_signature: 'B',
          opening_qty: null,
          opening_value: null,
          opening_value_wot: null,
        }),
      ]);

      const rows = await service.getByScope(balanceQuery());

      expect(rows.map((row) => row.isb_stock_bucket)).toEqual(['DAMAGED', 'SALEABLE']);
      expect(rows[1]).toEqual({
        // The smallest holding id of the bucket.
        isb_id: 'sbl-b',
        isb_acc_year: '2026-2027',
        isb_company_id: COMPANY_ID,
        isb_branch_id: BRANCH_ID,
        isb_godown_id: GODOWN_ID,
        isb_item_id: ITEM_ID,
        isb_unit_id: BOX_UNIT_ID,
        // One lot carries a tracking signature, so the bucket is tracked.
        isb_tracking_type: 'LOT',
        isb_stock_bucket: 'SALEABLE',
        isb_opening_qty: 24,
        isb_in_qty: 72,
        isb_out_qty: 12,
        isb_closing_qty: 60,
        isb_opening_free_qty: 0,
        isb_free_in_qty: 6,
        isb_free_out_qty: 0,
        isb_free_closing_qty: 6,
        isb_reserved_qty: 6,
        isb_transit_qty: 12,
        isb_available_qty: 54,
        book_qty: 5,
        book_base_qty: 60,
        isb_opening_avg_rate: 10,
        // Notes 92: Σ value ÷ Σ quantity, not either lot's own rate.
        isb_avg_stock_rate: 648 / 60,
        isb_opening_value: 240,
        isb_stock_value: 648,
        isb_opening_avg_rate_wot: 8.5,
        isb_avg_stock_rate_wot: 546 / 60,
        isb_opening_value_wot: 204,
        isb_stock_value_wot: 546,
        isb_last_in_date: '2026-10-05T00:00:00.000Z',
        isb_last_out_date: '2026-10-06T00:00:00.000Z',
        isb_sync_date: '2026-10-07T00:00:00.000Z',
        // The earliest creation of the bucket's holdings.
        isb_created_on: '2026-09-30T00:00:00.000Z',
        isb_created_by: 'admin',
        isb_updated_on: '2026-10-08T00:00:00.000Z',
        isb_updated_by: null,
      });
    });

    it("keeps the first holding's rate when nothing is on hand", async () => {
      prisma.$queryRaw.mockResolvedValue([
        holding({ sbl_on_hand_qty: D(0), sbl_avg_cost_rate: D(11), sbl_avg_cost_rate_wot: D(9) }),
        holding({ sbl_id: 'sbl-z', sbl_on_hand_qty: null, sbl_avg_cost_rate: D(99) }),
      ]);

      const [row] = await service.getByScope(balanceQuery());

      expect(row).toMatchObject({
        isb_closing_qty: 0,
        isb_avg_stock_rate: 11,
        isb_avg_stock_rate_wot: 9,
        isb_tracking_type: 'NONE',
      });
    });

    it('reads the one godown and item, every bucket unless one is asked for', async () => {
      await service.getByScope(balanceQuery());
      await service.getByScope(balanceQuery({ isb_stock_bucket: 'DAMAGED' }));

      const all = rawQuery(0);
      expect(all.sql).toContain("sml.sml_txn_type   = 'OPENING'");
      expect(all.values).toEqual([
        '2026-2027',
        COMPANY_ID,
        BRANCH_ID,
        GODOWN_ID,
        ITEM_ID,
        null,
        null,
        false,
        10000,
      ]);
      expect(rawQuery(1).values.slice(5, 7)).toEqual(['DAMAGED', 'DAMAGED']);
    });

    it('answers 404 when the scope holds no stock', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const refusal = await refusalOf(service.getByScope(balanceQuery()));

      expect(refusal).toEqual({
        status: 404,
        body: {
          success: false,
          message: 'Item stock balance not found',
          errors: [
            {
              field: 'scope',
              code: StockErrorCode.BALANCE_NOT_FOUND,
              message:
                `No item stock balance found for acc year 2026-2027, company ${COMPANY_ID}, ` +
                `branch ${BRANCH_ID}, godown ${GODOWN_ID}, item ${ITEM_ID}, unit ${BOX_UNIT_ID}`,
            },
          ],
        },
      });
    });

    it.each([
      ['the item has no price row for the unit', []],
      [
        'the price rows name another unit only',
        [
          boxPriceRow({
            ipmId: 'x',
            ipmUcUnitId: 'y',
            itemUnitConversion: { iucUnitId: 'z', iucUnitFactor: D(1) },
          }),
        ],
      ],
    ])('answers 404 when %s', async (_label, priceRows) => {
      prisma.itemPriceMaster.findMany.mockResolvedValue(priceRows);

      const refusal = await refusalOf(service.getByScope(balanceQuery()));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          message: 'Item price master not found',
          errors: [
            {
              field: 'ipm_item_id',
              code: StockErrorCode.ITEM_PRICE_NOT_FOUND,
              message: `No item price master found for item ${ITEM_ID} and unit ${BOX_UNIT_ID}`,
            },
          ],
        },
      });
    });

    it('answers 0 book quantity when the unit factor is 0', async () => {
      prisma.itemPriceMaster.findMany.mockResolvedValue([
        boxPriceRow({ itemUnitConversion: { iucUnitId: BOX_UNIT_ID, iucUnitFactor: D(0) } }),
      ]);

      const [row] = await service.getByScope(balanceQuery());

      expect(row).toMatchObject({ book_qty: 0, book_base_qty: 36 });
    });
  });

  // ── GET /batch-options ────────────────────────────────────────────────────
  describe('getBatchOptionsByScope', () => {
    it('lists one option per lot on hand, in the unit asked for', async () => {
      prisma.$queryRaw.mockResolvedValue([
        holding({
          sbl_id: 'sbl-a',
          slt_batch_no: 'B-001',
          slt_serial_no: 'SN-1',
          slt_mrp: D(15),
          slt_mfg_date: new Date('2026-09-01T00:00:00.000Z'),
          slt_expiry_date: new Date('2027-09-01T00:00:00.000Z'),
          slt_first_inward_date: new Date('2026-10-02T00:00:00.000Z'),
        }),
      ]);

      const [option] = await service.getBatchOptionsByScope(optionsQuery());

      expect(option).toMatchObject({
        ibs_id: 'sbl-a',
        ibs_company_id: COMPANY_ID,
        ibs_branch_id: BRANCH_ID,
        ibs_godown_id: GODOWN_ID,
        ibs_item_id: ITEM_ID,
        ibs_unit_id: BOX_UNIT_ID,
        // The lot is the batch: its id is what a document line's lotId names.
        ibs_batch_id: LOT_A,
        ibs_batch_no: 'B-001',
        ibs_mfg_batch_no: null,
        ibs_batch_date: '2026-10-02T00:00:00.000Z',
        ibs_mfg_date: '2026-09-01T00:00:00.000Z',
        ibs_expiry_date: '2027-09-01T00:00:00.000Z',
        ibs_mrp: 15,
        ibs_barcode: null,
        ibs_serial_no: 'SN-1',
        ibs_stock_bucket: 'SALEABLE',
        ibs_closing_qty: 36,
        ibs_free_closing_qty: 6,
        book_qty: 3,
        book_base_qty: 36,
        book_free_qty: 0.5,
        book_free_base_qty: 6,
        ibs_avg_stock_rate: 10,
        ibs_avg_stock_rate_wot: 8.5,
      });
    });

    it('asks only for holdings with stock on hand, 50 at a time by default', async () => {
      await service.getBatchOptionsByScope(optionsQuery());

      const query = rawQuery();
      expect(query.sql).toContain('b.sbl_on_hand_qty > 0');
      expect(query.values).toEqual([
        '2026-2027',
        COMPANY_ID,
        BRANCH_ID,
        GODOWN_ID,
        ITEM_ID,
        null,
        null,
        true,
        50,
      ]);
    });

    it.each([
      ['a limit it can read', '20', 20],
      ['a limit above the cap', '500', 100],
      ['a limit of 0', '0', 50],
      ['a negative limit', '-3', 50],
      ['a limit that is not a number', 'abc', 50],
    ])('takes %s as %p', async (_label, limit, expected) => {
      await service.getBatchOptionsByScope(optionsQuery({ limit }));

      expect(rawQuery().values.at(-1)).toBe(expected);
    });

    it('narrows to a bucket and searches the batch and serial numbers', async () => {
      await service.getBatchOptionsByScope(
        optionsQuery({ ibs_stock_bucket: 'SALEABLE', search: '  B-001 ' }),
      );

      const query = rawQuery();
      expect(query.values.slice(5, 7)).toEqual(['SALEABLE', 'SALEABLE']);
      // The piece is bound once per searched column.
      expect(query.values.slice(7, 9)).toEqual(['B-001', 'B-001']);
      expect(query.sql).toContain('slt.slt_serial_no');
    });

    it('counts in base units when no price row names the unit asked for', async () => {
      prisma.itemPriceMaster.findMany.mockResolvedValue([]);

      const [option] = await service.getBatchOptionsByScope(optionsQuery());

      expect(option).toMatchObject({ book_qty: 36, book_base_qty: 36 });
    });

    it('reads a missing on-hand figure and MRP as 0', async () => {
      prisma.$queryRaw.mockResolvedValue([holding({ sbl_on_hand_qty: null, slt_mrp: null })]);

      const [option] = await service.getBatchOptionsByScope(optionsQuery());

      expect(option).toMatchObject({ ibs_closing_qty: 0, ibs_mrp: 0, book_qty: 0 });
    });

    it('answers an empty list when nothing is on hand', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.getBatchOptionsByScope(optionsQuery())).resolves.toEqual([]);
    });
  });

  // ── GET /bulk-list ────────────────────────────────────────────────────────
  describe('getBulkList', () => {
    const stockRow = (overrides: Record<string, unknown> = {}) => ({
      sbl_item_id: ITEM_ID,
      sbl_godown_id: GODOWN_ID,
      base_unit_id: PCS_UNIT_ID,
      base_iuc_id: PCS_IUC_ID,
      closing_qty: D(36),
      free_closing_qty: D(6),
      avg_cost_rate: D(10),
      avg_cost_rate_wot: D('8.5'),
      tracking: null,
      ...overrides,
    });
    const pcsPriceRow = (overrides: Record<string, unknown> = {}) => ({
      ipmItemId: ITEM_ID,
      ipmId: 'ipm-any-godown',
      ipmUcUnitId: PCS_IUC_ID,
      ipmGodownId: null,
      ipmCostPrice: D(10),
      ipmCostWot: D('8.5'),
      ipmMaxPrice: D(15),
      itemUnitConversion: {
        iucUnitId: PCS_UNIT_ID,
        iucBaseUnitId: PCS_UNIT_ID,
        iucToBaseFactor: D(1),
        iucUnitFactor: D(1),
      },
      ...overrides,
    });

    beforeEach(() => {
      prisma.$queryRaw.mockResolvedValue([stockRow()]);
      prisma.itemMaster.findMany.mockResolvedValue([
        {
          itemId: ITEM_ID,
          itemNameEn: 'Chilli Powder 100g',
          itemCode: 'CP100',
          itemDefaultBarcode: '890100',
          itemBaseUnitId: PCS_UNIT_ID,
        },
      ]);
      prisma.unit.findMany.mockResolvedValue([{ unit_id: PCS_UNIT_ID, unit_name: 'PCS' }]);
      prisma.godownLocation.findMany.mockResolvedValue([{ gdlId: GODOWN_ID, gdlName: 'Main' }]);
      prisma.itemPriceMaster.findMany.mockResolvedValue([pcsPriceRow()]);
    });

    it('answers one row per item and godown, in base units, with its names and prices', async () => {
      await expect(service.getBulkList(bulkQuery())).resolves.toEqual([
        {
          isb_item_id: ITEM_ID,
          item_name: 'Chilli Powder 100g',
          item_code: 'CP100',
          item_default_barcode: '890100',
          isb_unit_id: PCS_UNIT_ID,
          unit_name: 'PCS',
          isb_base_unit_id: PCS_UNIT_ID,
          isb_price_master_id: 'ipm-any-godown',
          isb_godown_id: GODOWN_ID,
          godown_name: 'Main',
          isb_to_base_factor: 1,
          book_qty: 36,
          book_base_qty: 36,
          book_free_qty: 6,
          book_free_base_qty: 6,
          avg_stock_rate: 10,
          avg_stock_rate_wot: 8.5,
          mrp: 15,
          cost_price: 10,
          cost_wot: 8.5,
          tracking_type: 'NONE',
        },
      ]);
    });

    it('reads every live holding of the branch, 500 rows by default', async () => {
      await service.getBulkList(bulkQuery());

      const query = rawQuery();
      expect(query.sql).toContain('GROUP BY b.sbl_item_id, b.sbl_godown_id');
      expect(query.values).toEqual([
        COMPANY_ID,
        BRANCH_ID,
        null,
        null,
        null,
        null,
        null,
        null,
        'ALL',
        500,
      ]);
      expect(prisma.itemMaster.findMany).toHaveBeenCalledTimes(1);
    });

    it('passes the godown, bucket and stock type it was given', async () => {
      await service.getBulkList(
        bulkQuery({
          isb_godown_id: GODOWN_ID,
          isb_stock_bucket: 'DAMAGED',
          stock_type: 'NEGATIVE',
        }),
      );

      expect(rawQuery().values).toEqual([
        COMPANY_ID,
        BRANCH_ID,
        null,
        null,
        GODOWN_ID,
        GODOWN_ID,
        'DAMAGED',
        'DAMAGED',
        'NEGATIVE',
        500,
      ]);
    });

    it.each([
      ['a limit it can read', '50', 50],
      ['a limit above the cap', '5000', 2000],
      ['a limit of 0', '0', 500],
      ['a limit that is not a number', 'abc', 500],
    ])('takes %s as %p rows', async (_label, limit, expected) => {
      await service.getBulkList(bulkQuery({ limit }));

      expect(rawQuery().values.at(-1)).toBe(expected);
    });

    it('filters by the item master first, so the limit cannot cut items that pass', async () => {
      prisma.itemMaster.findMany
        .mockResolvedValueOnce([{ itemId: ITEM_ID }, { itemId: OTHER_ITEM_ID }])
        .mockResolvedValueOnce([
          {
            itemId: ITEM_ID,
            itemNameEn: 'Chilli Powder 100g',
            itemCode: null,
            itemDefaultBarcode: null,
            itemBaseUnitId: PCS_UNIT_ID,
          },
        ]);

      await service.getBulkList(
        bulkQuery({
          item_group_id: GROUP_ID,
          item_brand_id: GROUP_ID,
          item_section_id: GROUP_ID,
          item_category_id: GROUP_ID,
        }),
      );

      expect(prisma.itemMaster.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          itemIsDeleted: false,
          itemGroupId: GROUP_ID,
          itemBrandId: GROUP_ID,
          itemSectionId: GROUP_ID,
          itemCategoryId: GROUP_ID,
        },
        select: { itemId: true },
      });
      expect(rawQuery().values.slice(2, 4)).toEqual([
        [ITEM_ID, OTHER_ITEM_ID],
        [ITEM_ID, OTHER_ITEM_ID],
      ]);
    });

    it('answers an empty list, reading no stock, when no item passes the filters', async () => {
      prisma.itemMaster.findMany.mockResolvedValueOnce([]);

      await expect(service.getBulkList(bulkQuery({ item_group_id: GROUP_ID }))).resolves.toEqual(
        [],
      );
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('answers an empty list, looking nothing up, when no holding matches', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.getBulkList(bulkQuery())).resolves.toEqual([]);
      expect(prisma.itemPriceMaster.findMany).not.toHaveBeenCalled();
      expect(prisma.godownLocation.findMany).not.toHaveBeenCalled();
    });

    it('reads only the headline price rows of the items found, as they stand today', async () => {
      await service.getBulkList(bulkQuery());

      expect(prisma.itemPriceMaster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            ipmItemId: { in: [ITEM_ID] },
            ipmIsDeleted: false,
            ipmBucketMrp: null,
            ipmBucketSp: null,
            ipmEffectiveFrom: { lte: TODAY_COLUMN },
            ipmEffectiveTo: { gte: TODAY_COLUMN },
          },
        }),
      );
      expect(prisma.itemMaster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { itemId: { in: [ITEM_ID] }, itemIsDeleted: false } }),
      );
    });

    it("prefers the price row of the holding's own godown over one for any godown", async () => {
      prisma.itemPriceMaster.findMany.mockResolvedValue([
        pcsPriceRow(),
        pcsPriceRow({ ipmId: 'ipm-main', ipmGodownId: GODOWN_ID, ipmMaxPrice: D(16) }),
      ]);

      const [row] = await service.getBulkList(bulkQuery());

      expect(row).toMatchObject({ isb_price_master_id: 'ipm-main', mrp: 16 });
    });

    it('answers 0 prices when the item has no price row for its unit', async () => {
      prisma.itemPriceMaster.findMany.mockResolvedValue([]);

      const [row] = await service.getBulkList(bulkQuery());

      expect(row).toMatchObject({ isb_price_master_id: null, mrp: 0, cost_price: 0, cost_wot: 0 });
    });

    it("falls back to the item's base unit when the holding names none", async () => {
      prisma.$queryRaw.mockResolvedValue([stockRow({ base_unit_id: null })]);

      const [row] = await service.getBulkList(bulkQuery());

      expect(prisma.unit.findMany).not.toHaveBeenCalled();
      expect(row).toMatchObject({ isb_unit_id: PCS_UNIT_ID, unit_name: '' });
    });

    it('marks a holding of a tracked lot as LOT and names an unknown godown null', async () => {
      prisma.$queryRaw.mockResolvedValue([
        stockRow({ tracking: 'B', sbl_godown_id: OTHER_GODOWN_ID }),
      ]);

      const [row] = await service.getBulkList(bulkQuery());

      expect(row).toMatchObject({ tracking_type: 'LOT', godown_name: null });
    });

    it('drops holdings of items it cannot find', async () => {
      prisma.$queryRaw.mockResolvedValue([stockRow(), stockRow({ sbl_item_id: OTHER_ITEM_ID })]);

      const rows = await service.getBulkList(bulkQuery());

      expect(rows.map((row) => row.isb_item_id)).toEqual([ITEM_ID]);
    });

    it('answers an empty list when none of the items is live', async () => {
      prisma.itemMaster.findMany.mockResolvedValue([]);

      await expect(service.getBulkList(bulkQuery())).resolves.toEqual([]);
    });

    it('names a unit with no code, barcode or base unit null', async () => {
      prisma.$queryRaw.mockResolvedValue([stockRow({ base_unit_id: null })]);
      prisma.itemMaster.findMany.mockResolvedValue([
        {
          itemId: ITEM_ID,
          itemNameEn: 'Loose rice',
          itemCode: null,
          itemDefaultBarcode: null,
          itemBaseUnitId: null,
        },
      ]);

      const [row] = await service.getBulkList(bulkQuery());

      expect(row).toMatchObject({
        item_code: null,
        item_default_barcode: null,
        isb_unit_id: '',
        isb_base_unit_id: null,
      });
    });
  });

  // ── getPriceMasterByItemAndUnit ───────────────────────────────────────────
  describe('getPriceMasterByItemAndUnit', () => {
    const priceRecord = (overrides: Record<string, unknown> = {}) => ({
      ipmId: BOX_IPM_ID,
      ipmCompanyId: null,
      ipmBranchId: null,
      ipmItemId: ITEM_ID,
      ipmUcUnitId: BOX_IUC_ID,
      ipmGodownId: null,
      ipmSlNo: 2,
      ipmCostPrice: D(120),
      ipmCostWot: D(102),
      ipmSalesPriceA: D(150),
      ipmSalesPriceB: D(145),
      ipmSalesPriceC: D(140),
      ipmSalesPriceD: D(135),
      ipmPriceAWot: D(127),
      ipmPriceBWot: D(123),
      ipmPriceCWot: D(119),
      ipmPriceDWot: D(114),
      ipmPriceAMarkupPerc: D(25),
      ipmPriceBMarkupPerc: D(20),
      ipmPriceCMarkupPerc: D(16),
      ipmPriceDMarkupPerc: D(12),
      ipmMaxPrice: D(180),
      ipmBucketMrp: null,
      ipmBucketSp: null,
      ipmMinPrice: D(130),
      ipmDiscPerc: D(0),
      ipmDiscQty: D(0),
      ipmAddlCess: D(0),
      ipmProfitType: 'By %',
      ipmRoundOff: D(0),
      ipmLoadingCharge: D(0),
      ipmFreightCharge: D(0),
      ipmLoyaltyPoints: D(1),
      ipmUomRemarks: null,
      ipmCostRemarks: null,
      ipmIsActive: true,
      ipmIsDeleted: false,
      ipmSyncDate: null,
      ipmCreatedOn: CREATED_ON,
      ipmCreatedBy: 'admin',
      ipmUpdatedOn: null,
      ipmUpdatedBy: null,
      itemUnitConversion: {},
      ...overrides,
    });

    it('answers the live price rows that name the unit, as payloads', async () => {
      prisma.itemPriceMaster.findMany.mockResolvedValue([priceRecord()]);

      const [payload] = await service.getPriceMasterByItemAndUnit(ITEM_ID, BOX_UNIT_ID);

      expect(prisma.itemPriceMaster.findMany).toHaveBeenCalledWith({
        where: {
          ipmItemId: ITEM_ID,
          ipmIsDeleted: false,
          OR: [
            { ipmId: BOX_UNIT_ID },
            { ipmUcUnitId: BOX_UNIT_ID },
            { itemUnitConversion: { iucUnitId: BOX_UNIT_ID } },
          ],
        },
        include: { itemUnitConversion: true },
        orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
      });
      expect(payload).toEqual({
        ipm_id: BOX_IPM_ID,
        ipm_company_id: null,
        ipm_branch_id: null,
        ipm_item_id: ITEM_ID,
        ipm_uc_unit_id: BOX_IUC_ID,
        ipm_godown_id: null,
        ipm_sl_no: 2,
        ipm_cost_price: 120,
        ipm_cost_wot: 102,
        ipm_sales_price_a: 150,
        ipm_sales_price_b: 145,
        ipm_sales_price_c: 140,
        ipm_sales_price_d: 135,
        ipm_price_a_wot: 127,
        ipm_price_b_wot: 123,
        ipm_price_c_wot: 119,
        ipm_price_d_wot: 114,
        ipm_price_a_markup_perc: 25,
        ipm_price_b_markup_perc: 20,
        ipm_price_c_markup_perc: 16,
        ipm_price_d_markup_perc: 12,
        ipm_max_price: 180,
        ipm_bucket_mrp: null,
        ipm_bucket_sp: null,
        ipm_min_price: 130,
        ipm_disc_perc: 0,
        ipm_disc_qty: 0,
        ipm_addl_cess: 0,
        ipm_profit_type: 'By %',
        ipm_round_off: 0,
        ipm_loading_charge: 0,
        ipm_freight_charge: 0,
        ipm_loyalty_points: 1,
        ipm_uom_remarks: null,
        ipm_cost_remarks: null,
        ipm_is_active: true,
        ipm_is_deleted: false,
        ipm_sync_date: null,
        ipm_created_on: CREATED_ON.toISOString(),
        ipm_created_by: 'admin',
        ipm_updated_on: null,
        ipm_updated_by: null,
      });
    });

    it('turns a bucket row and its dates into numbers and ISO text', async () => {
      prisma.itemPriceMaster.findMany.mockResolvedValue([
        priceRecord({
          ipmBucketMrp: D(199),
          ipmBucketSp: D(180),
          ipmSyncDate: new Date('2026-10-02T00:00:00.000Z'),
          ipmUpdatedOn: new Date('2026-10-03T00:00:00.000Z'),
        }),
      ]);

      const [payload] = await service.getPriceMasterByItemAndUnit(ITEM_ID, BOX_UNIT_ID);

      expect(payload).toMatchObject({
        ipm_bucket_mrp: 199,
        ipm_bucket_sp: 180,
        ipm_sync_date: '2026-10-02T00:00:00.000Z',
        ipm_updated_on: '2026-10-03T00:00:00.000Z',
      });
    });

    it('answers 404 when no price row names the unit', async () => {
      prisma.itemPriceMaster.findMany.mockResolvedValue([]);

      const refusal = await refusalOf(service.getPriceMasterByItemAndUnit(ITEM_ID, BOX_UNIT_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: StockErrorCode.ITEM_PRICE_NOT_FOUND }] },
      });
    });
  });
});
