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
exports.SALE_RETURN_PRINT_PROVIDERS = exports.SaleReturnTaxSummaryProvider = exports.SaleReturnItemsProvider = exports.SaleReturnHeaderProvider = void 0;
const common_1 = require("@nestjs/common");
const pg_service_1 = require("../../../../../database/pg/pg.service");
const provider_utils_1 = require("./provider.utils");
let SaleReturnHeaderProvider = class SaleReturnHeaderProvider {
    pg;
    code = 'sales.return.header';
    label = 'Sale return (credit note) — header';
    cardinality = 'one';
    constructor(pg) {
        this.pg = pg;
    }
    async resolve(request) {
        const { docId, accYear } = (0, provider_utils_1.requireDocument)(request, this.code);
        const rows = await (0, provider_utils_1.providerQuery)(this.pg, `SELECT sr.sr_id              AS return_id,
              sr.sr_acc_year        AS acc_year,
              sr.sr_company_id      AS company_id,
              sr.sr_branch_id       AS branch_id,
              sr.sr_doc_type        AS doc_type,
              sr.sr_return_kind     AS return_kind,
              sr.sr_gst_mode        AS gst_mode,
              sr.sr_return_slno     AS return_slno,
              sr.sr_return_refno    AS return_refno,
              sr.sr_usr_refno       AS usr_refno,
              sr.sr_return_date     AS return_date,
              sr.sr_return_datetime AS return_datetime,
              sr.sr_is_against_bill AS is_against_bill,
              sr.sr_bill_refno      AS bill_refno,
              sr.sr_bill_date       AS bill_date,
              rsn.srm_name          AS reason_name,
              sr.sr_return_reason   AS return_reason,
              sr.sr_cust_id         AS cust_id,
              sr.sr_cust_name       AS cust_name,
              sr.sr_cust_addr       AS cust_addr,
              sr.sr_cust_place      AS cust_place,
              sr.sr_cust_pin        AS cust_pin,
              sr.sr_cust_phone      AS cust_phone,
              sr.sr_cust_gstin      AS cust_gstin,
              sr.sr_cust_gst_type   AS cust_gst_type,
              sr.sr_cust_stcd       AS cust_state_code,
              sr.sr_pos_stcd        AS pos_state_code,
              sr.sr_state_name      AS state_name,
              (sr.sr_pos_stcd IS DISTINCT FROM sr.sr_cust_stcd) AS is_interstate,
              sr.sr_vehicle_no      AS vehicle_no,
              sr.sr_tot_items       AS tot_items,
              sr.sr_tot_weight      AS tot_weight,
              sr.sr_gross_amt       AS gross_amt,
              sr.sr_disc_amt        AS disc_amt,
              sr.sr_taxable_amt     AS taxable_amt,
              sr.sr_cgst_amt        AS cgst_amt,
              sr.sr_sgst_amt        AS sgst_amt,
              sr.sr_igst_amt        AS igst_amt,
              sr.sr_cess_amt        AS cess_amt,
              sr.sr_tax_amt         AS tax_amt,
              sr.sr_freight_amt     AS freight_amt,
              sr.sr_load_amt        AS load_amt,
              sr.sr_unload_amt      AS unload_amt,
              sr.sr_other_amt       AS other_amt,
              sr.sr_round_off       AS round_off,
              sr.sr_return_amt      AS return_amt,
              sr.sr_settle_mode     AS settle_mode,
              sr.sr_settle_status   AS settle_status,
              sr.sr_refund_amt      AS refund_amt,
              sr.sr_adjusted_amt    AS adjusted_amt,
              sr.sr_credit_amt      AS credit_amt,
              sr.sr_points_back     AS points_back,
              sr.sr_points_back_amt AS points_back_amt,
              sr.sr_voucher_share_amt AS voucher_share_amt,
              sr.sr_loyalty_reverse_points AS loyalty_reverse_points,
              sr.sr_remarks         AS remarks,
              sr.sr_status          AS status,
              sr.sr_print_count     AS print_count
         FROM sales.sale_return sr
         LEFT JOIN stock.stock_reason_master rsn ON rsn.srm_id = sr.sr_reason_id
        WHERE sr.sr_id = $1
          AND sr.sr_acc_year = $2
          AND sr.sr_company_id = $3
          AND sr.sr_is_deleted = false`, [docId, accYear, request.context.companyId]);
        return rows[0] ?? {};
    }
};
exports.SaleReturnHeaderProvider = SaleReturnHeaderProvider;
exports.SaleReturnHeaderProvider = SaleReturnHeaderProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pg_service_1.PgService])
], SaleReturnHeaderProvider);
let SaleReturnItemsProvider = class SaleReturnItemsProvider {
    pg;
    code = 'sales.return.items';
    label = 'Sale return (credit note) — lines';
    cardinality = 'many';
    constructor(pg) {
        this.pg = pg;
    }
    async resolve(request) {
        const { docId, accYear } = (0, provider_utils_1.requireDocument)(request, this.code);
        const wantsTamil = request.lang.toLowerCase().startsWith('ta');
        return (0, provider_utils_1.providerQuery)(this.pg, `SELECT sri.sri_id            AS line_id,
              sri.sri_line_no       AS line_no,
              sri.sri_split_no      AS split_no,
              sri.sri_item_id       AS item_id,
              itm.item_code         AS item_code,
              CASE WHEN $4::boolean
                   THEN COALESCE(NULLIF(itm.item_name_ta, ''), itm.item_name_en)
                   ELSE itm.item_name_en
              END                   AS item_name,
              sri.sri_hsn_code      AS hsn_code,
              unt.unit_name         AS unit_name,
              sri.sri_batch_no      AS batch_no,
              sri.sri_expiry_date   AS expiry_date,
              sri.sri_condition     AS condition,
              sri.sri_claim_goods   AS claim_goods,
              sri.sri_is_free       AS is_free,
              sri.sri_return_qty    AS return_qty,
              sri.sri_free_qty      AS free_qty,
              sri.sri_weight_qty    AS weight_qty,
              sri.sri_rate          AS rate,
              sri.sri_rate_pre_tax  AS rate_pre_tax,
              sri.sri_max_price     AS mrp,
              sri.sri_disc_amt      AS disc_amt,
              sri.sri_gross_amt     AS gross_amt,
              sri.sri_taxable_amt   AS taxable_amt,
              sri.sri_tax_perc      AS tax_perc,
              sri.sri_tax_amt       AS tax_amt,
              sri.sri_cgst_perc     AS cgst_perc,
              sri.sri_cgst_amt      AS cgst_amt,
              sri.sri_sgst_perc     AS sgst_perc,
              sri.sri_sgst_amt      AS sgst_amt,
              sri.sri_igst_perc     AS igst_perc,
              sri.sri_igst_amt      AS igst_amt,
              sri.sri_cess_perc     AS cess_perc,
              sri.sri_cess_amt      AS cess_amt,
              sri.sri_net_amt       AS net_amt,
              sri.sri_rate_source   AS rate_source,
              sri.sri_remarks       AS remarks
         FROM sales.sale_return_item sri
         JOIN inventory.item_master itm ON itm.item_id = sri.sri_item_id
         LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = sri.sri_item_unit_id
         LEFT JOIN inventory.item_unit_master unt ON unt.unit_id = iuc.iuc_unit_id
        WHERE sri.sri_return_id = $1
          AND sri.sri_acc_year = $2
          AND sri.sri_company_id = $3
          AND sri.sri_is_deleted = false
        ORDER BY sri.sri_line_no, sri.sri_split_no
        LIMIT $5`, [docId, accYear, request.context.companyId, wantsTamil, request.rowLimit]);
    }
};
exports.SaleReturnItemsProvider = SaleReturnItemsProvider;
exports.SaleReturnItemsProvider = SaleReturnItemsProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pg_service_1.PgService])
], SaleReturnItemsProvider);
let SaleReturnTaxSummaryProvider = class SaleReturnTaxSummaryProvider {
    pg;
    code = 'sales.return.tax_summary';
    label = 'Sale return (credit note) — HSN / tax summary';
    cardinality = 'many';
    constructor(pg) {
        this.pg = pg;
    }
    async resolve(request) {
        const { docId, accYear } = (0, provider_utils_1.requireDocument)(request, this.code);
        return (0, provider_utils_1.providerQuery)(this.pg, `SELECT COALESCE(NULLIF(sri.sri_hsn_code, ''), '-') AS hsn_code,
              sri.sri_tax_perc                            AS tax_perc,
              sri.sri_cgst_perc                           AS cgst_perc,
              sri.sri_sgst_perc                           AS sgst_perc,
              sri.sri_igst_perc                           AS igst_perc,
              sri.sri_cess_perc                           AS cess_perc,
              COUNT(*)                                    AS line_count,
              SUM(sri.sri_return_qty + sri.sri_free_qty)  AS qty,
              SUM(sri.sri_taxable_amt)                    AS taxable_amt,
              SUM(sri.sri_cgst_amt)                       AS cgst_amt,
              SUM(sri.sri_sgst_amt)                       AS sgst_amt,
              SUM(sri.sri_igst_amt)                       AS igst_amt,
              SUM(sri.sri_cess_amt)                       AS cess_amt,
              SUM(sri.sri_tax_amt)                        AS tax_amt,
              SUM(sri.sri_taxable_amt + sri.sri_tax_amt)  AS total_amt
         FROM sales.sale_return_item sri
        WHERE sri.sri_return_id = $1
          AND sri.sri_acc_year = $2
          AND sri.sri_company_id = $3
          AND sri.sri_is_deleted = false
        GROUP BY 1, 2, 3, 4, 5, 6
        ORDER BY 1, 2
        LIMIT $4`, [docId, accYear, request.context.companyId, request.rowLimit]);
    }
};
exports.SaleReturnTaxSummaryProvider = SaleReturnTaxSummaryProvider;
exports.SaleReturnTaxSummaryProvider = SaleReturnTaxSummaryProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pg_service_1.PgService])
], SaleReturnTaxSummaryProvider);
exports.SALE_RETURN_PRINT_PROVIDERS = [
    SaleReturnHeaderProvider,
    SaleReturnItemsProvider,
    SaleReturnTaxSummaryProvider,
];
//# sourceMappingURL=sale-return.providers.js.map