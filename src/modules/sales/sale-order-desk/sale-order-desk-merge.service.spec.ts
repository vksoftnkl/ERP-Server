import { HttpException } from '@nestjs/common';
import { Prisma, SaleOrder, SaleOrderItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  TxnStatusEvent,
  appendTxnStatusLog,
} from '../../../common/txn-status-log/txn-status-log.helper';
import { loadDayClosed } from '../posting/sales.guards';
import { readOrderAdvanceBalance } from '../sale-order/order-advance-posting.helper';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import {
  SaleOrderDeskMergeService,
  buildMerge,
  distinctRefs,
  fingerprintOf,
  toSaveDto,
} from './sale-order-desk-merge.service';

jest.mock('../../../common/txn-status-log/txn-status-log.helper', () => ({
  ...jest.requireActual<object>('../../../common/txn-status-log/txn-status-log.helper'),
  appendTxnStatusLog: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../posting/sales.guards', () => ({
  ...jest.requireActual<object>('../posting/sales.guards'),
  loadDayClosed: jest.fn(() => Promise.resolve(false)),
}));
jest.mock('../sale-order/order-advance-posting.helper', () => ({
  ...jest.requireActual<object>('../sale-order/order-advance-posting.helper'),
  readOrderAdvanceBalance: jest.fn(() => Promise.resolve(null)),
}));

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a302';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46a303';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a304';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46a305';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46a306';
const OTHER_CUST = '019c6f6c-be87-7a11-8905-36092c46a307';
const OLD_ID = '019c6f6c-be87-7a11-8905-36092c46a3a1';
const NEW_ID = '019c6f6c-be87-7a11-8905-36092c46a3a2';
const MADE_ID = '019c6f6c-be87-7a11-8905-36092c46a3ff';
const ITEM = '019c6f6c-be87-7a11-8905-36092c46a321';
const UNIT = '019c6f6c-be87-7a11-8905-36092c46a323';
const YR = '2026-2027';
const D = (v: string | number) => new Prisma.Decimal(v);

const orderRow = (overrides: Partial<SaleOrder> = {}): SaleOrder =>
  ({
    soId: OLD_ID,
    soCompanyId: COMPANY_ID,
    soBranchId: BRANCH_ID,
    soTenantId: null,
    soAccYear: YR,
    soOrderRefno: 'SO/1042',
    soOrderDate: new Date('2026-11-01T00:00:00.000Z'),
    soOrderDatetime: new Date('2026-11-01T05:00:00.000Z'),
    soDeliveryDate: new Date('2026-11-14T00:00:00.000Z'),
    soStatus: 'CONFIRMED',
    soPriority: 'NORMAL',
    soDocType: 'SALES_ORDER',
    soOrderType: 'CREDIT',
    soPosStcd: '33',
    soPriceLevel: 2,
    soDeliveryMode: 'TRANSPORT',
    soCustId: CUST_ID,
    soCustName: 'Sri Lakshmi Stores',
    soCustPlace: 'Gandhipuram',
    soCustAddr: null,
    soSalesmanId: null,
    soDeliveryHold: false,
    soDeliveryHoldReason: null,
    soAdvanceBalanceAmt: D(0),
    soOtherAmt1: D(0),
    soOtherAmt2: D(0),
    soRoundOffStep: D(1),
    soRevisionNo: 1,
    soDeviceId: DEVICE_ID,
    soSessionId: null,
    soHasFreight: true,
    ...overrides,
  }) as SaleOrder;

