import { HttpException } from '@nestjs/common';
import { Prisma, SaleOrder, SaleOrderItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  TxnStatusEvent,
  appendTxnStatusLog,
} from '../../../common/txn-status-log/txn-status-log.helper';
import { assertSalesmen, loadDayClosed } from '../posting/sales.guards';
import { SaleOrderLifecycleService } from './sale-order-lifecycle.service';
import { AmendSaleOrderDto } from './dto/sale-order-lifecycle.dto';
import { SaveSaleOrderDto } from './dto/save-sale-order.dto';

// The trail and the posting guards read tables this mock does not carry; they
// have their own tests. What matters here is which ones the lifecycle asks for.
jest.mock('../../../common/txn-status-log/txn-status-log.helper', () => ({
  ...jest.requireActual<object>('../../../common/txn-status-log/txn-status-log.helper'),
  appendTxnStatusLog: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../posting/sales.guards', () => ({
  ...jest.requireActual<object>('../posting/sales.guards'),
  assertAccYearWritable: jest.fn(() => Promise.resolve()),
  assertSalesmen: jest.fn(() => Promise.resolve()),
  loadDayClosed: jest.fn(() => Promise.resolve(false)),
}));

const ORDER_ID = '019c6f6c-be87-7a11-8905-36092c46a301';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a302';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46a303';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a304';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46a305';
const LINE_1 = '019c6f6c-be87-7a11-8905-36092c46a311';
const LINE_2 = '019c6f6c-be87-7a11-8905-36092c46a312';
const ITEM_A = '019c6f6c-be87-7a11-8905-36092c46a321';
const ITEM_B = '019c6f6c-be87-7a11-8905-36092c46a322';
const UNIT = '019c6f6c-be87-7a11-8905-36092c46a323';
const ACC_YEAR = '2026-2027';
const LOGIN_NAME = 'tester1';
// What SaleOrderService.orderAmountsOf answers for the lines /post confirms.
const AMOUNTS = {
  soPendingAmt: new Prisma.Decimal('1250.00'),
  soCancelledAmt: new Prisma.Decimal('0.00'),
  soBilledAmt: new Prisma.Decimal('0.00'),
};
const KEYS = {
  soId: ORDER_ID,
  soCompanyId: COMPANY_ID,
  soBranchId: BRANCH_ID,
  soAccYear: ACC_YEAR,
};

const orderRow = (overrides: Partial<SaleOrder> = {}): SaleOrder =>
  ({
    soId: ORDER_ID,
    soCompanyId: COMPANY_ID,
    soBranchId: BRANCH_ID,
    soTenantId: null,
    soAccYear: ACC_YEAR,
    soOrderRefno: 'sor00101',
    soOrderDate: new Date('2026-10-18T00:00:00.000Z'),
    soStatus: 'DRAFT',
    soRevisionNo: 1,
    soSalesmanId: [],
    soDeviceId: DEVICE_ID,
    soSessionId: null,
    ...overrides,
  }) as SaleOrder;

const lineRow = (overrides: Partial<SaleOrderItem> = {}): SaleOrderItem =>
  ({
    soiId: LINE_1,
    soiAccYear: ACC_YEAR,
    soiLineNo: 1,
    soiItemId: ITEM_A,
    soiItemUnitId: UNIT,
    soiGodownId: null,
    soiOrderQty: new Prisma.Decimal('10'),
    soiPendingQty: new Prisma.Decimal('10'),
    soiDeliveredQty: new Prisma.Decimal('0'),
    soiReserveExpiresOn: null,
    ...overrides,
  }) as SaleOrderItem;

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
  saleOrder: { findFirst: jest.Mock; update: jest.Mock };
  saleOrderItem: { findMany: jest.Mock; update: jest.Mock; count: jest.Mock };
  $transaction: jest.Mock;
};

