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
exports.DcFulfilmentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
let DcFulfilmentService = class DcFulfilmentService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async dcRefsOfBill(tx, sbId, sbAccYear) {
        const rows = await tx.$queryRaw `
      SELECT DISTINCT d.sdi_dc_id, d.sdi_acc_year
        FROM sales.sale_bill_item b
        JOIN sales.sale_dc_item d ON d.sdi_id = b.sbi_src_item_id
       WHERE b.sbi_bill_id = ${sbId}::uuid AND b.sbi_acc_year = ${sbAccYear}::char(9)
         AND b.sbi_src_doc_type = 'DELIVERY_CHALLAN' AND b.sbi_src_item_id IS NOT NULL`;
        return rows.map((r) => ({ dcId: r.sdi_dc_id, accYear: r.sdi_acc_year.trim() }));
    }
    async recompute(tx, refs, actor, now) {
        const seen = new Set();
        for (const ref of refs) {
            const key = `${ref.dcId}|${ref.accYear}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            await this.recomputeOne(tx, ref.dcId, ref.accYear, actor, now);
        }
    }
    async recomputeOne(tx, dcId, accYear, actor, now) {
        await tx.$executeRaw `
      UPDATE sales.sale_dc_item d
         SET sdi_billed_qty = COALESCE((
               SELECT SUM(b.sbi_bill_qty)
                 FROM sales.sale_bill_item b
                 JOIN sales.sale_bill h ON h.sb_id = b.sbi_bill_id AND h.sb_acc_year = b.sbi_acc_year
                WHERE b.sbi_src_item_id = d.sdi_id AND b.sbi_src_doc_type = 'DELIVERY_CHALLAN'
                  AND b.sbi_is_deleted = false AND h.sb_is_deleted = false AND h.sb_status = 'POSTED'), 0),
             sdi_returned_qty = COALESCE((
               SELECT SUM(r.sdri_return_qty)
                 FROM sales.sale_dc_return_item r
                 JOIN sales.sale_dc_return rh ON rh.sdr_id = r.sdri_return_id AND rh.sdr_acc_year = r.sdri_acc_year
                WHERE r.sdri_dc_item_id = d.sdi_id
                  AND r.sdri_is_deleted = false AND rh.sdr_is_deleted = false AND rh.sdr_status = 'POSTED'), 0),
             sdi_modified_on = ${now},
             sdi_modified_by = ${actor}
       WHERE d.sdi_dc_id = ${dcId}::uuid AND d.sdi_acc_year = ${accYear}::char(9)
         AND d.sdi_is_deleted = false`;
        await tx.$executeRaw `
      UPDATE sales.sale_dc_item d
         SET sdi_line_status = CASE
               WHEN d.sdi_billed_qty <= 0 AND d.sdi_returned_qty <= 0 THEN 'OPEN'
               WHEN d.sdi_dc_qty - d.sdi_billed_qty - d.sdi_returned_qty > 0 THEN 'PARTIAL'
               WHEN d.sdi_billed_qty > 0 AND d.sdi_returned_qty <= 0 THEN 'BILLED'
               WHEN d.sdi_returned_qty > 0 AND d.sdi_billed_qty <= 0 THEN 'RETURNED'
               ELSE 'CLOSED' END
       WHERE d.sdi_dc_id = ${dcId}::uuid AND d.sdi_acc_year = ${accYear}::char(9)
         AND d.sdi_is_deleted = false`;
        await tx.$executeRaw `
      UPDATE sales.sale_dc h
         SET sdc_billed_amt = COALESCE((
               SELECT SUM(ROUND(d.sdi_billed_qty * COALESCE(d.sdi_rate, 0), 2))
                 FROM sales.sale_dc_item d
                WHERE d.sdi_dc_id = h.sdc_id AND d.sdi_acc_year = h.sdc_acc_year AND d.sdi_is_deleted = false), 0),
             sdc_returned_amt = COALESCE((
               SELECT SUM(ROUND(d.sdi_returned_qty * COALESCE(d.sdi_rate, 0), 2))
                 FROM sales.sale_dc_item d
                WHERE d.sdi_dc_id = h.sdc_id AND d.sdi_acc_year = h.sdc_acc_year AND d.sdi_is_deleted = false), 0),
             sdc_fulfil_status = (
               SELECT CASE
                        WHEN COUNT(*) = 0 THEN 'OPEN'
                        WHEN bool_and(d.sdi_line_status = 'OPEN') THEN 'OPEN'
                        -- Every line disposed of. BILLED / RETURNED only when
                        -- that is the ONLY way any line went; a line that was
                        -- part billed and part returned is CLOSED, and so is
                        -- a challan made of them.
                        WHEN bool_and(d.sdi_line_status IN ('BILLED', 'CLOSED'))
                             AND bool_or(d.sdi_line_status = 'BILLED') THEN 'BILLED'
                        WHEN bool_and(d.sdi_line_status IN ('RETURNED', 'CLOSED'))
                             AND bool_or(d.sdi_line_status = 'RETURNED') THEN 'RETURNED'
                        WHEN bool_and(d.sdi_line_status <> 'OPEN' AND d.sdi_line_status <> 'PARTIAL') THEN 'CLOSED'
                        ELSE 'PARTIAL' END
                 FROM sales.sale_dc_item d
                WHERE d.sdi_dc_id = h.sdc_id AND d.sdi_acc_year = h.sdc_acc_year AND d.sdi_is_deleted = false),
             sdc_modified_on = ${now},
             sdc_modified_by = ${actor}
       WHERE h.sdc_id = ${dcId}::uuid AND h.sdc_acc_year = ${accYear}::char(9)`;
    }
};
exports.DcFulfilmentService = DcFulfilmentService;
exports.DcFulfilmentService = DcFulfilmentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DcFulfilmentService);
//# sourceMappingURL=dc-fulfilment.service.js.map