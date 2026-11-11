import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  ensureBalanceRows,
  refreshReserved,
} from '../../stocks/stock-voucher/stock-voucher-posting.helper';
import {
  netOrderLineMoves,
  StockReservationService,
  type ReservationLine,
} from './stock-reservation.service';

jest.mock('../../stocks/stock-voucher/stock-voucher-posting.helper', () => ({
  ensureBalanceRows: jest.fn().mockResolvedValue(undefined),
  refreshReserved: jest.fn().mockResolvedValue(undefined),
  reservationHoldingsOf: jest.fn((docType: string, docId: string) => `${docType}:${docId}`),
}));

const ORDER_ID = '019c6f6c-be87-7a11-8905-36092c46ae01';
const NOW = new Date('2026-10-19T06:00:00.000Z');
const DOC = {
  docType: 'SALES_ORDER' as const,
  docId: ORDER_ID,
  accYear: '2026-2027',
  companyId: 'company-1',
  branchId: 'branch-1',
  refno: 'SO/42',
};

const line = (overrides: Partial<ReservationLine> = {}): ReservationLine => ({
  lineId: 'line-1',
  lineNo: 1,
  itemId: 'item-1',
  itemUnitId: 'iuc-pcs',
  godownId: 'godown-1',
  qty: 5,
  ...overrides,
});

/** Positions of the values bound into the reservation INSERT. */
const INSERT_LOT = 6;
const INSERT_TAKE = 14;

