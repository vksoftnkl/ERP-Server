import { Logger } from '@nestjs/common';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import type { RequestContextService } from '../../../common/request-context/request-context.service';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import { rebuildStockDerivedFigures } from '../stock-voucher/stock-voucher-posting.helper';
import type { StockAccountsPostingService } from './stock-accounts-posting.service';
import { StockAdminService } from './stock-admin.service';
import { assertStockBalances, type StockBalanceFinding } from './stock-balance-assertion';

// The rebuild and the assertion are SQL with their own suites; here only what
// the service does around them is under test.
jest.mock('../stock-voucher/stock-voucher-posting.helper', () => ({
  rebuildStockDerivedFigures: jest.fn(),
}));
jest.mock('./stock-balance-assertion', () => ({ assertStockBalances: jest.fn() }));

const COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const BRANCH_ID = '33333333-3333-4333-8333-333333333333';
const ITEM_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ITEM_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ITEM_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const ACC_YEAR = '2026-2027';

const WRITTEN = { balances: 3, lotRates: 2, itemCosts: 1, stamps: 0, lotTotals: 1 };
const FINDING = { kind: 'LOT_TOTAL' } as StockBalanceFinding;

const missingRow = (
  svh_id: string,
  svh_voucher_type: string,
  svh_refno = `${svh_voucher_type}-${svh_id}`,
) => ({
  svh_id,
  svh_refno,
  svh_branch_id: BRANCH_ID,
  svh_voucher_type,
});

const itemCostRow = (
  item_id: string,
  total_qty: string,
  total_value: string,
  avg_cost_rate: string,
) => ({
  company_id: COMPANY_ID,
  branch_id: BRANCH_ID,
  item_id,
  item_code: `CODE-${item_id.slice(0, 1)}`,
  item_name: `Item ${item_id.slice(0, 1)}`,
  total_qty,
  total_value,
  avg_cost_rate,
});

