import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import type { StockVoucherType } from '../stock-voucher/types/stock-voucher.types';
import {
  STOCK_ACCOUNTS_SRC_MODULE,
  StockAccountsPostingService,
} from './stock-accounts-posting.service';
import {
  assertStockBalances,
  type StockBalanceAssertionScope,
  type StockBalanceFinding,
} from './stock-balance-assertion';
import {
  rebuildStockDerivedFigures,
  type StockRebuildOutcome,
  type StockRebuildScope,
} from '../stock-voucher/stock-voucher-posting.helper';

const DISPLAY_NAME: Partial<Record<StockVoucherType, string>> = {
  OPENING: 'Opening stock',
  PHYSICAL: 'Physical stock count',
};

@Injectable()
export class StockAdminService {
  private readonly logger = new Logger(StockAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: StockAccountsPostingService,
    private readonly requestContext: RequestContextService,
  ) {}

  /** See StockAdminController. One transaction per document, so one refusal does not undo the rest. */
  async postMissingVouchers(
    companyId: string,
    accYear: string,
  ): Promise<{
    walked: number;
    posted: number;
    skipped: Array<{ svhId: string; refno: string; reason: string }>;
  }> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;
    const missing = await this.prisma.$queryRaw<
      Array<{ svh_id: string; svh_refno: string; svh_branch_id: string; svh_voucher_type: string }>
    >`
      SELECT svh.svh_id, svh.svh_refno, svh.svh_branch_id, svh.svh_voucher_type
        FROM stock.stock_voucher svh
       WHERE svh.svh_company_id = ${companyId}::uuid
         AND svh.svh_acc_year   = ${accYear}::bpchar
         AND svh.svh_status     = 'POSTED'
         AND svh.svh_is_deleted = false
         AND svh.svh_voucher_type IN ('OPENING', 'PHYSICAL')
         AND NOT EXISTS (
               SELECT 1 FROM accounts.acc_voucher_header avh
                WHERE avh.avh_company_id   = svh.svh_company_id
                  AND avh.avh_src_module   = ${STOCK_ACCOUNTS_SRC_MODULE}
                  AND avh.avh_src_doc_type = svh.svh_voucher_type
                  AND avh.avh_src_doc_id   = svh.svh_id
                  AND avh.avh_acc_year     = svh.svh_acc_year
                  AND avh.avh_is_deleted   = false
                  AND avh.avh_voucher_status = 'POSTED')
       ORDER BY svh.svh_doc_date, svh.svh_slno
    `;
    let posted = 0;
    const skipped: Array<{ svhId: string; refno: string; reason: string }> = [];
    for (const row of missing) {
      const voucherType = row.svh_voucher_type as StockVoucherType;
      try {
        const result = await this.prisma.$transaction((tx) =>
          this.accounts.postForVoucher(tx, {
            svhId: row.svh_id,
            accYear,
            companyId,
            branchId: row.svh_branch_id,
            voucherType,
            displayName: DISPLAY_NAME[voucherType] ?? voucherType,
            actor,
            postedOn: new Date(),
          }),
        );
        if (result) {
          posted += 1;
        } else {
          skipped.push({
            svhId: row.svh_id,
            refno: row.svh_refno,
            reason: 'nothing to post (PERIODIC or zero value)',
          });
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`post-missing-vouchers: ${row.svh_refno} skipped — ${reason}`);
        skipped.push({ svhId: row.svh_id, refno: row.svh_refno, reason });
      }
    }
    return { walked: missing.length, posted, skipped };
  }

  assertBalances(scope: StockBalanceAssertionScope): Promise<StockBalanceFinding[]> {
    return assertStockBalances(this.prisma, scope);
  }

  /**
   * Notes 92 §4 — every derived stock figure in `scope` re-derived from the
   * ledger (balances, each tracked lot's own cost, the item totals and the
   * plain-item stamp, the lot totals), reported as what moved per item.
   *
   * `dryRun` runs the whole rebuild inside a transaction that is then rolled
   * back, so the report says what WOULD change and the database is untouched —
   * the "report, don't post" step. The ledger is never written either way; a
   * second real run reports nothing moved.
   */
  async rebuildCosts(scope: StockRebuildScope, dryRun: boolean): Promise<StockRebuildReport> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;
    const now = new Date();
    let report: StockRebuildReport | null = null;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const before = await this.itemTotals(tx, scope);
          const written = await rebuildStockDerivedFigures(tx, scope, actor, now);
          const after = await this.itemTotals(tx, scope);
          const lotsMoved = await this.lotRatesMoved(tx, scope);
          const moved: StockRebuildItemMove[] = [];
          for (const [key, next] of after) {
            const prev = before.get(key);
            if (
              !prev ||
              prev.totalQty !== next.totalQty ||
              prev.totalValue !== next.totalValue ||
              prev.avgCostRate !== next.avgCostRate
            ) {
              moved.push({
                ...next,
                oldTotalQty: prev?.totalQty ?? null,
                oldTotalValue: prev?.totalValue ?? null,
                oldAvgCostRate: prev?.avgCostRate ?? null,
                valueDifference:
                  prev === undefined
                    ? next.totalValue
                    : Number((Number(next.totalValue) - Number(prev.totalValue)).toFixed(2)),
              });
            }
          }
          const assertion = await assertStockBalances(tx, scope);
          report = { dryRun, written, itemsMoved: moved, lotRatesWritten: lotsMoved, assertion };
          if (dryRun) {
            throw new DryRunRollback();
          }
        },
        { maxWait: 30_000, timeout: 10 * 60_000 },
      );
    } catch (error) {
      if (!(error instanceof DryRunRollback)) {
        throw error;
      }
    }
    if (!report) {
      throw new Error('rebuild-costs produced no report');
    }
    return report;
  }

  private async itemTotals(
    tx: Prisma.TransactionClient,
    scope: StockRebuildScope,
  ): Promise<Map<string, StockRebuildItemTotal>> {
    const rows = await tx.$queryRaw<
      Array<{
        company_id: string;
        branch_id: string;
        item_id: string;
        item_code: string | null;
        item_name: string | null;
        total_qty: string;
        total_value: string;
        avg_cost_rate: string;
      }>
    >`
      SELECT c.sic_company_id AS company_id, c.sic_branch_id AS branch_id, c.sic_item_id AS item_id,
             itm.item_code, itm.item_name_en AS item_name,
             c.sic_total_qty::text AS total_qty, c.sic_total_value::text AS total_value,
             c.sic_avg_cost_rate::text AS avg_cost_rate
        FROM stock.stock_item_cost c
        JOIN inventory.item_master itm ON itm.item_id = c.sic_item_id
       WHERE c.sic_is_deleted = false
         AND (${scope.companyId ?? null}::uuid IS NULL OR c.sic_company_id = ${scope.companyId ?? null}::uuid)
         AND (${scope.branchId ?? null}::uuid  IS NULL OR c.sic_branch_id  = ${scope.branchId ?? null}::uuid)
         AND (${scope.itemId ?? null}::uuid    IS NULL OR c.sic_item_id    = ${scope.itemId ?? null}::uuid)
    `;
    return new Map(
      rows.map((r) => [
        `${r.company_id}|${r.branch_id}|${r.item_id}`,
        {
          companyId: r.company_id,
          branchId: r.branch_id,
          itemId: r.item_id,
          itemCode: r.item_code,
          itemName: r.item_name,
          totalQty: r.total_qty,
          totalValue: r.total_value,
          avgCostRate: r.avg_cost_rate,
        },
      ]),
    );
  }

  /** Every tracked lot's cost per branch after the run, for the report. */
  private async lotRatesMoved(
    tx: Prisma.TransactionClient,
    scope: StockRebuildScope,
  ): Promise<StockRebuildLotRate[]> {
    const rows = await tx.$queryRaw<
      Array<{
        branch_id: string;
        item_code: string | null;
        item_name: string | null;
        lot_id: string;
        batch_no: string | null;
        mrp: string | null;
        on_hand: string;
        rate: string;
        value: string;
      }>
    >`
      SELECT b.sbl_branch_id AS branch_id, itm.item_code, itm.item_name_en AS item_name,
             b.sbl_lot_id AS lot_id, slt.slt_batch_no AS batch_no, slt.slt_mrp::text AS mrp,
             SUM(b.sbl_on_hand_qty)::text AS on_hand, MAX(b.sbl_avg_cost_rate)::text AS rate,
             SUM(b.sbl_stock_value)::text AS value
        FROM stock.stock_balance b
        JOIN stock.stock_lot slt ON slt.slt_id = b.sbl_lot_id
        JOIN inventory.item_master itm ON itm.item_id = b.sbl_item_id
       WHERE b.sbl_is_deleted = false
         AND slt.slt_track_signature <> 'N'
         AND (${scope.companyId ?? null}::uuid IS NULL OR b.sbl_company_id = ${scope.companyId ?? null}::uuid)
         AND (${scope.branchId ?? null}::uuid  IS NULL OR b.sbl_branch_id  = ${scope.branchId ?? null}::uuid)
         AND (${scope.itemId ?? null}::uuid    IS NULL OR b.sbl_item_id    = ${scope.itemId ?? null}::uuid)
       GROUP BY 1, 2, 3, 4, 5, 6
       ORDER BY itm.item_name_en, slt.slt_batch_no
    `;
    return rows.map((r) => ({
      branchId: r.branch_id,
      itemCode: r.item_code,
      itemName: r.item_name,
      lotId: r.lot_id,
      batchNo: r.batch_no,
      mrp: r.mrp,
      onHand: r.on_hand,
      rate: r.rate,
      value: r.value,
    }));
  }
}

