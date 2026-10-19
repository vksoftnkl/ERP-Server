import { HttpException } from '@nestjs/common';
import { Prisma, SaleOrder, SaleOrderItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  TxnStatusEvent,
  appendTxnStatusLog,
} from '../../../common/txn-status-log/txn-status-log.helper';
import { SaleOrderService } from './sale-order.service';
import { SaveSaleOrderDto } from './dto/save-sale-order.dto';
import { SaleOrderLineRef } from './types/sale-order-api.types';
import { SaleOrderErrorCode } from './types/sale-order-error-codes';

// The trail resolves its device against fixed.device_master, which this mock
// does not carry; it has its own tests.
jest.mock('../../../common/txn-status-log/txn-status-log.helper', () => ({
  ...jest.requireActual<object>('../../../common/txn-status-log/txn-status-log.helper'),
  appendTxnStatusLog: jest.fn(() => Promise.resolve({})),
}));

/**
 * The paths sale-order.service.spec.ts does not reach: the fulfilment recompute
 * the sale bill runs inside its own transaction, the bill-driven cancel of the
 * orders it was raised against, and the refusal wording of the save guards.
 */

const ORDER_ID = '019c6f6c-be87-7a11-8905-36092c46a501';
const OTHER_ORDER_ID = '019c6f6c-be87-7a11-8905-36092c46a502';
const LINE_1 = '019c6f6c-be87-7a11-8905-36092c46a511';
const LINE_2 = '019c6f6c-be87-7a11-8905-36092c46a512';
const UNKNOWN_ID = '019c6f6c-be87-7a11-8905-36092c46a5ff';
const ACC_YEAR = '2026-2027';
const ACTOR = 'billing-user';
const NOW = new Date('2026-10-19T06:00:00.000Z');
const D = (value: string | number) => new Prisma.Decimal(value);

const LINE_FIELDS = { docId: 'sbiSrcDocId', accYear: 'sbiSrcDocYear', lineNo: 'sbiSrcDocLineNo' };
const HEADER_FIELDS = { docId: 'sbSrcDocId', accYear: 'sbSrcDocYear' };

const lineRef = (srcDocId: string, soLineNo: number | null = null): SaleOrderLineRef => ({
  srcDocId,
  srcAccYear: ACC_YEAR,
  soLineNo,
  fields: LINE_FIELDS,
});
const headerRef = (srcDocId = ORDER_ID): SaleOrderLineRef => ({
  srcDocId,
  srcAccYear: ACC_YEAR,
  soLineNo: null,
  fields: HEADER_FIELDS,
});

// Two open lines worth 100 and 50 a unit; the header says exactly that, so a
// recompute that finds nothing new has nothing to write.
const orderRow = (overrides: Partial<SaleOrder> = {}): SaleOrder =>
  ({
    soId: ORDER_ID,
    soAccYear: ACC_YEAR,
    soCompanyId: '019c6f6c-be87-7a11-8905-36092c46a503',
    soBranchId: '019c6f6c-be87-7a11-8905-36092c46a504',
    soTenantId: null,
    soOrderRefno: 'sor00101',
    soStatus: 'CONFIRMED',
    soBilledAmt: D('0.00'),
    soCancelledAmt: D('0.00'),
    soPendingAmt: D('1250.00'),
    soTotItems: 2,
    soDeliveredItems: 0,
    soFulfilStatus: 'PENDING',
    soCompletedOn: null,
    soDeviceId: '019c6f6c-be87-7a11-8905-36092c46a505',
    soSessionId: null,
    ...overrides,
  }) as SaleOrder;

const lineRow = (overrides: Partial<SaleOrderItem> = {}): SaleOrderItem =>
  ({
    soiId: LINE_1,
    soiOrderId: ORDER_ID,
    soiAccYear: ACC_YEAR,
    soiLineNo: 1,
    soiNetQty: D('10'),
    soiDeliveredQty: D('0'),
    soiCancelledQty: D('0'),
    soiPendingQty: D('10'),
    soiBilledAmt: D('0'),
    soiNetAmt: D('1000'),
    ...overrides,
  }) as SaleOrderItem;

