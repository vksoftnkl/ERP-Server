import { HttpException } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import {
  BalanceAssertionQueryDto,
  PostMissingVouchersQueryDto,
  RebuildCostsQueryDto,
  StockAdminController,
} from './stock-admin.controller';
import type { StockAdminService, StockRebuildReport } from './stock-admin.service';
import type { StockBalanceFinding } from './stock-balance-assertion';

const COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const BRANCH_ID = '33333333-3333-4333-8333-333333333333';
const ITEM_ID = '44444444-4444-4444-8444-444444444444';

const report = (overrides: Partial<StockRebuildReport> = {}): StockRebuildReport => ({
  dryRun: false,
  written: { balances: 4, lotRates: 2, itemCosts: 1, stamps: 0, lotTotals: 1 },
  itemsMoved: [],
  lotRatesWritten: [],
  assertion: [],
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

const query = <T extends object>(value: object, dto: new () => T) =>
  validateDto(value, dto, { type: 'query' });

describe('StockAdminController', () => {
  let admin: { postMissingVouchers: jest.Mock; assertBalances: jest.Mock; rebuildCosts: jest.Mock };
  let controller: StockAdminController;

  beforeEach(() => {
    admin = {
      postMissingVouchers: jest.fn().mockResolvedValue({ walked: 5, posted: 3, skipped: [] }),
      assertBalances: jest.fn().mockResolvedValue([]),
      rebuildCosts: jest.fn().mockResolvedValue(report()),
    };
    controller = new StockAdminController(admin as unknown as StockAdminService);
  });

  // ── the query DTOs, through the house pipe ────────────────────────────────
  describe('query validation', () => {
    it('wants a company uuid and a YYYY-YYYY year to post missing vouchers', async () => {
      await expect(
        query({ companyId: COMPANY_ID, accYear: '2026-2027' }, PostMissingVouchersQueryDto),
      ).resolves.toEqual({ companyId: COMPANY_ID, accYear: '2026-2027' });

      const refusal = await refusalOf(
        query({ companyId: 'zeta', accYear: '2026-27' }, PostMissingVouchersQueryDto),
      );
      expect(refusal.status).toBe(400);
      expect(refusal.body).toMatchObject({
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'companyId' }),
          expect.objectContaining({ field: 'accYear', message: 'accYear must be YYYY-YYYY' }),
        ]),
      });
    });

    it('lets the balance assertion run unscoped, but refuses a scope id that is not a uuid', async () => {
      await expect(query({ itemId: ITEM_ID }, BalanceAssertionQueryDto)).resolves.toEqual({
        itemId: ITEM_ID,
      });
      await expect(
        refusalOf(query({ branchId: 'main' }, BalanceAssertionQueryDto)),
      ).resolves.toMatchObject({
        status: 400,
      });
    });

    it.each(['true', '1'])('reads dryRun=%s as a dry run', async (raw) => {
      await expect(query({ dryRun: raw }, RebuildCostsQueryDto)).resolves.toMatchObject({
        dryRun: true,
      });
    });

    it('leaves dryRun unset when it is not sent, which the route reads as a real run', async () => {
      const dto = await query({ companyId: COMPANY_ID }, RebuildCostsQueryDto);

      expect(dto.dryRun).toBeUndefined();
    });
  });

  // ── routes ────────────────────────────────────────────────────────────────
  it('posts the missing vouchers and says how many were written', async () => {
    await expect(
      controller.postMissingVouchers({ companyId: COMPANY_ID, accYear: '2026-2027' }),
    ).resolves.toEqual({
      success: true,
      message: '3 accounts vouchers written for 5 stock documents',
      data: { walked: 5, posted: 3, skipped: [] },
    });
    expect(admin.postMissingVouchers).toHaveBeenCalledWith(COMPANY_ID, '2026-2027');
  });

  describe('balanceAssertion', () => {
    it('calls an empty list a clean book', async () => {
      await expect(controller.balanceAssertion({})).resolves.toEqual({
        success: true,
        message: 'Every derived figure agrees with its source',
        data: [],
      });
    });

    it('counts the findings, still as a success — it detects, it does not refuse', async () => {
      const findings = [{ kind: 'RESERVED' }, { kind: 'LOT_TOTAL' }] as StockBalanceFinding[];
      admin.assertBalances.mockResolvedValue(findings);

      await expect(
        controller.balanceAssertion({ companyId: COMPANY_ID, branchId: BRANCH_ID }),
      ).resolves.toEqual({ success: true, message: '2 findings', data: findings });
      expect(admin.assertBalances).toHaveBeenCalledWith({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
      });
    });
  });

  describe('rebuildCosts', () => {
    it('passes the scope without dryRun, and runs for real when dryRun is not sent', async () => {
      await controller.rebuildCosts({ companyId: COMPANY_ID, itemId: ITEM_ID });

      expect(admin.rebuildCosts).toHaveBeenCalledWith(
        { companyId: COMPANY_ID, itemId: ITEM_ID },
        false,
      );
    });

    it('words a real run in the past tense, counting the items that moved', async () => {
      admin.rebuildCosts.mockResolvedValue(
        report({ itemsMoved: [{}, {}] as StockRebuildReport['itemsMoved'] }),
      );

      await expect(controller.rebuildCosts({})).resolves.toMatchObject({
        success: true,
        message: '2 item totals moved; 2 lot cost rows and 4 balance rows were written',
      });
    });

    it('words a dry run as one that rolled back and would have written', async () => {
      admin.rebuildCosts.mockResolvedValue(
        report({ dryRun: true, itemsMoved: [{}] as StockRebuildReport['itemsMoved'] }),
      );

      await expect(controller.rebuildCosts({ dryRun: true })).resolves.toMatchObject({
        message:
          'DRY RUN — rolled back. 1 item total moved; 2 lot cost rows and 4 balance rows would be written',
      });
      expect(admin.rebuildCosts).toHaveBeenCalledWith({}, true);
    });

    it('says 0 item totals moved when nothing changed', async () => {
      await expect(controller.rebuildCosts({})).resolves.toMatchObject({
        message: '0 item totals moved; 2 lot cost rows and 4 balance rows were written',
      });
    });
  });
});
