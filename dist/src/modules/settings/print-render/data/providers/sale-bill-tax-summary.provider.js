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
exports.SaleBillTaxSummaryProvider = void 0;
const common_1 = require("@nestjs/common");
const pg_service_1 = require("../../../../../database/pg/pg.service");
const provider_utils_1 = require("./provider.utils");
let SaleBillTaxSummaryProvider = class SaleBillTaxSummaryProvider {
    pg;
    code = 'sales.bill.tax_summary';
    label = 'Sale bill — HSN / tax summary';
    cardinality = 'many';
    constructor(pg) {
        this.pg = pg;
    }
    async resolve(request) {
        const { docId, accYear } = (0, provider_utils_1.requireDocument)(request, this.code);
        return (0, provider_utils_1.providerQuery)(this.pg, `SELECT COALESCE(NULLIF(sbi.sbi_hsn_code, ''), '-') AS hsn_code,
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
        LIMIT $4`, [docId, accYear, request.context.companyId, request.rowLimit]);
    }
};
exports.SaleBillTaxSummaryProvider = SaleBillTaxSummaryProvider;
exports.SaleBillTaxSummaryProvider = SaleBillTaxSummaryProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pg_service_1.PgService])
], SaleBillTaxSummaryProvider);
//# sourceMappingURL=sale-bill-tax-summary.provider.js.map