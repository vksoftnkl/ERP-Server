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
const KEYS = { soId: ORDER_ID, soCompanyId: COMPANY_ID, soBranchId: BRANCH_ID, soAccYear: ACC_YEAR };

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
    save: jest.Mock;
    softDelete: jest.Mock;
    cancelOrderOpenLines: jest.Mock;
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
      save: jest.fn().mockResolvedValue({ soId: ORDER_ID, soRevisionNo: 1 }),
      softDelete: jest.fn().mockResolvedValue({ soId: ORDER_ID, deleted: true }),
      cancelOrderOpenLines: jest.fn().mockResolvedValue({ cancelledLines: 1 }),
    };
    ctx = { actor: USER_ID, actorName: LOGIN_NAME, rights: { post: true, cancel: true, amend: true } };
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
      // The text column takes the login name, never the uuid.
      expect(prisma.saleOrder.update).toHaveBeenCalledWith({
        where: { soId_soAccYear: { soId: ORDER_ID, soAccYear: ACC_YEAR } },
        data: { soStatus: 'CONFIRMED', soModifiedOn: expect.any(Date), soModifiedBy: LOGIN_NAME },
      });
      expect(trailStep()).toMatchObject({
        event: TxnStatusEvent.POSTED,
        fromStatus: 'DRAFT',
        toStatus: 'CONFIRMED',
        changedBy: USER_ID,
        remarks: null,
        srcDocId: ORDER_ID,
      });
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'approve', pk: ORDER_ID, userId: USER_ID }),
        prisma,
      );
    });

    it('warns, never refuses, on a line the shelf cannot cover', async () => {
      const short = { code: 'SALES_RESERVE_SHORT', line: 1, short: 6, message: 'short by 6' };
      reservations.reserve.mockResolvedValue({ reserved: new Map([[LINE_1, 4]]), warnings: [short] });

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

    it('answers an already confirmed order as it is, writing nothing', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'CONFIRMED' }));

      await expect(service.post(KEYS)).resolves.toEqual({ soStatus: 'CONFIRMED', warnings: [] });
      expect(salesContext.resolve).not.toHaveBeenCalled();
      expect(reservations.reserve).not.toHaveBeenCalled();
      expect(prisma.saleOrder.update).not.toHaveBeenCalled();
    });

    it.each(['CANCELLED', 'COMPLETED'])('refuses to confirm a %s order', async (soStatus) => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus }));

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'soId', code: 'SALES_DOC_NOT_DRAFT' }] },
      });
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
      expect(jest.mocked(assertSalesmen)).toHaveBeenLastCalledWith(
        prisma,
        COMPANY_ID,
        [USER_ID],
        { field: 'soSalesmanId' },
      );
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
      const [tx, saved] = orders.createOrderInTx.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(tx).toBe(prisma);
      // CONFIRMED is the instruction, not a column value: the save writes a draft.
      expect(saved).not.toHaveProperty('soStatus');
      expect(saved).not.toHaveProperty('post');
      expect(orders.prepareSave).toHaveBeenCalledWith(saved);
      expect(prisma.saleOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ soStatus: 'CONFIRMED' }) as object }),
      );
      expect(orders.getById).toHaveBeenCalledWith(ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
      expect(result).toEqual({ soId: ORDER_ID, soStatus: 'CONFIRMED', warnings: [] });
    });

    it('updates instead of creating when the body names the order', async () => {
      await service.saveAndPost(dto({ soId: ORDER_ID }));

      expect(orders.updateOrderInTx).toHaveBeenCalledTimes(1);
      expect(orders.createOrderInTx).not.toHaveBeenCalled();
    });

    it('lets a refusal from the post roll the save back with it', async () => {
      ctx.rights.post = false;

      const refusal = await refusalOf(service.saveAndPost(dto()));

      expect(refusal).toMatchObject({ status: 403, body: { errors: [{ code: 'SALES_RIGHT_POST' }] } });
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

      expect(refusal).toMatchObject({ status: 403, body: { errors: [{ code: 'SALES_RIGHT_CANCEL' }] } });
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

    it('closes the header itself when the line cancel left it open', async () => {
      prisma.saleOrder.findFirst
        .mockResolvedValueOnce(orderRow({ soStatus: 'CONFIRMED' }))
        .mockResolvedValueOnce({ soStatus: 'CONFIRMED' });

      await service.cancel(CANCEL);

      expect(prisma.saleOrder.update).toHaveBeenCalledWith({
        where: { soId_soAccYear: { soId: ORDER_ID, soAccYear: ACC_YEAR } },
        data: { soStatus: 'CANCELLED', soModifiedOn: expect.any(Date), soModifiedBy: LOGIN_NAME },
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

      expect(refusal).toMatchObject({ status: 409, body: { errors: [{ code: 'SALES_DOC_CANCELLED' }] } });
    });

    it('refuses a user without the Amend right', async () => {
      ctx.rights.amend = false;

      const refusal = await refusalOf(service.amend(amend()));

      expect(refusal).toMatchObject({ status: 403, body: { errors: [{ code: 'SALES_RIGHT_AMEND' }] } });
    });

    it('refuses an edit made against an older revision', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soRevisionNo: 3 }));

      const refusal = await refusalOf(service.amend(amend({ baseRevision: 2 })));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'baseRevision', code: 'SALES_REVISION_STALE' }] },
      });
      expect(orders.save).not.toHaveBeenCalled();
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
      expect(orders.save).not.toHaveBeenCalled();
    });

    it('lets a delivered line be cut down to exactly what was delivered', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([delivered]);

      await service.amend(amend({ items: [{ soiId: LINE_1, soiOrderQty: 3 }] } as never));

      expect(orders.save).toHaveBeenCalledTimes(1);
    });

    it('does not judge the lines when the amend leaves them out', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([delivered]);

      await service.amend(amend());

      expect(orders.save).toHaveBeenCalledTimes(1);
    });

    it('saves through the one order save, bumps the revision and logs the remark', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soStatus: 'DRAFT' }));

      const result = await service.amend(amend({ soRemarks: 'Deliver after 5' } as never));

      const saved = orders.save.mock.calls[0][0] as Record<string, unknown>;
      expect(saved).toMatchObject({ soId: ORDER_ID, soRemarks: 'Deliver after 5' });
      expect(saved).not.toHaveProperty('baseRevision');
      expect(saved).not.toHaveProperty('editRemark');
      expect(saved).not.toHaveProperty('soStatus');
      // A draft holds no reservations to redo.
      expect(reservations.reserve).not.toHaveBeenCalled();
      expect(prisma.saleOrder.update).toHaveBeenCalledWith({
        where: { soId_soAccYear: { soId: ORDER_ID, soAccYear: ACC_YEAR } },
        data: { soRevisionNo: 2, soModifiedOn: expect.any(Date), soModifiedBy: LOGIN_NAME },
      });
      expect(trailStep()).toMatchObject({
        event: TxnStatusEvent.AMENDED,
        fromStatus: 'DRAFT',
        toStatus: 'DRAFT',
        remarks: 'Customer added a carton',
      });
      expect(result).toEqual({ soId: ORDER_ID, soRevisionNo: 2 });
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
  });

  describe('deleteDraft', () => {
    it('refuses an order with no live row in its scope', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.deleteDraft(KEYS));

      expect(prisma.saleOrder.findFirst).toHaveBeenCalledWith({
        where: { ...KEYS, soIsDeleted: false },
        select: { soStatus: true },
      });
      expect(refusal).toMatchObject({ status: 404, body: { errors: [{ code: 'SALES_NOT_FOUND' }] } });
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