describe('StockAdminService', () => {
  let prisma: { $queryRaw: jest.Mock; $transaction: jest.Mock };
  let tx: { $queryRaw: jest.Mock };
  let accounts: { postForVoucher: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: StockAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx = { $queryRaw: jest.fn() };
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    accounts = { postForVoucher: jest.fn().mockResolvedValue({ voucherId: 'avh-1' }) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new StockAdminService(
      prisma as unknown as PrismaService,
      accounts as unknown as StockAccountsPostingService,
      context as unknown as RequestContextService,
    );
    (rebuildStockDerivedFigures as jest.Mock).mockResolvedValue(WRITTEN);
    (assertStockBalances as jest.Mock).mockResolvedValue([FINDING]);
  });

  afterEach(() => jest.restoreAllMocks());

  // ── post-missing-vouchers ─────────────────────────────────────────────────
  describe('postMissingVouchers', () => {
    it('walks only POSTED openings and counts with no live STOCK voucher, for the year asked', async () => {
      await service.postMissingVouchers(COMPANY_ID, ACC_YEAR);

      const [strings, ...params] = prisma.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      const sql = strings.join('?');
      expect(sql).toContain("svh.svh_status     = 'POSTED'");
      expect(sql).toContain("svh.svh_voucher_type IN ('OPENING', 'PHYSICAL')");
      expect(sql).toContain('NOT EXISTS');
      expect(params).toEqual([COMPANY_ID, ACC_YEAR, 'STOCK']);
    });

    it('posts each document in a transaction of its own, under its own display name', async () => {
      prisma.$queryRaw.mockResolvedValue([
        missingRow('s1', 'OPENING'),
        missingRow('s2', 'PHYSICAL'),
      ]);

      await expect(service.postMissingVouchers(COMPANY_ID, ACC_YEAR)).resolves.toEqual({
        walked: 2,
        posted: 2,
        skipped: [],
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(accounts.postForVoucher).toHaveBeenNthCalledWith(1, tx, {
        svhId: 's1',
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        voucherType: 'OPENING',
        displayName: 'Opening stock',
        actor: USER_ID,
        postedOn: expect.any(Date),
      });
      expect(accounts.postForVoucher).toHaveBeenNthCalledWith(
        2,
        tx,
        expect.objectContaining({ svhId: 's2', displayName: 'Physical stock count' }),
      );
    });

    it('names an unexpected type by itself, and posts as the default actor with nobody logged in', async () => {
      context.getUserId.mockReturnValue(null);
      prisma.$queryRaw.mockResolvedValue([missingRow('s1', 'DAMAGE')]);

      await service.postMissingVouchers(COMPANY_ID, ACC_YEAR);

      expect(accounts.postForVoucher).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ displayName: 'DAMAGE', actor: DEFAULT_ACTOR }),
      );
    });

    it('skips, with the reason, a document that had nothing to post', async () => {
      prisma.$queryRaw.mockResolvedValue([missingRow('s1', 'PHYSICAL', 'PHY0001')]);
      accounts.postForVoucher.mockResolvedValue(null);

      await expect(service.postMissingVouchers(COMPANY_ID, ACC_YEAR)).resolves.toEqual({
        walked: 1,
        posted: 0,
        skipped: [
          { svhId: 's1', refno: 'PHY0001', reason: 'nothing to post (PERIODIC or zero value)' },
        ],
      });
    });

    it('logs and skips a document that is refused, and carries on with the rest', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      prisma.$queryRaw.mockResolvedValue([
        missingRow('s1', 'OPENING', 'OPN0001'),
        missingRow('s2', 'OPENING', 'OPN0002'),
        missingRow('s3', 'OPENING', 'OPN0003'),
      ]);
      accounts.postForVoucher
        .mockRejectedValueOnce(new Error('INVENTORY is not mapped'))
        .mockRejectedValueOnce('lock timeout')
        .mockResolvedValueOnce({ voucherId: 'avh-3' });

      await expect(service.postMissingVouchers(COMPANY_ID, ACC_YEAR)).resolves.toEqual({
        walked: 3,
        posted: 1,
        skipped: [
          { svhId: 's1', refno: 'OPN0001', reason: 'INVENTORY is not mapped' },
          { svhId: 's2', refno: 'OPN0002', reason: 'lock timeout' },
        ],
      });
      expect(warn).toHaveBeenCalledWith(
        'post-missing-vouchers: OPN0001 skipped — INVENTORY is not mapped',
      );
    });

    it('walks nothing and posts nothing when every document already has its voucher', async () => {
      await expect(service.postMissingVouchers(COMPANY_ID, ACC_YEAR)).resolves.toEqual({
        walked: 0,
        posted: 0,
        skipped: [],
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── balance assertion ─────────────────────────────────────────────────────
  it('asserts balances over the scope it is given, outside any transaction', async () => {
    const scope = { companyId: COMPANY_ID, itemId: ITEM_A };

    await expect(service.assertBalances(scope)).resolves.toEqual([FINDING]);
    expect(assertStockBalances).toHaveBeenCalledWith(prisma, scope);
  });

  // ── rebuild-costs ─────────────────────────────────────────────────────────
  describe('rebuildCosts', () => {
    /**
     * Item totals are read twice (before and after the rebuild), then the lot
     * rates once. Answered by what each query reads, in call order per query.
     */
    const txAnswering = (before: unknown[], after: unknown[], lots: unknown[] = []) => {
      let itemReads = 0;
      tx.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('FROM stock.stock_item_cost c')) {
          itemReads += 1;
          return Promise.resolve(itemReads === 1 ? before : after);
        }
        if (sql.includes('FROM stock.stock_balance b')) {
          return Promise.resolve(lots);
        }
        throw new Error(`unexpected query: ${sql}`);
      });
    };

    it('reports only the items whose quantity, value or average moved, with what they were', async () => {
      txAnswering(
        [
          itemCostRow(ITEM_A, '10.000000', '100.00', '10.000000'),
          itemCostRow(ITEM_B, '5.000000', '50.00', '10.000000'),
        ],
        [
          itemCostRow(ITEM_A, '10.000000', '100.00', '10.000000'),
          itemCostRow(ITEM_B, '5.000000', '52.35', '10.470000'),
          itemCostRow(ITEM_C, '2.000000', '30.00', '15.000000'),
        ],
      );

      const report = await service.rebuildCosts({ companyId: COMPANY_ID }, false);

      expect(report.dryRun).toBe(false);
      expect(report.written).toEqual(WRITTEN);
      expect(report.assertion).toEqual([FINDING]);
      expect(report.itemsMoved).toEqual([
        {
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          itemId: ITEM_B,
          itemCode: 'CODE-b',
          itemName: 'Item b',
          totalQty: '5.000000',
          totalValue: '52.35',
          avgCostRate: '10.470000',
          oldTotalQty: '5.000000',
          oldTotalValue: '50.00',
          oldAvgCostRate: '10.000000',
          valueDifference: 2.35,
        },
        expect.objectContaining({
          itemId: ITEM_C,
          oldTotalQty: null,
          oldTotalValue: null,
          oldAvgCostRate: null,
          // A new row has nothing to subtract: the difference is its whole value.
          valueDifference: '30.00',
        }),
      ]);
    });

    it('runs the rebuild and the assertion inside one long transaction, as the request user', async () => {
      txAnswering([], []);
      const scope = { companyId: COMPANY_ID, branchId: BRANCH_ID, itemId: ITEM_A };

      await service.rebuildCosts(scope, false);

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        maxWait: 30_000,
        timeout: 10 * 60_000,
      });
      expect(rebuildStockDerivedFigures).toHaveBeenCalledWith(tx, scope, USER_ID, expect.any(Date));
      expect(assertStockBalances).toHaveBeenCalledWith(tx, scope);
      const [, ...params] = tx.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      expect(params).toEqual([COMPANY_ID, COMPANY_ID, BRANCH_ID, BRANCH_ID, ITEM_A, ITEM_A]);
    });

    it('rebuilds as the default actor over the whole book when nothing narrows it', async () => {
      context.getUserId.mockReturnValue(null);
      txAnswering([], []);

      await service.rebuildCosts({}, false);

      expect(rebuildStockDerivedFigures).toHaveBeenCalledWith(
        tx,
        {},
        DEFAULT_ACTOR,
        expect.any(Date),
      );
      const [, ...params] = tx.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      expect(params).toEqual([null, null, null, null, null, null]);
    });

    it('maps every tracked lot’s cost per branch', async () => {
      txAnswering(
        [],
        [],
        [
          {
            branch_id: BRANCH_ID,
            item_code: 'SOAP',
            item_name: 'Soap',
            lot_id: 'lot-1',
            batch_no: 'B1',
            mrp: '40.00',
            on_hand: '12.000000',
            rate: '31.250000',
            value: '375.00',
          },
        ],
      );

      const report = await service.rebuildCosts({}, false);

      expect(report.lotRatesWritten).toEqual([
        {
          branchId: BRANCH_ID,
          itemCode: 'SOAP',
          itemName: 'Soap',
          lotId: 'lot-1',
          batchNo: 'B1',
          mrp: '40.00',
          onHand: '12.000000',
          rate: '31.250000',
          value: '375.00',
        },
      ]);
    });

    it('rolls a dry run back but still answers with its report', async () => {
      txAnswering([], [itemCostRow(ITEM_A, '1.000000', '9.00', '9.000000')]);
      let rolledBack = false;
      prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => {
        try {
          return await callback(tx);
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      });

      const report = await service.rebuildCosts({}, true);

      expect(rolledBack).toBe(true);
      expect(report).toMatchObject({ dryRun: true, written: WRITTEN });
      expect(report.itemsMoved).toHaveLength(1);
    });

    it('lets a real failure out', async () => {
      txAnswering([], []);
      (rebuildStockDerivedFigures as jest.Mock).mockRejectedValue(new Error('deadlock detected'));

      await expect(service.rebuildCosts({}, false)).rejects.toThrow('deadlock detected');
    });

    it('refuses to answer with no report when the transaction never ran its work', async () => {
      prisma.$transaction.mockResolvedValue(undefined);

      await expect(service.rebuildCosts({}, false)).rejects.toThrow(
        'rebuild-costs produced no report',
      );
    });
  });
});
