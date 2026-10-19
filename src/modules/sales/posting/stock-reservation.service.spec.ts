import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  ensureBalanceRows,
  refreshReserved,
} from '../../stocks/stock-voucher/stock-voucher-posting.helper';
import { StockReservationService, type ReservationLine } from './stock-reservation.service';

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

      const out = await service.reserve(tx, DOC, [line({ qty: 1, itemUnitId: 'iuc-box' })], 'a', NOW);

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
      const tx = { $executeRaw: jest.fn().mockResolvedValue(0) } as unknown as Prisma.TransactionClient;

      await service.release(tx, { docType: 'SALES_ORDER', docId: ORDER_ID }, 'x', 'a', NOW);

      expect(refreshReserved).not.toHaveBeenCalled();
    });
  });

  describe('consume', () => {
    const reservation = (id: string, reserved: number, consumed: number, released = 0) => ({
      srv_id: id,
      srv_acc_year: '2026-2027',
      srv_reserved_qty: new Prisma.Decimal(reserved),
      srv_consumed_qty: new Prisma.Decimal(consumed),
      srv_released_qty: new Prisma.Decimal(released),
    });
    const consumeTx = (rows: unknown[]) => {
      const executeRaw = jest.fn().mockResolvedValue(1);
      return {
        executeRaw,
        tx: {
          $queryRaw: jest.fn().mockResolvedValue(rows),
          $executeRaw: executeRaw,
        } as unknown as Prisma.TransactionClient,
      };
    };
    /** [srv_id, consumed, status] of each UPDATE. */
    const updates = (executeRaw: jest.Mock) =>
      executeRaw.mock.calls.map((call) => [call[7], call[1], call[2]]);

    it('does nothing for a zero quantity', async () => {
      const { tx, executeRaw } = consumeTx([reservation('r1', 5, 0)]);

      await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, 0, 'a', NOW);

      expect(executeRaw).not.toHaveBeenCalled();
      expect(refreshReserved).not.toHaveBeenCalled();
    });

    it('takes from the reservations in order, closing the ones it fills', async () => {
      const { tx, executeRaw } = consumeTx([reservation('r1', 5, 0), reservation('r2', 5, 0)]);

      await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, 7, 'a', NOW);

      expect(updates(executeRaw)).toEqual([
        ['r1', 5, 'CONSUMED'],
        ['r2', 2, 'PARTIAL'],
      ]);
      expect(refreshReserved).toHaveBeenCalledTimes(1);
    });

    it('marks a reservation part released and part consumed as RELEASED once it is used up', async () => {
      const { tx, executeRaw } = consumeTx([reservation('r1', 5, 2, 2)]);

      await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, 1, 'a', NOW);

      expect(updates(executeRaw)).toEqual([['r1', 3, 'RELEASED']]);
    });

    it('gives back a negative quantity, reopening what it frees', async () => {
      const { tx, executeRaw } = consumeTx([
        reservation('r1', 5, 0),
        reservation('r2', 5, 5),
        reservation('r3', 5, 2),
      ]);

      await service.consume(tx, { docId: ORDER_ID, lineNo: 1 }, -6, 'a', NOW);

      expect(updates(executeRaw)).toEqual([
        ['r2', 0, 'OPEN'],
        ['r3', 1, 'PARTIAL'],
      ]);
    });
  });
});
