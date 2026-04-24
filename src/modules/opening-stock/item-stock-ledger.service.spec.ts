import { ItemStockLedgerService } from './item-stock-ledger.service';
import {
  OpeningStockDetailPayload,
  OpeningStockDocumentPayload,
  OpeningStockHeaderPayload,
} from './types/opening-stock-api.types';

describe('ItemStockLedgerService', () => {
  const makeHeader = (): OpeningStockHeaderPayload => ({
    avh_voucher_id: 'voucher-1',
    avh_voucher_refno: 'OS-1',
    avh_voucher_type_id: 7,
    avh_bill_refno: 'bill-1',
    avh_user_refno: null,
    avh_bill_date: null,
    avh_party_id: 'party-1',
    avh_opposite_ledger_id: null,
    avh_employee_id: [],
    avh_pay_notes: null,
    avh_remarks: null,
    avh_voucher_status: 'DRAFT',
    avh_user_id: 'user-1',
    avh_session_id: null,
    avh_device_type: 'WEB',
    avh_device_id: null,
    avh_counter_id: 'counter-1',
    osh_id: 'opening-1',
    osh_acc_year: '2025-2026',
    osh_company_id: 'company-1',
    osh_branch_id: 'branch-1',
    osh_voucher_no: '1',
    osh_voucher_date: '2026-04-15T10:00:00.000Z',
    osh_ref_no: 'REF-1',
    osh_narration: 'Opening stock',
    osh_total_lines: 2,
    osh_total_qty: 7,
    osh_total_value: 700,
    osh_status: 'DRAFT',
    osh_user_id: 'user-1',
    osh_session_id: null,
    osh_device_type: 'WEB',
    osh_device_id: null,
    osh_counter_id: 'counter-1',
    osh_is_active: true,
    osh_is_deleted: false,
    osh_created_on: '2026-04-15T10:00:00.000Z',
    osh_created_by: 'user-1',
    osh_updated_on: null,
    osh_updated_by: null,
  });

  const makeDetail = (
    overrides: Partial<OpeningStockDetailPayload>,
  ): OpeningStockDetailPayload => ({
    osl_id: `detail-${overrides.osl_line_no ?? 1}`,
    osl_voucher_id: 'voucher-1',
    osl_opening_id: 'opening-1',
    osl_line_no: 1,
    osl_acc_year: '2025-2026',
    osl_company_id: 'company-1',
    osl_branch_id: 'branch-1',
    osl_item_id: 'item-1',
    osl_item_code: 'ITEM-1',
    osl_item_name: 'Item 1',
    osl_unit_id: 'unit-1',
    osl_unit_name: 'Nos',
    osl_base_uom_id: 'base-unit-1',
    osl_base_uom_name: 'Base Nos',
    osl_godown_id: 'godown-1',
    osl_godown_name: 'Main',
    osl_tracking_type: 'NONE',
    osl_barcode: null,
    osl_batch_id: null,
    osl_batch_no: null,
    osl_batch_date: null,
    osl_mfg_date: null,
    osl_expiry_date: null,
    osl_serial_no: null,
    osl_qty: 0,
    osl_base_qty: 0,
    osl_free_qty: 0,
    osl_free_base_qty: 0,
    osl_conv_factor: 1,
    osl_tax_id: null,
    osl_tax_name: null,
    osl_tax_perc: 0,
    osl_cess_type: 'NONE',
    osl_cess_perc: 0,
    osl_cess_per_unit: 0,
    osl_cost_rate: 100,
    osl_cost_rate_wot: 100,
    osl_stock_value: 0,
    osl_stock_value_wot: 0,
    osl_sale_rate_a: 0,
    osl_sale_rate_b: 0,
    osl_sale_rate_c: 0,
    osl_sale_rate_d: 0,
    osl_sale_rate_a_wot: 0,
    osl_sale_rate_b_wot: 0,
    osl_sale_rate_c_wot: 0,
    osl_sale_rate_d_wot: 0,
    osl_markup_perc_a: 0,
    osl_markup_perc_b: 0,
    osl_markup_perc_c: 0,
    osl_markup_perc_d: 0,
    osl_mrp_rate: 0,
    osl_min_rate: 0,
    osl_remarks: null,
    osl_is_active: true,
    osl_is_deleted: false,
    osl_created_on: '2026-04-15T10:00:00.000Z',
    osl_created_by: 'user-1',
    osl_updated_on: null,
    osl_updated_by: null,
    ...overrides,
  });

  const makeDocument = (): OpeningStockDocumentPayload => ({
    header: makeHeader(),
    details: [
      makeDetail({
        osl_line_no: 1,
        osl_qty: 5,
        osl_free_qty: 1,
        osl_free_base_qty: 2,
        osl_base_qty: 10,
        osl_conv_factor: 2,
        osl_stock_value: 500,
        osl_stock_value_wot: 400,
        osl_cost_rate_wot: 80,
      }),
      makeDetail({
        osl_line_no: 2,
        osl_qty: 2,
        osl_free_qty: 3,
        osl_free_base_qty: 6,
        osl_base_qty: 6,
        osl_conv_factor: 2,
        osl_stock_value: 200,
        osl_stock_value_wot: 160,
        osl_cost_rate_wot: 80,
      }),
    ],
  });

  const makeBatchRow = (
    overrides: Partial<Record<string, unknown>> = {},
  ): Record<string, unknown> => ({
    ibsAccYear: '2025-2026',
    ibsCompanyId: 'company-1',
    ibsBranchId: 'branch-1',
    ibsGodownId: 'godown-1',
    ibsItemId: 'item-1',
    ibsUnitId: 'base-unit-1',
    ibsBatchId: 'batch-1',
    ibsBatchNo: 'B-1',
    ibsStockBucket: 'SALEABLE',
    ibsOpeningQty: 0,
    ibsInQty: 0,
    ibsOutQty: 0,
    ibsClosingQty: 0,
    ibsOpeningFreeQty: 0,
    ibsFreeInQty: 0,
    ibsFreeOutQty: 0,
    ibsFreeClosingQty: 0,
    ibsReservedQty: 0,
    ibsAvailableQty: 0,
    ibsOpeningAvgRate: 0,
    ibsAvgStockRate: 0,
    ibsOpeningValue: 0,
    ibsStockValue: 0,
    ibsLastInDate: new Date('2026-04-15T10:00:00.000Z'),
    ibsLastOutDate: null,
    ...overrides,
  });

  const makeBalanceRow = (
    overrides: Partial<Record<string, unknown>> = {},
  ): Record<string, unknown> => ({
    isbAccYear: '2025-2026',
    isbCompanyId: 'company-1',
    isbBranchId: 'branch-1',
    isbGodownId: 'godown-1',
    isbItemId: 'item-1',
    isbUnitId: 'base-unit-1',
    isbTrackingType: 'NONE',
    isbStockBucket: 'SALEABLE',
    isbOpeningQty: 16,
    isbInQty: 0,
    isbOutQty: 0,
    isbClosingQty: 16,
    isbOpeningFreeQty: 8,
    isbFreeInQty: 0,
    isbFreeOutQty: 0,
    isbFreeClosingQty: 8,
    isbReservedQty: 0,
    isbTransitQty: 0,
    isbAvailableQty: 16,
    isbOpeningAvgRate: 29.166667,
    isbAvgStockRate: 29.166667,
    isbOpeningValue: 700,
    isbStockValue: 700,
    isbOpeningAvgRateWot: 23.333333,
    isbAvgStockRateWot: 23.333333,
    isbOpeningValueWot: 560,
    isbStockValueWot: 560,
    isbLastInDate: new Date('2026-04-15T10:00:00.000Z'),
    isbLastOutDate: null,
    ...overrides,
  });

  const createTx = ({
    initialBatchRows = [],
    initialBalanceRows = [],
    initialBatchMasters = [],
  }: {
    initialBatchRows?: Array<Record<string, unknown>>;
    initialBalanceRows?: Array<Record<string, unknown>>;
    initialBatchMasters?: Array<Record<string, unknown>>;
  } = {}) => {
    const batchRows = new Map<string, Record<string, unknown>>();
    const balanceRows = new Map<string, Record<string, unknown>>();
    const batchMasters = new Map<string, Record<string, unknown>>();
    const batchMastersById = new Map<string, Record<string, unknown>>();

    const getBalanceKey = (where: {
      isbAccYear_isbCompanyId_isbBranchId_isbGodownId_isbItemId_isbUnitId_isbStockBucket: {
        isbAccYear: string;
        isbCompanyId: string;
        isbBranchId: string;
        isbGodownId: string;
        isbItemId: string;
        isbUnitId: string;
        isbStockBucket: string;
      };
    }): string =>
      Object.values(
        where.isbAccYear_isbCompanyId_isbBranchId_isbGodownId_isbItemId_isbUnitId_isbStockBucket,
      ).join('|');

    const getBatchMasterKey = (companyId: string, itemId: string, batchNo: string): string =>
      [companyId, itemId, batchNo.trim().toLowerCase()].join('|');

    const getBatchKey = (source: {
      ibsAccYear: string;
      ibsCompanyId: string;
      ibsBranchId: string;
      ibsGodownId: string;
      ibsItemId: string;
      ibsUnitId?: string;
      ibsBatchId: string;
      ibsStockBucket: string;
    }): string =>
      [
        source.ibsAccYear,
        source.ibsCompanyId,
        source.ibsBranchId,
        source.ibsGodownId,
        source.ibsItemId,
        source.ibsUnitId ?? '',
        source.ibsBatchId,
        source.ibsStockBucket,
      ].join('|');

    const findBatchRow = (source: {
      ibsAccYear: string;
      ibsCompanyId: string;
      ibsBranchId: string;
      ibsGodownId: string;
      ibsItemId: string;
      ibsBatchId: string;
      ibsStockBucket: string;
      ibsUnitId?: string;
    }): Record<string, unknown> | undefined =>
      Array.from(batchRows.values()).find(
        (row) =>
          row.ibsAccYear === source.ibsAccYear &&
          row.ibsCompanyId === source.ibsCompanyId &&
          row.ibsBranchId === source.ibsBranchId &&
          row.ibsGodownId === source.ibsGodownId &&
          row.ibsItemId === source.ibsItemId &&
          row.ibsBatchId === source.ibsBatchId &&
          row.ibsStockBucket === source.ibsStockBucket &&
          (source.ibsUnitId === undefined || row.ibsUnitId === source.ibsUnitId),
      );

    for (const row of initialBatchRows) {
      batchRows.set(
        getBatchKey({
          ibsAccYear: String(row.ibsAccYear),
          ibsCompanyId: String(row.ibsCompanyId),
          ibsBranchId: String(row.ibsBranchId),
          ibsGodownId: String(row.ibsGodownId),
          ibsItemId: String(row.ibsItemId),
          ibsUnitId: String(row.ibsUnitId),
          ibsBatchId: String(row.ibsBatchId),
          ibsStockBucket: String(row.ibsStockBucket),
        }),
        row,
      );
    }

    for (const row of initialBatchMasters) {
      const key = getBatchMasterKey(
        String(row.btmCompanyId),
        String(row.btmItemId),
        String(row.btmBatchNo),
      );
      batchMasters.set(key, row);
      batchMastersById.set(String(row.btmId), row);
    }

    for (const row of initialBalanceRows) {
      balanceRows.set(
        [
          row.isbAccYear,
          row.isbCompanyId,
          row.isbBranchId,
          row.isbGodownId,
          row.isbItemId,
          row.isbUnitId,
          row.isbStockBucket,
        ].join('|'),
        row,
      );
    }

    return {
      openingStockDetail: {
        update: jest
          .fn()
          .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data),
      },
      itemStockLedger: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        create: jest.fn().mockImplementation(async ({ data }: { data: unknown }) => data),
      },
      itemBatchMaster: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          const batchNo = where?.btmBatchNo?.equals;
          if (!batchNo) {
            return null;
          }
          return (
            batchMasters.get(getBatchMasterKey(where.btmCompanyId, where.btmItemId, batchNo)) ??
            null
          );
        }),
        findMany: jest
          .fn()
          .mockImplementation(async ({ where }) =>
            Array.from(batchMasters.values()).filter(
              (row) => row.btmCompanyId === where.btmCompanyId && row.btmItemId === where.btmItemId,
            ),
          ),
        findUnique: jest
          .fn()
          .mockImplementation(async ({ where }) => batchMastersById.get(where.btmId) ?? null),
        create: jest
          .fn()
          .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
            const created = {
              btmId: `batch-master-${batchMasters.size + 1}`,
              ...data,
            };
            batchMasters.set(
              getBatchMasterKey(
                String(data.btmCompanyId),
                String(data.btmItemId),
                String(data.btmBatchNo),
              ),
              created,
            );
            batchMastersById.set(String(created.btmId), created);
            return created;
          }),
      },
      itemStockBalance: {
        findUnique: jest
          .fn()
          .mockImplementation(async ({ where }) => balanceRows.get(getBalanceKey(where)) ?? null),
        upsert: jest
          .fn()
          .mockImplementation(
            async ({
              where,
              create,
            }: {
              where: Parameters<typeof getBalanceKey>[0];
              create: Record<string, unknown>;
            }) => {
              balanceRows.set(getBalanceKey(where), create);
              return create;
            },
          ),
      },
      itemBatchStock: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          const scope =
            where.ibsAccYear_ibsCompanyId_ibsBranchId_ibsGodownId_ibsItemId_ibsBatchId_ibsStockBucket;
          return findBatchRow(scope) ?? null;
        }),
        findMany: jest
          .fn()
          .mockImplementation(async ({ where }) =>
            Array.from(batchRows.values()).filter(
              (row) =>
                (where.ibsAccYear === undefined || row.ibsAccYear === where.ibsAccYear) &&
                (where.ibsCompanyId === undefined || row.ibsCompanyId === where.ibsCompanyId) &&
                (where.ibsBranchId === undefined || row.ibsBranchId === where.ibsBranchId) &&
                (where.ibsGodownId === undefined || row.ibsGodownId === where.ibsGodownId) &&
                (where.ibsItemId === undefined || row.ibsItemId === where.ibsItemId) &&
                (where.ibsUnitId === undefined || row.ibsUnitId === where.ibsUnitId) &&
                (where.ibsStockBucket === undefined || row.ibsStockBucket === where.ibsStockBucket),
            ),
          ),
        upsert: jest.fn().mockImplementation(
          async ({
            where,
            create,
            update,
          }: {
            where: {
              ibsAccYear_ibsCompanyId_ibsBranchId_ibsGodownId_ibsItemId_ibsBatchId_ibsStockBucket: {
                ibsAccYear: string;
                ibsCompanyId: string;
                ibsBranchId: string;
                ibsGodownId: string;
                ibsItemId: string;
                ibsUnitId?: string;
                ibsBatchId: string;
                ibsStockBucket: string;
              };
            };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => {
            const scope =
              where.ibsAccYear_ibsCompanyId_ibsBranchId_ibsGodownId_ibsItemId_ibsBatchId_ibsStockBucket;
            const existing = findBatchRow(scope);
            const nextRow = existing ? { ...existing, ...update } : create;
            batchRows.set(
              getBatchKey({
                ibsAccYear: String(nextRow.ibsAccYear),
                ibsCompanyId: String(nextRow.ibsCompanyId),
                ibsBranchId: String(nextRow.ibsBranchId),
                ibsGodownId: String(nextRow.ibsGodownId),
                ibsItemId: String(nextRow.ibsItemId),
                ibsUnitId: String(nextRow.ibsUnitId),
                ibsBatchId: String(nextRow.ibsBatchId),
                ibsStockBucket: String(nextRow.ibsStockBucket),
              }),
              nextRow,
            );
            return nextRow;
          },
        ),
      },
    };
  };

  it('uses the common stock engine for non-batch opening stock in base units', async () => {
    const tx = createTx();

    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    await service.syncFromOpeningStockDocument(tx as never, makeDocument());

    expect(tx.itemBatchStock.upsert).not.toHaveBeenCalled();
    expect(tx.itemStockBalance.upsert).toHaveBeenCalledTimes(2);

    const lastSummaryWrite = tx.itemStockBalance.upsert.mock.calls.at(-1)?.[0];
    const { create, update } = lastSummaryWrite;

    expect(create.isbUnitId).toBe('base-unit-1');
    expect(create.isbTrackingType).toBe('NONE');
    expect(create.isbOpeningQty).toBe(16);
    expect(create.isbClosingQty).toBe(16);
    expect(create.isbOpeningFreeQty).toBe(8);
    expect(create.isbFreeClosingQty).toBe(8);
    expect(create.isbAvailableQty).toBe(16);
    expect(create.isbOpeningAvgRate).toBe(29.166667);
    expect(create.isbAvgStockRate).toBe(29.166667);
    expect(create.isbOpeningValue).toBe(700);
    expect(create.isbStockValue).toBe(700);
    expect(create.isbOpeningAvgRateWot).toBe(23.333333);
    expect(create.isbAvgStockRateWot).toBe(23.333333);
    expect(create.isbOpeningValueWot).toBe(560);
    expect(create.isbStockValueWot).toBe(560);

    expect(update.isbClosingQty).toBe(16);
    expect(update.isbAvailableQty).toBe(16);
    expect(update.isbStockValue).toBe(700);
    expect(update.isbStockValueWot).toBe(560);
  });

  it('normalizes free base quantity from free qty and conversion factor when the payload is inconsistent', async () => {
    const tx = createTx();
    const document = {
      ...makeDocument(),
      details: [
        makeDetail({
          osl_line_no: 1,
          osl_qty: 5,
          osl_free_qty: 1,
          osl_free_base_qty: 9,
          osl_base_qty: 10,
          osl_conv_factor: 2,
          osl_stock_value: 500,
          osl_stock_value_wot: 400,
          osl_cost_rate_wot: 80,
        }),
      ],
    } satisfies OpeningStockDocumentPayload;

    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    await service.syncFromOpeningStockDocument(tx as never, document);

    expect(tx.itemStockLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stlFreeQty: 1,
          stlFreeBaseQty: 2,
        }),
      }),
    );

    const summaryWrite = tx.itemStockBalance.upsert.mock.calls[0][0];
    expect(summaryWrite.create.isbOpeningFreeQty).toBe(2);
    expect(summaryWrite.create.isbFreeClosingQty).toBe(2);
    expect(summaryWrite.create.isbOpeningValueWot).toBe(400);
    expect(summaryWrite.create.isbStockValueWot).toBe(400);
  });

  it('updates batch stock first and rolls it up to summary for batch-tracked opening stock', async () => {
    const tx = createTx();
    const document = {
      ...makeDocument(),
      details: [
        makeDetail({
          osl_line_no: 1,
          osl_tracking_type: 'BATCH',
          osl_batch_id: 'batch-1',
          osl_batch_no: 'B-1',
          osl_qty: 5,
          osl_free_qty: 1,
          osl_free_base_qty: 2,
          osl_base_qty: 10,
          osl_conv_factor: 2,
          osl_stock_value: 500,
          osl_stock_value_wot: 400,
          osl_cost_rate_wot: 80,
        }),
      ],
    } satisfies OpeningStockDocumentPayload;

    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    await service.syncFromOpeningStockDocument(tx as never, document);

    expect(tx.itemBatchStock.upsert).toHaveBeenCalledTimes(1);
    expect(tx.itemStockBalance.upsert).toHaveBeenCalledTimes(1);
    expect(tx.itemBatchStock.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      tx.itemStockBalance.upsert.mock.invocationCallOrder[0],
    );

    const batchWrite = tx.itemBatchStock.upsert.mock.calls[0][0];
    expect(batchWrite.create.ibsBatchId).toBe('batch-1');
    expect(batchWrite.create.ibsOpeningQty).toBe(10);
    expect(batchWrite.create.ibsOpeningFreeQty).toBe(2);
    expect(batchWrite.create.ibsAvailableQty).toBe(10);
    expect(batchWrite.create.ibsOpeningValue).toBe(500);

    const summaryWrite = tx.itemStockBalance.upsert.mock.calls[0][0];
    expect(summaryWrite.create.isbTrackingType).toBe('BATCH');
    expect(summaryWrite.create.isbOpeningQty).toBe(10);
    expect(summaryWrite.create.isbOpeningFreeQty).toBe(2);
    expect(summaryWrite.create.isbAvailableQty).toBe(10);
    expect(summaryWrite.create.isbOpeningValue).toBe(500);
    expect(summaryWrite.create.isbOpeningValueWot).toBe(400);
    expect(summaryWrite.create.isbStockValueWot).toBe(400);
  });

  it('stores mrp-tracked opening stock in batch tables and auto-generates batch no when the payload omits it', async () => {
    const tx = createTx({
      initialBatchRows: [
        makeBatchRow({
          ibsBatchId: 'saved-batch-1',
          ibsBatchNo: 'B-001',
        }),
        makeBatchRow({
          ibsBatchId: 'saved-batch-2',
          ibsBatchNo: 'B-002',
        }),
      ],
      initialBatchMasters: [
        {
          btmId: 'saved-batch-1',
          btmCompanyId: 'company-1',
          btmItemId: 'item-1',
          btmBatchNo: 'B-001',
        },
        {
          btmId: 'saved-batch-2',
          btmCompanyId: 'company-1',
          btmItemId: 'item-1',
          btmBatchNo: 'B-002',
        },
      ],
    });
    const document = {
      ...makeDocument(),
      details: [
        makeDetail({
          osl_line_no: 1,
          osl_tracking_type: 'MRP',
          osl_batch_id: null,
          osl_batch_no: null,
          osl_qty: 5,
          osl_free_qty: 1,
          osl_free_base_qty: 2,
          osl_base_qty: 10,
          osl_conv_factor: 2,
          osl_stock_value: 500,
          osl_stock_value_wot: 400,
          osl_cost_rate_wot: 80,
        }),
      ],
    } satisfies OpeningStockDocumentPayload;

    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    await service.syncFromOpeningStockDocument(tx as never, document);

    expect(tx.itemBatchMaster.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          btmBatchNo: 'B-003',
        }),
      }),
    );
    expect(tx.openingStockDetail.update).toHaveBeenCalledWith({
      where: { oslId: 'detail-1' },
      data: expect.objectContaining({
        oslBatchId: 'batch-master-3',
        oslBatchNo: 'B-003',
      }),
    });
    expect(tx.itemBatchStock.upsert).toHaveBeenCalledTimes(1);
    expect(tx.itemStockBalance.upsert).toHaveBeenCalledTimes(1);

    const batchWrite = tx.itemBatchStock.upsert.mock.calls[0][0];
    expect(batchWrite.create.ibsBatchId).toBe('batch-master-3');
    expect(batchWrite.create.ibsOpeningQty).toBe(10);
    expect(batchWrite.create.ibsOpeningFreeQty).toBe(2);

    const summaryWrite = tx.itemStockBalance.upsert.mock.calls[0][0];
    expect(summaryWrite.create.isbTrackingType).toBe('MRP');
    expect(summaryWrite.create.isbOpeningQty).toBe(10);
    expect(summaryWrite.create.isbOpeningFreeQty).toBe(2);

    expect(tx.itemStockLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stlTrackingType: 'MRP',
          stlBatchId: 'batch-master-3',
          stlBatchNo: 'B-003',
        }),
      }),
    );
  });

  it('falls back to legacy WOT opening value when reversing an older batch row during update', async () => {
    const previousDocument = {
      ...makeDocument(),
      details: [
        makeDetail({
          osl_line_no: 1,
          osl_tracking_type: 'BATCH',
          osl_batch_id: 'batch-1',
          osl_batch_no: 'B-1',
          osl_qty: 5,
          osl_free_qty: 1,
          osl_free_base_qty: 2,
          osl_base_qty: 10,
          osl_conv_factor: 2,
          osl_stock_value: 500,
          osl_stock_value_wot: 400,
          osl_cost_rate_wot: 80,
        }),
      ],
    } satisfies OpeningStockDocumentPayload;

    const updatedDocument = {
      ...previousDocument,
      details: [
        makeDetail({
          osl_line_no: 1,
          osl_tracking_type: 'BATCH',
          osl_batch_id: 'batch-1',
          osl_batch_no: 'B-1',
          osl_qty: 5,
          osl_free_qty: 1,
          osl_free_base_qty: 2,
          osl_base_qty: 10,
          osl_conv_factor: 2,
          osl_stock_value: 600,
          osl_stock_value_wot: 480,
          osl_cost_rate: 120,
          osl_cost_rate_wot: 96,
        }),
      ],
    } satisfies OpeningStockDocumentPayload;

    const tx = createTx({
      initialBatchRows: [
        makeBatchRow({
          ibsOpeningQty: 10,
          ibsClosingQty: 10,
          ibsOpeningFreeQty: 2,
          ibsFreeClosingQty: 2,
          ibsAvailableQty: 10,
          ibsOpeningAvgRate: 33.333333,
          ibsAvgStockRate: 33.333333,
          ibsOpeningValue: 400,
          ibsStockValue: 400,
        }),
      ],
    });

    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    await service.syncFromOpeningStockDocument(tx as never, updatedDocument, previousDocument);

    expect(tx.itemBatchStock.upsert).toHaveBeenCalledTimes(2);

    const reverseWrite = tx.itemBatchStock.upsert.mock.calls[0][0];
    expect(reverseWrite.update.ibsOpeningValue).toBe(0);
    expect(reverseWrite.update.ibsStockValue).toBe(0);

    const finalWrite = tx.itemBatchStock.upsert.mock.calls[1][0];
    expect(finalWrite.update.ibsOpeningQty).toBe(10);
    expect(finalWrite.update.ibsOpeningFreeQty).toBe(2);
    expect(finalWrite.update.ibsOpeningValue).toBe(600);
    expect(finalWrite.update.ibsStockValue).toBe(600);

    const reverseSummaryWrite = tx.itemStockBalance.upsert.mock.calls[0][0];
    expect(reverseSummaryWrite.create.isbOpeningValueWot).toBe(0);
    expect(reverseSummaryWrite.create.isbStockValueWot).toBe(0);

    const finalSummaryWrite = tx.itemStockBalance.upsert.mock.calls[1][0];
    expect(finalSummaryWrite.create.isbOpeningValueWot).toBe(480);
    expect(finalSummaryWrite.create.isbStockValueWot).toBe(480);
  });

  it('resolves or creates batch id from batch number when batch id is not sent', async () => {
    const tx = createTx();
    const document = {
      ...makeDocument(),
      details: [
        makeDetail({
          osl_line_no: 1,
          osl_tracking_type: 'BATCH',
          osl_batch_id: null,
          osl_batch_no: 'B-NEW',
          osl_qty: 5,
          osl_free_qty: 1,
          osl_free_base_qty: 2,
          osl_base_qty: 10,
          osl_conv_factor: 2,
          osl_stock_value_wot: 400,
          osl_cost_rate_wot: 80,
          osl_mrp_rate: 1000,
        }),
      ],
    } satisfies OpeningStockDocumentPayload;

    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    await service.syncFromOpeningStockDocument(tx as never, document);

    expect(tx.itemBatchMaster.create).toHaveBeenCalledTimes(1);
    expect(tx.itemBatchMaster.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          btmStatus: 'ACTIVE',
        }),
      }),
    );
    expect(tx.openingStockDetail.update).toHaveBeenCalledWith({
      where: { oslId: 'detail-1' },
      data: expect.objectContaining({
        oslBatchId: 'batch-master-1',
        oslBatchNo: 'B-NEW',
      }),
    });
    expect(tx.itemStockLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stlBatchId: 'batch-master-1',
          stlBatchNo: 'B-NEW',
        }),
      }),
    );
    expect(tx.itemBatchStock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          ibsBatchId: 'batch-master-1',
        }),
      }),
    );
  });

  it('reuses the saved scoped batch id when the batch number already exists in item batch stock', async () => {
    const tx = createTx({
      initialBatchRows: [
        makeBatchRow({
          ibsBatchId: 'saved-batch-1',
          ibsBatchNo: 'B-007',
        }),
      ],
    });
    const document = {
      ...makeDocument(),
      details: [
        makeDetail({
          osl_line_no: 1,
          osl_tracking_type: 'BATCH',
          osl_batch_id: null,
          osl_batch_no: '  b-007  ',
          osl_qty: 5,
          osl_free_qty: 1,
          osl_free_base_qty: 2,
          osl_base_qty: 10,
          osl_conv_factor: 2,
          osl_stock_value_wot: 400,
          osl_cost_rate_wot: 80,
        }),
      ],
    } satisfies OpeningStockDocumentPayload;

    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    await service.syncFromOpeningStockDocument(tx as never, document);

    expect(tx.itemBatchMaster.create).not.toHaveBeenCalled();
    expect(tx.openingStockDetail.update).toHaveBeenCalledWith({
      where: { oslId: 'detail-1' },
      data: expect.objectContaining({
        oslBatchId: 'saved-batch-1',
        oslBatchNo: 'B-007',
      }),
    });
    expect(tx.itemStockLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stlBatchId: 'saved-batch-1',
          stlBatchNo: 'B-007',
        }),
      }),
    );
  });

  it('auto-generates the next batch number from saved batch numbers when the payload does not send one', async () => {
    const tx = createTx({
      initialBatchRows: [
        makeBatchRow({
          ibsBatchId: 'saved-batch-1',
          ibsBatchNo: 'B-001',
        }),
        makeBatchRow({
          ibsBatchId: 'saved-batch-2',
          ibsBatchNo: 'B-002',
        }),
      ],
      initialBatchMasters: [
        {
          btmId: 'saved-batch-1',
          btmCompanyId: 'company-1',
          btmItemId: 'item-1',
          btmBatchNo: 'B-001',
        },
        {
          btmId: 'saved-batch-2',
          btmCompanyId: 'company-1',
          btmItemId: 'item-1',
          btmBatchNo: 'B-002',
        },
      ],
    });
    const document = {
      ...makeDocument(),
      details: [
        makeDetail({
          osl_line_no: 1,
          osl_tracking_type: 'BATCH',
          osl_batch_id: null,
          osl_batch_no: null,
          osl_qty: 5,
          osl_free_qty: 1,
          osl_free_base_qty: 2,
          osl_base_qty: 10,
          osl_conv_factor: 2,
          osl_stock_value_wot: 400,
          osl_cost_rate_wot: 80,
        }),
      ],
    } satisfies OpeningStockDocumentPayload;

    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    await service.syncFromOpeningStockDocument(tx as never, document);

    expect(tx.itemBatchMaster.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          btmBatchNo: 'B-003',
        }),
      }),
    );
    expect(tx.openingStockDetail.update).toHaveBeenCalledWith({
      where: { oslId: 'detail-1' },
      data: expect.objectContaining({
        oslBatchId: 'batch-master-3',
        oslBatchNo: 'B-003',
      }),
    });
    expect(tx.itemStockLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stlBatchId: 'batch-master-3',
          stlBatchNo: 'B-003',
        }),
      }),
    );
  });

  it('rejects a scoped duplicate batch number when a different batch id is sent', async () => {
    const tx = createTx({
      initialBatchRows: [
        makeBatchRow({
          ibsBatchId: 'saved-batch-1',
          ibsBatchNo: 'B-007',
        }),
      ],
    });
    const document = {
      ...makeDocument(),
      details: [
        makeDetail({
          osl_line_no: 1,
          osl_tracking_type: 'BATCH',
          osl_batch_id: 'another-batch-id',
          osl_batch_no: 'B-007',
          osl_qty: 5,
          osl_free_qty: 1,
          osl_free_base_qty: 2,
          osl_base_qty: 10,
          osl_conv_factor: 2,
          osl_stock_value_wot: 400,
          osl_cost_rate_wot: 80,
        }),
      ],
    } satisfies OpeningStockDocumentPayload;

    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    await expect(service.syncFromOpeningStockDocument(tx as never, document)).rejects.toThrow(
      'Batch no "B-007" already exists for the selected company, branch, godown, item, and unit',
    );
    expect(tx.itemBatchMaster.create).not.toHaveBeenCalled();
    expect(tx.openingStockDetail.update).not.toHaveBeenCalled();
  });

  it('rejects unsupported batch status values before batch master insert', () => {
    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    expect(() => (service as any).normalizeBatchStatus('archived', 'btmStatus')).toThrow(
      'btmStatus must be one of: ACTIVE, CLOSED, BLOCKED',
    );
  });

  it('rejects unsupported stock bucket values before balance writes', async () => {
    const tx = createTx();
    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    await expect(
      (service as any).applyStockMovements(
        tx,
        [
          {
            accYear: '2025-2026',
            companyId: 'company-1',
            branchId: 'branch-1',
            godownId: 'godown-1',
            itemId: 'item-1',
            unitId: 'base-unit-1',
            trackingType: 'NONE',
            stockBucket: 'damaged-stock',
            movementType: 'OPENING',
            qty: 1,
            freeQty: 0,
            inwardValue: 100,
            inwardValueWot: 80,
            txnDate: new Date('2026-04-15T10:00:00.000Z'),
          },
        ],
        'user-1',
        new Date('2026-04-15T10:00:00.000Z'),
      ),
    ).rejects.toThrow(
      'movement.stockBucket must be one of: SALEABLE, DAMAGED, EXPIRED, HOLD, RETURN',
    );
    expect(tx.itemStockBalance.upsert).not.toHaveBeenCalled();
    expect(tx.itemBatchStock.upsert).not.toHaveBeenCalled();
  });

  it('rejects negative batch stock mrp before batch writes', async () => {
    const tx = createTx();
    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    await expect(
      (service as any).applyStockMovements(
        tx,
        [
          {
            accYear: '2025-2026',
            companyId: 'company-1',
            branchId: 'branch-1',
            godownId: 'godown-1',
            itemId: 'item-1',
            unitId: 'base-unit-1',
            trackingType: 'BATCH',
            stockBucket: 'SALEABLE',
            movementType: 'OPENING',
            qty: 1,
            freeQty: 0,
            inwardValue: 100,
            inwardValueWot: 80,
            txnDate: new Date('2026-04-15T10:00:00.000Z'),
            batchId: 'batch-1',
            batchNo: 'B-1',
            mrp: -1,
          },
        ],
        'user-1',
        new Date('2026-04-15T10:00:00.000Z'),
      ),
    ).rejects.toThrow('itemBatchStock.ibsMrp must be greater than or equal to 0');
    expect(tx.itemBatchStock.upsert).not.toHaveBeenCalled();
  });

  it('rejects invalid batch stock dates before batch writes', async () => {
    const tx = createTx();
    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    await expect(
      (service as any).applyStockMovements(
        tx,
        [
          {
            accYear: '2025-2026',
            companyId: 'company-1',
            branchId: 'branch-1',
            godownId: 'godown-1',
            itemId: 'item-1',
            unitId: 'base-unit-1',
            trackingType: 'BATCH',
            stockBucket: 'SALEABLE',
            movementType: 'OPENING',
            qty: 1,
            freeQty: 0,
            inwardValue: 100,
            inwardValueWot: 80,
            txnDate: new Date('2026-04-15T10:00:00.000Z'),
            batchId: 'batch-1',
            batchNo: 'B-1',
            mfgDate: new Date('2026-05-01T00:00:00.000Z'),
            expiryDate: new Date('2026-04-01T00:00:00.000Z'),
          },
        ],
        'user-1',
        new Date('2026-04-15T10:00:00.000Z'),
      ),
    ).rejects.toThrow(
      'itemBatchStock.ibsExpiryDate must be greater than or equal to itemBatchStock.ibsMfgDate',
    );
    expect(tx.itemBatchStock.upsert).not.toHaveBeenCalled();
  });

  it('rejects invalid batch stock quantity formulas before batch writes', () => {
    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    expect(() =>
      (service as any).assertValidBatchStockWrite(
        {
          accYear: '2025-2026',
          companyId: 'company-1',
          branchId: 'branch-1',
          godownId: 'godown-1',
          itemId: 'item-1',
          unitId: 'base-unit-1',
          trackingType: 'BATCH',
          stockBucket: 'SALEABLE',
          movementType: 'OPENING',
          qty: 1,
          freeQty: 0,
          inwardValue: 100,
          inwardValueWot: 80,
          txnDate: new Date('2026-04-15T10:00:00.000Z'),
          batchId: 'batch-1',
        },
        {
          openingQty: 10,
          inQty: 1,
          outQty: 2,
          closingQty: 20,
          openingFreeQty: 0,
          freeInQty: 0,
          freeOutQty: 0,
          freeClosingQty: 0,
          reservedQty: 0,
          transitQty: 0,
          availableQty: 20,
          openingAvgRate: 10,
          avgStockRate: 10,
          openingValue: 100,
          stockValue: 100,
          openingAvgRateWot: 0,
          avgStockRateWot: 0,
          openingValueWot: 0,
          stockValueWot: 0,
          lastInDate: null,
          lastOutDate: null,
        },
      ),
    ).toThrow('itemBatchStock.ibsClosingQty must equal ibsOpeningQty + ibsInQty - ibsOutQty');
  });

  it('reverses stock balances and recreates ledger rows as deleted when opening stock is deleted', async () => {
    const previousDocument = makeDocument();
    const deletedDocument: OpeningStockDocumentPayload = {
      header: {
        ...makeHeader(),
        osh_status: 'CANCELLED',
        osh_is_active: false,
        osh_is_deleted: true,
        osh_updated_on: '2026-04-16T08:00:00.000Z',
        osh_updated_by: 'user-1',
      },
      details: previousDocument.details.map((detail) => ({
        ...detail,
        osl_is_active: false,
        osl_is_deleted: true,
        osl_updated_on: '2026-04-16T08:00:00.000Z',
        osl_updated_by: 'user-1',
      })),
    };
    const tx = createTx({
      initialBalanceRows: [makeBalanceRow()],
    });

    const service = new ItemStockLedgerService(
      {} as never,
      { getUserId: jest.fn().mockReturnValue('user-1') } as never,
    );

    await service.syncFromOpeningStockDocument(tx as never, deletedDocument, previousDocument);

    expect(tx.itemStockLedger.deleteMany).toHaveBeenCalledWith({
      where: {
        stlVoucherId: 'voucher-1',
      },
    });
    expect(tx.itemStockLedger.create).toHaveBeenCalledTimes(2);
    expect(tx.itemStockLedger.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          stlIsActive: false,
          stlIsDeleted: true,
        }),
      }),
    );

    const summaryWrite = tx.itemStockBalance.upsert.mock.calls.at(-1)?.[0];
    expect(summaryWrite.update.isbOpeningQty).toBe(0);
    expect(summaryWrite.update.isbClosingQty).toBe(0);
    expect(summaryWrite.update.isbOpeningFreeQty).toBe(0);
    expect(summaryWrite.update.isbFreeClosingQty).toBe(0);
    expect(summaryWrite.update.isbAvailableQty).toBe(0);
    expect(summaryWrite.update.isbOpeningValue).toBe(0);
    expect(summaryWrite.update.isbStockValue).toBe(0);
    expect(summaryWrite.update.isbOpeningValueWot).toBe(0);
    expect(summaryWrite.update.isbStockValueWot).toBe(0);
  });
});
