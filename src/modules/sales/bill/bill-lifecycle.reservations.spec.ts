import { Prisma, type SaleBill, type SaleBillItem } from '@prisma/client';
import { HttpException } from '@nestjs/common';
import { createGuardContext, SALES_ERROR_CODES } from '../posting/types/posting.types';
import { BillLifecycleService, orderLineQtys } from './bill-lifecycle.service';

/**
 * The order reservations a bill moves on post, cancel and amend
 * (afterStatusChange). The amend re-post moves them by the NET change per
 * order line: the bill's unwind gives nothing back, so taking the new lines
 * alone consumed the posted quantity a second time (2026-11-11).
 */
const SO_A = '019c6f6c-be87-7a11-8905-36092c46aa01';
const SO_B = '019c6f6c-be87-7a11-8905-36092c46bb02';
const NOW = new Date('2026-11-11T06:00:00.000Z');

const item = (o: {
  so?: string | null;
  line?: number | null;
  qty: number;
  factor?: number;
  type?: string | null;
}): SaleBillItem =>
  ({
    sbiSrcDocType: o.type === undefined ? 'SALES_ORDER' : o.type,
    sbiSrcDocId: o.so === undefined ? SO_A : o.so,
    sbiSrcDocLineNo: o.line === undefined ? 1 : o.line,
    sbiBillQty: new Prisma.Decimal(o.qty),
    sbiToBaseFactor: new Prisma.Decimal(o.factor ?? 1),
  }) as unknown as SaleBillItem;

const bill = (status: string): SaleBill =>
  ({ sbId: 'bill-1', sbAccYear: '2026-2027', sbBillRefno: 'SB/1', sbStatus: status }) as SaleBill;

/** The service with only what afterStatusChange touches. */
const harness = () => {
  const consume = jest.fn().mockResolvedValue(undefined);
  const syncOrderFulfilment = jest.fn().mockResolvedValue(undefined);
  const svc = Object.create(BillLifecycleService.prototype) as Record<string, unknown>;
  Object.assign(svc, {
    reservations: { consume },
    saleOrders: { syncOrderFulfilment },
    bills: { orderRefsOf: jest.fn().mockReturnValue([]) },
    dcFulfilment: {
      dcRefsOfBill: jest.fn().mockResolvedValue([]),
      recompute: jest.fn().mockResolvedValue(undefined),
    },
  });
  const tx = {} as Prisma.TransactionClient;
  const run = (b: SaleBill, items: SaleBillItem[], prior?: SaleBillItem[]) =>
    (
      svc as unknown as {
        afterStatusChange: (...a: unknown[]) => Promise<void>;
      }
    ).afterStatusChange(tx, b, items, 'actor', NOW, prior);
  /** [orderId, lineNo, baseQty] of each consume() call. */
  const moves = () =>
    consume.mock.calls.map(([, order, qty]) => [
      (order as { docId: string }).docId,
      (order as { lineNo: number }).lineNo,
      Number(qty as Prisma.Decimal),
    ]);
  return { run, moves, consume, syncOrderFulfilment, tx };
};

describe('orderLineQtys', () => {
  it('signs each order-sourced line in base units and skips the rest', () => {
    const out = orderLineQtys(
      [
        item({ qty: 2, factor: 12 }),
        item({ qty: 3, type: 'DELIVERY_CHALLAN' }),
        item({ qty: 4, so: null }),
        item({ qty: 5, line: null }),
        item({ qty: 1.5, factor: 0 }),
      ],
      -1,
    );

    expect(out.map((m) => [m.docId, m.lineNo, m.baseQty.toString()])).toEqual([
      [SO_A, 1, '-24'],
      // A factor of 0 (the column default) counts as 1.
      [SO_A, 1, '-1.5'],
    ]);
  });
});

