import { HttpException } from '@nestjs/common';
import { Prisma, SaleOrder } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  TxnStatusEvent,
  appendTxnStatusLog,
} from '../../../common/txn-status-log/txn-status-log.helper';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { SaleOrderDeskService } from './sale-order-desk.service';

jest.mock('../../../common/txn-status-log/txn-status-log.helper', () => ({
  ...jest.requireActual<object>('../../../common/txn-status-log/txn-status-log.helper'),
  appendTxnStatusLog: jest.fn(() => Promise.resolve({})),
}));

const ORDER_ID = '019c6f6c-be87-7a11-8905-36092c46a301';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a302';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46a303';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a304';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46a305';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46a306';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46a321';
const ACC_YEAR = '2026-2027';
const KEYS = {
  soId: ORDER_ID,
  soCompanyId: COMPANY_ID,
  soBranchId: BRANCH_ID,
  soAccYear: ACC_YEAR,
};
const D = (v: string | number) => new Prisma.Decimal(v);

const orderRow = (overrides: Partial<SaleOrder> = {}): SaleOrder =>
  ({
    soId: ORDER_ID,
    soCompanyId: COMPANY_ID,
    soBranchId: BRANCH_ID,
    soTenantId: null,
    soAccYear: ACC_YEAR,
    soOrderRefno: 'SO/1043',
    soStatus: 'CONFIRMED',
    soPriority: 'NORMAL',
    soDeliveryHold: false,
    soDeliveryHoldReason: null,
    soDeliveryHoldBy: null,
    soDeliveryHoldOn: null,
    soDeviceId: DEVICE_ID,
    soSessionId: null,
    soCustId: CUST_ID,
    soRevisionNo: 1,
    ...overrides,
  }) as SaleOrder;

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(
  promise: Promise<unknown>,
): Promise<{ status: number; body: { message: string; errors: Record<string, unknown>[] } }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() as never };
}

