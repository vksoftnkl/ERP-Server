import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ChargeCarryService } from './charge-carry.service';
import { SALES_ERROR_CODES } from './types/posting.types';

const ORDER = { orderId: '019c6f6c-be87-7a11-8905-36092c46ac01', accYear: '2026-2027' };
const LINE_1 = '019c6f6c-be87-7a11-8905-36092c46ac11';
const CHARGE_A = '019c6f6c-be87-7a11-8905-36092c46aca1';
const CHARGE_B = '019c6f6c-be87-7a11-8905-36092c46acb2';

type Answer = unknown[] | ((values: unknown[]) => unknown[]);

/** A `$queryRaw` that answers by the SQL it is handed; an unrouted statement fails. */
function routedQuery(routes: [needle: string, answer: Answer][]): jest.Mock {
  return jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join('?');
    const hit = routes.find(([needle]) => sql.includes(needle));
    if (!hit) {
      throw new Error(`unrouted SQL: ${sql.slice(0, 120)}`);
    }
    return typeof hit[1] === 'function' ? hit[1](values) : hit[1];
  });
}

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

const chargeRow = (overrides: Record<string, unknown> = {}) => ({
  cd_id: CHARGE_A,
  cd_acc_year: '2026-2027',
  cd_chg_id: 'chg-freight',
  cd_chg_name: 'Freight',
  cd_amount: new Prisma.Decimal(100),
  cd_carried_amt: null,
  cd_carry_basis: 'PRORATA',
  ...overrides,
});

