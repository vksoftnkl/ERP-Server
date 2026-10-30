import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PromotionUsageService } from './promotion-usage.service';
import { SALES_ERROR_CODES } from './types/posting.types';
import type { PromotionApplied, PromotionUsageDoc } from './types/promotion.types';

const SCHEME_A = '019c6f6c-be87-7a11-8905-36092c46b001';
const SCHEME_B = '019c6f6c-be87-7a11-8905-36092c46b002';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46b003';

const DOC: PromotionUsageDoc = {
  docId: '019c6f6c-be87-7a11-8905-36092c46b0d1',
  accYear: '2026-2027',
  companyId: 'company-1',
  branchId: 'branch-1',
  custId: CUST_ID,
  docDate: '2026-10-19',
  docType: 'SALE_BILL',
};

const applied = (overrides: Partial<PromotionApplied> = {}): PromotionApplied => ({
  schemeId: SCHEME_A,
  baseAmount: 1000,
  baseQty: 4,
  benefitAmt: 100,
  freeQty: 0,
  lineCount: 2,
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

describe('PromotionUsageService', () => {
  const service = new PromotionUsageService({} as PrismaService);

  describe('record', () => {
    it('writes nothing when no scheme gave anything', async () => {
      const executeRaw = jest.fn();

      await expect(
        service.record(
          { $executeRaw: executeRaw } as unknown as Prisma.TransactionClient,
          DOC,
          [applied({ benefitAmt: 0, freeQty: 0 })],
        ),
      ).resolves.toBe(0);
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('writes one row per scheme that gave, with exact numeric text and positive figures', async () => {
      const executeRaw = jest.fn().mockResolvedValue(2);

      const written = await service.record(
        { $executeRaw: executeRaw } as unknown as Prisma.TransactionClient,
        DOC,
        [
          applied(),
          applied({ schemeId: SCHEME_B, benefitAmt: 0, freeQty: -1.5, baseAmount: 249.995 }),
          applied({ schemeId: 'gave-nothing', benefitAmt: 0, freeQty: 0 }),
        ],
      );

      expect(written).toBe(2);
      const [strings, rows] = executeRaw.mock.calls[0] as [TemplateStringsArray, Prisma.Sql];
      expect(strings.join('?')).toContain('ON CONFLICT DO NOTHING');
      expect(rows.values).toEqual(
        expect.arrayContaining([SCHEME_A, SCHEME_B, '100.00', '1.5000', '250.00']),
      );
      expect(rows.values).not.toContain('gave-nothing');
    });
  });

  it('reverse mirrors the document’s live rows under the given reason', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);

    await expect(
      service.reverse(
        { $executeRaw: executeRaw } as unknown as Prisma.TransactionClient,
        { docId: DOC.docId, accYear: DOC.accYear },
        'Bill cancelled',
        'actor',
      ),
    ).resolves.toBe(1);

    const [strings, ...values] = executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(strings.join('?')).toContain('-o.pru_benefit_amt');
    expect(values).toEqual(['Bill cancelled', 'actor', DOC.docId, DOC.accYear]);
  });

  describe('validateApplied', () => {
    const liveTx = (live: string[]) => {
      const queryRaw = jest.fn().mockResolvedValue(live.map((prm_id) => ({ prm_id })));
      return { queryRaw, tx: { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient };
    };

    it('checks nothing when no scheme was applied', async () => {
      const { tx, queryRaw } = liveTx([]);

      await expect(service.validateApplied(tx, DOC, ['', ''])).resolves.toEqual([]);
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('asks once per distinct scheme and passes when all are live', async () => {
      const { tx, queryRaw } = liveTx([SCHEME_A, SCHEME_B]);

      await expect(
        service.validateApplied(tx, DOC, [SCHEME_A, SCHEME_B, SCHEME_A]),
      ).resolves.toEqual([]);
      expect(queryRaw.mock.calls[0][1]).toEqual([SCHEME_A, SCHEME_B]);
    });

    it('refuses the first scheme that is no longer live', async () => {
      const { tx } = liveTx([SCHEME_A]);

      const refusal = await refusalOf(service.validateApplied(tx, DOC, [SCHEME_A, SCHEME_B]));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [
            {
              field: 'schemeId',
              code: SALES_ERROR_CODES.PROMO_NOT_LIVE,
              message: `Scheme ${SCHEME_B} is not live for this document`,
            },
          ],
        },
      });
    });

    it('lists every dead scheme instead when asked not to throw', async () => {
      const { tx } = liveTx([]);

      await expect(
        service.validateApplied(tx, DOC, [SCHEME_A, SCHEME_B], { throwOnFirst: false }),
      ).resolves.toEqual([
        {
          code: SALES_ERROR_CODES.PROMO_NOT_LIVE,
          message: `Scheme ${SCHEME_A} is not live for this document`,
          schemeId: SCHEME_A,
        },
        {
          code: SALES_ERROR_CODES.PROMO_NOT_LIVE,
          message: `Scheme ${SCHEME_B} is not live for this document`,
          schemeId: SCHEME_B,
        },
      ]);
    });
  });

  describe('caps', () => {
    const capsTx = (scheme: Record<string, unknown>, used: Record<string, unknown>) => {
      const queryRaw = jest.fn(async (strings: TemplateStringsArray) =>
        strings.join('?').includes('sales.promotion_usage') ? [used] : [scheme],
      );
      return { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient;
    };

    it('reads a zero cap as no cap', async () => {
      const report = await service.caps(
        capsTx(
          { prm_max_uses_total: 0, prm_max_uses_per_cust: 0, prm_budget_amount: new Prisma.Decimal(0) },
          { uses: 500n, cust_uses: 50n, given: new Prisma.Decimal(99999) },
        ),
        SCHEME_A,
        CUST_ID,
      );

      expect(report).toMatchObject({
        uses: 500,
        custUses: 50,
        given: 99999,
        usesExceeded: false,
        custUsesExceeded: false,
        budgetExceeded: false,
      });
    });

    it('flags each cap that has been reached', async () => {
      const report = await service.caps(
        capsTx(
          {
            prm_max_uses_total: 100,
            prm_max_uses_per_cust: 1,
            prm_budget_amount: new Prisma.Decimal(5000),
          },
          { uses: 100n, cust_uses: 1n, given: new Prisma.Decimal(4999.99) },
        ),
        SCHEME_A,
        CUST_ID,
      );

      expect(report).toEqual({
        schemeId: SCHEME_A,
        uses: 100,
        custUses: 1,
        given: 4999.99,
        maxUses: 100,
        maxPerCust: 1,
        budget: 5000,
        usesExceeded: true,
        custUsesExceeded: true,
        budgetExceeded: false,
      });
    });

    it('reads an unknown scheme with no usage as uncapped and unused', async () => {
      const queryRaw = jest.fn().mockResolvedValue([]);

      await expect(
        service.caps({ $queryRaw: queryRaw } as unknown as Prisma.TransactionClient, SCHEME_A, null),
      ).resolves.toMatchObject({ uses: 0, given: 0, maxUses: 0, usesExceeded: false });
    });
  });
});