describe('StockReservationService', () => {
  const service = new StockReservationService({} as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  describe('reserve', () => {
    /** A godown whose holdings are `free` per lot, in FEFO order, and a unit of `factor`. */
    const reserveTx = (free: [lotId: string, qty: number][], factor = 1) => {
      const queryRaw = jest.fn(async (strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('inventory.item_unit_conversion')) {
          return [{ base_iuc_id: 'iuc-base', iuc_to_base_factor: new Prisma.Decimal(factor) }];
        }
        if (sql.includes('stock.stock_balance')) {
          return free.map(([lot, qty]) => ({ sbl_lot_id: lot, free: new Prisma.Decimal(qty) }));
        }
        throw new Error(`unrouted SQL: ${sql.slice(0, 80)}`);
      });
      const executeRaw = jest.fn().mockResolvedValue(1);
      return {
        queryRaw,
        executeRaw,
        tx: { $queryRaw: queryRaw, $executeRaw: executeRaw } as unknown as Prisma.TransactionClient,
      };
    };
    const inserts = (executeRaw: jest.Mock) =>
      executeRaw.mock.calls
        .filter(([strings]) => (strings as TemplateStringsArray).join('?').includes('INSERT'))
        .map((call) => [call[1 + INSERT_LOT], call[1 + INSERT_TAKE]]);

    it('skips a line with nothing to reserve', async () => {
      const { tx, queryRaw } = reserveTx([]);

      const out = await service.reserve(tx, DOC, [line({ qty: 0 })], 'actor', NOW);

      expect(out).toEqual({ reserved: new Map(), warnings: [] });
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('warns, and reserves nothing, for a line with no godown', async () => {
      const { tx, queryRaw } = reserveTx([]);

      const out = await service.reserve(tx, DOC, [line({ godownId: null, lineNo: 3 })], 'a', NOW);

      expect(out.warnings).toEqual([
        {
          code: 'SALES_RESERVE_SHORT',
          line: 3,
          short: 5,
          message: 'Line 3: no godown on the line, nothing reserved',
        },
      ]);
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('walks the lots in the order given, skipping empty ones, until the line is covered', async () => {
      const { tx, executeRaw } = reserveTx([
        ['lot-a', 3],
        ['lot-b', 0],
        ['lot-c', 10],
        ['lot-d', 10],
      ]);

      const out = await service.reserve(tx, DOC, [line()], 'actor', NOW);

      expect(inserts(executeRaw)).toEqual([
        ['lot-a', 3],
        ['lot-c', 2],
      ]);
      expect(out).toEqual({ reserved: new Map([['line-1', 5]]), warnings: [] });
    });

    it('releases the line’s earlier reservation and refreshes the balance before reading it', async () => {
      const { tx, executeRaw, queryRaw } = reserveTx([['lot-a', 10]]);

      await service.reserve(tx, DOC, [line()], 'actor', NOW);

      const first = (executeRaw.mock.calls[0][0] as TemplateStringsArray).join('?');
      expect(first).toContain("srv_status = 'RELEASED'");
      const refreshOrder = (refreshReserved as jest.Mock).mock.invocationCallOrder[0];
      const balanceRead = queryRaw.mock.invocationCallOrder[1];
      expect(refreshOrder).toBeLessThan(balanceRead);
      expect(ensureBalanceRows).toHaveBeenCalledWith(tx, `SALES_ORDER:${ORDER_ID}`, 'actor');
      expect(refreshReserved).toHaveBeenCalledTimes(2);
    });

    it('reserves in base units and reports the line in its own unit', async () => {
      // A box of 12: one box wants 12 pieces off the shelf.
      const { tx, executeRaw } = reserveTx([['lot-a', 20]], 12);

      const out = await service.reserve(
        tx,
        DOC,
        [line({ qty: 1, itemUnitId: 'iuc-box' })],
        'a',
        NOW,
      );

      expect(inserts(executeRaw)).toEqual([['lot-a', 12]]);
      expect(out.reserved.get('line-1')).toBe(1);
    });

    it('warns with what it could not cover, and keeps what it could', async () => {
      const { tx } = reserveTx([['lot-a', 2]]);

      const out = await service.reserve(tx, DOC, [line({ lineNo: 2 })], 'actor', NOW);

      expect(out.reserved.get('line-1')).toBe(2);
      expect(out.warnings).toEqual([
        {
          code: 'SALES_RESERVE_SHORT',
          line: 2,
          short: 3,
          message: 'Line 2: only 2 of 5 could be reserved (3 short)',
        },
      ]);
    });
  });

  describe('release', () => {
    it('releases every open reservation of the document and refreshes the balance', async () => {
      const executeRaw = jest.fn().mockResolvedValue(3);
      const tx = { $executeRaw: executeRaw } as unknown as Prisma.TransactionClient;

      await expect(
        service.release(tx, { docType: 'SALES_ORDER', docId: ORDER_ID }, 'Cancelled', 'a', NOW),
      ).resolves.toBe(3);
      expect(refreshReserved).toHaveBeenCalledWith(tx, `SALES_ORDER:${ORDER_ID}`, 'a', NOW);
    });

    it('leaves the balance alone when nothing was open', async () => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(0),
      } as unknown as Prisma.TransactionClient;

      await service.release(tx, { docType: 'SALES_ORDER', docId: ORDER_ID }, 'x', 'a', NOW);

      expect(refreshReserved).not.toHaveBeenCalled();
    });
  });

  describe('consume', () => {
    type Row = {
      id: string;
      reserved: number;
      consumed: number;
      released?: number;
      status?: string;
      lot?: string;
    };
    /** A reservation row as the SELECT returns it; the key differs only by lot here. */
    const reservation = ({ id, reserved, consumed, released = 0, status, lot = 'lot-a' }: Row) => ({
      srv_id: id,
      srv_acc_year: '2026-2027',
      srv_src_module: 'SALES',
      srv_lot_id: lot,
      srv_godown_id: 'godown-1',
      srv_bucket: 'SALEABLE',
      srv_status:
        status ??
        (consumed + released >= reserved
          ? released > 0
            ? 'RELEASED'
            : 'CONSUMED'
          : consumed > 0
            ? 'PARTIAL'
            : 'OPEN'),
      srv_reserved_qty: new Prisma.Decimal(reserved),
      srv_consumed_qty: new Prisma.Decimal(consumed),
      srv_released_qty: new Prisma.Decimal(released),
    });
    const consumeTx = (rows: unknown[]) => {
      const executeRaw = jest.fn().mockResolvedValue(1);
      const queryRaw = jest.fn().mockResolvedValue(rows);
      return {
        executeRaw,
        queryRaw,
        tx: { $queryRaw: queryRaw, $executeRaw: executeRaw } as unknown as Prisma.TransactionClient,
      };
    };
    const n = (v: unknown) => Number(v as Prisma.Decimal);
    /**
     * Each UPDATE, by what it writes:
     *   ['consumed', id, consumed, status]           a take, or a give-back on the row itself
     *   ['handed', id, consumed, released, status]   the old row of a hand-over
     *   ['holds', id, reserved, status]              the live row it was handed to
     */
    const updates = (executeRaw: jest.Mock) =>
      executeRaw.mock.calls.map((call) => {
        const sql = (call[0] as TemplateStringsArray).join('?');
        if (sql.includes('srv_released_qty =')) {
          return ['handed', call[8], n(call[1]), n(call[2]), call[3]];
        }
        if (sql.includes('srv_reserved_qty =')) {
          return ['holds', call[5], n(call[1]), call[2]];
        }
        return ['consumed', call[7], n(call[1]), call[2]];
      });
    const sqlOf = (executeRaw: jest.Mock, i: number) =>
      (executeRaw.mock.calls[i][0] as TemplateStringsArray).join('?');

    it('does nothing for a zero quantity', async () => {
      const { tx, executeRaw, queryRaw } = consumeTx([
        reservation({ id: 'r1', reserved: 5, consumed: 0 }),
      ]);

      await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, 0, 'a', NOW);

      expect(queryRaw).not.toHaveBeenCalled();
      expect(executeRaw).not.toHaveBeenCalled();
      expect(refreshReserved).not.toHaveBeenCalled();
    });

    it('takes from the reservations in order, closing the ones it fills', async () => {
      const { tx, executeRaw } = consumeTx([
        reservation({ id: 'r1', reserved: 5, consumed: 0 }),
        reservation({ id: 'r2', reserved: 5, consumed: 0, lot: 'lot-b' }),
      ]);

      await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, 7, 'a', NOW);

      expect(updates(executeRaw)).toEqual([
        ['consumed', 'r1', 5, 'CONSUMED'],
        ['consumed', 'r2', 2, 'PARTIAL'],
      ]);
      expect(refreshReserved).toHaveBeenCalledTimes(1);
      expect(refreshReserved).toHaveBeenCalledWith(tx, `SALES_ORDER:${ORDER_ID}`, 'a', NOW);
    });

    it('marks a reservation part released and part consumed as RELEASED once it is used up', async () => {
      const { tx, executeRaw } = consumeTx([
        reservation({ id: 'r1', reserved: 5, consumed: 2, released: 2, status: 'PARTIAL' }),
      ]);

      await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, 1, 'a', NOW);

      expect(updates(executeRaw)).toEqual([['consumed', 'r1', 3, 'RELEASED']]);
    });

    it('reads RELEASED rows only for a give-back, and after every other row', async () => {
      const take = consumeTx([]);
      await service.consume(take.tx, { docId: ORDER_ID, lineNo: 1 }, 2, 'a', NOW);
      const give = consumeTx([]);
      await service.consume(give.tx, { docId: ORDER_ID, lineNo: 1 }, -2, 'a', NOW);

      const [strings, ...values] = take.queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      const sql = strings.join('?');
      expect(sql).toContain("r.srv_status = 'RELEASED' AND r.srv_consumed_qty > 0");
      expect(sql).toContain("ORDER BY (r.srv_status = 'RELEASED'), l.slt_expiry_date NULLS LAST");
      expect(values).toContain(false);
      expect(give.queryRaw.mock.calls[0].slice(1)).toContain(true);
      // Nothing found, nothing written, no balance refresh.
      expect(take.executeRaw).not.toHaveBeenCalled();
      expect(refreshReserved).not.toHaveBeenCalled();
    });

    it('gives back a negative quantity, reopening what it frees', async () => {
      const { tx, executeRaw } = consumeTx([
        reservation({ id: 'r1', reserved: 5, consumed: 0 }),
        reservation({ id: 'r2', reserved: 5, consumed: 5, lot: 'lot-b' }),
        reservation({ id: 'r3', reserved: 5, consumed: 2, lot: 'lot-c' }),
      ]);

      await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, -6, 'a', NOW);

      expect(updates(executeRaw)).toEqual([
        ['consumed', 'r2', 0, 'OPEN'],
        ['consumed', 'r3', 1, 'PARTIAL'],
      ]);
      expect(sqlOf(executeRaw, 0)).toContain('THEN ? ELSE NULL END');
    });

    describe('after an amend (a terminal row and a live row on one key)', () => {
      it('hands a fully consumed row’s give-back to the live row instead of reopening it', async () => {
        // Ordered 10, billed 10 from lot A, amended to 15: a new OPEN hold of 5
        // on lot A. Cancelling the bill must leave the order holding 15.
        const { tx, executeRaw } = consumeTx([
          reservation({ id: 'old', reserved: 10, consumed: 10 }),
          reservation({ id: 'new', reserved: 5, consumed: 0 }),
        ]);

        await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, -10, 'a', NOW);

        expect(updates(executeRaw)).toEqual([
          ['handed', 'old', 0, 10, 'RELEASED'],
          ['holds', 'new', 15, 'OPEN'],
        ]);
        const handed = sqlOf(executeRaw, 0);
        expect(handed).toContain('srv_closed_on = COALESCE(srv_closed_on, ?)');
        expect(handed).toContain('srv_close_reason = COALESCE(srv_close_reason, ?)');
        expect(handed).not.toContain('srv_open_qty');
        expect(sqlOf(executeRaw, 1)).not.toContain('srv_closed_on');
        expect(refreshReserved).toHaveBeenCalledTimes(1);
      });

      it('hands over part of a row, which stays RELEASED with the rest still consumed', async () => {
        const { tx, executeRaw } = consumeTx([
          reservation({ id: 'old', reserved: 10, consumed: 10 }),
          reservation({ id: 'new', reserved: 5, consumed: 2 }),
        ]);

        await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, -4, 'a', NOW);

        expect(updates(executeRaw)).toEqual([
          ['handed', 'old', 6, 4, 'RELEASED'],
          ['holds', 'new', 9, 'PARTIAL'],
        ]);
      });

      it('hands a RELEASED row’s consumed part to the live row (a PARTIAL row the amend released)', async () => {
        // Ordered 10, billed 4, amended to 15: the old row RELEASED 6 and kept 4
        // consumed; the new hold is 11. Cancelling the bill: the order holds 15.
        const { tx, executeRaw } = consumeTx([
          reservation({ id: 'new', reserved: 11, consumed: 0 }),
          reservation({ id: 'old', reserved: 10, consumed: 4, released: 6 }),
        ]);

        await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, -4, 'a', NOW);

        expect(updates(executeRaw)).toEqual([
          ['handed', 'old', 0, 10, 'RELEASED'],
          ['holds', 'new', 15, 'OPEN'],
        ]);
      });

      it('never reopens a RELEASED row with no live row on its key, but records the give-back on it', async () => {
        // A desk-closed order: 10 held, 4 billed, 6 released by the close.
        // Cancelling the bill brings no hold back; consumed follows the bill.
        const { tx, executeRaw } = consumeTx([
          reservation({ id: 'old', reserved: 10, consumed: 4, released: 6 }),
          reservation({ id: 'other-lot', reserved: 5, consumed: 0, lot: 'lot-b' }),
        ]);

        await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, -4, 'a', NOW);

        expect(updates(executeRaw)).toEqual([['handed', 'old', 0, 10, 'RELEASED']]);
        const [strings, ...values] = executeRaw.mock.calls[0] as [
          TemplateStringsArray,
          ...unknown[],
        ];
        const sql = strings.join('?');
        expect(sql).toContain('srv_closed_on = COALESCE(srv_closed_on, ?)');
        expect(sql).not.toContain('srv_reserved_qty');
        expect(sql).not.toContain('srv_open_qty');
        expect(values).toContain('Bill quantity given back after the hold was released');
        expect(refreshReserved).toHaveBeenCalledTimes(1);
      });

      it('records part of a give-back on a RELEASED row, which keeps the rest consumed', async () => {
        const { tx, executeRaw } = consumeTx([
          reservation({ id: 'old', reserved: 10, consumed: 4, released: 6 }),
        ]);

        await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, -2, 'a', NOW);

        expect(updates(executeRaw)).toEqual([['handed', 'old', 2, 8, 'RELEASED']]);
      });

      it('gives back on live and CONSUMED rows before a RELEASED row records the rest', async () => {
        // The SELECT puts RELEASED rows last; the walk keeps that order.
        const { tx, executeRaw } = consumeTx([
          reservation({ id: 'live-b', reserved: 5, consumed: 3, lot: 'lot-b' }),
          reservation({ id: 'done-c', reserved: 2, consumed: 2, lot: 'lot-c' }),
          reservation({ id: 'released-a', reserved: 10, consumed: 4, released: 6 }),
        ]);

        await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, -7, 'a', NOW);

        expect(updates(executeRaw)).toEqual([
          ['consumed', 'live-b', 0, 'OPEN'],
          ['consumed', 'done-c', 0, 'OPEN'],
          ['handed', 'released-a', 2, 8, 'RELEASED'],
        ]);
      });

      it('reopens a CONSUMED row when the live row is on another lot', async () => {
        const { tx, executeRaw } = consumeTx([
          reservation({ id: 'old', reserved: 10, consumed: 10 }),
          reservation({ id: 'new', reserved: 5, consumed: 0, lot: 'lot-b' }),
        ]);

        await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, -10, 'a', NOW);

        expect(updates(executeRaw)).toEqual([['consumed', 'old', 0, 'OPEN']]);
      });

      it('treats a row it reopened as the live row for the next one on the same key', async () => {
        // Two CONSUMED rows on lot A (billed, amended up, billed again) and no
        // live row: the first reopens, the second must not reopen beside it.
        const { tx, executeRaw } = consumeTx([
          reservation({ id: 'first', reserved: 10, consumed: 10 }),
          reservation({ id: 'second', reserved: 5, consumed: 5 }),
        ]);

        await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, -15, 'a', NOW);

        expect(updates(executeRaw)).toEqual([
          ['consumed', 'first', 0, 'OPEN'],
          ['handed', 'second', 0, 5, 'RELEASED'],
          ['holds', 'first', 15, 'OPEN'],
        ]);
      });

      it('gives back on the live row itself first when the live row holds the consumption', async () => {
        const { tx, executeRaw } = consumeTx([
          reservation({ id: 'new', reserved: 11, consumed: 3 }),
          reservation({ id: 'old', reserved: 10, consumed: 4, released: 6 }),
        ]);

        await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, -3, 'a', NOW);

        expect(updates(executeRaw)).toEqual([['consumed', 'new', 0, 'OPEN']]);
      });

      it('bills against the live row and leaves the terminal row alone', async () => {
        const { tx, executeRaw } = consumeTx([
          reservation({ id: 'old', reserved: 10, consumed: 10 }),
          reservation({ id: 'new', reserved: 5, consumed: 0 }),
        ]);

        await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, 3, 'a', NOW);

        expect(updates(executeRaw)).toEqual([['consumed', 'new', 3, 'PARTIAL']]);
      });

      it('works in exact decimals: no float drift on fractional quantities', async () => {
        const { tx, executeRaw } = consumeTx([
          reservation({ id: 'old', reserved: 0.3, consumed: 0.3 }),
          reservation({ id: 'new', reserved: 0.1, consumed: 0 }),
        ]);

        await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, -(0.1 + 0.2), 'a', NOW);

        const [handed, holds] = executeRaw.mock.calls;
        expect((handed[1] as Prisma.Decimal).toString()).toBe('0');
        expect((handed[2] as Prisma.Decimal).toString()).toBe('0.3');
        expect((holds[1] as Prisma.Decimal).toString()).toBe('0.4');
      });
    });
  });

  describe('netOrderLineMoves', () => {
    const q = (docId: string, lineNo: number, qty: number | string) => ({
      docId,
      lineNo,
      baseQty: new Prisma.Decimal(qty),
    });
    const flat = (out: ReturnType<typeof netOrderLineMoves>) =>
      out.map((m) => [m.docId, m.lineNo, m.baseQty.toString()]);

    it('nets each order line, keeps first-seen order, and drops lines that net to zero', () => {
      expect(
        flat(
          netOrderLineMoves([
            q('so-a', 1, 7),
            q('so-b', 1, 2),
            q('so-a', 2, 3),
            q('so-a', 1, -4),
            q('so-a', 2, -3),
          ]),
        ),
      ).toEqual([
        ['so-a', 1, '3'],
        ['so-b', 1, '2'],
      ]);
    });

    it('treats the same line number on two orders as two lines', () => {
      expect(flat(netOrderLineMoves([q('so-a', 1, 2), q('so-b', 1, -2)]))).toEqual([
        ['so-a', 1, '2'],
        ['so-b', 1, '-2'],
      ]);
    });

    it('drops a residue below the 4 dp consume() works in', () => {
      expect(netOrderLineMoves([q('so-a', 1, '1.00004'), q('so-a', 1, -1)])).toEqual([]);
    });
  });

  it('consume() accepts a Decimal quantity', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          srv_id: 'r1',
          srv_acc_year: '2026-2027',
          srv_src_module: 'SALES',
          srv_lot_id: 'lot-a',
          srv_godown_id: 'godown-1',
          srv_bucket: 'SALEABLE',
          srv_status: 'OPEN',
          srv_reserved_qty: new Prisma.Decimal(5),
          srv_consumed_qty: new Prisma.Decimal(0),
          srv_released_qty: new Prisma.Decimal(0),
        },
      ]),
      $executeRaw: executeRaw,
    } as unknown as Prisma.TransactionClient;

    await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, new Prisma.Decimal('2.5'), 'a', NOW);

    expect((executeRaw.mock.calls[0][1] as Prisma.Decimal).toString()).toBe('2.5');
  });
});
