import { ConflictException, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { StockVoucherSource } from '../../stocks/posting/stock-voucher.source';
import { nextStockVoucherSlno } from '../../stocks/stock-voucher/stock-voucher-numbering.helper';
import { TxnStatusDocType } from '../../../common/txn-status-log/txn-status-log.helper';
import { SalesStockService, type SalesStockDoc, type SalesStockLine } from './sales-stock.service';
import { SALES_ERROR_CODES } from './types/posting.types';

jest.mock('../../stocks/stock-voucher/stock-voucher-numbering.helper', () => ({
  nextStockVoucherSlno: jest.fn(),
}));

const nextSlno = nextStockVoucherSlno as jest.Mock;

const DOC_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b002';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b003';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46b004';
const COUNTER_DEVICE = '019c6f6c-be87-7a11-8905-36092c46b005';
const GODOWN = '019c6f6c-be87-7a11-8905-36092c46b006';
const ITEM = '019c6f6c-be87-7a11-8905-36092c46b007';
const BOX_IUC = '019c6f6c-be87-7a11-8905-36092c46b008';
const PCS_IUC = '019c6f6c-be87-7a11-8905-36092c46b009';
const SVH_ID = '019c6f6c-be87-7a11-8905-36092c46b010';
const LOT_ID = '019c6f6c-be87-7a11-8905-36092c46b011';
const ACTOR = '019c6f6c-be87-7a11-8905-36092c46b099';
const NIL = '00000000-0000-0000-0000-000000000000';
const POSTED_ON = new Date('2026-10-19T07:00:00.000Z');

const line = (overrides: Partial<SalesStockLine> = {}): SalesStockLine => ({
  lineId: 'line-1',
  lineNo: 1,
  itemId: ITEM,
  itemUnitId: BOX_IUC,
  godownId: GODOWN,
  qty: 2,
  ...overrides,
});

const doc = (overrides: Partial<SalesStockDoc> = {}): SalesStockDoc => ({
  docType: 'SALE_BILL',
  docId: DOC_ID,
  accYear: '2026-2027',
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  deviceId: DEVICE_ID,
  docDate: '2026-10-19',
  docDatetime: new Date('2026-10-19T06:55:00.000Z'),
  refno: 'bil00042',
  revision: 1,
  direction: 'OUT',
  txnType: 'SALE',
  lines: [line()],
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

type Answers = {
  units?: unknown[];
  devices?: unknown[];
  moved?: { qty: Prisma.Decimal | null; rows: bigint };
  costs?: unknown[];
  shadows?: unknown[];
};

/** A `$queryRaw` that answers each of the service's statements by a needle in its SQL. */
function routedTx(answers: Answers) {
  const queryRaw = jest.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (sql.includes('inventory.item_unit_conversion')) {
      return (
        answers.units ?? [
          {
            iuc_id: BOX_IUC,
            iuc_unit_id: 'box',
            iuc_base_unit_id: 'pcs',
            iuc_to_base_factor: new Prisma.Decimal(12),
            base_iuc_id: PCS_IUC,
          },
        ]
      );
    }
    if (sql.includes('fixed.device_master')) return answers.devices ?? [{ dev_id: DEVICE_ID }];
    if (sql.includes('INSERT INTO stock.stock_voucher (')) return [{ svh_id: SVH_ID }];
    if (sql.includes('SUM(sml_qty + sml_free_qty)')) {
      return [answers.moved ?? { qty: new Prisma.Decimal(2), rows: 1n }];
    }
    if (sql.includes('GROUP BY svi.svi_line_no')) {
      return answers.costs ?? [{ svi_line_no: 1, svi_lot_id: LOT_ID, cost: new Prisma.Decimal('160.004') }];
    }
    if (sql.includes("svh_link_src_module   = 'SALES'")) return answers.shadows ?? [];
    throw new Error(`unrouted SQL: ${sql.slice(0, 80)}`);
  });
  return { $queryRaw: queryRaw, $executeRaw: jest.fn().mockResolvedValue(1) };
}

/** The bound values of the first statement whose SQL contains `needle`. */
function boundValuesOf(mock: jest.Mock, needle: string): unknown[] {
  const call = mock.mock.calls.find(([strings]) =>
    (strings as TemplateStringsArray).join('?').includes(needle),
  ) as [TemplateStringsArray, ...unknown[]] | undefined;
  if (!call) throw new Error(`no statement containing ${needle}`);
  const [strings, ...values] = call;
  return Prisma.sql(strings, ...values).values;
}

describe('SalesStockService — post / cancel', () => {
  let stockPosting: { post: jest.Mock; cancel: jest.Mock };
  let requestContext: { getDeviceId: jest.Mock };
  let service: SalesStockService;

  beforeEach(() => {
    nextSlno.mockReset().mockResolvedValue(41n);
    stockPosting = {
      post: jest.fn().mockResolvedValue({ rowsPosted: 1 }),
      cancel: jest.fn().mockResolvedValue(1),
    };
    requestContext = { getDeviceId: jest.fn().mockReturnValue(null) };
    service = new SalesStockService(
      {} as PrismaService,
      stockPosting as never,
      requestContext as never,
    );
  });

  const post = (tx: ReturnType<typeof routedTx>, d: SalesStockDoc = doc(), actor = ACTOR) =>
    service.post(tx as unknown as Prisma.TransactionClient, d, actor, POSTED_ON);

  describe('post', () => {
    it('moves nothing, and reads nothing, for a document with only services or zero lines', async () => {
      const tx = routedTx({});

      await expect(
        post(
          tx,
          doc({
            lines: [line({ isService: true }), line({ qty: 0, freeQty: 0 }), line({ qty: 0.00004 })],
          }),
        ),
      ).resolves.toEqual({
        svhId: null,
        rowsPosted: 0,
        costByLine: new Map(),
        lotByLine: new Map(),
        cogsTotal: 0,
      });
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(stockPosting.post).not.toHaveBeenCalled();
    });

    it('writes a DRAFT shadow voucher linked to the bill and posts it under the bill’s labels', async () => {
      const tx = routedTx({});

      const result = await post(tx);

      expect(nextSlno).toHaveBeenCalledWith(tx, {
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: '2026-2027',
        voucherType: 'ISSUE',
        deviceId: DEVICE_ID,
      });
      const header = boundValuesOf(tx.$queryRaw, 'INSERT INTO stock.stock_voucher (');
      expect(header).toEqual(
        expect.arrayContaining([
          DEVICE_ID,
          'ISSUE',
          41n,
          'SALE_BILL/bil00042/r1',
          'bil00042',
          'Sale bill bil00042',
        ]),
      );
      // An issue leaves its godown; nothing is received.
      expect(header).toContain(GODOWN);
      expect(header).toContain(ACTOR);

      const [source, options] = stockPosting.post.mock.calls[0].slice(1) as [
        StockVoucherSource,
        Record<string, unknown>,
      ];
      expect(source).toBeInstanceOf(StockVoucherSource);
      expect(source.svhId).toBe(SVH_ID);
      expect(source.rules).toMatchObject({
        voucherType: 'ISSUE',
        typeCode: 'SALE_BILL',
        isInward: false,
        requiresFromGodown: true,
        requiresToGodown: false,
        ledgerTxnTypes: ['SALE'],
        postShape: 'SIMPLE',
        statusDocType: TxnStatusDocType.SALE_BILL,
      });
      expect(options).toEqual({
        actor: ACTOR,
        postedOn: POSTED_ON,
        ledgerSource: {
          srcModule: 'SALES',
          srcDocType: 'SALE_BILL',
          srcRefno: 'bil00042',
          partyId: null,
        },
      });
      expect(result).toEqual({
        svhId: SVH_ID,
        rowsPosted: 1,
        costByLine: new Map([['line-1', 160]]),
        lotByLine: new Map([['line-1', LOT_ID]]),
        cogsTotal: 160,
      });
    });

    it('receives into the godown for an inward document', async () => {
      const tx = routedTx({});

      await post(tx, doc({ docType: 'SALE_RETURN', direction: 'IN', txnType: 'SALE_RETURN', revision: 3 }));

      expect(nextSlno.mock.calls[0][1].voucherType).toBe('RECEIPT');
      const header = boundValuesOf(tx.$queryRaw, 'INSERT INTO stock.stock_voucher (');
      expect(header).toContain('SALE_RETURN/bil00042/r3');
      expect(stockPosting.post.mock.calls[0][1].rules).toMatchObject({
        voucherType: 'RECEIPT',
        isInward: true,
        requiresToGodown: true,
        requiresFromGodown: false,
        ledgerTxnTypes: ['SALE_RETURN'],
      });
    });

    it('stamps no creator for the nil actor', async () => {
      const tx = routedTx({});

      await post(tx, doc(), NIL);

      expect(boundValuesOf(tx.$queryRaw, 'INSERT INTO stock.stock_voucher (')).not.toContain(NIL);
      expect(boundValuesOf(tx.$executeRaw, 'INSERT INTO stock.stock_voucher_item')).not.toContain(
        NIL,
      );
    });

    it('writes each line in base units at the conversion factor, the quoted cost net of tax', async () => {
      const tx = routedTx({ moved: { qty: new Prisma.Decimal(3), rows: 1n } });

      await post(
        tx,
        doc({ lines: [line({ qty: 2, freeQty: 1, costRate: 118, taxPerc: 18, lotId: LOT_ID })] }),
      );

      const values = boundValuesOf(tx.$executeRaw, 'INSERT INTO stock.stock_voucher_item');
      const decimals = values.filter((v) => v instanceof Prisma.Decimal).map(String);
      // qty 2 → 24 base, free 1 → 12 base, wot 118 at 18% → 100.
      expect(decimals).toEqual(['2', '24', '1', '12', '100']);
      expect(values).toEqual(expect.arrayContaining([BOX_IUC, PCS_IUC, 12, LOT_ID, 'SALEABLE', 118, 18]));
    });

    it('takes the line’s own conversion factor over the unit master’s', async () => {
      const tx = routedTx({});

      await post(tx, doc({ lines: [line({ toBaseFactor: 6 })] }));

      const decimals = boundValuesOf(tx.$executeRaw, 'INSERT INTO stock.stock_voucher_item')
        .filter((v) => v instanceof Prisma.Decimal)
        .map(String);
      expect(decimals.slice(0, 2)).toEqual(['2', '12']);
    });

    it('refuses a line whose unit conversion does not exist, before writing anything', async () => {
      const tx = routedTx({ units: [] });

      const refusal = await refusalOf(post(tx));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'items', code: SALES_ERROR_CODES.STOCK_QTY_MISMATCH }] },
      });
      expect(nextSlno).not.toHaveBeenCalled();
      expect(tx.$executeRaw).not.toHaveBeenCalled();
    });

    it('files the shadow under the session’s counter when the document’s device is not registered', async () => {
      requestContext.getDeviceId.mockReturnValue(COUNTER_DEVICE);
      const tx = routedTx({ devices: [{ dev_id: COUNTER_DEVICE }] });

      await post(tx, doc({ deviceId: 'TILL-01-HOSTNAME' }));

      expect(boundValuesOf(tx.$queryRaw, 'fixed.device_master')).toEqual([[COUNTER_DEVICE]]);
      expect(nextSlno.mock.calls[0][1].deviceId).toBe(COUNTER_DEVICE);
    });

    it('refuses with SALES_DEVICE_UNREGISTERED when neither device is registered', async () => {
      requestContext.getDeviceId.mockReturnValue(COUNTER_DEVICE);
      const tx = routedTx({ devices: [] });

      const refusal = await refusalOf(post(tx));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'deviceId', code: SALES_ERROR_CODES.DEVICE_UNREGISTERED }] },
      });
      expect(stockPosting.post).not.toHaveBeenCalled();
    });

    it('refuses without a device read when no candidate is a uuid', async () => {
      const tx = routedTx({});

      const refusal = await refusalOf(post(tx, doc({ deviceId: null })));

      expect(refusal.body).toMatchObject({
        errors: [{ code: SALES_ERROR_CODES.DEVICE_UNREGISTERED }],
      });
      const sql = tx.$queryRaw.mock.calls.map(([s]) => (s as TemplateStringsArray).join('?'));
      expect(sql.some((s) => s.includes('fixed.device_master'))).toBe(false);
    });

    it('fails loudly when the ledger moved a different quantity than the lines', async () => {
      const tx = routedTx({ moved: { qty: new Prisma.Decimal('1.9999'), rows: 1n } });

      await expect(post(tx)).rejects.toThrow(SALES_ERROR_CODES.STOCK_QTY_MISMATCH);
    });

    it('demands exact equality, summed in Decimal at the line scale', async () => {
      const tx = routedTx({
        moved: { qty: new Prisma.Decimal('0.3'), rows: 2n },
        costs: [],
      });

      await expect(
        post(
          tx,
          doc({ lines: [line({ qty: 0.1 }), line({ lineId: 'line-2', lineNo: 2, qty: 0.2 })] }),
        ),
      ).resolves.toMatchObject({ svhId: SVH_ID });
    });

    it('turns the engine’s negative-stock 409 into a 422 SALES_STOCK_NEGATIVE', async () => {
      stockPosting.post.mockRejectedValue(
        new ConflictException({
          message: 'blocked',
          errors: [{ message: 'ITEM-1 would go to -2' }, { message: 'ITEM-2 would go to -1' }],
        }),
      );
      const tx = routedTx({});

      const refusal = await refusalOf(post(tx));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          message: 'ITEM-1 would go to -2; ITEM-2 would go to -1',
          errors: [{ field: 'items', code: SALES_ERROR_CODES.STOCK_NEGATIVE }],
        },
      });
    });

    it('lets any other engine failure through unchanged', async () => {
      stockPosting.post.mockRejectedValue(new Error('engine down'));

      await expect(post(routedTx({}))).rejects.toThrow('engine down');
    });

    it('sums each line’s relieved cost to the paisa and ignores rows it did not write', async () => {
      const tx = routedTx({
        moved: { qty: new Prisma.Decimal(5), rows: 2n },
        costs: [
          { svi_line_no: 1, svi_lot_id: null, cost: new Prisma.Decimal('10.005') },
          { svi_line_no: 2, svi_lot_id: LOT_ID, cost: null },
          { svi_line_no: 9, svi_lot_id: null, cost: new Prisma.Decimal(999) },
        ],
      });

      const result = await post(
        tx,
        doc({ lines: [line({ qty: 2 }), line({ lineId: 'line-2', lineNo: 2, qty: 3 })] }),
      );

      expect(result.costByLine).toEqual(
        new Map([
          ['line-1', 10.01],
          ['line-2', 0],
        ]),
      );
      expect(result.lotByLine).toEqual(
        new Map([
          ['line-1', null],
          ['line-2', LOT_ID],
        ]),
      );
      expect(result.cogsTotal).toBe(10.01);
    });
  });

  describe('cancel', () => {
    it('reverses every posted shadow of the document through the engine', async () => {
      const tx = routedTx({ shadows: [{ svh_id: 'svh-a' }, { svh_id: 'svh-b' }] });
      stockPosting.cancel.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
      const on = new Date('2026-10-20T10:00:00.000Z');

      const reversed = await service.cancel(
        tx as unknown as Prisma.TransactionClient,
        doc(),
        ACTOR,
        'Bill cancelled',
        on,
      );

      expect(reversed).toBe(5);
      expect(boundValuesOf(tx.$queryRaw, "svh_link_src_module   = 'SALES'")).toEqual([
        'SALE_BILL',
        DOC_ID,
        '2026-2027',
      ]);
      const [source, options] = stockPosting.cancel.mock.calls[1].slice(1) as [
        StockVoucherSource,
        unknown,
      ];
      expect(source.svhId).toBe('svh-b');
      expect(source.rules.ledgerTxnTypes).toEqual(['SALE']);
      expect(options).toEqual({ actor: ACTOR, reason: 'Bill cancelled', cancelledOn: on });
    });

    it('is a no-op for a document whose shadow never posted', async () => {
      const tx = routedTx({ shadows: [] });

      await expect(
        service.cancel(tx as unknown as Prisma.TransactionClient, doc(), ACTOR, 'x', POSTED_ON),
      ).resolves.toBe(0);
      expect(stockPosting.cancel).not.toHaveBeenCalled();
    });
  });
});