describe('SaleOrderLifecycleService', () => {
  let prisma: PrismaMock;
  let orders: {
    prepareSave: jest.Mock;
    createOrderInTx: jest.Mock;
    updateOrderInTx: jest.Mock;
    throwIfDuplicate: jest.Mock;
    getById: jest.Mock;
    writeRevision: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
    cancelOrderOpenLines: jest.Mock;
    orderAmountsOf: jest.Mock;
  };
  let ctx: {
    actor: string;
    actorName: string;
    rights: { post: boolean; cancel: boolean; amend: boolean };
  };
  let salesContext: { resolve: jest.Mock };
  let reservations: { reserve: jest.Mock; release: jest.Mock };
  let audit: { logEntityChange: jest.Mock };
  let service: SaleOrderLifecycleService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ so_id: ORDER_ID }]),
      saleOrder: {
        findFirst: jest.fn().mockResolvedValue(orderRow()),
        update: jest.fn().mockResolvedValue({}),
      },
      saleOrderItem: {
        findMany: jest.fn().mockResolvedValue([lineRow()]),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    orders = {
      prepareSave: jest.fn(),
      createOrderInTx: jest.fn().mockResolvedValue(orderRow()),
      updateOrderInTx: jest.fn().mockResolvedValue(orderRow()),
      throwIfDuplicate: jest.fn(),
      getById: jest.fn().mockResolvedValue({ soId: ORDER_ID, soStatus: 'CONFIRMED' }),
      writeRevision: jest.fn().mockResolvedValue({ revNo: 3, after: { soId: ORDER_ID } }),
      save: jest.fn().mockResolvedValue({ soId: ORDER_ID, soRevisionNo: 1 }),
      softDelete: jest.fn().mockResolvedValue({ soId: ORDER_ID, deleted: true }),
      cancelOrderOpenLines: jest.fn().mockResolvedValue({ cancelledLines: 1 }),
      orderAmountsOf: jest.fn().mockReturnValue(AMOUNTS),
    };
    ctx = {
      actor: USER_ID,
      actorName: LOGIN_NAME,
      rights: { post: true, cancel: true, amend: true },
    };
    salesContext = { resolve: jest.fn(() => Promise.resolve(ctx)) };
    reservations = {
      reserve: jest.fn().mockResolvedValue({ reserved: new Map([[LINE_1, 10]]), warnings: [] }),
      release: jest.fn().mockResolvedValue(1),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    service = new SaleOrderLifecycleService(
      prisma as unknown as PrismaService,
      orders as never,
      salesContext as never,
      reservations as never,
      audit as never,
    );
  });

  const trailStep = (n = 0) =>
    jest.mocked(appendTxnStatusLog).mock.calls[n][1] as unknown as Record<string, unknown>;

  describe('post', () => {
    it('locks the order by all four keys before anything else', async () => {
      await service.post(KEYS);

      const [, ...values] = prisma.$queryRaw.mock.calls[0] as unknown[];
      expect(values).toEqual([ORDER_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID]);
    });

    it('refuses an order the lock does not find', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'soId', code: 'SALES_NOT_FOUND' }] },
      });
      expect(salesContext.resolve).not.toHaveBeenCalled();
    });

    it('confirms a draft, reserves its lines and names the login on the header', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([
        lineRow(),
        // A part-cancelled line reserves what is still pending, not what was ordered.
        lineRow({
          soiId: LINE_2,
          soiLineNo: 2,
          soiItemId: ITEM_B,
          soiPendingQty: new Prisma.Decimal('4'),
        }),
      ]);
      reservations.reserve.mockResolvedValue({
        reserved: new Map([
          [LINE_1, 10],
          [LINE_2, 4],
        ]),
        warnings: [],
      });

      await expect(service.post(KEYS)).resolves.toEqual({ soStatus: 'CONFIRMED', warnings: [] });

      expect(salesContext.resolve).toHaveBeenCalledWith(
        { companyId: COMPANY_ID, branchId: BRANCH_ID },
        11,
        prisma,
      );
      const [, doc, lines] = reservations.reserve.mock.calls[0] as [unknown, unknown, unknown[]];
      expect(doc).toMatchObject({ docType: 'SALES_ORDER', docId: ORDER_ID, refno: 'sor00101' });
      expect(lines).toEqual([
        expect.objectContaining({ lineId: LINE_1, qty: 10 }),
        expect.objectContaining({ lineId: LINE_2, qty: 4 }),
      ]);
      expect(prisma.saleOrderItem.update).toHaveBeenNthCalledWith(1, {
        where: { soiId_soiAccYear: { soiId: LINE_1, soiAccYear: ACC_YEAR } },
        data: {
          soiIsReserved: true,
          soiReservedQty: new Prisma.Decimal('10.000'),
          soiModifiedOn: expect.any(Date),
          soiModifiedBy: USER_ID,
        },
      });
      // Plan SO-5: the user id, as the save paths stamp it; /get names it.
      // ctx.actorName (LOGIN_NAME) is no longer written anywhere on the order.
      // so_pending_amt & co. are restated off the very lines being confirmed.
      expect(prisma.saleOrder.update).toHaveBeenCalledWith({
        where: { soId_soAccYear: { soId: ORDER_ID, soAccYear: ACC_YEAR } },
        data: {
          soStatus: 'CONFIRMED',
          soModifiedOn: expect.any(Date),
          soModifiedBy: USER_ID,
          ...AMOUNTS,
        },
      });
      expect(orders.orderAmountsOf).toHaveBeenCalledWith([
        expect.objectContaining({ soiId: LINE_1 }),
        expect.objectContaining({ soiId: LINE_2 }),
      ]);
      expect(trailStep()).toMatchObject({
        event: TxnStatusEvent.POSTED,
        fromStatus: 'DRAFT',
        toStatus: 'CONFIRMED',
        changedBy: USER_ID,
        remarks: null,
        srcDocId: ORDER_ID,
      });
      // Screen 87, as every sales-order audit row (user, 2026-11-11).
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'approve',
          screenName: 'Sale Order',
          pk: ORDER_ID,
          userId: USER_ID,
        }),
        prisma,
      );
    });

    it('warns, never refuses, on a line the shelf cannot cover', async () => {
      const short = { code: 'SALES_RESERVE_SHORT', line: 1, short: 6, message: 'short by 6' };
      reservations.reserve.mockResolvedValue({
        reserved: new Map([[LINE_1, 4]]),
        warnings: [short],
      });

      await expect(service.post(KEYS)).resolves.toEqual({
        soStatus: 'CONFIRMED',
        warnings: [short],
      });
      expect(prisma.saleOrderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            soiIsReserved: true,
            soiReservedQty: new Prisma.Decimal('4.000'),
          }) as object,
        }),
      );
      expect(trailStep().remarks).toBe('1 line(s) short on reservation');
    });

    it('marks a line nothing could be reserved for as unreserved', async () => {
      reservations.reserve.mockResolvedValue({ reserved: new Map(), warnings: [] });

      await service.post(KEYS);

      expect(prisma.saleOrderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            soiIsReserved: false,
            soiReservedQty: new Prisma.Decimal('0.000'),
          }) as object,
        }),
      );
    });

    it.each(['CONFIRMED', 'PARTIAL'])(
      'answers an already %s order as it is, writing nothing',
      async (soStatus) => {
        // PARTIAL too (review 2026-11-11): a save-and-confirm over it has moved
        // its reservations already, and a 409 here rolled that save back.
        prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus }));

        await expect(service.post(KEYS)).resolves.toEqual({ soStatus, warnings: [] });
        expect(salesContext.resolve).not.toHaveBeenCalled();
        expect(reservations.reserve).not.toHaveBeenCalled();
        expect(prisma.saleOrder.update).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['CANCELLED', 'SALES_DOC_CANCELLED'],
      ['COMPLETED', 'SALES_DOC_NOT_DRAFT'],
      ['CLOSED', 'SALES_DOC_NOT_DRAFT'],
      ['EXPIRED', 'SALES_DOC_NOT_DRAFT'],
    ])('refuses to confirm a %s order with %s', async (soStatus, code) => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus }));

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'soId', code }] },
      });
      expect(salesContext.resolve).not.toHaveBeenCalled();
    });

    it('refuses a user without the Post right on the order menu', async () => {
      ctx.rights.post = false;

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: 'SALES_RIGHT_POST' }] },
      });
      expect(reservations.reserve).not.toHaveBeenCalled();
    });

    it('refuses an order dated on a closed day', async () => {
      jest.mocked(loadDayClosed).mockResolvedValueOnce(true);

      const refusal = await refusalOf(service.post(KEYS));

      expect(jest.mocked(loadDayClosed)).toHaveBeenCalledWith(
        prisma,
        COMPANY_ID,
        BRANCH_ID,
        '2026-10-18',
      );
      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'soOrderDate', code: 'SALES_DAY_CLOSED' }] },
      });
      expect(prisma.saleOrder.update).not.toHaveBeenCalled();
    });

    it('checks the salesmen only when the order names some', async () => {
      await service.post(KEYS);
      expect(jest.mocked(assertSalesmen)).toHaveBeenLastCalledWith(prisma, COMPANY_ID, null, {
        field: 'soSalesmanId',
      });

      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soSalesmanId: [USER_ID] }));
      await service.post(KEYS);
      expect(jest.mocked(assertSalesmen)).toHaveBeenLastCalledWith(prisma, COMPANY_ID, [USER_ID], {
        field: 'soSalesmanId',
      });
    });
  });

  describe('saveAndPost', () => {
    const dto = (overrides: Partial<SaveSaleOrderDto> = {}): SaveSaleOrderDto =>
      ({
        soCompanyId: COMPANY_ID,
        soBranchId: BRANCH_ID,
        soAccYear: ACC_YEAR,
        soStatus: 'CONFIRMED',
        post: true,
        ...overrides,
      }) as SaveSaleOrderDto;

    it('saves a DRAFT and confirms it in the same transaction', async () => {
      const result = await service.saveAndPost(dto());

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const [tx, saved] = orders.createOrderInTx.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(tx).toBe(prisma);
      // CONFIRMED is the instruction, not a column value: the save writes a draft.
      expect(saved).not.toHaveProperty('soStatus');
      expect(saved).not.toHaveProperty('post');
      expect(orders.prepareSave).toHaveBeenCalledWith(saved);
      expect(prisma.saleOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ soStatus: 'CONFIRMED' }) as object,
        }),
      );
      expect(orders.getById).toHaveBeenCalledWith(ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
      expect(result).toEqual({ soId: ORDER_ID, soStatus: 'CONFIRMED', warnings: [] });
    });

    it('updates instead of creating when the body names the order', async () => {
      await service.saveAndPost(dto({ soId: ORDER_ID }));

      expect(orders.updateOrderInTx).toHaveBeenCalledTimes(1);
      expect(orders.createOrderInTx).not.toHaveBeenCalled();
    });

    it('moves the reservations of a CONFIRMED order it saves over, then leaves it confirmed', async () => {
      // The Qt entry sends a loaded order's status back, so its edits of a
      // confirmed order arrive here.
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'CONFIRMED' }));

      const result = await service.saveAndPost(dto({ soId: ORDER_ID }));

      expect(orders.updateOrderInTx.mock.calls[0][2]).toEqual({ revision: false });
      expect(reservations.release).toHaveBeenCalledTimes(1);
      expect(reservations.reserve).toHaveBeenCalledTimes(1);
      expect(orders.writeRevision).toHaveBeenCalledTimes(1);
      // postInTx answers a confirmed order as it is: no second reserve.
      expect(result.warnings).toEqual([]);
    });

    it('lets a refusal from the post roll the save back with it', async () => {
      ctx.rights.post = false;

      const refusal = await refusalOf(service.saveAndPost(dto()));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: 'SALES_RIGHT_POST' }] },
      });
      // The refusal still passes the duplicate check on its way out.
      expect(orders.throwIfDuplicate).toHaveBeenCalledTimes(1);
      expect(orders.getById).not.toHaveBeenCalled();
    });

    it('turns a unique-index clash on the save into the save route answer', async () => {
      const clash = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      orders.createOrderInTx.mockRejectedValue(clash);

      await expect(service.saveAndPost(dto())).rejects.toBe(clash);
      expect(orders.throwIfDuplicate).toHaveBeenCalledWith(clash);
    });
  });

  describe('save (/create without the confirm instruction)', () => {
    const dto = (overrides: Partial<SaveSaleOrderDto> = {}): SaveSaleOrderDto =>
      ({
        soCompanyId: COMPANY_ID,
        soBranchId: BRANCH_ID,
        soAccYear: ACC_YEAR,
        ...overrides,
      }) as SaveSaleOrderDto;

    it('hands a new order to the order service’s plain save', async () => {
      const body = dto();

      await service.save(body);

      expect(orders.save).toHaveBeenCalledWith(body);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('saves over a DRAFT exactly as before: the update with its own revision, no reservations', async () => {
      await service.save(dto({ soId: ORDER_ID }));

      expect(orders.prepareSave).toHaveBeenCalledTimes(1);
      expect(orders.updateOrderInTx).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ soId: ORDER_ID }),
      );
      expect(orders.updateOrderInTx.mock.calls[0]).toHaveLength(2);
      expect(reservations.release).not.toHaveBeenCalled();
      expect(reservations.reserve).not.toHaveBeenCalled();
      expect(orders.writeRevision).not.toHaveBeenCalled();
    });

    it('lets the update answer an order it cannot find', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(null);

      await service.save(dto({ soId: ORDER_ID }));

      expect(orders.updateOrderInTx.mock.calls[0]).toHaveLength(2);
      expect(reservations.reserve).not.toHaveBeenCalled();
    });

    it('saves over a CONFIRMED order with the amend’s reservation steps, in one transaction', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'CONFIRMED' }));
      const held = lineRow({
        soiOrderQty: new Prisma.Decimal('5'),
        soiPendingQty: new Prisma.Decimal('3'),
        soiReservedQty: new Prisma.Decimal('5'),
      });
      prisma.saleOrderItem.findMany.mockResolvedValue([held]);
      reservations.reserve.mockResolvedValue({ reserved: new Map([[LINE_1, 3]]), warnings: [] });
      orders.getById.mockResolvedValue({ soId: ORDER_ID, soStatus: 'CONFIRMED', items: [] });
      orders.updateOrderInTx.mockResolvedValue({
        soId: ORDER_ID,
        items: [{ soiId: LINE_1, soiIsReserved: true, soiReservedQty: new Prisma.Decimal('3') }],
      });

      const result = await service.save(
        dto({
          soId: ORDER_ID,
          items: [{ soiId: LINE_1, soiOrderQty: 3, soiReservedQty: 9 }],
        } as never),
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // 1 · capped before the save, and the save writes no revision of its own.
      const [, saved, options] = orders.updateOrderInTx.mock.calls[0] as [
        unknown,
        { items: Array<{ soiReservedQty: string }> },
        unknown,
      ];
      expect(saved.items[0].soiReservedQty).toBe('3.000');
      expect(options).toEqual({ revision: false });
      // 2 · every hold released, then the pending line re-reserved.
      expect(reservations.release).toHaveBeenCalledWith(
        prisma,
        { docType: 'SALES_ORDER', docId: ORDER_ID },
        'Re-reserved',
        USER_ID,
        expect.any(Date),
      );
      expect(reservations.release.mock.invocationCallOrder[0]).toBeLessThan(
        reservations.reserve.mock.invocationCallOrder[0],
      );
      expect(prisma.saleOrderItem.update).toHaveBeenCalledWith({
        where: { soiId_soiAccYear: { soiId: LINE_1, soiAccYear: ACC_YEAR } },
        data: { soiIsReserved: true, soiReservedQty: new Prisma.Decimal('3.000') },
      });
      // 3 · the save's ONE revision, after the reservations, with the before read first.
      expect(orders.writeRevision).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ soId: ORDER_ID }),
        { soId: ORDER_ID, soStatus: 'CONFIRMED', items: [] },
        USER_ID,
        'Order updated',
      );
      expect(orders.writeRevision.mock.invocationCallOrder[0]).toBeGreaterThan(
        reservations.reserve.mock.invocationCallOrder[0],
      );
      // Not an amend: no revision number, no AMENDED step.
      expect(prisma.saleOrder.update).not.toHaveBeenCalled();
      expect(appendTxnStatusLog).not.toHaveBeenCalled();
      // The answer carries what the line now holds.
      expect(result.items?.[0]).toMatchObject({
        soiIsReserved: true,
        soiReservedQty: new Prisma.Decimal('3.000'),
      });
    });

    it('turns a unique-index clash on the save into the save route answer', async () => {
      const clash = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      orders.updateOrderInTx.mockRejectedValue(clash);

      await expect(service.save(dto({ soId: ORDER_ID }))).rejects.toBe(clash);
      expect(orders.throwIfDuplicate).toHaveBeenCalledWith(clash);
    });
  });

  describe('review 2026-11-11: transaction options, shortfall warnings, Decimal', () => {
    const TX = { timeout: 30_000, maxWait: 10_000 };
    const SHORT = {
      code: 'SALES_RESERVE_SHORT' as const,
      line: 1,
      short: 30,
      message: 'Line 1: only 20 of 50 could be reserved (30 short)',
    };
    const body = (overrides: Partial<SaveSaleOrderDto> = {}) =>
      ({
        soCompanyId: COMPANY_ID,
        soBranchId: BRANCH_ID,
        soAccYear: ACC_YEAR,
        ...overrides,
      }) as SaveSaleOrderDto;
    const amendBody = () =>
      ({
        ...KEYS,
        baseRevision: 1,
        editRemark: 'More',
        soStatus: 'CONFIRMED',
      }) as AmendSaleOrderDto;

    it('gives every order-side transaction 30 s (timeout) and 10 s (maxWait)', async () => {
      await service.post(KEYS);
      await service.saveAndPost(body({ post: true }));
      await service.save(body({ soId: ORDER_ID }));
      await service.amend(amendBody());
      await service.cancel({ ...KEYS, reason: 'x' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(5);
      for (const call of prisma.$transaction.mock.calls) {
        expect(call[1]).toEqual(TX);
      }
    });

    it('passes the re-reserve shortfalls out of a save over a CONFIRMED order', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'CONFIRMED' }));
      reservations.reserve.mockResolvedValue({
        reserved: new Map([[LINE_1, 20]]),
        warnings: [SHORT],
      });

      const result = await service.save(body({ soId: ORDER_ID }));

      expect(result.warnings).toEqual([SHORT]);
    });

    it('passes them out of a save-and-confirm over a CONFIRMED order, and of an amend', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'CONFIRMED' }));
      reservations.reserve.mockResolvedValue({
        reserved: new Map([[LINE_1, 20]]),
        warnings: [SHORT],
      });

      const saved = await service.saveAndPost(body({ soId: ORDER_ID, post: true }));
      const amended = await service.amend(amendBody());

      expect(saved.warnings).toEqual([SHORT]);
      expect(amended.warnings).toEqual([SHORT]);
    });

    it('a new or DRAFT save has no warnings', async () => {
      expect((await service.save(body())).warnings).toEqual([]);
      expect((await service.save(body({ soId: ORDER_ID }))).warnings).toEqual([]);
    });

    it('writes the reserved figure in Decimal, not float', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'CONFIRMED' }));
      prisma.saleOrderItem.findMany.mockResolvedValue([
        lineRow({ soiPendingQty: new Prisma.Decimal('0.3') }),
      ]);
      reservations.reserve.mockResolvedValue({
        reserved: new Map([[LINE_1, 0.1 + 0.2]]),
        warnings: [],
      });

      await service.save(body({ soId: ORDER_ID }));

      const data = prisma.saleOrderItem.update.mock.calls[0][0].data as {
        soiReservedQty: Prisma.Decimal;
      };
      expect(data.soiReservedQty.toString()).toBe('0.3');
    });
  });

  describe('cancel', () => {
    const CANCEL = { ...KEYS, reason: 'Customer withdrew' };

    it('answers an already cancelled order as it is', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'CANCELLED' }));

      await expect(service.cancel(CANCEL)).resolves.toEqual({
        soStatus: 'CANCELLED',
        cancelledLines: 0,
      });
      expect(salesContext.resolve).not.toHaveBeenCalled();
    });

    it('refuses a user without the Cancel right', async () => {
      ctx.rights.cancel = false;

      const refusal = await refusalOf(service.cancel(CANCEL));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: 'SALES_RIGHT_CANCEL' }] },
      });
    });

    it('refuses an order with anything delivered, before releasing a thing', async () => {
      prisma.saleOrderItem.count.mockResolvedValue(2);

      const refusal = await refusalOf(service.cancel(CANCEL));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'soId', code: 'SALES_ORDER_DELIVERED' }] },
      });
      expect(reservations.release).not.toHaveBeenCalled();
      expect(orders.cancelOrderOpenLines).not.toHaveBeenCalled();
    });

    it.each(['CLOSED', 'EXPIRED'])(
      'refuses a %s order with nothing delivered, before releasing a thing',
      async (soStatus) => {
        prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus }));

        const refusal = await refusalOf(service.cancel(CANCEL));

        expect(refusal).toMatchObject({
          status: 409,
          body: { errors: [{ field: 'soId', code: 'SALES_DOC_NOT_DRAFT', status: soStatus }] },
        });
        expect(reservations.release).not.toHaveBeenCalled();
        expect(orders.cancelOrderOpenLines).not.toHaveBeenCalled();
      },
    );

    it('releases the reservations and writes off every open line', async () => {
      prisma.saleOrder.findFirst
        .mockResolvedValueOnce(orderRow({ soStatus: 'CONFIRMED' }))
        .mockResolvedValueOnce({ soStatus: 'CANCELLED' });

      await expect(service.cancel(CANCEL)).resolves.toEqual({
        soStatus: 'CANCELLED',
        cancelledLines: 1,
      });

      expect(reservations.release).toHaveBeenCalledWith(
        prisma,
        { docType: 'SALES_ORDER', docId: ORDER_ID },
        'Customer withdrew',
        USER_ID,
        expect.any(Date),
      );
      expect(orders.cancelOrderOpenLines).toHaveBeenCalledWith(prisma, {
        order: expect.objectContaining({ soId: ORDER_ID }) as object,
        srcAccYear: ACC_YEAR,
        targetLineId: null,
        cancelReason: 'Customer withdrew',
        actor: USER_ID,
        now: expect.any(Date),
      });
      // The line cancel already left it CANCELLED (and logged it): nothing more.
      expect(prisma.saleOrder.update).not.toHaveBeenCalled();
      expect(appendTxnStatusLog).not.toHaveBeenCalled();
    });

    it('releases a delivery hold when it closes the header itself', async () => {
      prisma.saleOrder.findFirst
        .mockResolvedValueOnce(orderRow({ soStatus: 'CONFIRMED' }))
        .mockResolvedValueOnce({ soStatus: 'CONFIRMED', soDeliveryHold: true });

      await service.cancel(CANCEL);

      expect(prisma.saleOrder.findFirst).toHaveBeenLastCalledWith({
        where: { soId: ORDER_ID, soAccYear: ACC_YEAR },
        select: { soStatus: true, soDeliveryHold: true },
      });
      expect(prisma.saleOrder.update).toHaveBeenCalledWith({
        where: { soId_soAccYear: { soId: ORDER_ID, soAccYear: ACC_YEAR } },
        data: {
          soStatus: 'CANCELLED',
          soModifiedOn: expect.any(Date),
          soModifiedBy: USER_ID,
          soDeliveryHold: false,
          soDeliveryHoldReason: 'Delivery hold released because the order was cancelled',
          soDeliveryHoldBy: USER_ID,
          soDeliveryHoldOn: expect.any(Date),
        },
      });
      expect(trailStep(0)).toMatchObject({
        event: TxnStatusEvent.CANCELLED,
        toStatus: 'CANCELLED',
      });
      expect(trailStep(1)).toMatchObject({
        event: TxnStatusEvent.DELIVERY_RELEASED,
        fromStatus: 'CANCELLED',
        toStatus: 'CANCELLED',
        remarks: 'Delivery hold released because the order was cancelled',
      });
    });

    it('closes the header itself when the line cancel left it open', async () => {
      prisma.saleOrder.findFirst
        .mockResolvedValueOnce(orderRow({ soStatus: 'CONFIRMED' }))
        .mockResolvedValueOnce({ soStatus: 'CONFIRMED' });

      await service.cancel(CANCEL);

      expect(prisma.saleOrder.update).toHaveBeenCalledWith({
        where: { soId_soAccYear: { soId: ORDER_ID, soAccYear: ACC_YEAR } },
        data: { soStatus: 'CANCELLED', soModifiedOn: expect.any(Date), soModifiedBy: USER_ID },
      });
      expect(trailStep()).toMatchObject({
        event: TxnStatusEvent.CANCELLED,
        fromStatus: 'CONFIRMED',
        toStatus: 'CANCELLED',
        remarks: 'Customer withdrew',
      });
    });
  });

  describe('amend', () => {
    const amend = (overrides: Partial<AmendSaleOrderDto> = {}): AmendSaleOrderDto =>
      ({
        ...KEYS,
        baseRevision: 1,
        editRemark: 'Customer added a carton',
        soStatus: 'CONFIRMED',
        ...overrides,
      }) as AmendSaleOrderDto;
    const delivered = lineRow({
      soiDeliveredQty: new Prisma.Decimal('3'),
      soiPendingQty: new Prisma.Decimal('7'),
    });

    it('refuses a cancelled order', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'CANCELLED' }));

      const refusal = await refusalOf(service.amend(amend()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: 'SALES_DOC_CANCELLED' }] },
      });
    });

    it.each(['COMPLETED', 'CLOSED', 'EXPIRED'])(
      'refuses a %s order before the right or the save',
      async (soStatus) => {
        prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus }));

        const refusal = await refusalOf(service.amend(amend()));

        expect(refusal).toMatchObject({
          status: 409,
          body: { errors: [{ field: 'soId', code: 'SALES_DOC_NOT_DRAFT', status: soStatus }] },
        });
        expect(salesContext.resolve).not.toHaveBeenCalled();
        expect(orders.updateOrderInTx).not.toHaveBeenCalled();
      },
    );

    it('refuses a user without the Amend right', async () => {
      ctx.rights.amend = false;

      const refusal = await refusalOf(service.amend(amend()));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: 'SALES_RIGHT_AMEND' }] },
      });
    });

    it('refuses an edit made against an older revision', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soRevisionNo: 3 }));

      const refusal = await refusalOf(service.amend(amend({ baseRevision: 2 })));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'baseRevision', code: 'SALES_REVISION_STALE' }] },
      });
      expect(orders.updateOrderInTx).not.toHaveBeenCalled();
    });

    it.each([
      ['drops', []],
      ['re-items', [{ soiId: LINE_1, soiItemId: ITEM_B }]],
      ['re-units', [{ soiId: LINE_1, soiItemUnitId: ITEM_B }]],
      ['cuts below delivered', [{ soiId: LINE_1, soiOrderQty: 2 }]],
    ])('refuses an amend that %s a delivered line', async (_label, items) => {
      prisma.saleOrderItem.findMany.mockResolvedValue([delivered]);

      const refusal = await refusalOf(service.amend(amend({ items } as never)));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'items.1', code: 'SALES_ORDER_LINE_DELIVERED' }] },
      });
      expect(orders.updateOrderInTx).not.toHaveBeenCalled();
    });

    it('lets a delivered line be cut down to exactly what was delivered', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([delivered]);

      await service.amend(amend({ items: [{ soiId: LINE_1, soiOrderQty: 3 }] } as never));

      expect(orders.updateOrderInTx).toHaveBeenCalledTimes(1);
    });

    it('lets an undelivered line be dropped or re-itemed beside a delivered one', async () => {
      const open = lineRow({ soiId: LINE_2, soiLineNo: 2, soiItemId: ITEM_B });
      prisma.saleOrderItem.findMany.mockResolvedValue([delivered, open]);

      // Line 2 is left out entirely; only the delivered line has to survive.
      await service.amend(amend({ items: [{ soiId: LINE_1, soiOrderQty: 10 }] } as never));
      // ... or re-pointed at another item.
      await service.amend(
        amend({
          items: [
            { soiId: LINE_1, soiOrderQty: 10 },
            { soiId: LINE_2, soiItemId: ITEM_A },
          ],
        } as never),
      );

      expect(orders.updateOrderInTx).toHaveBeenCalledTimes(2);
    });

    it('does not judge the lines when the amend leaves them out', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([delivered]);

      await service.amend(amend());

      expect(orders.updateOrderInTx).toHaveBeenCalledTimes(1);
    });

    it('saves through the one order save, bumps the revision and logs the remark', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'DRAFT' }));
      orders.updateOrderInTx.mockResolvedValue({ soId: ORDER_ID, soRevisionNo: 1 });

      const result = await service.amend(amend({ soRemarks: 'Deliver after 5' }));

      // In the amend's own transaction, and without the save's own revision.
      expect(orders.prepareSave).toHaveBeenCalledTimes(1);
      expect(orders.updateOrderInTx.mock.calls[0][0]).toBe(prisma);
      expect(orders.updateOrderInTx.mock.calls[0][2]).toEqual({ revision: false });
      const saved = orders.updateOrderInTx.mock.calls[0][1] as Record<string, unknown>;
      expect(saved).toMatchObject({ soId: ORDER_ID, soRemarks: 'Deliver after 5' });
      expect(saved).not.toHaveProperty('baseRevision');
      expect(saved).not.toHaveProperty('editRemark');
      expect(saved).not.toHaveProperty('soStatus');
      // A draft holds no reservations to redo.
      expect(reservations.reserve).not.toHaveBeenCalled();
      expect(prisma.saleOrder.update).toHaveBeenCalledWith({
        where: { soId_soAccYear: { soId: ORDER_ID, soAccYear: ACC_YEAR } },
        data: { soRevisionNo: 2, soModifiedOn: expect.any(Date), soModifiedBy: USER_ID },
      });
      expect(trailStep()).toMatchObject({
        event: TxnStatusEvent.AMENDED,
        fromStatus: 'DRAFT',
        toStatus: 'DRAFT',
        remarks: 'Rev 3: Customer added a carton',
      });
      expect(orders.save).not.toHaveBeenCalled();
      expect(result).toEqual({ soId: ORDER_ID, soRevisionNo: 2, warnings: [] });
    });

    // P6 (addendum-1 §6.2) — ONE History revision per amend: the /get payload
    // read under the lock before the edit, and the order after every write.
    it('writes one revision after its own writes, in one transaction', async () => {
      const before = { soId: ORDER_ID, soRemarks: 'old' };
      orders.getById.mockResolvedValue(before);

      await service.amend(amend());

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(orders.getById).toHaveBeenCalledWith(
        ORDER_ID,
        COMPANY_ID,
        BRANCH_ID,
        ACC_YEAR,
        prisma,
      );
      expect(orders.writeRevision).toHaveBeenCalledTimes(1);
      expect(orders.writeRevision).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ soId: ORDER_ID, soAccYear: ACC_YEAR }),
        before,
        USER_ID,
        'Order amended: Customer added a carton',
      );
      // before → the save → the revision number → the revision → the step.
      const order = (mock: jest.Mock) => mock.mock.invocationCallOrder[0];
      expect(order(orders.getById)).toBeLessThan(order(orders.updateOrderInTx));
      expect(order(orders.updateOrderInTx)).toBeLessThan(order(prisma.saleOrder.update));
      expect(order(prisma.saleOrder.update)).toBeLessThan(order(orders.writeRevision));
      expect(order(orders.writeRevision)).toBeLessThan(
        jest.mocked(appendTxnStatusLog).mock.invocationCallOrder[0],
      );
    });

    it('writes no revision when a gate refuses', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soRevisionNo: 3 }));

      await refusalOf(service.amend(amend({ baseRevision: 2 })));

      expect(orders.getById).not.toHaveBeenCalled();
      expect(orders.writeRevision).not.toHaveBeenCalled();
      expect(appendTxnStatusLog).not.toHaveBeenCalled();
    });

    it('turns a unique-index clash on the save into the save route answer', async () => {
      const clash = new Error('P2002');
      orders.updateOrderInTx.mockRejectedValueOnce(clash);

      await expect(service.amend(amend())).rejects.toBe(clash);

      expect(orders.throwIfDuplicate).toHaveBeenCalledWith(clash);
      expect(orders.writeRevision).not.toHaveBeenCalled();
    });

    it('does not relabel a clash after the save (a reservation) as the save route answer', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'CONFIRMED' }));
      const clash = new Error('P2010 23505 ux_srv_source');
      reservations.reserve.mockRejectedValueOnce(clash);

      await expect(service.amend(amend())).rejects.toBe(clash);

      expect(orders.throwIfDuplicate).not.toHaveBeenCalled();
      expect(orders.writeRevision).not.toHaveBeenCalled();
    });

    it('re-reserves only what is still pending on a confirmed order', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'CONFIRMED' }));
      const settled = lineRow({
        soiId: LINE_2,
        soiLineNo: 2,
        soiPendingQty: new Prisma.Decimal('0'),
      });
      prisma.saleOrderItem.findMany.mockResolvedValue([delivered, settled]);
      reservations.reserve.mockResolvedValue({ reserved: new Map([[LINE_1, 9]]), warnings: [] });

      await service.amend(amend());

      const lines = reservations.reserve.mock.calls[0][2] as Array<{ lineId: string; qty: number }>;
      expect(lines).toEqual([expect.objectContaining({ lineId: LINE_1, qty: 7 })]);
      // Capped at the pending quantity, and the settled line gives its reservation up.
      expect(prisma.saleOrderItem.update).toHaveBeenNthCalledWith(1, {
        where: { soiId_soiAccYear: { soiId: LINE_1, soiAccYear: ACC_YEAR } },
        data: { soiIsReserved: true, soiReservedQty: new Prisma.Decimal('7.000') },
      });
      expect(prisma.saleOrderItem.update).toHaveBeenNthCalledWith(2, {
        where: { soiId_soiAccYear: { soiId: LINE_2, soiAccYear: ACC_YEAR } },
        data: { soiIsReserved: false, soiReservedQty: new Prisma.Decimal('0.000') },
      });
    });

    // 2026-11-11: amending a reserved line DOWN answered 400
    // SALE_ORDER_RESERVED_OUT_OF_RANGE — the save merged the stored
    // soi_reserved_qty with the lower order quantity.
    it('caps each line’s reserved figure at its new quantity before the save', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'CONFIRMED' }));
      const held = lineRow({
        soiOrderQty: new Prisma.Decimal('5'),
        soiPendingQty: new Prisma.Decimal('5'),
        soiReservedQty: new Prisma.Decimal('5'),
      });
      const up = lineRow({
        soiId: LINE_2,
        soiLineNo: 2,
        soiOrderQty: new Prisma.Decimal('4'),
        soiReservedQty: new Prisma.Decimal('4'),
      });
      prisma.saleOrderItem.findMany.mockResolvedValue([held, up]);

      await service.amend(
        amend({
          items: [
            { soiId: LINE_1, soiOrderQty: 3, soiReservedQty: 5 },
            { soiId: LINE_2, soiOrderQty: '8' },
            { soiLineNo: 3, soiItemId: ITEM_B, soiOrderQty: 2, soiReservedQty: 2 },
          ],
        } as never),
      );

      const saved = orders.updateOrderInTx.mock.calls[0][1] as {
        items: Array<{ soiReservedQty: string }>;
      };
      // Down: capped at the new 3, whatever the client sent. Up: the stored
      // 4 stands until the re-reserve. A new line holds nothing yet.
      expect(saved.items.map((i) => i.soiReservedQty)).toEqual(['3.000', '4.000', '0.000']);
    });

    it('releases every live hold of the order before it re-reserves the pending lines', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'CONFIRMED' }));

      await service.amend(amend());

      expect(reservations.release).toHaveBeenCalledWith(
        prisma,
        { docType: 'SALES_ORDER', docId: ORDER_ID },
        'Re-reserved',
        USER_ID,
        expect.any(Date),
      );
      expect(reservations.release.mock.invocationCallOrder[0]).toBeLessThan(
        reservations.reserve.mock.invocationCallOrder[0],
      );
    });

    it('leaves a draft’s reservations alone (it holds none)', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'DRAFT' }));

      await service.amend(amend());

      expect(reservations.release).not.toHaveBeenCalled();
      expect(reservations.reserve).not.toHaveBeenCalled();
    });
  });

  describe('deleteDraft', () => {
    it('refuses an order with no live row in its scope', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.deleteDraft(KEYS));

      expect(prisma.saleOrder.findFirst).toHaveBeenCalledWith({
        where: { ...KEYS, soIsDeleted: false },
        select: { soStatus: true },
      });
      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: 'SALES_NOT_FOUND' }] },
      });
    });

    it('refuses a confirmed order, which must be cancelled instead', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue({ soStatus: 'CONFIRMED' });

      const refusal = await refusalOf(service.deleteDraft(KEYS));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'soId', code: 'SALES_ORDER_CONFIRMED' }] },
      });
      expect(orders.softDelete).not.toHaveBeenCalled();
    });

    it('soft deletes a draft through the order service', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue({ soStatus: 'DRAFT' });

      await expect(service.deleteDraft(KEYS)).resolves.toEqual({ soId: ORDER_ID, deleted: true });
      expect(orders.softDelete).toHaveBeenCalledWith(ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
    });
  });
});