type Line = SaleOrderItem & { itemUnitConversion: { iucUomWeight: Prisma.Decimal } | null };
const lineRow = (overrides: Partial<SaleOrderItem> = {}, weight = '25'): Line =>
  ({
    soiId: '019c6f6c-be87-7a11-8905-36092c46b001',
    soiOrderId: OLD_ID,
    soiAccYear: YR,
    soiLineNo: 1,
    soiItemId: ITEM,
    soiItemUnitId: UNIT,
    soiToBaseFactor: D('1.000000'),
    soiGodownId: null,
    soiOrderQty: D(10),
    soiNetQty: D(10),
    soiDeliveredQty: D(0),
    soiCancelledQty: D(0),
    soiPendingQty: D(10),
    soiRate: D('100.0000'),
    soiItemDiscPerc: D('5.0000'),
    soiGrossAmt: D('1000.00'),
    soiItemDiscAmt: D('50.00'),
    soiTaxableAmt: D('950.00'),
    soiCgstAmt: D('23.75'),
    soiSgstAmt: D('23.75'),
    soiIgstAmt: D('0.00'),
    soiCessAmt: D('0.00'),
    soiNetAmt: D('997.50'),
    soiWeightQty: D('250.000'),
    soiFreightQty: null,
    soiTaxId: '019c6f6c-be87-7a11-8905-36092c46b0aa',
    soiSalesmanId: null,
    soiRemarks: 'Top shelf',
    soiIsFree: false,
    itemUnitConversion: { iucUomWeight: D(weight) },
    ...overrides,
  }) as Line;

const source = (order: Partial<SaleOrder>, lines: Line[], extra: object = {}) => ({
  order: orderRow(order),
  lines,
  advanceHeld: D(0),
  chargeRows: 0,
  ...extra,
});

async function refusalOf(
  promise: Promise<unknown>,
): Promise<{ status: number; body: { errors: Record<string, unknown>[] } }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() as never };
}

