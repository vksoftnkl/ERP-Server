import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { StockErrorCode } from '../types/stock-error-codes';
import { GetItemBatchStockQueryDto } from './dto/get-item-batch-stock-query.dto';
import { ItemBatchStockService } from './itemBatchStockService';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b002';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46b003';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46b004';
/** The unit the caller asks in — a BOX of 12. */
const BOX_UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46b005';
const BOX_IUC_ID = '019c6f6c-be87-7a11-8905-36092c46b006';
const BOX_IPM_ID = '019c6f6c-be87-7a11-8905-36092c46b007';
const LOT_ID = '019c6f6c-be87-7a11-8905-36092c46b008';
const SBL_ID = '019c6f6c-be87-7a11-8905-36092c46b009';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');

const D = (value: number | string) => new Prisma.Decimal(value);

const lotRow = (overrides: Record<string, unknown> = {}) => ({
  sbl_id: SBL_ID,
  sbl_company_id: COMPANY_ID,
  sbl_branch_id: BRANCH_ID,
  sbl_godown_id: GODOWN_ID,
  sbl_item_id: ITEM_ID,
  sbl_lot_id: LOT_ID,
  sbl_bucket: 'SALEABLE',
  sbl_in_qty: D(120),
  sbl_out_qty: D(24),
  sbl_free_in_qty: D(12),
  sbl_free_out_qty: D(0),
  sbl_on_hand_qty: D(96),
  sbl_reserved_qty: D(12),
  sbl_available_qty: D(84),
  sbl_avg_cost_rate: D('10.5'),
  sbl_stock_value: D(1008),
  sbl_last_in_date: new Date('2026-10-02T00:00:00.000Z'),
  sbl_last_out_date: null,
  sbl_is_active: true,
  sbl_is_deleted: false,
  sbl_row_version: 7n,
  sbl_created_on: CREATED_ON,
  sbl_created_by: 'admin',
  sbl_modified_on: null,
  sbl_modified_by: null,
  slt_batch_no: 'B-001',
  slt_mfg_date: new Date('2026-09-01T00:00:00.000Z'),
  slt_expiry_date: new Date('2027-09-01T00:00:00.000Z'),
  slt_mrp: D(15),
  slt_serial_no: null,
  slt_first_inward_date: new Date('2026-10-02T00:00:00.000Z'),
  opening_qty: D(60),
  opening_free_qty: D(6),
  opening_value: D(600),
  ...overrides,
});

const boxPriceRow = (overrides: Record<string, unknown> = {}) => ({
  ipmId: BOX_IPM_ID,
  ipmUcUnitId: BOX_IUC_ID,
  itemUnitConversion: { iucUnitId: BOX_UNIT_ID, iucUnitFactor: D(12) },
  ...overrides,
});

