import { Injectable } from '@nestjs/common';
import { PgService } from 'src/database/pg/pg.service';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
import { providerQuery, requireDocument } from './provider.utils';

/**
 * `sales.bill.tax_summary` — the HSN/rate table Rule 46 requires.
 *
 * §4 names this one specifically as belonging in code ("the e-invoice QR, tax
 * summaries, amount in words"), and the reason is not that the SQL is hard. It
 * is that this table is a LEGAL requirement whose shape changes when the law
 * does. The day a rate slab moves or the cess rules change, one provider is
 * edited and every site's next invoice is right; a hundred stored copies of the
 * same GROUP BY would each be wrong separately, and nobody would know which
 * sites were affected.
 *
 * Grouped by (HSN, rate) rather than by HSN alone: one HSN can legitimately
 * carry two rates on one bill — the classic case being a rate change dated
 * mid-bill, and the less classic one being an item taxed differently as part of
 * a mixed supply — and collapsing them would print a taxable value against a
 * rate that was never charged.
 */
@Injectable()
export class SaleBillTaxSummaryProvider implements PrintDataProvider {
  readonly code = 'sales.bill.tax_summary';

  readonly label = 'Sale bill — HSN / tax summary';

  readonly cardinality = 'many' as const;

  constructor(private readonly pg: PgService) {}

  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    const { docId, accYear } = requireDocument(request, this.code);

    return providerQuery(
      this.pg,
      `SELECT COALESCE(NULLIF(sbi.sbi_hsn_code, ''), '-') AS hsn_code,
              sbi.sbi_tax_perc                            AS tax_perc,
              sbi.sbi_cgst_perc                           AS cgst_perc,
              sbi.sbi_sgst_perc                           AS sgst_perc,
              sbi.sbi_igst_perc                           AS igst_perc,
              sbi.sbi_cess_perc                           AS cess_perc,
              COUNT(*)                                    AS line_count,
              SUM(sbi.sbi_net_qty)                        AS net_qty,
              SUM(sbi.sbi_taxable_amt)                    AS taxable_amt,
              SUM(sbi.sbi_cgst_amt)                       AS cgst_amt,
              SUM(sbi.sbi_sgst_amt)                       AS sgst_amt,
              SUM(sbi.sbi_igst_amt)                       AS igst_amt,
              SUM(sbi.sbi_cess_amt)                       AS cess_amt,
              SUM(sbi.sbi_tax_amt)                        AS tax_amt,
              SUM(sbi.sbi_taxable_amt + sbi.sbi_tax_amt)  AS total_amt
         FROM sales.sale_bill_item sbi
        WHERE sbi.sbi_bill_id = $1
          AND sbi.sbi_acc_year = $2
          AND sbi.sbi_company_id = $3
          AND sbi.sbi_is_deleted = false
        GROUP BY 1, 2, 3, 4, 5, 6
        -- Ascending by rate within an HSN, which is how the table is read.
        ORDER BY 1, 2
        LIMIT $4`,
      [docId, accYear, request.context.companyId, request.rowLimit],
    );
  }
}