describe('ChargeCarryService', () => {
  const service = new ChargeCarryService({} as PrismaService);

  describe('propose', () => {
    /** An order whose lines total 300 taxable, with `openLeft` lines this bill does not take. */
    const orderTx = (charges: unknown[], openLeft: number, orderTaxable = 300) => {
      const queryRaw = routedQuery([
        ['public.txn_charge_detail', charges],
        ['SUM(soi_taxable_amt)', [{ order_taxable: new Prisma.Decimal(orderTaxable) }]],
        ['COUNT(*) AS n', [{ n: BigInt(openLeft) }]],
      ]);
      return { queryRaw, tx: { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient };
    };
    const billLines = [{ srcLineId: LINE_1, taxableAmt: 100 }];

    it('offers nothing, and reads no further, for an order with no charges', async () => {
      const { tx, queryRaw } = orderTx([], 0);

      await expect(service.propose(tx, ORDER, billLines)).resolves.toEqual([]);
      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('offers a PRORATA charge in proportion to the taxable value the bill takes', async () => {
      const { tx } = orderTx([chargeRow()], 2);

      await expect(service.propose(tx, ORDER, billLines)).resolves.toEqual([
        {
          srcChargeId: CHARGE_A,
          srcAccYear: '2026-2027',
          chargeId: 'chg-freight',
          chargeName: 'Freight',
          amount: 100,
          alreadyCarried: 0,
          remaining: 100,
          basis: 'PRORATA',
          proposed: 33.33,
          completesOrder: false,
        },
      ]);
    });

    it('never offers more than is left of the charge', async () => {
      const { tx } = orderTx([chargeRow({ cd_carried_amt: new Prisma.Decimal(90) })], 1);

      const [proposal] = await service.propose(tx, ORDER, billLines);

      expect(proposal).toMatchObject({ remaining: 10, proposed: 10 });
    });

    it('hands the bill that completes the order the remainder, closing the rounding gap', async () => {
      const { tx } = orderTx([chargeRow({ cd_carried_amt: new Prisma.Decimal(66.66) })], 0);

      const [proposal] = await service.propose(tx, ORDER, billLines);

      expect(proposal).toMatchObject({ completesOrder: true, remaining: 33.34, proposed: 33.34 });
    });

    it('asks which order lines the bill leaves open by the ids it takes', async () => {
      const { tx, queryRaw } = orderTx([chargeRow()], 1);

      await service.propose(tx, ORDER, [
        { srcLineId: LINE_1, taxableAmt: 50 },
        { srcLineId: 'line-2', taxableAmt: 50 },
      ]);

      const [, ...values] = queryRaw.mock.calls[2] as [TemplateStringsArray, ...unknown[]];
      expect(values).toEqual([ORDER.orderId, ORDER.accYear, [LINE_1, 'line-2']]);
    });

    it.each([
      ['FULL', 100],
      ['NONE', 0],
      ['MANUAL', 0],
    ])('offers a %s charge %p', async (basis, proposed) => {
      const { tx } = orderTx([chargeRow({ cd_carry_basis: basis })], 2);

      const [proposal] = await service.propose(tx, ORDER, billLines);

      expect(proposal).toMatchObject({ basis, proposed });
    });

    it('takes the caller default basis for a charge that names none', async () => {
      const { tx } = orderTx([chargeRow({ cd_carry_basis: null })], 2);

      const [proposal] = await service.propose(tx, ORDER, billLines, { defaultBasis: 'FULL' });

      expect(proposal).toMatchObject({ basis: 'FULL', proposed: 100 });
    });

    it('offers nothing under PRORATA when the order has no taxable value to share by', async () => {
      const { tx } = orderTx([chargeRow()], 2, 0);

      const [proposal] = await service.propose(tx, ORDER, billLines);

      expect(proposal.proposed).toBe(0);
    });
  });

  describe('consume / release', () => {
    const carryTx = (locked: unknown[]) => {
      const queryRaw = routedQuery([['FOR UPDATE', locked]]);
      const executeRaw = jest.fn().mockResolvedValue(1);
      return {
        queryRaw,
        executeRaw,
        tx: { $queryRaw: queryRaw, $executeRaw: executeRaw } as unknown as Prisma.TransactionClient,
      };
    };
    const locked = (id: string, amount: number, carried: number | null) => ({
      cd_id: id,
      cd_amount: new Prisma.Decimal(amount),
      cd_carried_amt: carried === null ? null : new Prisma.Decimal(carried),
    });
    const deltasWritten = (executeRaw: jest.Mock) =>
      executeRaw.mock.calls.map(([, delta, id]) => [id, delta] as [unknown, unknown]);

    it('does nothing for rows that point at no order charge or carry nothing', async () => {
      const { tx, queryRaw } = carryTx([]);

      await expect(
        service.consume(tx, [
          { srcChargeId: null, srcAccYear: null, amount: 50 },
          { srcChargeId: CHARGE_A, srcAccYear: '2026-2027', amount: 0 },
        ]),
      ).resolves.toBe(0);
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('locks the source rows once each, in id order, before writing', async () => {
      const { tx, queryRaw } = carryTx([locked(CHARGE_A, 100, 0), locked(CHARGE_B, 100, 0)]);

      await service.consume(tx, [
        { srcChargeId: CHARGE_B, srcAccYear: '2026-2027', amount: 10 },
        { srcChargeId: CHARGE_A, srcAccYear: '2026-2027', amount: 10 },
        { srcChargeId: CHARGE_B, srcAccYear: '2026-2027', amount: 5 },
      ]);

      expect(queryRaw.mock.calls[0][1]).toEqual([CHARGE_A, CHARGE_B]);
    });

    it('nets several bill rows on one charge into one write', async () => {
      const { tx, executeRaw } = carryTx([locked(CHARGE_A, 100, 0), locked(CHARGE_B, 100, 0)]);

      await expect(
        service.consume(tx, [
          { srcChargeId: CHARGE_B, srcAccYear: '2026-2027', amount: 10 },
          { srcChargeId: CHARGE_A, srcAccYear: '2026-2027', amount: 12.5 },
          { srcChargeId: CHARGE_B, srcAccYear: '2026-2027', amount: 5 },
        ]),
      ).resolves.toBe(2);
      expect(deltasWritten(executeRaw)).toEqual([
        [CHARGE_B, '15.00'],
        [CHARGE_A, '12.50'],
      ]);
    });

    it('refuses to carry more than the order charge, judging the netted move', async () => {
      const { tx, executeRaw } = carryTx([locked(CHARGE_A, 100, 80)]);

      const refusal = await refusalOf(
        service.consume(tx, [
          { srcChargeId: CHARGE_A, srcAccYear: '2026-2027', amount: 15 },
          { srcChargeId: CHARGE_A, srcAccYear: '2026-2027', amount: 15 },
        ]),
      );

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'charges', code: SALES_ERROR_CODES.CHARGE_OVER_CARRY }] },
      });
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('lets a carry land exactly on the order charge', async () => {
      const { tx, executeRaw } = carryTx([locked(CHARGE_A, 100, 80)]);

      await service.consume(tx, [{ srcChargeId: CHARGE_A, srcAccYear: '2026-2027', amount: 20 }]);

      expect(executeRaw).toHaveBeenCalledTimes(1);
    });

    it('lets an override carry past the order charge', async () => {
      const { tx, executeRaw } = carryTx([locked(CHARGE_A, 100, 80)]);

      await service.consume(
        tx,
        [{ srcChargeId: CHARGE_A, srcAccYear: '2026-2027', amount: 30 }],
        { canOverride: true },
      );

      expect(deltasWritten(executeRaw)).toEqual([[CHARGE_A, '30.00']]);
    });

    it('gives a cancelled bill its carry back as a negative move, never refused', async () => {
      const { tx, executeRaw } = carryTx([locked(CHARGE_A, 100, 120)]);

      await expect(
        service.release(tx, [{ srcChargeId: CHARGE_A, srcAccYear: '2026-2027', amount: 33.33 }]),
      ).resolves.toBe(1);
      expect(deltasWritten(executeRaw)).toEqual([[CHARGE_A, '-33.33']]);
    });
  });
});