const LINES = () => [
  lineRow(),
  lineRow({
    soiId: LINE_2,
    soiLineNo: 2,
    soiNetQty: D('5'),
    soiPendingQty: D('5'),
    soiNetAmt: D('250'),
  }),
];

const billed = (srcDocId: string, lineNo: number | null, qty: string, amt: string) => ({
  sbiSrcDocId: srcDocId,
  sbiSrcDocLineNo: lineNo,
  sbiNetQty: D(qty),
  sbiNetAmt: D(amt),
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

type TxMock = {
  $queryRaw: jest.Mock;
  saleOrder: { findMany: jest.Mock; findFirst: jest.Mock; updateMany: jest.Mock };
  saleOrderItem: { findMany: jest.Mock; update: jest.Mock };
  saleBillItem: { findMany: jest.Mock };
};

describe('SaleOrderService — bill-driven paths', () => {
  let tx: TxMock;
  let audit: { logEntityChange: jest.Mock };
  let service: SaleOrderService;
  let lines: SaleOrderItem[];

  beforeEach(() => {
    jest.clearAllMocks();
    lines = LINES();
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ so_id: ORDER_ID }]),
      saleOrder: {
        // resolveOrderRefs: which of the ids are live orders.
        findMany: jest.fn(({ where }: { where: { soId: { in: string[] } } }) =>
          Promise.resolve(
            where.soId.in.filter((id) => id === ORDER_ID).map((soId) => ({ soId })),
          ),
        ),
        findFirst: jest.fn(() => Promise.resolve(orderRow())),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      saleOrderItem: {
        // Called twice per recompute: once to resolve line ids, once for every line.
        findMany: jest.fn(({ where }: { where: { soiId?: { in: string[] } } }) =>
          Promise.resolve(
            where.soiId
              ? lines
                  .filter((line) => where.soiId!.in.includes(line.soiId))
                  .map(({ soiId, soiOrderId, soiLineNo }) => ({ soiId, soiOrderId, soiLineNo }))
              : lines,
          ),
        ),
        update: jest.fn(({ data }: { data: Record<string, Prisma.Decimal> }) =>
          Promise.resolve({
            ...data,
            soiPendingQty: data.soiNetQty.minus(data.soiDeliveredQty),
            soiLineStatus: 'GENERATED',
          }),
        ),
      },
      saleBillItem: { findMany: jest.fn().mockResolvedValue([]) },
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    service = new SaleOrderService(
      {} as PrismaService,
      audit as never,
      { getUserId: () => ACTOR } as never,
      {} as never,
      {} as never,
    );
  });

  const TX = () => tx as unknown as Prisma.TransactionClient;
  const sync = (refs: SaleOrderLineRef[]) => service.syncOrderFulfilment(TX(), { refs }, ACTOR, NOW);
  const headerWrite = () =>
    (tx.saleOrder.updateMany.mock.calls[0][0] as { data: Record<string, unknown> }).data;

  describe('syncOrderFulfilment', () => {
    it('answers an empty list without reading anything', async () => {
      await expect(sync([])).resolves.toEqual([]);
      expect(tx.saleOrder.findMany).not.toHaveBeenCalled();
    });

    it('refuses with a 400 on the bill field a reference that names no order or line', async () => {
      const refusal = await refusalOf(sync([lineRef(UNKNOWN_ID)]));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'sbiSrcDocId', code: 'SALES_NOT_FOUND' }] },
      });
      expect(JSON.stringify(refusal.body)).toContain(`in accounting year ${ACC_YEAR}`);
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    });

    it('re-sums a part delivery from the posted bills and leaves the order PARTIAL', async () => {
      tx.saleBillItem.findMany.mockResolvedValue([billed(LINE_1, null, '4', '400')]);

      const [result] = await sync([lineRef(LINE_1)]);

      const [, ...lockValues] = tx.$queryRaw.mock.calls[0] as unknown[];
      expect(lockValues).toEqual([ORDER_ID, ACC_YEAR]);
      // Only POSTED, live bills — in any year — that point at the order or its lines.
      expect(tx.saleBillItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sbiSrcDocType: 'SALES_ORDER',
            sbiSrcDocId: { in: [ORDER_ID, LINE_1, LINE_2] },
            sbiSrcDocYear: ACC_YEAR,
            sbiIsDeleted: false,
            bill: { sbStatus: 'POSTED', sbIsDeleted: false },
          },
        }),
      );
      expect(tx.saleOrderItem.update).toHaveBeenCalledTimes(1);
      expect(tx.saleOrderItem.update).toHaveBeenCalledWith({
        where: { soiId_soiAccYear: { soiId: LINE_1, soiAccYear: ACC_YEAR } },
        data: {
          soiNetQty: D('10'),
          soiDeliveredQty: D('4'),
          soiBilledAmt: D('400'),
          soiModifiedOn: NOW,
          soiModifiedBy: ACTOR,
        },
      });
      // 6 pending at 100 + 5 pending at 50.
      expect(headerWrite()).toEqual({
        soBilledAmt: D('400'),
        soCancelledAmt: D('0'),
        soPendingAmt: D('850'),
        soTotItems: 2,
        soDeliveredItems: 0,
        soFulfilStatus: 'PARTIAL',
        soModifiedOn: NOW,
        soModifiedBy: ACTOR,
      });
      // PARTIAL is not a status move: no trail step.
      expect(appendTxnStatusLog).not.toHaveBeenCalled();
      expect(result).toEqual({
        soId: ORDER_ID,
        soAccYear: ACC_YEAR,
        soStatus: 'CONFIRMED',
        soFulfilStatus: 'PARTIAL',
        lines: [
          {
            soiId: LINE_1,
            soiLineNo: 1,
            soiNetQty: 10,
            soiDeliveredQty: 4,
            soiCancelledQty: 0,
            soiPendingQty: 6,
            soiBilledAmt: 400,
            soiLineStatus: 'GENERATED',
          },
        ],
      });
    });

    it('completes an order delivered whole through a header reference, and logs the move', async () => {
      tx.saleBillItem.findMany.mockResolvedValue([
        billed(ORDER_ID, 1, '10', '1000'),
        billed(ORDER_ID, 2, '5', '260'),
      ]);

      const [result] = await sync([headerRef()]);

      expect(tx.saleOrderItem.update).toHaveBeenCalledTimes(2);
      expect(headerWrite()).toMatchObject({
        soBilledAmt: D('1260'),
        soPendingAmt: D('0'),
        soDeliveredItems: 2,
        soFulfilStatus: 'COMPLETED',
        soStatus: 'COMPLETED',
        soCompletedOn: NOW,
      });
      expect(jest.mocked(appendTxnStatusLog).mock.calls[0][1]).toMatchObject({
        event: TxnStatusEvent.CONVERTED,
        fromStatus: 'CONFIRMED',
        toStatus: 'COMPLETED',
        changedBy: ACTOR,
        remarks: 'Order fulfilment recomputed from its sale bills',
      });
      expect(result).toMatchObject({ soStatus: 'COMPLETED', soFulfilStatus: 'COMPLETED' });
    });

    it('keeps the first completion date of an order that was completed before', async () => {
      tx.saleOrder.findFirst.mockResolvedValue(
        orderRow({ soCompletedOn: new Date('2026-10-01T00:00:00.000Z') }),
      );
      tx.saleBillItem.findMany.mockResolvedValue([
        billed(LINE_1, null, '10', '1000'),
        billed(LINE_2, null, '5', '250'),
      ]);

      await sync([lineRef(LINE_1)]);

      expect(headerWrite()).not.toHaveProperty('soCompletedOn');
    });

    it('sums several bill lines drawing on one order line in Decimal', async () => {
      tx.saleBillItem.findMany.mockResolvedValue([
        billed(LINE_1, null, '0.1', '10'),
        billed(LINE_1, null, '0.2', '20'),
      ]);

      await sync([lineRef(LINE_1)]);

      expect(tx.saleOrderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ soiDeliveredQty: D('0.3') }) as object,
        }),
      );
    });

    it('raises the line to what an over-delivering bill took', async () => {
      tx.saleBillItem.findMany.mockResolvedValue([billed(LINE_1, null, '12', '1200')]);

      await sync([lineRef(LINE_1)]);

      expect(tx.saleOrderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            soiNetQty: D('12'),
            soiDeliveredQty: D('12'),
          }) as object,
        }),
      );
      expect(headerWrite()).toMatchObject({ soDeliveredItems: 1, soFulfilStatus: 'PARTIAL' });
    });

    it('hands a line its quantity back when the bill that drew on it is gone', async () => {
      lines = [
        lineRow({
          soiDeliveredQty: D('4'),
          soiPendingQty: D('6'),
          soiBilledAmt: D('400'),
        }),
      ];
      tx.saleOrder.findFirst.mockResolvedValue(
        orderRow({ soBilledAmt: D('400'), soPendingAmt: D('600'), soTotItems: 1 }),
      );

      await sync([lineRef(LINE_1)]);

      expect(tx.saleOrderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ soiDeliveredQty: D('0'), soiBilledAmt: D('0') }) as object,
        }),
      );
      expect(headerWrite()).toMatchObject({
        soBilledAmt: D('0'),
        soPendingAmt: D('1000'),
        soFulfilStatus: 'PENDING',
      });
    });

    it('leaves a cancelled quantity alone and counts a fully settled line', async () => {
      lines = [lineRow({ soiCancelledQty: D('6'), soiPendingQty: D('4') })];
      tx.saleOrder.findFirst.mockResolvedValue(orderRow({ soTotItems: 1 }));
      tx.saleBillItem.findMany.mockResolvedValue([billed(LINE_1, null, '4', '400')]);

      const [result] = await sync([lineRef(LINE_1)]);

      // 4 delivered + 6 written off: settled, and something shipped — COMPLETED.
      expect(headerWrite()).toMatchObject({
        soCancelledAmt: D('600'),
        soPendingAmt: D('0'),
        soDeliveredItems: 1,
        soFulfilStatus: 'COMPLETED',
        soStatus: 'COMPLETED',
      });
      expect(result.lines[0]).toMatchObject({ soiCancelledQty: 6, soiDeliveredQty: 4 });
    });

    it('writes nothing when the bills say what the order already says', async () => {
      // A bill line naming the order but no line draws nothing down.
      tx.saleBillItem.findMany.mockResolvedValue([billed(ORDER_ID, null, '3', '300')]);

      const [result] = await sync([headerRef()]);

      expect(tx.saleOrderItem.update).not.toHaveBeenCalled();
      expect(tx.saleOrder.updateMany).not.toHaveBeenCalled();
      expect(audit.logEntityChange).not.toHaveBeenCalled();
      expect(result).toEqual({
        soId: ORDER_ID,
        soAccYear: ACC_YEAR,
        soStatus: 'CONFIRMED',
        soFulfilStatus: 'PENDING',
        lines: [],
      });
    });

    it('recomputes an order once however many references reach it', async () => {
      tx.saleBillItem.findMany.mockResolvedValue([billed(LINE_1, null, '1', '100')]);

      const results = await sync([lineRef(LINE_1), lineRef(LINE_2), headerRef()]);

      expect(results).toHaveLength(1);
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('refuses a line number the order does not have, on the line-number field', async () => {
      const refusal = await refusalOf(sync([lineRef(ORDER_ID, 9)]));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'sbiSrcDocLineNo',
              code: 'SALES_LINE_NOT_FOUND',
              message: 'Order sor00101 has no active line numbered 9',
            },
          ],
        },
      });
      expect(tx.saleOrderItem.update).not.toHaveBeenCalled();
    });

    it('refuses an order deleted between resolving the reference and the lock', async () => {
      tx.saleOrder.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(sync([headerRef()]));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'sbSrcDocId', code: 'SALES_NOT_FOUND' }] },
      });
    });

    it('answers 404 when the header write finds the order gone', async () => {
      tx.saleBillItem.findMany.mockResolvedValue([billed(LINE_1, null, '4', '400')]);
      tx.saleOrder.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(sync([lineRef(LINE_1)]));

      expect(refusal).toMatchObject({ status: 404, body: { errors: [{ code: 'SALES_NOT_FOUND' }] } });
    });
  });

  describe('cancelOpenLinesForRefs', () => {
    it('answers an empty list without reading anything', async () => {
      await expect(service.cancelOpenLinesForRefs(TX(), [], 'Bill deleted', ACTOR, NOW)).resolves.toEqual(
        [],
      );
      expect(tx.saleOrder.findMany).not.toHaveBeenCalled();
    });

    it('cancels every open line of each order the references reach, once per order', async () => {
      const cancel = jest
        .spyOn(service, 'cancelOrderOpenLines')
        .mockResolvedValue({ cancelledLines: 2 } as never);

      const results = await service.cancelOpenLinesForRefs(
        TX(),
        [lineRef(LINE_1), headerRef()],
        'Bill deleted',
        ACTOR,
        NOW,
      );

      expect(results).toEqual([{ cancelledLines: 2 }]);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(cancel).toHaveBeenCalledWith(TX(), {
        order: expect.objectContaining({ soId: ORDER_ID }) as object,
        srcAccYear: ACC_YEAR,
        // A line reference still cancels the whole order.
        targetLineId: null,
        cancelReason: 'Bill deleted',
        actor: ACTOR,
        now: NOW,
      });
    });

    it('refuses an order deleted after the references were resolved', async () => {
      tx.saleOrder.findFirst.mockResolvedValue(null);
      const cancel = jest.spyOn(service, 'cancelOrderOpenLines');

      const refusal = await refusalOf(
        service.cancelOpenLinesForRefs(TX(), [headerRef()], null, ACTOR, NOW),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'sbSrcDocId', code: 'SALES_NOT_FOUND' }] },
      });
      expect(cancel).not.toHaveBeenCalled();
    });

    it('refuses a reference to some other document', async () => {
      const refusal = await refusalOf(
        service.cancelOpenLinesForRefs(TX(), [headerRef(OTHER_ORDER_ID)], null, ACTOR, NOW),
      );

      expect(refusal.status).toBe(400);
    });
  });

  describe('prepareSave', () => {
    it('answers a required field sent as null with the shared FIELD_REQUIRED code', () => {
      expect(() => service.prepareSave({ soPriority: null } as unknown as SaveSaleOrderDto)).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            errors: [
              expect.objectContaining({ field: 'soPriority', code: 'SALES_FIELD_REQUIRED' }),
            ],
          }) as object,
        }) as Error,
      );
    });

    it('collects every bad value into one refusal', async () => {
      const refusal = await refusalOf(
        Promise.resolve().then(() =>
          service.prepareSave({
            soDocType: 'WHOLESALE',
            soPriority: 'ASAP',
            soAdvancePolicy: null,
          } as unknown as SaveSaleOrderDto),
        ),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          message: 'Invalid order value',
          errors: [
            { field: 'soDocType', code: SaleOrderErrorCode.VALUE_NOT_ALLOWED },
            { field: 'soPriority', code: SaleOrderErrorCode.VALUE_NOT_ALLOWED },
            { field: 'soAdvancePolicy', code: 'SALES_FIELD_REQUIRED' },
          ],
        },
      });
    });

    it('passes a payload that leaves the guarded fields out', () => {
      expect(() =>
        service.prepareSave({ soAdvanceStatus: null } as unknown as SaveSaleOrderDto),
      ).not.toThrow();
    });
  });

  describe('throwIfDuplicate', () => {
    const uniqueError = (code: string, meta: object) =>
      Object.assign(new Error('Unique constraint failed'), { code, meta });

    it('names the line number when the line index refused', async () => {
      const refusal = await refusalOf(
        Promise.resolve().then(() =>
          service.throwIfDuplicate(uniqueError('P2002', { target: 'ux_sale_order_item_line_no' })),
        ),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'Duplicate order line number is not allowed',
          errors: [{ field: 'soiLineNo', code: 'SALES_LINE_NO_DUPLICATE' }],
        },
      });
    });

    it('names the order number for any other unique index, raw or not', async () => {
      for (const error of [
        uniqueError('P2002', { target: ['so_company_id', 'so_order_refno'] }),
        uniqueError('P2010', { code: '23505' }),
      ]) {
        const refusal = await refusalOf(
          Promise.resolve().then(() => service.throwIfDuplicate(error)),
        );
        expect(refusal).toMatchObject({
          status: 409,
          body: { errors: [{ field: 'soOrderRefno', code: SaleOrderErrorCode.ORDER_NO_TAKEN }] },
        });
      }
    });

    it('lets any other error pass untouched', () => {
      expect(() => service.throwIfDuplicate(new Error('deadlock detected'))).not.toThrow();
    });
  });
});