describe('BillLifecycleService.afterStatusChange — order reservations', () => {
  it('a post takes each line’s quantity', async () => {
    const h = harness();

    await h.run(bill('POSTED'), [item({ qty: 4 }), item({ line: 2, qty: 1, factor: 10 })]);

    expect(h.moves()).toEqual([
      [SO_A, 1, 4],
      [SO_A, 2, 10],
    ]);
    expect(h.syncOrderFulfilment).toHaveBeenCalledTimes(1);
  });

  it('a cancel gives each line’s quantity back', async () => {
    const h = harness();

    await h.run(bill('CANCELLED'), [item({ qty: 4 })]);

    expect(h.moves()).toEqual([[SO_A, 1, -4]]);
  });

  describe('an amend’s re-post moves the net change, never old + new', () => {
    it('quantity up: takes only the increase', async () => {
      const h = harness();

      await h.run(bill('POSTED'), [item({ qty: 7 })], [item({ qty: 4 })]);

      expect(h.moves()).toEqual([[SO_A, 1, 3]]);
    });

    it('quantity down: gives back only the decrease', async () => {
      const h = harness();

      await h.run(bill('POSTED'), [item({ qty: 2 })], [item({ qty: 4 })]);

      expect(h.moves()).toEqual([[SO_A, 1, -2]]);
    });

    it('quantity unchanged (a rate or lot change): touches no reservation', async () => {
      const h = harness();

      await h.run(bill('POSTED'), [item({ qty: 4 })], [item({ qty: 4 })]);

      expect(h.consume).not.toHaveBeenCalled();
      // The fulfilment is still re-derived.
      expect(h.syncOrderFulfilment).toHaveBeenCalledTimes(1);
    });

    it('a dropped line gives its whole quantity back; an added line from another order takes', async () => {
      const h = harness();

      await h.run(
        bill('POSTED'),
        [item({ qty: 4 }), item({ so: SO_B, line: 3, qty: 6 })],
        [item({ qty: 4 }), item({ line: 2, qty: 5 })],
      );

      expect(h.moves()).toEqual([
        [SO_B, 3, 6],
        [SO_A, 2, -5],
      ]);
    });

    it('a line split over two bill rows, or a unit change, nets in base units', async () => {
      const h = harness();

      // Posted: 1 box of 12. Now: 5 pieces + 5 pieces on two rows of the same order line.
      await h.run(
        bill('POSTED'),
        [item({ qty: 5 }), item({ qty: 5 })],
        [item({ qty: 1, factor: 12 })],
      );

      expect(h.moves()).toEqual([[SO_A, 1, -2]]);
    });

    it('a line moved from one order line to another gives back on the old and takes on the new', async () => {
      const h = harness();

      await h.run(bill('POSTED'), [item({ line: 2, qty: 4 })], [item({ line: 1, qty: 4 })]);

      expect(h.moves()).toEqual([
        [SO_A, 2, 4],
        [SO_A, 1, -4],
      ]);
    });

    it('passes exact decimals to consume()', async () => {
      const h = harness();

      await h.run(bill('POSTED'), [item({ qty: 0.3 })], [item({ qty: 0.1 })]);

      expect((h.consume.mock.calls[0][2] as Prisma.Decimal).toString()).toBe('0.2');
    });
  });
});

describe('BillLifecycleService.afterStatusChange — the orders re-derived', () => {
  it('re-derives the orders of the posted lines too after an amend (a dropped order line)', async () => {
    const h = harness();
    const svc = Object.create(BillLifecycleService.prototype) as Record<string, unknown>;
    const orderRefsOf = jest.fn((_b: unknown, list: SaleBillItem[]) =>
      list.map((i) => ({ srcDocId: i.sbiSrcDocId })),
    );
    Object.assign(svc, {
      reservations: { consume: jest.fn() },
      saleOrders: { syncOrderFulfilment: h.syncOrderFulfilment },
      bills: { orderRefsOf },
      dcFulfilment: { dcRefsOfBill: jest.fn().mockResolvedValue([]), recompute: jest.fn() },
    });

    await (
      svc as unknown as { afterStatusChange: (...a: unknown[]) => Promise<void> }
    ).afterStatusChange(h.tx, bill('POSTED'), [item({ qty: 4 })], 'actor', NOW, [
      item({ qty: 4 }),
      item({ so: SO_B, qty: 2 }),
    ]);

    const refs = (h.syncOrderFulfilment.mock.calls[0][1] as { refs: { srcDocId: string }[] }).refs;
    expect(refs.map((r) => r.srcDocId)).toEqual([SO_A, SO_A, SO_B]);
  });
});

