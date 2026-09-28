import { Injectable, Logger } from '@nestjs/common';
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
  ): Promise<{ walked: number; posted: number; skipped: Array<{ svhId: string; refno: string; reason: string }> }> {
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
          skipped.push({ svhId: row.svh_id, refno: row.svh_refno, reason: 'nothing to post (PERIODIC or zero value)' });
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
}