/** Thrown inside the dry-run transaction so Prisma rolls it back; never escapes `rebuildCosts`. */
class DryRunRollback extends Error {}

export interface StockRebuildItemTotal {
  companyId: string;
  branchId: string;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  totalQty: string;
  totalValue: string;
  avgCostRate: string;
}
export interface StockRebuildItemMove extends StockRebuildItemTotal {
  oldTotalQty: string | null;
  oldTotalValue: string | null;
  oldAvgCostRate: string | null;
  valueDifference: string | number;
}
/** One tracked lot's cost in a branch after the run. */
export interface StockRebuildLotRate {
  branchId: string;
  itemCode: string | null;
  itemName: string | null;
  lotId: string;
  batchNo: string | null;
  mrp: string | null;
  onHand: string;
  rate: string;
  value: string;
}
export interface StockRebuildReport {
  dryRun: boolean;
  /** Rows written per phase. */
  written: StockRebuildOutcome;
  /** Every (company, branch, item) whose total quantity, value or average moved. */
  itemsMoved: StockRebuildItemMove[];
  /** Every tracked lot's cost per branch after the run. */
  lotRatesWritten: StockRebuildLotRate[];
  /** The balance assertion over the same scope, after the rebuild. */
  assertion: StockBalanceFinding[];
}