/** guardSources on its own: the source orders under their lock, and the hold. */
describe('BillLifecycleService.guardSources — the delivery hold', () => {
  const LINE = '019c6f6c-be87-7a11-8905-36092c46cc01';
  const sources = (rows: Record<string, unknown>[]) => {
    const queryRaw = jest.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      if (sql.includes('FOR UPDATE OF h')) return rows;
      if (sql.includes('SELECT soi_id, soi_order_id'))
        return [{ soi_id: LINE, soi_order_id: SO_A }];
      if (sql.includes('soi_pending_qty'))
        return [{ soi_id: LINE, soi_pending_qty: new Prisma.Decimal(100), so_status: 'CONFIRMED' }];
      return [];
    });
    return { queryRaw, tx: { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient };
  };
  const HELD = {
    so_id: SO_A,
    so_order_refno: 'SO/7',
    so_status: 'CONFIRMED',
    so_delivery_hold: true,
    so_delivery_hold_reason: 'After 15th',
  };
  const snap = (qty: number, extra: Record<string, unknown>[] = []) =>
    ({
      srcDocType: 'SALES_ORDER',
      srcDocId: SO_A,
      items: [
        { srcDocType: 'SALES_ORDER', srcDocId: SO_A, srcItemId: LINE, qty, toBaseFactor: 1 },
        ...extra,
      ],
    }) as never;
  const prior = (qty: number) =>
    ({
      sbiSrcDocType: 'SALES_ORDER',
      sbiSrcDocId: SO_A,
      sbiSrcItemId: LINE,
      sbiSrcDocLineNo: 1,
      sbiBillQty: new Prisma.Decimal(qty),
      sbiToBaseFactor: new Prisma.Decimal(1),
    }) as unknown as SaleBillItem;
  const run = async (tx: Prisma.TransactionClient, s: unknown, before?: SaleBillItem[]) => {
    const g = createGuardContext({ throwOnRefusal: false });
    const svc = Object.create(BillLifecycleService.prototype) as {
      guardSources: (...a: unknown[]) => Promise<void>;
    };
    await svc.guardSources(tx, s, g, false, before);
    return g.refusals.map((r) => r.code);
  };

  it('locks the source orders FOR UPDATE, in so_id order, before reading anything else', async () => {
    const { tx, queryRaw } = sources([HELD]);

    await run(tx, snap(4));

    const first = (queryRaw.mock.calls[0][0] as TemplateStringsArray).join('?');
    expect(first).toContain('ORDER BY h.so_id');
    expect(first).toContain('FOR UPDATE OF h');
    expect(first).toContain('h.so_delivery_hold');
  });

  it('refuses a new post on a held order', async () => {
    const { tx } = sources([HELD]);

    expect(await run(tx, snap(4))).toEqual([SALES_ERROR_CODES.ORDER_DELIVERY_HOLD]);
  });

  it.each([
    ['the same qty (a rate fix)', 4],
    ['a lower qty', 2],
  ])('lets an amend with %s through on a held order', async (_label, qty) => {
    const { tx } = sources([HELD]);

    expect(await run(tx, snap(qty), [prior(4)])).toEqual([]);
  });

  it('lets an amend that drops the held order’s line through', async () => {
    const { tx } = sources([HELD]);
    const other = { srcDocType: null, srcDocId: null, srcItemId: null, qty: 1, toBaseFactor: 1 };

    expect(await run(tx, { srcDocType: null, srcDocId: null, items: [other] }, [prior(4)])).toEqual(
      [],
    );
  });

  it('refuses an amend that raises the qty, or adds a line, from the held order', async () => {
    const { tx } = sources([HELD]);
    expect(await run(tx, snap(5), [prior(4)])).toEqual([SALES_ERROR_CODES.ORDER_DELIVERY_HOLD]);

    const added = sources([HELD]);
    const extra = {
      srcDocType: 'SALES_ORDER',
      srcDocId: SO_A,
      srcItemId: null,
      qty: 1,
      toBaseFactor: 1,
    };
    expect(await run(added.tx, snap(4, [extra]), [prior(4)])).toEqual([
      SALES_ERROR_CODES.ORDER_DELIVERY_HOLD,
    ]);
  });

  it('still refuses an order that is not open, read under the same lock', async () => {
    const { tx } = sources([{ ...HELD, so_delivery_hold: false, so_status: 'DRAFT' }]);

    expect(await run(tx, snap(4))).toEqual([SALES_ERROR_CODES.ORDER_NOT_OPEN]);
  });
});

