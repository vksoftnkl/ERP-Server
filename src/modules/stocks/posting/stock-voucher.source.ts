import { Prisma } from '@prisma/client';
import type { StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
import type { StockVoucherSourceInput } from './stock-line-source';

/**
 * The stock-voucher adapter — `new StockVoucherSource(svhId)` of §3.1.
 *
 * It carries the header facts `StockPostingService` needs (the company, the
 * branch, the godowns it touches and the instant the goods moved) and the rule
 * record the engine SQL needs. It does NOT re-read the lines: the voucher's own
 * CTE chain does that, and duplicating it here would be a second opinion about
 * what a voucher line means.
 */
export class StockVoucherSource {
  readonly srcModule = 'STOCK' as const;
  readonly srcDocType = 'STOCK_VOUCHER' as const;

  constructor(private readonly input: StockVoucherSourceInput) {}

  get svhId(): string {
    return this.input.svhId;
  }

  get accYear(): string {
    return this.input.accYear;
  }

  get srcDocId(): string {
    return this.input.svhId;
  }

  get companyId(): string {
    return this.input.companyId;
  }

  get branchId(): string {
    return this.input.branchId;
  }

  get rules(): StockVoucherTypeRules {
    return this.input.rules;
  }

  /**
   * When the goods MOVED — `svh_doc_datetime`, never `now()`.
   *
   * The freeze guard tests this, and that is the whole fix: the moment of the
   * movement, not the moment the row arrived at the server.
   */
  async docDatetime(tx: Prisma.TransactionClient): Promise<Date | null> {
    const [row] = await tx.$queryRaw<{ svh_doc_datetime: Date | null }[]>`
      SELECT svh_doc_datetime
        FROM stock.stock_voucher
       WHERE svh_id       = ${this.input.svhId}::uuid
         AND svh_acc_year = ${this.input.accYear}::bpchar`;
    return row?.svh_doc_datetime ?? null;
  }

  /**
   * Every godown this document touches — the line godowns plus the header's
   * from/to, because a transfer names its godowns on the header alone.
   */
  async godownIds(tx: Prisma.TransactionClient): Promise<string[]> {
    const rows = await tx.$queryRaw<{ godown_id: string }[]>`
      SELECT DISTINCT g.godown_id
        FROM (
          SELECT svi.svi_godown_id AS godown_id
            FROM stock.stock_voucher_item svi
           WHERE svi.svi_voucher_id = ${this.input.svhId}::uuid
             AND svi.svi_acc_year   = ${this.input.accYear}::bpchar
             AND svi.svi_is_deleted = false
          UNION
          SELECT svh.svh_from_godown_id
            FROM stock.stock_voucher svh
           WHERE svh.svh_id       = ${this.input.svhId}::uuid
             AND svh.svh_acc_year = ${this.input.accYear}::bpchar
          UNION
          SELECT svh.svh_to_godown_id
            FROM stock.stock_voucher svh
           WHERE svh.svh_id       = ${this.input.svhId}::uuid
             AND svh.svh_acc_year = ${this.input.accYear}::bpchar
        ) g(godown_id)
       WHERE g.godown_id IS NOT NULL`;
    return rows.map((r) => r.godown_id);
  }
}