describe('order desk merge — the pure parts', () => {
  // The old order: one line part-billed (4 of 10 delivered), one untouched.
  const oldOrder = source({}, [
    lineRow({ soiDeliveredQty: D(4), soiPendingQty: D(6) }),
    lineRow({
      soiId: '019c6f6c-be87-7a11-8905-36092c46b002',
      soiLineNo: 2,
      soiDeliveredQty: D(0),
      soiPendingQty: D(0),
      soiCancelledQty: D(10),
    }),
  ]);
  const newerOrder = source(
    {
      soId: NEW_ID,
      soOrderRefno: 'SO/1046',
      soOrderDatetime: new Date('2026-11-05T05:00:00.000Z'),
      soDeliveryDate: new Date('2026-11-12T00:00:00.000Z'),
      soPriority: 'URGENT',
      soPriceLevel: 9,
    },
    [
      lineRow({
        soiId: '019c6f6c-be87-7a11-8905-36092c46b003',
        soiOrderId: NEW_ID,
        soiNetAmt: D('333.33'),
        soiGrossAmt: D('333.33'),
        soiOrderQty: D(3),
        soiNetQty: D(3),
        soiPendingQty: D(3),
        soiItemDiscAmt: D(0),
        soiTaxableAmt: D('333.33'),
        soiCgstAmt: D(0),
        soiSgstAmt: D(0),
      }),
    ],
  );

  it('takes every open line, oldest order first, at its pending qty with amounts pro-rata', () => {
    const built = buildMerge([newerOrder, oldOrder]);

    expect(built.oldest.soId).toBe(OLD_ID);
    expect(built.items).toHaveLength(2);
    const [first, second] = built.items as unknown as Record<string, unknown>[];
    // r = 6 / 10: amounts × 0.6 (2 dp), other quantities × 0.6 (3 dp).
    expect(first).toMatchObject({
      soiLineNo: 1,
      soiItemId: ITEM,
      soiItemUnitId: UNIT,
      soiOrderQty: '6.000',
      soiNetQty: '6.000',
      soiCaseQty: '0',
      soiDeliveredQty: '0',
      soiCancelledQty: '0',
      soiReservedQty: '0',
      soiIsReserved: false,
      soiGrossAmt: '600.00',
      soiItemDiscAmt: '30.00',
      soiTaxableAmt: '570.00',
      soiCgstAmt: '14.25',
      soiNetAmt: '598.50',
      soiWeightQty: '150.000',
      // per-unit fields as they are
      soiRate: '100',
      soiItemDiscPerc: '5',
      soiRemarks: 'Top shelf',
      // the trace back
      soiSrcDocType: 'SALES_ORDER',
      soiSrcDocId: OLD_ID,
      soiSrcDocAccYear: YR,
      soiSrcDocRefno: 'SO/1042',
      soiSrcLineNo: 1,
    });
    // A NULL on the source stays the column's default: not sent.
    expect(first).not.toHaveProperty('soiFreightQty');
    expect(first).not.toHaveProperty('soiSalesmanId');
    expect(second).toMatchObject({ soiLineNo: 2, soiSrcDocRefno: 'SO/1046', soiNetAmt: '333.33' });
    expect(built.totQty.toString()).toBe('9');
    expect(built.totKg.toString()).toBe('225');
    // 598.50 + 333.33 = 931.83 → rounded to the step 1 = 932, round-off +0.17
    expect(built.sums.net.toString()).toBe('931.83');
    expect(built.orderAmt.toString()).toBe('932');
    expect(built.roundOff.toString()).toBe('0.17');
    expect(built.priority).toBe('URGENT');
    expect(built.deliveryDate).toBe('2026-11-12');
    expect(built.perSource.get(OLD_ID)).toMatchObject({ openLines: 1 });
    expect(built.perSource.get(OLD_ID)!.openValue.toString()).toBe('598.5');
  });

  it('builds the create body from the oldest header, with no advance and no charges', () => {
    const built = buildMerge([newerOrder, oldOrder]);

    const dto = toSaveDto(
      built,
      {
        soCompanyId: COMPANY_ID,
        soBranchId: BRANCH_ID,
        soAccYear: YR,
        soDeviceId: DEVICE_ID,
        soSessionId: null,
      },
      USER_ID,
      '2026-11-10',
      'Merged on the order desk',
    ) as unknown as Record<string, unknown>;

    expect(dto).toMatchObject({
      soCompanyId: COMPANY_ID,
      soBranchId: BRANCH_ID,
      soAccYear: YR,
      soDeviceId: DEVICE_ID,
      soUserId: USER_ID,
      soPriceLevel: 2,
      soOrderType: 'CREDIT',
      soDeliveryMode: 'TRANSPORT',
      soCustId: CUST_ID,
      soCustName: 'Sri Lakshmi Stores',
      soCustPlace: 'Gandhipuram',
      soHasFreight: true,
      soSalesmanId: [],
      soOrderDate: '2026-11-10',
      soDeliveryDate: '2026-11-12',
      soPriority: 'URGENT',
      soRemarks: 'Made from SO/1042 + SO/1046: Merged on the order desk',
      soAdvancePolicy: 'NONE',
      soOtherAmt1: '0',
      soOtherAmt2: '0',
      soTotItems: 2,
      soTotBags: '9.000',
      soTotWeight: '225.000',
      soGrossAmt: '933.33',
      soTaxableAmt: '903.33',
      soTaxAmt: '28.50',
      soRoundOff: '0.17',
      soOrderAmt: '932.00',
    });
    expect(dto).not.toHaveProperty('soCustAddr');
    expect(dto).not.toHaveProperty('soStatus');
    expect(dto).not.toHaveProperty('charges');
  });

  it('adds the additional cess into the header tax and sums the MRP savings (review 2026-11-11)', () => {
    const a = source({ soOrderRefno: 'SO/1', soOrderDate: new Date('2026-11-01') }, [
      lineRow({
        soiAcessAmt: D('10.00'),
        soiMrpSavings: D('100.00'),
        soiSoldPrice: D('90.0000'),
      }),
    ]);
    const b = source({ soId: NEW_ID, soOrderRefno: 'SO/2', soOrderDate: new Date('2026-11-02') }, [
      lineRow({
        soiId: '019c6f6c-be87-7a11-8905-36092c46b009',
        soiOrderId: NEW_ID,
        soiMrpSavings: D('0.00'),
        soiSoldPrice: D('100.0000'),
      }),
    ]);

    const dto = toSaveDto(
      buildMerge([a, b]),
      {
        soCompanyId: COMPANY_ID,
        soBranchId: BRANCH_ID,
        soAccYear: YR,
        soDeviceId: DEVICE_ID,
        soSessionId: null,
      },
      USER_ID,
      '2026-11-10',
      'x',
    ) as unknown as Record<string, unknown>;

    // GST 2 × 47.50 + additional cess 10.
    expect(dto.soTaxAmt).toBe('105.00');
    // Savings 100 on an MRP value of 100 + 90 × 10 = 1000; the line sold at its
    // MRP (savings 0) carries no MRP and stays out of the value.
    expect(dto.soMrpSavings).toBe('100.00');
    expect(dto.soMrpSavingsPerc).toBe('10.00');
  });

  it('fingerprints the sources whatever order they come in, and moves when a pending qty does', () => {
    const a = fingerprintOf([oldOrder, newerOrder]);

    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprintOf([newerOrder, oldOrder])).toBe(a);
    const billed = source({}, [
      lineRow({ soiDeliveredQty: D(5), soiPendingQty: D(5) }),
      oldOrder.lines[1],
    ]);
    expect(fingerprintOf([billed, newerOrder])).not.toBe(a);
  });

  it('counts each order once', () => {
    expect(
      distinctRefs([
        { soId: OLD_ID, soAccYear: YR },
        { soId: OLD_ID.toUpperCase(), soAccYear: `${YR} ` },
        { soId: NEW_ID, soAccYear: YR },
      ]),
    ).toEqual([
      { soId: OLD_ID, soAccYear: YR },
      { soId: NEW_ID, soAccYear: YR },
    ]);
  });
});