/** Lock order (review 2026-11-11): the source orders before any stock write. */
describe('BillLifecycleService.cancelIn — lock order', () => {
  it('locks the bill’s source orders before the unwind touches stock', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const tx = {
      $queryRaw: queryRaw,
      saleBillItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            sbiSrcDocType: 'SALES_ORDER',
            sbiSrcDocId: SO_A,
            sbiSrcItemId: '019c6f6c-be87-7a11-8905-36092c46cc01',
          },
        ]),
      },
    } as unknown as Prisma.TransactionClient;
    const unwind = jest.fn().mockRejectedValue(new HttpException('stop here', 418));
    const svc = Object.create(BillLifecycleService.prototype) as Record<string, unknown>;
    Object.assign(svc, { assertUnwindable: jest.fn(), unwind });

    await expect(
      (svc as unknown as { cancelIn: (...a: unknown[]) => Promise<unknown> }).cancelIn(
        tx,
        { ...bill('POSTED'), sbSrcDocType: 'SALES_ORDER', sbSrcDocId: SO_A },
        { actor: 'a', actorName: 'A' },
        'why',
        NOW,
      ),
    ).rejects.toThrow('stop here');

    const lockCall = queryRaw.mock.calls.findIndex((c) =>
      (c[0] as TemplateStringsArray).join('?').includes('FOR UPDATE OF h'),
    );
    expect(lockCall).toBeGreaterThanOrEqual(0);
    expect(queryRaw.mock.calls[lockCall].slice(1)).toEqual([
      [SO_A],
      ['019c6f6c-be87-7a11-8905-36092c46cc01'],
    ]);
    expect(queryRaw.mock.invocationCallOrder[lockCall]).toBeLessThan(
      unwind.mock.invocationCallOrder[0],
    );
  });
});

describe('BillLifecycleService.amend — lock order', () => {
  it('locks the posted AND the new lines’ source orders before the unwind touches stock', async () => {
    const NEW_LINE = '019c6f6c-be87-7a11-8905-36092c46cc02';
    const queryRaw = jest.fn().mockResolvedValue([]);
    const tx = {
      $queryRaw: queryRaw,
      saleBillItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { sbiSrcDocType: 'SALES_ORDER', sbiSrcDocId: SO_A, sbiSrcItemId: null },
          ]),
      },
    };
    const unwind = jest.fn().mockRejectedValue(new HttpException('stop here', 418));
    const svc = Object.create(BillLifecycleService.prototype) as Record<string, unknown>;
    Object.assign(svc, {
      prisma: { $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)) },
      bills: {
        lockHeader: jest.fn().mockResolvedValue({
          ...bill('POSTED'),
          sbCompanyId: 'c',
          sbBranchId: 'b',
          sbRevisionNo: 1,
          sbDocRegisterId: null,
        }),
        getById: jest.fn().mockResolvedValue({}),
      },
      salesContext: {
        resolve: jest.fn().mockResolvedValue({
          actor: 'a',
          rights: { amend: true },
          settings: { allowPostedAmend: true },
        }),
      },
      assertUnwindable: jest.fn(),
      unwind,
    });

    await expect(
      (svc as unknown as { amend: (d: unknown) => Promise<unknown> }).amend({
        sbId: 'bill-1',
        sbCompanyId: 'c',
        sbBranchId: 'b',
        sbAccYear: '2026-2027',
        baseRevision: 1,
        editRemark: 'more',
        items: [{ sbiSrcDocType: 'SALES_ORDER', sbiSrcDocId: SO_B, sbiSrcItemId: NEW_LINE }],
      }),
    ).rejects.toThrow('stop here');

    const lockCall = queryRaw.mock.calls.findIndex((c) =>
      (c[0] as TemplateStringsArray).join('?').includes('FOR UPDATE OF h'),
    );
    expect(queryRaw.mock.calls[lockCall].slice(1)).toEqual([[SO_A, SO_B], [NEW_LINE]]);
    expect(queryRaw.mock.invocationCallOrder[lockCall]).toBeLessThan(
      unwind.mock.invocationCallOrder[0],
    );
  });
});