describe('SaleOrderDeskService', () => {
  let prisma: {
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    saleOrder: { findFirst: jest.Mock; update: jest.Mock };
    saleOrderItem: { count: jest.Mock };
    $transaction: jest.Mock;
  };
  let ctx: {
    actor: string;
    actorName: string;
    rights: { view: boolean; edit: boolean; cancel: boolean };
  };
  let receiptRights: { view: boolean };
  let orderRights: { view: boolean };
  let salesContext: { resolve: jest.Mock; rights: jest.Mock };
  let reservations: { release: jest.Mock };
  let orders: { cancelOrderOpenLines: jest.Mock };
  let audit: { logEntityChange: jest.Mock };
  let service: SaleOrderDeskService;
  let stored: SaleOrder;

  beforeEach(() => {
    jest.clearAllMocks();
    stored = orderRow();
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ so_id: ORDER_ID }]),
      $executeRaw: jest.fn().mockResolvedValue(0),
      saleOrder: {
        findFirst: jest.fn(async () => stored),
        update: jest.fn(async ({ data }: { data: Partial<SaleOrder> }) => ({ ...stored, ...data })),
      },
      saleOrderItem: { count: jest.fn().mockResolvedValue(2) },
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    ctx = {
      actor: USER_ID,
      actorName: 'ravi',
      rights: { view: true, edit: true, cancel: true },
    };
    receiptRights = { view: true };
    orderRights = { view: true };
    salesContext = {
      resolve: jest.fn(async () => ctx),
      rights: jest.fn(async (menuId: number) => (menuId === 99 ? receiptRights : orderRights)),
    };
    reservations = { release: jest.fn().mockResolvedValue(3) };
    orders = {
      cancelOrderOpenLines: jest.fn().mockResolvedValue({
        soId: ORDER_ID,
        soAccYear: ACC_YEAR,
        soStatus: 'COMPLETED',
        soFulfilStatus: 'COMPLETED',
        cancelledLines: 2,
        cancelledQty: 8,
        soCancelledAmt: 1200.5,
        soPendingAmt: 0,
        lines: [{ soiId: 'l1', soiLineNo: 3, soiCancelledQty: 8, soiLineStatus: 'PARTIAL' }],
      }),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    service = new SaleOrderDeskService(
      prisma as unknown as PrismaService,
      orders as never,
      salesContext as never,
      reservations as never,
      audit as never,
    );
  });

  describe('delivery-hold', () => {
    const hold = (overrides: Record<string, unknown> = {}) => ({
      ...KEYS,
      soDeliveryHold: true,
      reason: 'Customer asked to deliver after 15th',
      ...overrides,
    });

    it('puts the order on hold: the four columns, a DELIVERY_HOLD step and an audit row, no revision', async () => {
      const result = await service.deliveryHold(hold());

      const update = prisma.saleOrder.update.mock.calls[0][0];
      expect(update.where).toEqual({ soId_soAccYear: { soId: ORDER_ID, soAccYear: ACC_YEAR } });
      expect(update.data).toEqual({
        soDeliveryHold: true,
        soDeliveryHoldReason: 'Customer asked to deliver after 15th',
        soDeliveryHoldBy: USER_ID,
        soDeliveryHoldOn: expect.any(Date),
        soModifiedOn: expect.any(Date),
        soModifiedBy: USER_ID,
      });
      expect(update.data).not.toHaveProperty('soRevisionNo');
      expect(appendTxnStatusLog).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          event: TxnStatusEvent.DELIVERY_HOLD,
          fromStatus: 'CONFIRMED',
          toStatus: 'CONFIRMED',
          remarks: 'Customer asked to deliver after 15th',
          srcDocType: 'SALES_ORDER',
          srcDocId: ORDER_ID,
          changedBy: USER_ID,
        }),
      );
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: 'sale_order',
          screenName: 'Sale Order',
          pk: ORDER_ID,
        }),
        prisma,
      );
      expect(result).toEqual({
        soId: ORDER_ID,
        soAccYear: ACC_YEAR,
        soOrderRefno: 'SO/1043',
        soStatus: 'CONFIRMED',
        soDeliveryHold: true,
        soDeliveryHoldReason: 'Customer asked to deliver after 15th',
        soDeliveryHoldBy: USER_ID,
        soDeliveryHoldByName: 'ravi',
        soDeliveryHoldOn: expect.any(String),
      });
      // The row is locked before it is read (the lifecycle lock() way).
      expect((prisma.$queryRaw.mock.calls[0][0] as string[]).join('?')).toContain('FOR UPDATE');
    });

    it('releases a held order with a DELIVERY_RELEASED step', async () => {
      stored = orderRow({ soDeliveryHold: true, soDeliveryHoldReason: 'Wait' });

      await service.deliveryHold(hold({ soDeliveryHold: false, reason: 'Deliver now' }));

      expect(prisma.saleOrder.update.mock.calls[0][0].data).toMatchObject({
        soDeliveryHold: false,
        soDeliveryHoldReason: 'Deliver now',
      });
      expect(appendTxnStatusLog).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          event: TxnStatusEvent.DELIVERY_RELEASED,
          remarks: 'Deliver now',
        }),
      );
    });

    it.each([undefined, '', '   '])(
      'refuses a blank reason (%p) before opening a transaction',
      async (reason) => {
        const refusal = await refusalOf(service.deliveryHold(hold({ reason })));

        expect(refusal.status).toBe(400);
        expect(refusal.body.errors).toEqual([
          expect.objectContaining({
            code: SALES_ERROR_CODES.ORDER_REASON_REQUIRED,
            field: 'reason',
          }),
        ]);
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it('refuses a user without Edit on the Sales Order menu', async () => {
      ctx.rights.edit = false;

      const refusal = await refusalOf(service.deliveryHold(hold()));

      expect(refusal.status).toBe(403);
      expect(refusal.body.errors[0].code).toBe(SALES_ERROR_CODES.RIGHT_EDIT);
      expect(salesContext.resolve).toHaveBeenCalledWith(
        { companyId: COMPANY_ID, branchId: BRANCH_ID },
        11,
        prisma,
      );
      expect(prisma.saleOrder.update).not.toHaveBeenCalled();
    });

    it('answers 404 for an order not live in this company and branch', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const refusal = await refusalOf(service.deliveryHold(hold()));

      expect(refusal.status).toBe(404);
      expect(refusal.body.errors[0].code).toBe(SALES_ERROR_CODES.NOT_FOUND);
    });

    it.each(['DRAFT', 'COMPLETED', 'CANCELLED', 'CLOSED', 'EXPIRED'])(
      'refuses a %s order with SALES_ORDER_CLOSED',
      async (soStatus) => {
        stored = orderRow({ soStatus });

        const refusal = await refusalOf(service.deliveryHold(hold()));

        expect(refusal.status).toBe(409);
        expect(refusal.body.errors[0]).toMatchObject({
          code: SALES_ERROR_CODES.ORDER_CLOSED,
          status: soStatus,
        });
        expect(prisma.saleOrder.update).not.toHaveBeenCalled();
      },
    );

    it('refuses an order with no line left open', async () => {
      prisma.saleOrderItem.count.mockResolvedValue(0);

      const refusal = await refusalOf(service.deliveryHold(hold()));

      expect(refusal.body.errors[0].code).toBe(SALES_ERROR_CODES.ORDER_CLOSED);
    });

    it('answers HOLD_UNCHANGED, naming who and when, when the order is already held', async () => {
      stored = orderRow({ soDeliveryHold: true, soDeliveryHoldReason: 'After 15th' });
      prisma.$queryRaw
        .mockResolvedValueOnce([{ so_id: ORDER_ID }])
        .mockResolvedValueOnce([{ by_name: 'kumar', on_text: '10-11-2026 11:20 AM' }]);

      const refusal = await refusalOf(service.deliveryHold(hold()));

      expect(refusal.status).toBe(409);
      expect(refusal.body.errors[0]).toMatchObject({
        code: SALES_ERROR_CODES.ORDER_HOLD_UNCHANGED,
        field: 'soDeliveryHold',
        message:
          'Order SO/1043 is already on delivery hold (by kumar on 10-11-2026 11:20 AM: After 15th)',
      });
      expect(prisma.saleOrder.update).not.toHaveBeenCalled();
      expect(appendTxnStatusLog).not.toHaveBeenCalled();
    });
  });

  describe('priority', () => {
    it('marks the order quick with a PRIORITY_CHANGED step, no revision', async () => {
      const result = await service.priority({ ...KEYS, soPriority: 'URGENT' });

      expect(prisma.saleOrder.update.mock.calls[0][0].data).toEqual({
        soPriority: 'URGENT',
        soModifiedOn: expect.any(Date),
        soModifiedBy: USER_ID,
      });
      expect(appendTxnStatusLog).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          event: TxnStatusEvent.PRIORITY_CHANGED,
          fromStatus: 'CONFIRMED',
          toStatus: 'CONFIRMED',
          remarks: 'Quick delivery on: NORMAL → URGENT',
        }),
      );
      expect(result).toEqual({
        soId: ORDER_ID,
        soAccYear: ACC_YEAR,
        soOrderRefno: 'SO/1043',
        soPriority: 'URGENT',
      });
    });

    it('words un-quick as Quick delivery off', async () => {
      stored = orderRow({ soPriority: 'URGENT' });

      await service.priority({ ...KEYS, soPriority: 'NORMAL' });

      expect(appendTxnStatusLog).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ remarks: 'Quick delivery off: URGENT → NORMAL' }),
      );
    });

    it('answers PRIORITY_UNCHANGED when the order already has it', async () => {
      stored = orderRow({ soPriority: 'URGENT' });

      const refusal = await refusalOf(service.priority({ ...KEYS, soPriority: 'URGENT' }));

      expect(refusal.status).toBe(409);
      expect(refusal.body.errors[0].code).toBe(SALES_ERROR_CODES.ORDER_PRIORITY_UNCHANGED);
      expect(prisma.saleOrder.update).not.toHaveBeenCalled();
    });

    it('refuses without Edit, and a closed order', async () => {
      ctx.rights.edit = false;
      expect((await refusalOf(service.priority({ ...KEYS, soPriority: 'URGENT' }))).status).toBe(
        403,
      );

      ctx.rights.edit = true;
      stored = orderRow({ soStatus: 'COMPLETED' });
      const refusal = await refusalOf(service.priority({ ...KEYS, soPriority: 'URGENT' }));
      expect(refusal.body.errors[0].code).toBe(SALES_ERROR_CODES.ORDER_CLOSED);
    });
  });

  it('gives the hold, priority and close transactions 30 s / 10 s (review 2026-11-11)', async () => {
    stored = orderRow({ soStatus: 'CONFIRMED' });
    await service.closeOpenLines({ ...KEYS, reason: 'Rest not needed' });

    expect(prisma.$transaction.mock.calls[0][1]).toEqual({ timeout: 30_000, maxWait: 10_000 });
  });

  describe('close-open-lines', () => {
    it('releases the reservations, then closes every open line with "Open lines closed:"', async () => {
      stored = orderRow({ soStatus: 'PARTIAL' });

      const result = await service.closeOpenLines({ ...KEYS, reason: 'Rest not needed' });

      expect(reservations.release).toHaveBeenCalledWith(
        prisma,
        { docType: 'SALES_ORDER', docId: ORDER_ID },
        'Open lines closed: Rest not needed',
        USER_ID,
        expect.any(Date),
      );
      expect(orders.cancelOrderOpenLines).toHaveBeenCalledWith(prisma, {
        order: stored,
        srcAccYear: ACC_YEAR,
        targetLineId: null,
        cancelReason: 'Open lines closed: Rest not needed',
        actor: USER_ID,
        now: expect.any(Date),
      });
      expect(reservations.release.mock.invocationCallOrder[0]).toBeLessThan(
        orders.cancelOrderOpenLines.mock.invocationCallOrder[0],
      );
      expect(result).toEqual({
        soId: ORDER_ID,
        soAccYear: ACC_YEAR,
        soStatus: 'COMPLETED',
        soFulfilStatus: 'COMPLETED',
        cancelledLines: 2,
        cancelledQty: 8,
        soCancelledAmt: 1200.5,
        soPendingAmt: 0,
        lines: [{ soiId: 'l1', soiLineNo: 3, soiCancelledQty: 8, soiLineStatus: 'PARTIAL' }],
        releasedReservations: 3,
      });
    });

    it('leaves the amounts out without Receipt (menu 99) View', async () => {
      receiptRights.view = false;

      const result = await service.closeOpenLines({ ...KEYS, reason: 'Rest not needed' });

      expect(result).not.toHaveProperty('soCancelledAmt');
      expect(result).not.toHaveProperty('soPendingAmt');
      expect(result.cancelledLines).toBe(2);
    });

    it('refuses without Cancel, before releasing anything', async () => {
      ctx.rights.cancel = false;

      const refusal = await refusalOf(service.closeOpenLines({ ...KEYS, reason: 'x' }));

      expect(refusal.status).toBe(403);
      expect(refusal.body.errors[0].code).toBe(SALES_ERROR_CODES.RIGHT_CANCEL);
      expect(reservations.release).not.toHaveBeenCalled();
    });

    it('refuses a finished order and a blank reason', async () => {
      stored = orderRow({ soStatus: 'CLOSED' });
      const closed = await refusalOf(service.closeOpenLines({ ...KEYS, reason: 'x' }));
      expect(closed.body.errors[0]).toMatchObject({
        code: SALES_ERROR_CODES.ORDER_CLOSED,
        status: 'CLOSED',
      });
      expect(orders.cancelOrderOpenLines).not.toHaveBeenCalled();

      const blank = await refusalOf(service.closeOpenLines({ ...KEYS, reason: ' ' }));
      expect(blank.body.errors[0].code).toBe(SALES_ERROR_CODES.ORDER_REASON_REQUIRED);
    });

    it('clips the reason to the 250 the columns hold', async () => {
      await service.closeOpenLines({ ...KEYS, reason: 'r'.repeat(250) });

      expect(reservations.release.mock.calls[0][2]).toHaveLength(250);
    });
  });

  describe('stock-cover', () => {
    const body = {
      soCompanyId: COMPANY_ID,
      soBranchId: BRANCH_ID,
      orders: [
        { soId: ORDER_ID, soAccYear: ACC_YEAR },
        { soId: CUST_ID, soAccYear: ACC_YEAR },
      ],
      itemId: null,
    };

    it('covers each item with free stock plus the orders own reservations', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ so_id: ORDER_ID }]).mockResolvedValueOnce([
        {
          item_id: ITEM_ID,
          item_name: 'Rice 25kg',
          pending_base: D('120'),
          order_kg: D('600'),
          free_base: D('90'),
          own_base: D('10'),
        },
        {
          item_id: CUST_ID,
          item_name: 'Oil',
          pending_base: D('10'),
          order_kg: D('10'),
          free_base: D('-4'),
          own_base: D('0'),
        },
      ]);

      const result = await service.stockCover(body);

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(result).toEqual({
        orderKg: 610,
        coverKg: 500,
        shortKg: 110,
        coverPerc: 82,
        items: [
          {
            itemId: ITEM_ID,
            itemName: 'Rice 25kg',
            pendingBaseQty: 120,
            freeBaseQty: 100,
            coverBaseQty: 100,
            orderKg: 600,
            coverKg: 500,
          },
          {
            itemId: CUST_ID,
            itemName: 'Oil',
            pendingBaseQty: 10,
            freeBaseQty: -4,
            coverBaseQty: 0,
            orderKg: 10,
            coverKg: 0,
          },
        ],
        missing: [CUST_ID],
      });
    });

    it('refuses without Sales Order View', async () => {
      orderRights.view = false;

      const refusal = await refusalOf(service.stockCover(body));

      expect(refusal.status).toBe(403);
      expect(refusal.body.errors[0].code).toBe(SALES_ERROR_CODES.RIGHT_VIEW);
      expect(salesContext.rights).toHaveBeenCalledWith(11);
    });
  });

  describe('figures', () => {
    const body = {
      soCompanyId: COMPANY_ID,
      soBranchId: BRANCH_ID,
      itemId: null,
      orders: [{ soId: ORDER_ID, soAccYear: ACC_YEAR }],
      custIds: [USER_ID],
    };

    it('answers the values, the dues of the orders customers and the extra ones, and the list value', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([
          {
            so_id: ORDER_ID,
            so_acc_year: ACC_YEAR,
            so_cust_id: CUST_ID,
            so_order_amt: D('54860.00'),
            open_value: D('48620.00'),
            order_open_value: D('50000.00'),
          },
        ])
        .mockResolvedValueOnce([
          {
            cus_id: CUST_ID,
            cus_credit_amt_limit: D('50000'),
            pending: D('48250'),
            open_bills: 6n,
            overdue: D('12400'),
            overdue_bills: 2n,
          },
          {
            cus_id: USER_ID,
            cus_credit_amt_limit: D('0'),
            pending: null,
            open_bills: null,
            overdue: null,
            overdue_bills: null,
          },
        ]);

      const result = await service.figures(body);

      // The dues read asks for the order's customer and the extra one.
      expect(prisma.$queryRaw.mock.calls[1].slice(1)).toEqual([COMPANY_ID, [CUST_ID, USER_ID]]);
      expect(result).toEqual({
        orders: [
          {
            soId: ORDER_ID,
            soAccYear: ACC_YEAR,
            openValue: 48620,
            orderOpenValue: 50000,
            orderAmt: 54860,
          },
        ],
        customers: [
          {
            custId: CUST_ID,
            pending: 48250,
            openBills: 6,
            overdue: 12400,
            overdueBills: 2,
            creditAmtLimit: 50000,
            availCredit: 1750,
          },
          {
            custId: USER_ID,
            pending: 0,
            openBills: 0,
            overdue: 0,
            overdueBills: 0,
            creditAmtLimit: 0,
            availCredit: null,
          },
        ],
        listValue: 48620,
      });
    });

    it('refuses without Receipt (menu 99) View: SALES_ORDER_MONEY_RIGHT', async () => {
      receiptRights.view = false;

      const refusal = await refusalOf(service.figures(body));

      expect(refusal.status).toBe(403);
      expect(refusal.body.errors[0].code).toBe(SALES_ERROR_CODES.ORDER_MONEY_RIGHT);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('refuses without Sales Order View first', async () => {
      orderRights.view = false;

      const refusal = await refusalOf(service.figures(body));

      expect(refusal.body.errors[0].code).toBe(SALES_ERROR_CODES.RIGHT_VIEW);
    });
  });
});
