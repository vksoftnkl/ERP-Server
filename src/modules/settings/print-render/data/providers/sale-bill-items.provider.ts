import { Injectable } from '@nestjs/common';
import { PgService } from 'src/database/pg/pg.service';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
import { providerQuery, requireDocument } from './provider.utils';

/**
 * `sales.bill.items` — the lines.
 *
 * ── THE JOIN A STORED QUERY SHOULD NOT HAVE TO GET RIGHT ───────────────────
 *
 * A bill line stores `sbi_item_id` and `sbi_item_unit_id`, and neither is a
 * name. The item name comes from `inventory.item_master`, and the UNIT name is
 * two hops away: `sbi_item_unit_id` references `item_unit_conversion(iuc_id)`,
 * NOT `item_unit_master(unit_id)` — a trap the sale-bill model has a comment
 * about, and exactly the kind of thing that should be got right once in code
 * rather than in every site's copy of a query.
 *
 * ── LANGUAGE ───────────────────────────────────────────────────────────────
 *
 * `item_name` follows the revision's `ptv_lang`: a Tamil design prints
 * `item_name_ta` where it exists and falls back to English where it does not.
 * That fallback is the whole reason language never had to fork a template the
 * way 3.0's platform column forked every one of its own — the design is one
 * design, and the language is a property of the render.
 */
@Injectable()
export class SaleBillItemsProvider implements PrintDataProvider {
  readonly code = 'sales.bill.items';

  readonly label = 'Sale bill — lines';

  readonly cardinality = 'many' as const;

  constructor(private readonly pg: PgService) {}

  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    const { docId, accYear } = requireDocument(request, this.code);
    const wantsTamil = request.lang.toLowerCase().startsWith('ta');

    return providerQuery(
      this.pg,
      `SELECT sbi.sbi_id            AS line_id,
              sbi.sbi_line_no       AS line_no,
              sbi.sbi_split_no      AS split_no,
              sbi.sbi_item_id       AS item_id,
              itm.item_code         AS item_code,
              CASE WHEN $4::boolean
                   THEN COALESCE(NULLIF(itm.item_name_ta, ''), itm.item_name_en)
                   ELSE itm.item_name_en
              END                   AS item_name,
              itm.item_name_en      AS item_name_en,
              itm.item_name_ta      AS item_name_ta,
              sbi.sbi_hsn_code      AS hsn_code,
              sbi.sbi_ean_code      AS ean_code,
              unt.unit_name         AS unit_name,
              unt.unit_alias        AS unit_alias,
              sbi.sbi_size          AS size,
              sbi.sbi_size_uom      AS size_uom,
              sbi.sbi_batch_no      AS batch_no,
              sbi.sbi_batch_date    AS batch_date,
              sbi.sbi_expiry_date   AS expiry_date,
              sbi.sbi_serial_no     AS serial_no,
              sbi.sbi_is_free       AS is_free,
              sbi.sbi_is_promo      AS is_promo,
              sbi.sbi_is_service    AS is_service,
              sbi.sbi_case_qty      AS case_qty,
              sbi.sbi_bill_qty      AS bill_qty,
              sbi.sbi_net_qty       AS net_qty,
              sbi.sbi_weight_qty    AS weight_qty,
              sbi.sbi_rate          AS rate,
              sbi.sbi_rate_pre_tax  AS rate_pre_tax,
              sbi.sbi_max_price     AS mrp,
              sbi.sbi_item_disc_perc AS disc_perc,
              sbi.sbi_item_disc_amt AS disc_amt,
              sbi.sbi_sch_disc_amt  AS sch_disc_amt,
              sbi.sbi_gross_amt     AS gross_amt,
              sbi.sbi_taxable_amt   AS taxable_amt,
              sbi.sbi_tax_perc      AS tax_perc,
              sbi.sbi_tax_amt       AS tax_amt,
              sbi.sbi_cgst_perc     AS cgst_perc,
              sbi.sbi_cgst_amt      AS cgst_amt,
              sbi.sbi_sgst_perc     AS sgst_perc,
              sbi.sbi_sgst_amt      AS sgst_amt,
              sbi.sbi_igst_perc     AS igst_perc,
              sbi.sbi_igst_amt      AS igst_amt,
              sbi.sbi_cess_perc     AS cess_perc,
              sbi.sbi_cess_amt      AS cess_amt,
              sbi.sbi_net_amt       AS net_amt,
              sbi.sbi_mrp_savings   AS mrp_savings,
              sbi.sbi_scheme_name   AS scheme_name,
              sbi.sbi_remarks       AS remarks
         FROM sales.sale_bill_item sbi
         JOIN inventory.item_master itm
           ON itm.item_id = sbi.sbi_item_id
         -- Two hops, deliberately: sbi_item_unit_id names a CONVERSION row, and
         -- the unit's name hangs off that. LEFT so a line whose conversion row
         -- was retired still prints, with a blank unit rather than not at all.
         LEFT JOIN inventory.item_unit_conversion iuc
           ON iuc.iuc_id = sbi.sbi_item_unit_id
         LEFT JOIN inventory.item_unit_master unt
           ON unt.unit_id = iuc.iuc_unit_id
        WHERE sbi.sbi_bill_id = $1
          AND sbi.sbi_acc_year = $2
          AND sbi.sbi_company_id = $3
          AND sbi.sbi_is_deleted = false
        -- Split rows are one printed line's parts (a batch break), so they must
        -- stay adjacent and in order under their line.
        ORDER BY sbi.sbi_line_no, sbi.sbi_split_no
        LIMIT $5`,
      [docId, accYear, request.context.companyId, wantsTamil, request.rowLimit],
    );
  }
}
