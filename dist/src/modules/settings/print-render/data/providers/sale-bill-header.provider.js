"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleBillHeaderProvider = void 0;
const common_1 = require("@nestjs/common");
const pg_service_1 = require("../../../../../database/pg/pg.service");
const provider_utils_1 = require("./provider.utils");
let SaleBillHeaderProvider = class SaleBillHeaderProvider {
    pg;
    code = 'sales.bill.header';
    label = 'Sale bill — header';
    cardinality = 'one';
    constructor(pg) {
        this.pg = pg;
    }
    async resolve(request) {
        const { docId, accYear } = (0, provider_utils_1.requireDocument)(request, this.code);
        const rows = await (0, provider_utils_1.providerQuery)(this.pg, `SELECT sb_id              AS bill_id,
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
          AND sb_is_deleted = false`, [docId, accYear, request.context.companyId]);
        return rows[0] ?? {};
    }
};
exports.SaleBillHeaderProvider = SaleBillHeaderProvider;
exports.SaleBillHeaderProvider = SaleBillHeaderProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pg_service_1.PgService])
], SaleBillHeaderProvider);
//# sourceMappingURL=sale-bill-header.provider.js.map