/** The query as the ValidationPipe hands it over. */
const queryOf = (overrides: Record<string, unknown> = {}) =>
  plainToInstance(GetItemBatchStockQueryDto, {
    ibs_acc_year: '2026-2027',
    ibs_company_id: COMPANY_ID,
    ibs_branch_id: BRANCH_ID,
    ibs_godown_id: GODOWN_ID,
    ibs_item_id: ITEM_ID,
    ibs_unit_id: BOX_UNIT_ID,
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

describe('ItemBatchStockService', () => {
  let prisma: { $queryRaw: jest.Mock; itemPriceMaster: { findMany: jest.Mock } };
  let service: ItemBatchStockService;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([lotRow()]),
      itemPriceMaster: { findMany: jest.fn().mockResolvedValue([boxPriceRow()]) },
    };
    service = new ItemBatchStockService(prisma as unknown as PrismaService);
  });

  /** The holdings query as Postgres would receive it: its text and flattened parameters. */
  const holdingsQuery = () => {
    const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...Prisma.Sql[],
    ];
    return Prisma.sql(strings, ...values);
  };

  // ── the read ──────────────────────────────────────────────────────────────
  describe('getByScope', () => {
    it('answers one row per lot holding, with every figure the client reads', async () => {
      await expect(service.getByScope(queryOf())).resolves.toEqual([
        {
          ibs_id: SBL_ID,
          ibs_acc_year: '2026-2027',
          ibs_company_id: COMPANY_ID,
          ibs_branch_id: BRANCH_ID,
          ibs_godown_id: GODOWN_ID,
          ibs_item_id: ITEM_ID,
          ibs_unit_id: BOX_UNIT_ID,
          ibs_batch_id: LOT_ID,
          ibs_batch_no: 'B-001',
          ibs_mfg_batch_no: null,
          ibs_batch_date: '2026-10-02T00:00:00.000Z',
          ibs_serial_no: null,
          ibs_mfg_date: '2026-09-01T00:00:00.000Z',
          ibs_expiry_date: '2027-09-01T00:00:00.000Z',
          ibs_mrp: 15,
          ibs_barcode: null,
          ibs_stock_bucket: 'SALEABLE',
          ibs_opening_qty: 60,
          ibs_in_qty: 120,
          ibs_out_qty: 24,
          ibs_closing_qty: 96,
          ibs_opening_free_qty: 6,
          ibs_free_in_qty: 12,
          ibs_free_out_qty: 0,
          ibs_free_closing_qty: 12,
          ibs_reserved_qty: 12,
          ibs_available_qty: 84,
          // In boxes of 12.
          book_qty: 8,
          book_base_qty: 96,
          book_free_qty: 1,
          book_free_base_qty: 12,
          book_reserved_qty: 1,
          book_reserved_base_qty: 12,
          book_available_qty: 7,
          book_available_base_qty: 84,
          ibs_opening_avg_rate: 10,
          ibs_avg_stock_rate: 10.5,
          ibs_opening_value: 600,
          ibs_stock_value: 1008,
          ibs_last_in_date: '2026-10-02T00:00:00.000Z',
          ibs_last_out_date: null,
          ibs_is_active: true,
          ibs_is_deleted: false,
          ibs_row_version: '7',
          ibs_created_on: CREATED_ON.toISOString(),
          ibs_created_by: 'admin',
          ibs_updated_on: null,
          ibs_updated_by: null,
        },
      ]);
    });

    it('reads the scope, live active holdings by default, and the year for the opening rows', async () => {
      await service.getByScope(queryOf());

      const query = holdingsQuery();
      expect(query.sql).toContain('FROM stock.stock_balance b');
      expect(query.sql).toContain("sml.sml_txn_type   = 'OPENING'");
      expect(query.values).toEqual([
        '2026-2027',
        COMPANY_ID,
        BRANCH_ID,
        GODOWN_ID,
        ITEM_ID,
        true,
        false,
        null,
        null,
        null,
        null,
      ]);
    });

    it('narrows to one lot and one bucket, and reads inactive or deleted holdings when asked', async () => {
      await service.getByScope(
        queryOf({
          ibs_batch_id: LOT_ID,
          ibs_stock_bucket: 'DAMAGED',
          ibs_is_active: 'false',
          ibs_is_deleted: 'yes',
        }),
      );

      expect(holdingsQuery().values).toEqual([
        '2026-2027',
        COMPANY_ID,
        BRANCH_ID,
        GODOWN_ID,
        ITEM_ID,
        false,
        true,
        LOT_ID,
        LOT_ID,
        'DAMAGED',
        'DAMAGED',
      ]);
    });

    it('searches the batch and serial numbers for each piece of the term', async () => {
      await service.getByScope(queryOf({ search: ' B-001  sn9 ' }));

      // Each piece is bound once per searched column.
      const query = holdingsQuery();
      expect(query.values.slice(-4)).toEqual(['B-001', 'B-001', 'sn9', 'sn9']);
      expect(query.sql).toContain('slt.slt_batch_no');
      expect(query.sql).toContain('slt.slt_serial_no');
    });

    it('reads the unit factors from the live price rows that name the unit', async () => {
      await service.getByScope(queryOf());

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
        select: {
          ipmId: true,
          ipmUcUnitId: true,
          itemUnitConversion: { select: { iucUnitId: true, iucUnitFactor: true } },
        },
        orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
      });
    });

    it.each([
      ['its unit id', BOX_UNIT_ID],
      ['its conversion row id', BOX_IUC_ID],
      ['its price row id', BOX_IPM_ID],
    ])('finds the factor when the caller names the unit by %s', async (_label, unitId) => {
      const [row] = await service.getByScope(queryOf({ ibs_unit_id: unitId }));

      expect(row.book_qty).toBe(8);
      expect(row.ibs_unit_id).toBe(unitId);
    });

    it('takes the first price row for a unit when several name it', async () => {
      prisma.itemPriceMaster.findMany.mockResolvedValue([
        boxPriceRow(),
        boxPriceRow({
          ipmId: 'second-row',
          itemUnitConversion: { iucUnitId: BOX_UNIT_ID, iucUnitFactor: D(6) },
        }),
      ]);

      const [row] = await service.getByScope(queryOf());

      expect(row.book_qty).toBe(8);
    });

    it('answers 0 for book quantities when the unit factor is 0', async () => {
      prisma.itemPriceMaster.findMany.mockResolvedValue([
        boxPriceRow({ itemUnitConversion: { iucUnitId: BOX_UNIT_ID, iucUnitFactor: D(0) } }),
      ]);

      const [row] = await service.getByScope(queryOf());

      expect(row).toMatchObject({ book_qty: 0, book_base_qty: 96, book_available_qty: 0 });
    });

    it('reads missing figures as 0 and a lot with no opening as a 0 opening rate', async () => {
      prisma.$queryRaw.mockResolvedValue([
        lotRow({
          sbl_on_hand_qty: null,
          sbl_available_qty: null,
          slt_mrp: null,
          opening_qty: null,
          opening_free_qty: null,
          opening_value: null,
          sbl_avg_cost_rate: D(NaN),
          sbl_modified_on: new Date('2026-10-03T00:00:00.000Z'),
          slt_mfg_date: null,
          slt_expiry_date: null,
          slt_first_inward_date: null,
        }),
      ]);

      const [row] = await service.getByScope(queryOf());

      expect(row).toMatchObject({
        ibs_closing_qty: 0,
        ibs_available_qty: 0,
        ibs_mrp: 0,
        ibs_opening_qty: 0,
        ibs_opening_avg_rate: 0,
        ibs_avg_stock_rate: 0,
        ibs_mfg_date: null,
        ibs_expiry_date: null,
        ibs_batch_date: null,
        ibs_updated_on: '2026-10-03T00:00:00.000Z',
      });
    });
  });

  // ── refusals ──────────────────────────────────────────────────────────────
  describe('refusals', () => {
    it('answers 404 when the scope holds no stock', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const refusal = await refusalOf(service.getByScope(queryOf()));

      expect(refusal).toEqual({
        status: 404,
        body: {
          success: false,
          message: 'Item batch stock not found',
          errors: [
            {
              field: 'scope',
              code: StockErrorCode.BATCH_STOCK_NOT_FOUND,
              message:
                `No item batch stock found for acc year 2026-2027, company ${COMPANY_ID}, ` +
                `branch ${BRANCH_ID}, godown ${GODOWN_ID}, item ${ITEM_ID}, unit ${BOX_UNIT_ID}`,
            },
          ],
        },
      });
    });

    it('names the batch in the 404 when one was asked for', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const refusal = await refusalOf(service.getByScope(queryOf({ ibs_batch_id: LOT_ID })));

      expect(refusal).toMatchObject({
        body: { errors: [{ message: expect.stringMatching(new RegExp(`, batch ${LOT_ID}$`)) }] },
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

      const refusal = await refusalOf(service.getByScope(queryOf()));

      expect(refusal).toEqual({
        status: 404,
        body: {
          success: false,
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

    it('reports a scope with no stock before a missing price row', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.itemPriceMaster.findMany.mockResolvedValue([]);

      const refusal = await refusalOf(service.getByScope(queryOf()));

      expect(refusal).toMatchObject({
        body: { errors: [{ code: StockErrorCode.BATCH_STOCK_NOT_FOUND }] },
      });
    });
  });
});