describe('SaleOrderDeskMergeService', () => {
  let tx: {
    $queryRaw: jest.Mock;
    saleOrder: { findMany: jest.Mock; findFirst: jest.Mock };
    saleOrderItem: { findMany: jest.Mock };
  };
  let prisma: { $transaction: jest.Mock };
  let orders: {
    prepareSave: jest.Mock;
    createOrderInTx: jest.Mock;
    cancelOrderOpenLines: jest.Mock;
    throwIfDuplicate: jest.Mock;
  };
  let lifecycle: { postInTx: jest.Mock };
  let rights: Record<string, boolean>;
  let receipt: { view: boolean };
  let salesContext: { resolve: jest.Mock; rights: jest.Mock };
  let reservations: { release: jest.Mock };
  let service: SaleOrderDeskMergeService;
  let stored: SaleOrder[];
  let lines: Line[];

  const refs = [
    { soId: OLD_ID, soAccYear: YR },
    { soId: NEW_ID, soAccYear: YR },
  ];
  const scope = { soCompanyId: COMPANY_ID, soBranchId: BRANCH_ID };
  const mergeBody = (fingerprint: string, overrides: object = {}) => ({
    ...scope,
    soAccYear: YR,
    soDeviceId: DEVICE_ID,
    soSessionId: null,
    orders: refs,
    fingerprint,
    reason: 'Same truck',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    stored = [
      orderRow(),
      orderRow({
        soId: NEW_ID,
        soOrderRefno: 'SO/1046',
        soOrderDatetime: new Date('2026-11-05T05:00:00.000Z'),
      }),
    ];
    lines = [
      lineRow(),
      lineRow({ soiId: '019c6f6c-be87-7a11-8905-36092c46b009', soiOrderId: NEW_ID }),
    ];
    tx = {
      $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('CURRENT_DATE')) return [{ d: '2026-11-10' }];
        return [];
      }),
      saleOrder: {
        findMany: jest.fn(async () => stored),
        findFirst: jest.fn(async () => orderRow({ soId: MADE_ID, soOrderRefno: 'SO/1050' })),
      },
      saleOrderItem: { findMany: jest.fn(async () => lines) },
    };
    prisma = {
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
    };
    orders = {
      prepareSave: jest.fn(),
      createOrderInTx: jest.fn(async () => ({
        soId: MADE_ID,
        soCompanyId: COMPANY_ID,
        soBranchId: BRANCH_ID,
        soAccYear: YR,
        soOrderRefno: 'SO/1050',
      })),
      cancelOrderOpenLines: jest.fn(async (_tx: unknown, { order }: { order: SaleOrder }) => ({
        soId: order.soId,
        soAccYear: order.soAccYear,
        soStatus: 'CANCELLED',
        soFulfilStatus: 'CANCELLED',
        cancelledLines: 1,
      })),
      throwIfDuplicate: jest.fn(),
    };
    lifecycle = {
      postInTx: jest.fn(async () => ({
        soStatus: 'CONFIRMED',
        warnings: [{ code: 'SALES_RESERVE_SHORT', line: 2, short: 4, message: 'short' }],
      })),
    };
    rights = { view: true, create: true, post: true, cancel: true };
    receipt = { view: true };
    salesContext = {
      resolve: jest.fn(async () => ({ actor: USER_ID, userId: USER_ID, rights })),
      rights: jest.fn(async (menuId: number) => (menuId === 99 ? receipt : rights)),
    };
    reservations = { release: jest.fn().mockResolvedValue(1) };
    service = new SaleOrderDeskMergeService(
      prisma as unknown as PrismaService,
      orders as never,
      lifecycle as never,
      salesContext as never,
      reservations as never,
    );
  });

  describe('merge-preview', () => {
    it('answers ok, the orders, the new order and a fingerprint', async () => {
      const result = await service.preview({ ...scope, orders: refs });

      expect(result).toMatchObject({
        ok: true,
        refusals: [],
        customer: { custId: CUST_ID, custName: 'Sri Lakshmi Stores' },
        orders: [
          {
            soId: OLD_ID,
            soOrderRefno: 'SO/1042',
            openLines: 1,
            openQty: 10,
            openKg: 250,
            openValue: 997.5,
          },
          {
            soId: NEW_ID,
            soOrderRefno: 'SO/1046',
            openLines: 1,
            openQty: 10,
            openKg: 250,
            openValue: 997.5,
          },
        ],
        newOrder: {
          lines: 2,
          totQty: 20,
          totKg: 500,
          orderAmt: 1995,
          roundOff: 0,
          priority: 'NORMAL',
        },
      });
      expect(result.fingerprint).toMatch(/^[0-9a-f]{64}$/);
      // Reads only: no row lock.
      const sqls = tx.$queryRaw.mock.calls.map((c) => (c[0] as string[]).join('?'));
      expect(sqls.some((s) => s.includes('FOR UPDATE'))).toBe(false);
    });

    it('leaves the money keys out without Receipt (menu 99) View', async () => {
      receipt.view = false;

      const result = await service.preview({ ...scope, orders: refs });

      expect(result.orders[0]).not.toHaveProperty('openValue');
      expect(result.newOrder).not.toHaveProperty('orderAmt');
      expect(result.newOrder).not.toHaveProperty('roundOff');
      expect(result.newOrder!.totKg).toBe(500);
    });

    it('lists every refusal at once, a missing right first, in the merge order', async () => {
      rights.cancel = false;
      stored = [
        orderRow({ soDeliveryHold: true, soDeliveryHoldReason: 'After 15th' }),
        orderRow({
          soId: NEW_ID,
          soOrderRefno: 'SO/1046',
          soCustId: OTHER_CUST,
          soCustName: 'Annai',
          soOrderDatetime: new Date('2026-11-05T05:00:00.000Z'),
          soOtherAmt1: D(50),
        }),
      ];
      jest.mocked(readOrderAdvanceBalance).mockResolvedValueOnce({
        billAmount: D(500),
        pendingAmount: D(500),
      });

      const result = await service.preview({ ...scope, orders: refs });

      expect(result.ok).toBe(false);
      expect(result.refusals.map((r) => r.code)).toEqual([
        SALES_ERROR_CODES.RIGHT_CANCEL,
        SALES_ERROR_CODES.ORDER_DELIVERY_HOLD,
        SALES_ERROR_CODES.ORDER_MERGE_ONE_PARTY,
        SALES_ERROR_CODES.ORDER_MERGE_ADVANCE,
        SALES_ERROR_CODES.ORDER_MERGE_CHARGES,
      ]);
      expect(result.refusals[1]).toMatchObject({ soId: OLD_ID });
    });

    it('refuses too few orders, a missing one, a closed one, different terms and a closed day', async () => {
      stored = [orderRow({ soStatus: 'COMPLETED' })];
      jest.mocked(loadDayClosed).mockResolvedValueOnce(true);

      const one = await service.preview({ ...scope, orders: [refs[0], refs[0]] });
      expect(one.refusals.map((r) => r.code)).toEqual([
        SALES_ERROR_CODES.ORDER_MERGE_TOO_FEW,
        SALES_ERROR_CODES.ORDER_CLOSED,
        SALES_ERROR_CODES.DAY_CLOSED,
      ]);

      stored = [
        orderRow(),
        orderRow({
          soId: NEW_ID,
          soOrderType: 'CASH',
          soOrderDatetime: new Date('2026-11-05T05:00:00.000Z'),
        }),
      ];
      const missing = await service.preview({
        ...scope,
        orders: [...refs, { soId: MADE_ID, soAccYear: YR }],
      });
      expect(missing.refusals.map((r) => r.code)).toEqual([
        SALES_ERROR_CODES.NOT_FOUND,
        SALES_ERROR_CODES.ORDER_MERGE_TERMS_DIFFER,
      ]);
    });

    it('fails the call only without Sales Order View', async () => {
      rights.view = false;

      const refusal = await refusalOf(service.preview({ ...scope, orders: refs }));

      expect(refusal.status).toBe(403);
      expect(refusal.body.errors[0].code).toBe(SALES_ERROR_CODES.RIGHT_VIEW);
    });
  });

  describe('merge', () => {
    const fingerprint = async () => (await service.preview({ ...scope, orders: refs })).fingerprint;

    it('makes the new order, closes the old ones and confirms it, in one transaction and in order', async () => {
      const fp = await fingerprint();
      jest.mocked(appendTxnStatusLog).mockClear();

      const { message, data } = await service.merge(mergeBody(fp));

      expect(prisma.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
        timeout: 30_000,
        maxWait: 10_000,
      });
      // The sources are locked by so_id before they are read.
      const lock = tx.$queryRaw.mock.calls.find((c) =>
        (c[0] as string[]).join('?').includes('FOR UPDATE'),
      );
      expect((lock![0] as string[]).join('?')).toContain('ORDER BY so.so_id');
      expect(orders.prepareSave).toHaveBeenCalled();
      const created = orders.createOrderInTx.mock.calls[0][1];
      expect(created).toMatchObject({
        soCustId: CUST_ID,
        soOrderDate: '2026-11-10',
        soRemarks: 'Made from SO/1042 + SO/1046: Same truck',
        soAdvancePolicy: 'NONE',
      });
      expect(created.items).toHaveLength(2);
      // Each source: release → MERGED → open lines closed, all after the create.
      expect(reservations.release).toHaveBeenNthCalledWith(
        1,
        tx,
        { docType: 'SALES_ORDER', docId: OLD_ID },
        'Merged into SO/1050: Same truck',
        USER_ID,
        expect.any(Date),
      );
      expect(orders.cancelOrderOpenLines).toHaveBeenNthCalledWith(
        2,
        tx,
        expect.objectContaining({
          order: expect.objectContaining({ soId: NEW_ID }),
          targetLineId: null,
          cancelReason: 'Merged into SO/1050: Same truck',
        }),
      );
      expect(orders.createOrderInTx.mock.invocationCallOrder[0]).toBeLessThan(
        reservations.release.mock.invocationCallOrder[0],
      );
      expect(orders.cancelOrderOpenLines.mock.invocationCallOrder[1]).toBeLessThan(
        lifecycle.postInTx.mock.invocationCallOrder[0],
      );
      expect(lifecycle.postInTx).toHaveBeenCalledWith(
        tx,
        { soId: MADE_ID, soCompanyId: COMPANY_ID, soBranchId: BRANCH_ID, soAccYear: YR },
        expect.any(Date),
      );
      const steps = jest
        .mocked(appendTxnStatusLog)
        .mock.calls.map((c) => [c[1].srcDocId, c[1].event, c[1].remarks]);
      expect(steps).toEqual([
        [OLD_ID, TxnStatusEvent.MERGED, 'Merged into SO/1050: Same truck'],
        [NEW_ID, TxnStatusEvent.MERGED, 'Merged into SO/1050: Same truck'],
        [MADE_ID, TxnStatusEvent.MERGED, 'Made from SO/1042 + SO/1046: Same truck'],
      ]);
      expect(message).toBe('SO/1050 made from SO/1042 + SO/1046');
      expect(data).toEqual({
        soId: MADE_ID,
        soCompanyId: COMPANY_ID,
        soBranchId: BRANCH_ID,
        soAccYear: YR,
        soOrderRefno: 'SO/1050',
        soStatus: 'CONFIRMED',
        soTotItems: 2,
        soTotBags: 20,
        soTotWeight: 500,
        soOrderAmt: 1995,
        warnings: [{ code: 'SALES_RESERVE_SHORT', line: 2, short: 4, message: 'short' }],
        mergedSources: [
          {
            soId: OLD_ID,
            soAccYear: YR,
            soOrderRefno: 'SO/1042',
            soStatus: 'CANCELLED',
            soFulfilStatus: 'CANCELLED',
            cancelledLines: 1,
          },
          {
            soId: NEW_ID,
            soAccYear: YR,
            soOrderRefno: 'SO/1046',
            soStatus: 'CANCELLED',
            soFulfilStatus: 'CANCELLED',
            cancelledLines: 1,
          },
        ],
      });
    });

    it('answers SOURCE_CHANGED when the fingerprint is stale, and writes nothing', async () => {
      const refusal = await refusalOf(service.merge(mergeBody('0'.repeat(64))));

      expect(refusal.status).toBe(409);
      expect(refusal.body.errors[0]).toMatchObject({
        code: SALES_ERROR_CODES.ORDER_MERGE_SOURCE_CHANGED,
        field: 'fingerprint',
      });
      expect(orders.createOrderInTx).not.toHaveBeenCalled();
      expect(reservations.release).not.toHaveBeenCalled();
    });

    it.each([
      ['create', SALES_ERROR_CODES.RIGHT_CREATE],
      ['post', SALES_ERROR_CODES.RIGHT_POST],
      ['cancel', SALES_ERROR_CODES.RIGHT_CANCEL],
    ])('refuses without %s on menu 11, before locking anything', async (right, code) => {
      rights[right] = false;

      const refusal = await refusalOf(service.merge(mergeBody('x')));

      expect(refusal.status).toBe(403);
      expect(refusal.body.errors[0].code).toBe(code);
      expect(tx.saleOrder.findMany).not.toHaveBeenCalled();
    });

    it('throws the first business refusal with its own status', async () => {
      stored = [
        orderRow(),
        orderRow({
          soId: NEW_ID,
          soCustId: OTHER_CUST,
          soOrderDatetime: new Date('2026-11-05T05:00:00.000Z'),
        }),
      ];
      const party = await refusalOf(service.merge(mergeBody('x')));
      expect(party.status).toBe(400);
      expect(party.body.errors[0].code).toBe(SALES_ERROR_CODES.ORDER_MERGE_ONE_PARTY);

      stored = [orderRow({ soDeliveryHold: true }), stored[1]];
      const held = await refusalOf(service.merge(mergeBody('x')));
      expect(held.status).toBe(409);
      expect(held.body.errors[0].code).toBe(SALES_ERROR_CODES.ORDER_DELIVERY_HOLD);

      stored = [orderRow()];
      const missing = await refusalOf(service.merge(mergeBody('x')));
      expect(missing.status).toBe(404);
      expect(missing.body.errors[0].code).toBe(SALES_ERROR_CODES.NOT_FOUND);
      expect(orders.createOrderInTx).not.toHaveBeenCalled();
    });

    it('leaves soOrderAmt out without Receipt View', async () => {
      const fp = await fingerprint();
      receipt.view = false;

      const { data } = await service.merge(mergeBody(fp));

      expect(data).not.toHaveProperty('soOrderAmt');
      expect(data.soTotWeight).toBe(500);
    });

    it('defaults the reason', async () => {
      const fp = await fingerprint();

      await service.merge(mergeBody(fp, { reason: undefined }));

      expect(orders.createOrderInTx.mock.calls[0][1].soRemarks).toBe(
        'Made from SO/1042 + SO/1046: Merged on the order desk',
      );
    });

    it('re-throws a number clash as the order create answers it', async () => {
      const fp = await fingerprint();
      const clash = new Error('P2002');
      orders.createOrderInTx.mockRejectedValueOnce(clash);

      await expect(service.merge(mergeBody(fp))).rejects.toBe(clash);
      expect(orders.throwIfDuplicate).toHaveBeenCalledWith(clash);
    });
  });
});
