import { Injectable } from '@nestjs/common';
import { PgService } from 'src/database/pg/pg.service';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
import { providerQuery, requireDocument } from './provider.utils';

/**
 * `sales.bill.header` — the document itself.
 *
 * ── WHY THIS IS CODE AND NOT A STORED QUERY ────────────────────────────────
 *
 * `sales.sale_bill` is PARTITIONED BY `sb_acc_year` and its primary key is the
 * composite `(sb_id, sb_acc_year)`. A query that filters on `sb_id` alone is
 * correct and scans every partition in the database; one that filters on both
 * touches one. The year is a join key the query text cannot know — it arrives
 * with the render as `:acc_year` — and a template author who omits it gets a
 * report that works perfectly in year one and degrades every year after.
 *
 * The customer block is read from the BILL, not from `sales.customer`. Those
 * columns are snapshots taken at billing time, and a reprint of a two-year-old
 * invoice must show the address the goods went to, not the address the customer
 * moved to since. Printing the current master here would quietly rewrite
 * history on every reprint.
 */
@Injectable()
export class SaleBillHeaderProvider implements PrintDataProvider {
  readonly code = 'sales.bill.header';

  readonly label = 'Sale bill — header';

  readonly cardinality = 'one' as const;

  constructor(private readonly pg: PgService) {}

  async resolve(request: ProviderRequest): Promise<PrintRow> {
    const { docId, accYear } = requireDocument(request, this.code);

    const rows = await providerQuery(
      this.pg,
      `SELECT sb_id              AS bill_id,
              sb_acc_year        AS acc_year,
              sb_company_id      AS company_id,
              sb_branch_id       AS branch_id,
              sb_doc_type        AS doc_type,
              sb_bill_type       AS bill_type,
              sb_bill_slno       AS bill_slno,
              sb_bill_refno      AS bill_refno,
              sb_usr_refno       AS usr_refno,
              sb_bill_date       AS bill_date,
              sb_bill_datetime   AS bill_datetime,
              sb_due_days        AS due_days,
              sb_due_date        AS due_date,
              sb_src_doc_type    AS src_doc_type,
              sb_src_doc_refno   AS src_doc_refno,
              sb_src_doc_date    AS src_doc_date,
              -- Customer, as snapshotted onto the document.
              sb_cust_id         AS cust_id,
              sb_cust_name       AS cust_name,
              sb_cust_addr       AS cust_addr,
              sb_cust_place      AS cust_place,
              sb_cust_pin        AS cust_pin,
              sb_cust_phone      AS cust_phone,
              sb_cust_gstin      AS cust_gstin,
              sb_cust_gst_type   AS cust_gst_type,
              sb_cust_stcd       AS cust_state_code,
              sb_pos_stcd        AS pos_state_code,
              sb_state_name      AS state_name,
              -- Place of supply decides the tax split, and a design that prints
              -- CGST+SGST columns for an inter-state supply is a defective
              -- invoice. Answered here so no expression has to compare codes.
              (sb_pos_stcd IS DISTINCT FROM sb_cust_stcd) AS is_interstate,
              sb_vehicle_no      AS vehicle_no,
              sb_tot_items       AS tot_items,
              sb_tot_weight      AS tot_weight,
              sb_tot_bags        AS tot_bags,
              sb_gross_amt       AS gross_amt,
              sb_item_disc       AS item_disc,
              sb_spl_disc        AS spl_disc,
              sb_sch_disc        AS sch_disc,
              sb_bill_sch_disc   AS bill_sch_disc,
              sb_addl_disc1      AS addl_disc1,
              sb_addl_disc2      AS addl_disc2,
              sb_cash_disc       AS cash_disc,
              sb_taxable_amt     AS taxable_amt,
              sb_cgst_amt        AS cgst_amt,
              sb_sgst_amt        AS sgst_amt,
              sb_igst_amt        AS igst_amt,
              sb_cess_amt        AS cess_amt,
              sb_tax_amt         AS tax_amt,
              sb_freight_amt     AS freight_amt,
              sb_load_amt        AS load_amt,
              sb_unload_amt      AS unload_amt,
              sb_other_amt1      AS other_amt1,
              sb_other_amt2      AS other_amt2,
              sb_round_off       AS round_off,
              sb_bill_amt        AS bill_amt,
              sb_mrp_savings     AS mrp_savings,
              sb_pay_mode        AS pay_mode,
              sb_tender_amt      AS tender_amt,
              sb_refund_amt      AS refund_amt,
              sb_paid_amt        AS paid_amt,
              sb_balance_amt     AS balance_amt,
              sb_pay_status      AS pay_status,
              sb_payment_terms   AS payment_terms,
              sb_delivery_terms  AS delivery_terms,
              sb_terms_conditions AS terms_conditions,
              sb_remarks         AS remarks,
              sb_status          AS status,
              -- What the counter has printed so far. NOT the copy label: how
              -- many prints make the next one a DUPLICATE is a rule about GST
              -- and belongs to the service layer, which is why print_log
              -- carries the label and this is only the cache.
              sb_print_count     AS print_count
         FROM sales.sale_bill
        WHERE sb_id = $1
          -- The partition key. Without it this reads every year in the chain.
          AND sb_acc_year = $2
          AND sb_company_id = $3
          AND sb_is_deleted = false`,
      [docId, accYear, request.context.companyId],
    );

    return rows[0] ?? {};
  }
}
