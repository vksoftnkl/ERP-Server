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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseShortageController = exports.PurchaseShortageService = exports.CloseUndoDto = exports.CloseShortageDto = exports.OpenShortagesQueryDto = exports.ShortageReceiptCancelDto = exports.ShortageReceiptRefDto = exports.SaveShortageReceiptDto = exports.ShortageReceiptHeaderDto = exports.ShortageReceiptLineDto = exports.SHORTAGE_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const api_version_1 = require("../../../common/constants/api-version");
const rights_1 = require("../../../common/posting/rights");
const voucher_posting_service_1 = require("../../../common/posting/voucher-posting.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const stock_posting_service_1 = require("../../stocks/posting/stock-posting.service");
const purchase_errors_1 = require("../common/purchase.errors");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
exports.SHORTAGE_MENU_ID = 195;
const DOC = 'SHORTAGE_RECEIPT';
const CLOSE_DOC = 'SHORTAGE_CLOSE';
class ShortageReceiptLineDto {
    lineNo;
    shortageId;
    shortageAccYear;
    qty;
    batchNo;
    expiryDate;
    mrp;
    remarks;
}
exports.ShortageReceiptLineDto = ShortageReceiptLineDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ShortageReceiptLineDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ShortageReceiptLineDto.prototype, "shortageId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], ShortageReceiptLineDto.prototype, "shortageAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'In the item\'s BASE unit (a shortage is kept in base units).' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ShortageReceiptLineDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Default: the batch the shortage\'s source line came in.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], ShortageReceiptLineDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ShortageReceiptLineDto.prototype, "expiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ShortageReceiptLineDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], ShortageReceiptLineDto.prototype, "remarks", void 0);
class ShortageReceiptHeaderDto {
    psrId;
    companyId;
    branchId;
    accYear;
    deviceId;
    supplierId;
    godownId;
    docDate;
    challanNo;
    receivedBy;
    remarks;
    post;
}
exports.ShortageReceiptHeaderDto = ShortageReceiptHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ShortageReceiptHeaderDto.prototype, "psrId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ShortageReceiptHeaderDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ShortageReceiptHeaderDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], ShortageReceiptHeaderDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ShortageReceiptHeaderDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ShortageReceiptHeaderDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ShortageReceiptHeaderDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ShortageReceiptHeaderDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], ShortageReceiptHeaderDto.prototype, "challanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], ShortageReceiptHeaderDto.prototype, "receivedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], ShortageReceiptHeaderDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortageReceiptHeaderDto.prototype, "post", void 0);
class SaveShortageReceiptDto {
    header;
    lines;
}
exports.SaveShortageReceiptDto = SaveShortageReceiptDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ShortageReceiptHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ShortageReceiptHeaderDto),
    __metadata("design:type", ShortageReceiptHeaderDto)
], SaveShortageReceiptDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ShortageReceiptLineDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ShortageReceiptLineDto),
    __metadata("design:type", Array)
], SaveShortageReceiptDto.prototype, "lines", void 0);
class ShortageReceiptRefDto {
    psrId;
    accYear;
}
exports.ShortageReceiptRefDto = ShortageReceiptRefDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ShortageReceiptRefDto.prototype, "psrId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], ShortageReceiptRefDto.prototype, "accYear", void 0);
class ShortageReceiptCancelDto extends ShortageReceiptRefDto {
    reason;
}
exports.ShortageReceiptCancelDto = ShortageReceiptCancelDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], ShortageReceiptCancelDto.prototype, "reason", void 0);
class OpenShortagesQueryDto {
    companyId;
    branchId;
    supplierId;
    all;
}
exports.OpenShortagesQueryDto = OpenShortagesQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], OpenShortagesQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], OpenShortagesQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], OpenShortagesQueryDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Also rows with nothing open (history).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['true', 'false']),
    __metadata("design:type", String)
], OpenShortagesQueryDto.prototype, "all", void 0);
class CloseShortageDto {
    shortageId;
    accYear;
    closeAccYear;
    deviceId;
    kind;
    qty;
    cnNo;
    cnDate;
    docDate;
    reason;
}
exports.CloseShortageDto = CloseShortageDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CloseShortageDto.prototype, "shortageId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], CloseShortageDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The close row\'s own year (default: the shortage\'s).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], CloseShortageDto.prototype, "closeAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CloseShortageDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['SUPPLIER_CN', 'WRITE_OFF'] }),
    (0, class_validator_1.IsIn)(['SUPPLIER_CN', 'WRITE_OFF']),
    __metadata("design:type", String)
], CloseShortageDto.prototype, "kind", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Base units; default the whole open qty.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CloseShortageDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], CloseShortageDto.prototype, "cnNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CloseShortageDto.prototype, "cnDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CloseShortageDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], CloseShortageDto.prototype, "reason", void 0);
class CloseUndoDto {
    closeId;
    accYear;
    reason;
}
exports.CloseUndoDto = CloseUndoDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CloseUndoDto.prototype, "closeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], CloseUndoDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], CloseUndoDto.prototype, "reason", void 0);
let PurchaseShortageService = class PurchaseShortageService {
    prisma;
    ctx;
    vouchers;
    stockPosting;
    constructor(prisma, ctx, vouchers, stockPosting) {
        this.prisma = prisma;
        this.ctx = ctx;
        this.vouchers = vouchers;
        this.stockPosting = stockPosting;
    }
    actor() {
        const u = this.ctx.getUserId();
        if (!u)
            (0, purchase_errors_1.purRefuse)('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
        return u;
    }
    rules() { return (0, purchase_doc_helpers_1.stockRules)('IN', DOC, 'Shortage Receipt', 'PURCHASE', purchase_doc_helpers_1.TxnStatusDocType.SHORTAGE_RECEIPT); }
    async facts(db, ids, exceptPsrId, postedOnly = false) {
        if (!ids.length)
            return new Map();
        const live = postedOnly ? client_1.Prisma.sql `r.psr_status = 'POSTED'` : client_1.Prisma.sql `r.psr_status <> 'CANCELLED'`;
        const rows = await db.$queryRaw `
      SELECT s.psh_id, s.psh_acc_year, s.psh_company_id, s.psh_branch_id, s.psh_supplier_id, s.psh_item_id, s.psh_reason, s.psh_src_doc_refno,
             s.psh_src_doc_type, s.psh_src_item_id, s.psh_qty_base, COALESCE(s.psh_value, 0) AS value, COALESCE(s.psh_gst_pending, 0) AS gst,
             COALESCE(s.psh_origin_cost_rate, 0) AS origin_rate,
             COALESCE(pii.pii_cgst_amt, pri.pri_cgst_amt, 0) AS cgst, COALESCE(pii.pii_sgst_amt, pri.pri_sgst_amt, 0) AS sgst,
             COALESCE(pii.pii_igst_amt, pri.pri_igst_amt, 0) AS igst, COALESCE(pii.pii_cess_amt, pri.pri_cess_amt, 0) AS cess,
             COALESCE(pii.pii_tax_id, pri.pri_tax_id) AS tax_id,
             COALESCE(pii.pii_billed_qty * pii.pii_to_base_factor, pri.pri_qty * pri.pri_to_base_factor) AS src_base_qty,
             COALESCE(pii.pii_base_uom_id, gri.gri_base_uom_id, pri.pri_base_uom_id) AS base_uom, COALESCE(pii.pii_hsn_code, gri.gri_hsn_code, pri.pri_hsn_code) AS hsn,
             COALESCE((SELECT SUM(i.psri_qty * i.psri_to_base_factor) FROM purchase.pur_shortage_receipt_item i JOIN purchase.pur_shortage_receipt r ON r.psr_id = i.psri_psr_id AND r.psr_acc_year = i.psri_acc_year
                        WHERE i.psri_shortage_id = s.psh_id AND NOT i.psri_is_deleted AND NOT r.psr_is_deleted AND ${live}
                          AND (${exceptPsrId ?? null}::uuid IS NULL OR r.psr_id <> ${exceptPsrId ?? null}::uuid)), 0) AS received,
             COALESCE((SELECT SUM(i.psri_value) FROM purchase.pur_shortage_receipt_item i JOIN purchase.pur_shortage_receipt r ON r.psr_id = i.psri_psr_id AND r.psr_acc_year = i.psri_acc_year
                        WHERE i.psri_shortage_id = s.psh_id AND NOT i.psri_is_deleted AND NOT r.psr_is_deleted AND r.psr_status = 'POSTED'), 0) AS rcv_value,
             COALESCE((SELECT SUM(i.psri_gst_released) FROM purchase.pur_shortage_receipt_item i JOIN purchase.pur_shortage_receipt r ON r.psr_id = i.psri_psr_id AND r.psr_acc_year = i.psri_acc_year
                        WHERE i.psri_shortage_id = s.psh_id AND NOT i.psri_is_deleted AND NOT r.psr_is_deleted AND r.psr_status = 'POSTED'), 0) AS rcv_gst,
             COALESCE((SELECT SUM(c.psc_qty_base) FROM purchase.pur_shortage_close c WHERE c.psc_shortage_id = s.psh_id AND NOT c.psc_is_deleted), 0) AS closed,
             COALESCE((SELECT SUM(c.psc_amount) FROM purchase.pur_shortage_close c WHERE c.psc_shortage_id = s.psh_id AND NOT c.psc_is_deleted), 0) AS cls_amount,
             a.pia_batch_no AS batch_no, a.pia_expiry_date AS expiry, a.pia_mrp AS mrp
        FROM purchase.pur_shortage s
        -- the bill line whose GST is pending: the line that opened it, or the bill that adopted a GRN challan short (R3)
        LEFT JOIN purchase.pur_invoice_item pii ON pii.pii_id = COALESCE(s.psh_bill_item_id, CASE WHEN s.psh_src_doc_type = 'PURCHASE_BILL' THEN s.psh_src_item_id END)
              AND pii.pii_acc_year = COALESCE(s.psh_bill_doc_year, s.psh_src_doc_year)
        LEFT JOIN purchase.pur_grn_item gri ON s.psh_src_doc_type = 'GRN' AND gri.gri_id = s.psh_src_item_id AND gri.gri_acc_year = s.psh_src_doc_year
        LEFT JOIN purchase.pur_return_item pri ON s.psh_src_doc_type = 'PURCHASE_RETURN' AND pri.pri_id = s.psh_src_item_id AND pri.pri_acc_year = s.psh_src_doc_year
        LEFT JOIN LATERAL (SELECT x.pia_batch_no, x.pia_expiry_date, x.pia_mrp FROM purchase.pur_item_alloc x
                            WHERE x.pia_line_id = s.psh_src_item_id AND NOT x.pia_is_deleted ORDER BY x.pia_row_no LIMIT 1) a ON true
       WHERE s.psh_id = ANY(${ids}::uuid[]) AND NOT s.psh_is_deleted`;
        const out = new Map();
        for (const r of rows) {
            const qtyBase = (0, purchase_doc_helpers_1.D)(r.psh_qty_base), value = (0, purchase_doc_helpers_1.D)(r.value);
            const reason = r.psh_reason;
            const srcBase = (0, purchase_doc_helpers_1.D)(r.src_base_qty);
            const share = (v) => (srcBase.isZero() ? purchase_doc_helpers_1.ZERO : (0, purchase_doc_helpers_1.D)(v).times(qtyBase).dividedBy(srcBase));
            const raw = [['INPUT_CGST', r.cgst], ['INPUT_SGST', r.sgst], ['INPUT_IGST', r.igst], ['INPUT_CESS', r.cess]]
                .map(([role, v]) => ({ role: role, amt: share(v), taxId: r.tax_id ?? null }))
                .filter((h) => h.amt.greaterThan(0));
            const gst = reason === 'SHORT_BILL' ? (0, purchase_doc_helpers_1.D)(r.gst) : reason === 'REPLACE' ? (0, purchase_doc_helpers_1.r2)(raw.reduce((s, h) => s.plus(h.amt), purchase_doc_helpers_1.ZERO)) : purchase_doc_helpers_1.ZERO;
            const rawTotal = raw.reduce((s, h) => s.plus(h.amt), purchase_doc_helpers_1.ZERO);
            let given = purchase_doc_helpers_1.ZERO;
            const heads = raw.map((h, k) => {
                const amt = k === raw.length - 1 ? gst.minus(given) : (0, purchase_doc_helpers_1.r2)(rawTotal.isZero() ? purchase_doc_helpers_1.ZERO : gst.times(h.amt).dividedBy(rawTotal));
                given = given.plus(amt);
                return { ...h, amt };
            }).filter((h) => !h.amt.isZero());
            const received = (0, purchase_doc_helpers_1.D)(r.received), closed = (0, purchase_doc_helpers_1.D)(r.closed);
            const clsAmount = (0, purchase_doc_helpers_1.D)(r.cls_amount);
            const clsGst = qtyBase.isZero() ? purchase_doc_helpers_1.ZERO : (0, purchase_doc_helpers_1.r2)(gst.times(closed).dividedBy(qtyBase));
            out.set(r.psh_id, {
                id: r.psh_id, accYear: r.psh_acc_year, companyId: r.psh_company_id, branchId: r.psh_branch_id,
                supplierId: r.psh_supplier_id, itemId: r.psh_item_id, reason, srcRefno: r.psh_src_doc_refno ?? null,
                qtyBase, value, gst, heads, inter: heads.some((h) => h.role === 'INPUT_IGST'),
                costRate: value.greaterThan(0) && qtyBase.greaterThan(0) ? value.dividedBy(qtyBase).toDecimalPlaces(6) : (0, purchase_doc_helpers_1.D)(r.origin_rate),
                baseUomId: r.base_uom, hsn: r.hsn ?? null,
                received, closed, open: qtyBase.minus(received).minus(closed),
                valueUsed: (0, purchase_doc_helpers_1.D)(r.rcv_value).plus(clsAmount.minus(clsGst)), gstUsed: (0, purchase_doc_helpers_1.D)(r.rcv_gst).plus(clsGst),
                batchNo: r.batch_no ?? null, expiry: r.expiry ?? null, mrp: r.mrp ?? null,
            });
        }
        return out;
    }
    piece(f, q) {
        const last = q.equals(f.open);
        const value = last ? f.value.minus(f.valueUsed) : (0, purchase_doc_helpers_1.r2)(f.value.times(q).dividedBy(f.qtyBase));
        const gst = last ? f.gst.minus(f.gstUsed) : (0, purchase_doc_helpers_1.r2)(f.gst.times(q).dividedBy(f.qtyBase));
        let given = purchase_doc_helpers_1.ZERO;
        const total = f.heads.reduce((s, h) => s.plus(h.amt), purchase_doc_helpers_1.ZERO);
        const heads = f.heads.map((h, k) => {
            const amt = k === f.heads.length - 1 ? gst.minus(given) : (0, purchase_doc_helpers_1.r2)(total.isZero() ? purchase_doc_helpers_1.ZERO : gst.times(h.amt).dividedBy(total));
            given = given.plus(amt);
            return { ...h, amt };
        }).filter((h) => !h.amt.isZero());
        return { value: value.isNegative() ? purchase_doc_helpers_1.ZERO : value, gst: gst.isNegative() ? purchase_doc_helpers_1.ZERO : gst, heads };
    }
    async open(q) {
        const ids = await this.prisma.$queryRaw `
      SELECT s.psh_id AS id FROM purchase.pur_shortage s
       WHERE s.psh_company_id = ${q.companyId}::uuid AND s.psh_branch_id = ${q.branchId}::uuid AND NOT s.psh_is_deleted
         AND (${q.supplierId ?? null}::uuid IS NULL OR s.psh_supplier_id = ${q.supplierId ?? null}::uuid)
       ORDER BY s.psh_created_on`;
        const facts = await this.facts(this.prisma, ids.map((i) => i.id));
        const live = [...facts.values()].filter((f) => q.all === 'true' || f.open.greaterThan(0));
        const names = await (0, purchase_doc_helpers_1.unitNames)(this.prisma, live.map((f) => f.baseUomId));
        const sups = await this.prisma.$queryRaw `
      SELECT sup_id, sup_name FROM purchase.suppliers WHERE sup_id = ANY(${[...new Set(live.map((f) => f.supplierId))]}::uuid[])`;
        const supName = new Map(sups.map((s) => [s.sup_id, s.sup_name]));
        return (0, purchase_doc_helpers_1.jsonSafe)(live.map((f) => ({
            shortageId: f.id, accYear: f.accYear, supplierId: f.supplierId, supplierName: supName.get(f.supplierId) ?? null, itemId: f.itemId,
            ...names.get(f.baseUomId), uomId: f.baseUomId, reason: f.reason, srcRefno: f.srcRefno, qtyBase: f.qtyBase, received: f.received, closed: f.closed,
            openQty: f.open, value: f.value, gst: f.gst, openValue: f.value.minus(f.valueUsed), openGst: f.gst.minus(f.gstUsed), costRate: f.costRate,
            batchNo: f.batchNo, expiryDate: f.expiry, mrp: f.mrp,
        })));
    }
    async save(dto) {
        const actor = this.actor();
        const h = dto.header;
        const id = await this.prisma.$transaction(async (tx) => {
            const facts = await this.facts(tx, dto.lines.map((l) => l.shortageId), h.psrId);
            const want = new Map();
            const problems = [];
            dto.lines.forEach((l, i) => {
                const f = facts.get(l.shortageId);
                if (!f) {
                    problems.push({ field: `lines.${i}.shortageId`, code: purchase_errors_1.PUR.NOT_FOUND, message: `Line ${l.lineNo}: that shortage is not open` });
                    return;
                }
                if (f.supplierId !== h.supplierId)
                    problems.push({ field: `lines.${i}.shortageId`, code: purchase_errors_1.PUR.QTY_INVALID, message: `Line ${l.lineNo}: that shortage is another supplier's` });
                if (f.branchId !== h.branchId)
                    problems.push({ field: `lines.${i}.shortageId`, code: purchase_errors_1.PUR.QTY_INVALID, message: `Line ${l.lineNo}: that shortage is another branch's` });
                if (!(0, purchase_doc_helpers_1.D)(l.qty).greaterThan(0))
                    problems.push({ field: `lines.${i}.qty`, code: purchase_errors_1.PUR.QTY_INVALID, message: `Line ${l.lineNo}: nothing received` });
                want.set(l.shortageId, (want.get(l.shortageId) ?? purchase_doc_helpers_1.ZERO).plus((0, purchase_doc_helpers_1.D)(l.qty)));
            });
            for (const [sid, q] of want) {
                const f = facts.get(sid);
                if (f && q.greaterThan(f.open))
                    problems.push({ field: 'lines', code: 'PUR_SHORTAGE_QTY_EXCEEDS', message: `${f.srcRefno ?? 'Shortage'}: ${q} received, only ${f.open} is short` });
            }
            if (problems.length)
                (0, purchase_errors_1.purRefuseMany)(problems[0].message, problems);
            let psrId = h.psrId ?? null;
            let slno, refno, isNew = false;
            if (psrId) {
                const cur = await tx.purShortageReceipt.findFirst({ where: { psrId, psrAccYear: h.accYear, psrIsDeleted: false } });
                if (!cur)
                    (0, purchase_errors_1.purNotFound)(`Shortage receipt ${psrId} not found`);
                if (cur.psrStatus !== 'DRAFT')
                    (0, purchase_errors_1.purConflict)(`${cur.psrRefno} is ${cur.psrStatus} — only a draft can be edited.`, purchase_errors_1.PUR.NOT_DRAFT, 'psrId');
                slno = cur.psrSlno;
                refno = cur.psrRefno;
                await tx.purItemAlloc.deleteMany({ where: { piaDocType: DOC, piaDocId: psrId, piaAccYear: h.accYear } });
                await tx.purShortageReceiptItem.deleteMany({ where: { psriPsrId: psrId, psriAccYear: h.accYear } });
            }
            else {
                ({ slno, refno } = await (0, purchase_doc_helpers_1.allocateDocNumber)(tx, 'SHR', h.companyId, h.branchId, h.accYear, h.deviceId));
                isNew = true;
            }
            const total = dto.lines.reduce((s, l) => s.plus((0, purchase_doc_helpers_1.r2)((0, purchase_doc_helpers_1.D)(l.qty).times(facts.get(l.shortageId).costRate))), purchase_doc_helpers_1.ZERO);
            const data = {
                psrCompanyId: h.companyId, psrBranchId: h.branchId, psrAccYear: h.accYear, psrDeviceId: h.deviceId, psrSlno: slno, psrRefno: refno,
                psrDocDate: (0, purchase_doc_helpers_1.dateOf)(h.docDate), psrSupplierId: h.supplierId, psrGodownId: h.godownId, psrReceivedAt: new Date(), psrChallanNo: h.challanNo ?? null,
                psrReceivedBy: h.receivedBy ?? [], psrValue: total, psrRemarks: h.remarks ?? null, psrStatus: 'DRAFT',
            };
            if (isNew)
                psrId = (await tx.purShortageReceipt.create({ data: { ...data, psrCreatedBy: actor }, select: { psrId: true } })).psrId;
            else
                await tx.purShortageReceipt.update({ where: { psrId_psrAccYear: { psrId: psrId, psrAccYear: h.accYear } }, data: { ...data, psrModifiedBy: actor, psrModifiedOn: new Date(), psrRevisionNo: { increment: 1 } } });
            for (const l of dto.lines) {
                const f = facts.get(l.shortageId);
                const row = await tx.purShortageReceiptItem.create({ data: {
                        psriPsrId: psrId, psriCompanyId: h.companyId, psriBranchId: h.branchId, psriAccYear: h.accYear, psriLineNo: l.lineNo,
                        psriShortageId: f.id, psriShortageAccYear: f.accYear, psriItemId: f.itemId, psriUomId: f.baseUomId, psriBaseUomId: f.baseUomId, psriToBaseFactor: (0, purchase_doc_helpers_1.D)(1),
                        psriHsnCode: f.hsn, psriQty: (0, purchase_doc_helpers_1.D)(l.qty), psriCostRate: f.costRate, psriValue: (0, purchase_doc_helpers_1.r2)((0, purchase_doc_helpers_1.D)(l.qty).times(f.costRate)), psriGstReleased: purchase_doc_helpers_1.ZERO,
                        psriRemarks: l.remarks ?? null, psriCreatedBy: actor,
                    }, select: { psriId: true } });
                await tx.purItemAlloc.create({ data: {
                        piaCompanyId: h.companyId, piaBranchId: h.branchId, piaAccYear: h.accYear, piaDocType: DOC, piaDocId: psrId, piaLineId: row.psriId, piaRowNo: 1,
                        piaGodownId: h.godownId, piaBucket: 'SALEABLE', piaBatchNo: (l.batchNo ?? f.batchNo)?.trim() || null,
                        piaExpiryDate: l.expiryDate ? (0, purchase_doc_helpers_1.dateOf)(l.expiryDate) : f.expiry, piaMrp: l.mrp ?? f.mrp, piaQty: (0, purchase_doc_helpers_1.D)(l.qty), piaFreeQty: purchase_doc_helpers_1.ZERO, piaCreatedBy: actor,
                    } });
            }
            if (isNew)
                await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.SHORTAGE_RECEIPT, docId: psrId, refno, event: purchase_doc_helpers_1.TxnStatusEvent.CREATED, from: null, to: 'DRAFT', actor, deviceId: h.deviceId });
            if (h.post)
                await this.postInTx(tx, psrId, h.accYear, actor);
            return psrId;
        }, { timeout: 60000, maxWait: 10000 });
        return this.get(id, h.accYear);
    }
    async post(psrId, accYear) {
        const actor = this.actor();
        await this.prisma.$transaction((tx) => this.postInTx(tx, psrId, accYear, actor), { timeout: 60000, maxWait: 10000 });
        return this.get(psrId, accYear);
    }
    async postInTx(tx, psrId, accYear, actor) {
        const r = await tx.purShortageReceipt.findFirst({ where: { psrId, psrAccYear: accYear, psrIsDeleted: false } });
        if (!r)
            (0, purchase_errors_1.purNotFound)(`Shortage receipt ${psrId} not found`);
        if (r.psrStatus !== 'DRAFT')
            (0, purchase_errors_1.purConflict)(`${r.psrRefno} is ${r.psrStatus} — only a draft can be posted.`, purchase_errors_1.PUR.NOT_DRAFT, 'psrId');
        const lines = await tx.purShortageReceiptItem.findMany({ where: { psriPsrId: psrId, psriAccYear: accYear, psriIsDeleted: false }, orderBy: { psriLineNo: 'asc' } });
        const allocs = await tx.purItemAlloc.findMany({ where: { piaDocType: DOC, piaDocId: psrId, piaAccYear: accYear, piaIsDeleted: false } });
        const allocOf = new Map(allocs.map((a) => [a.piaLineId, a]));
        for (const l of lines)
            await tx.$queryRaw `SELECT count(pg_advisory_xact_lock(hashtext('purchase_shortage'), hashtext(${l.psriShortageId})))::int AS locked`;
        const facts = await this.facts(tx, lines.map((l) => l.psriShortageId), psrId, true);
        const pieces = lines.map((l) => {
            const f = facts.get(l.psriShortageId);
            if (!f)
                (0, purchase_errors_1.purConflict)(`Line ${l.psriLineNo}: its shortage is gone (its bill / GRN was cancelled).`, purchase_errors_1.PUR.NOT_FOUND, 'lines');
            const q = l.psriQty.times(l.psriToBaseFactor);
            if (q.greaterThan(f.open))
                (0, purchase_errors_1.purConflict)(`Line ${l.psriLineNo}: ${q} received, only ${f.open} is still short.`, 'PUR_SHORTAGE_QTY_EXCEEDS', 'lines');
            const p = f.value.greaterThan(0) ? this.piece(f, q) : { value: (0, purchase_doc_helpers_1.r2)(q.times(f.costRate)), gst: purchase_doc_helpers_1.ZERO, heads: [] };
            f.open = f.open.minus(q);
            f.valueUsed = f.valueUsed.plus(p.value);
            f.gstUsed = f.gstUsed.plus(p.gst);
            return { l, f, q, p };
        });
        const postedOn = new Date();
        const docDate = (0, purchase_doc_helpers_1.isoDate)(r.psrDocDate);
        const { perRow } = await (0, purchase_doc_helpers_1.postShadowStock)(tx, this.stockPosting, { companyId: r.psrCompanyId, branchId: r.psrBranchId, accYear, deviceId: r.psrDeviceId, sessionId: r.psrSessionId, docType: DOC, docId: psrId,
            refno: r.psrRefno, revision: r.psrRevisionNo, usrRefno: r.psrChallanNo, docDate, supplierId: r.psrSupplierId, remarks: `Shortage receipt ${r.psrRefno}` }, this.rules(), pieces.map(({ l, q, p }) => {
            const a = allocOf.get(l.psriId);
            return { itemId: l.psriItemId, uomId: l.psriUomId, baseUomId: l.psriBaseUomId, factor: l.psriToBaseFactor, godownId: a.piaGodownId, bucket: a.piaBucket,
                batchNo: a.piaBatchNo, expiryDate: a.piaExpiryDate, mrp: a.piaMrp, supplierId: r.psrSupplierId, qty: l.psriQty, freeQty: purchase_doc_helpers_1.ZERO,
                costRate: q.isZero() ? purchase_doc_helpers_1.ZERO : p.value.dividedBy(q).toDecimalPlaces(6, client_1.Prisma.Decimal.ROUND_HALF_UP) };
        }), actor, postedOn);
        for (let i = 0; i < pieces.length; i++) {
            const { l, p } = pieces[i];
            const a = allocOf.get(l.psriId);
            await tx.purShortageReceiptItem.update({ where: { psriId_psriAccYear: { psriId: l.psriId, psriAccYear: accYear } }, data: { psriValue: p.value, psriGstReleased: p.gst } });
            if (perRow[i]?.sviId)
                await tx.purItemAlloc.update({ where: { piaId_piaAccYear: { piaId: a.piaId, piaAccYear: accYear } }, data: { piaLotId: perRow[i].lotId, piaSviId: perRow[i].sviId, piaSviAccYear: accYear } });
        }
        const legs = [];
        const add = (leg) => { if (leg.amount >= 0.005)
            legs.push(leg); };
        let stockDr = purchase_doc_helpers_1.ZERO, srCr = purchase_doc_helpers_1.ZERO, grniCr = purchase_doc_helpers_1.ZERO, pendingCr = purchase_doc_helpers_1.ZERO;
        const inputDr = new Map();
        for (const { f, p } of pieces) {
            stockDr = stockDr.plus(p.value);
            if (f.reason === 'SHORT_CHALLAN')
                grniCr = grniCr.plus(p.value);
            else
                srCr = srCr.plus(p.value);
            if (f.reason === 'SHORT_BILL') {
                pendingCr = pendingCr.plus(p.gst);
                for (const hd of p.heads) {
                    const k = `${hd.role}|${hd.taxId ?? ''}`;
                    const cur = inputDr.get(k) ?? { ...hd, amt: purchase_doc_helpers_1.ZERO };
                    cur.amt = cur.amt.plus(hd.amt);
                    inputDr.set(k, cur);
                }
            }
        }
        const inter = pieces.some(({ f }) => f.inter);
        add({ role: 'INVENTORY', drCr: 'DR', amount: (0, purchase_doc_helpers_1.num2)(stockDr), roleTag: 'INVENTORY', remarks: `Shortage received · ${r.psrRefno}` });
        add({ role: 'SHORTAGE_RECEIVABLE', drCr: 'CR', amount: (0, purchase_doc_helpers_1.num2)(srCr), roleTag: 'SHORTAGE_RECEIVABLE', remarks: `Shortage received · ${r.psrRefno}` });
        add({ role: 'GRNI', drCr: 'CR', amount: (0, purchase_doc_helpers_1.num2)(grniCr), roleTag: 'GRNI', remarks: `Challan short received — bill pending · ${r.psrRefno}` });
        for (const hd of inputDr.values())
            add({ role: hd.role, drCr: 'DR', amount: (0, purchase_doc_helpers_1.num2)(hd.amt), taxId: hd.taxId, supplyNature: (inter ? 'INTER' : 'INTRA'), roleTag: hd.role });
        add({ role: 'INPUT_TAX_PENDING', drCr: 'CR', amount: (0, purchase_doc_helpers_1.num2)(pendingCr), roleTag: 'INPUT_TAX_PENDING', remarks: `GST released · ${r.psrRefno}` });
        let voucherId = null;
        if (legs.length) {
            const vt = await (0, purchase_doc_helpers_1.voucherTypeId)(tx, 'SHR');
            const posted = await this.vouchers.postLegs(tx, {
                header: { companyId: r.psrCompanyId, branchId: r.psrBranchId, accYear, voucherTypeId: vt, voucherDate: docDate, srcModule: 'PURCHASE', srcDocType: DOC, srcDocId: psrId,
                    docLabel: 'Shortage Receipt', docRefno: r.psrRefno, docDate, usrRefno: r.psrChallanNo, docAmount: (0, purchase_doc_helpers_1.num2)(stockDr), partyId: r.psrSupplierId,
                    userId: actor, sessionId: r.psrSessionId, deviceId: r.psrDeviceId, remarks: r.psrRemarks ?? `Shortage receipt ${r.psrRefno}`, createdBy: actor,
                    presetRefno: r.psrRefno, presetNo: r.psrSlno },
                legs,
            });
            voucherId = posted.voucherId;
        }
        await tx.purShortageReceipt.update({ where: { psrId_psrAccYear: { psrId, psrAccYear: accYear } }, data: { psrStatus: 'POSTED', psrValue: stockDr, psrPostedVoucherId: voucherId, psrModifiedBy: actor, psrModifiedOn: postedOn } });
        await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: r.psrCompanyId, branchId: r.psrBranchId, accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.SHORTAGE_RECEIPT, docId: psrId, refno: r.psrRefno, event: purchase_doc_helpers_1.TxnStatusEvent.POSTED, from: 'DRAFT', to: 'POSTED', actor, deviceId: r.psrDeviceId });
    }
    async get(psrId, accYear) {
        const header = await this.prisma.purShortageReceipt.findFirst({ where: { psrId, psrAccYear: accYear, psrIsDeleted: false } });
        if (!header)
            (0, purchase_errors_1.purNotFound)(`Shortage receipt ${psrId} not found`);
        const [lines, allocs, sup] = await Promise.all([
            this.prisma.purShortageReceiptItem.findMany({ where: { psriPsrId: psrId, psriAccYear: accYear, psriIsDeleted: false }, orderBy: { psriLineNo: 'asc' } }),
            this.prisma.purItemAlloc.findMany({ where: { piaDocType: DOC, piaDocId: psrId, piaAccYear: accYear, piaIsDeleted: false } }),
            this.prisma.$queryRaw `SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${header.psrSupplierId}::uuid`,
        ]);
        const names = await (0, purchase_doc_helpers_1.unitNames)(this.prisma, lines.map((l) => l.psriUomId));
        const facts = await this.facts(this.prisma, lines.map((l) => l.psriShortageId), header.psrStatus === 'DRAFT' ? psrId : null);
        return (0, purchase_doc_helpers_1.jsonSafe)({
            header: { ...header, supplierName: sup[0]?.sup_name ?? null },
            lines: lines.map((l) => {
                const a = allocs.find((x) => x.piaLineId === l.psriId);
                const f = facts.get(l.psriShortageId);
                return { ...l, ...names.get(l.psriUomId), reason: f?.reason ?? null, srcRefno: f?.srcRefno ?? null, openQty: f?.open ?? null,
                    batchNo: a?.piaBatchNo ?? null, expiryDate: a?.piaExpiryDate ?? null, mrp: a?.piaMrp ?? null };
            }),
        });
    }
    async cancel(dto) {
        const actor = this.actor();
        await this.prisma.$transaction(async (tx) => {
            const r = await tx.purShortageReceipt.findFirst({ where: { psrId: dto.psrId, psrAccYear: dto.accYear, psrIsDeleted: false } });
            if (!r)
                (0, purchase_errors_1.purNotFound)(`Shortage receipt ${dto.psrId} not found`);
            if (r.psrStatus === 'CANCELLED')
                (0, purchase_errors_1.purConflict)(`${r.psrRefno} is already cancelled.`, purchase_errors_1.PUR.NOT_POSTED, 'psrId');
            if (r.psrStatus === 'POSTED') {
                await (0, purchase_doc_helpers_1.cancelShadowStock)(tx, this.stockPosting, DOC, dto.psrId, dto.accYear, r.psrCompanyId, r.psrBranchId, this.rules(), actor, dto.reason);
                if (r.psrPostedVoucherId)
                    await this.vouchers.reverseLegs(tx, r.psrPostedVoucherId, dto.accYear, `Shortage receipt ${r.psrRefno} cancelled: ${dto.reason}`, actor);
            }
            await tx.purShortageReceipt.update({ where: { psrId_psrAccYear: { psrId: dto.psrId, psrAccYear: dto.accYear } }, data: { psrStatus: 'CANCELLED', psrModifiedBy: actor, psrModifiedOn: new Date() } });
            await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: r.psrCompanyId, branchId: r.psrBranchId, accYear: dto.accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.SHORTAGE_RECEIPT, docId: dto.psrId, refno: r.psrRefno, event: purchase_doc_helpers_1.TxnStatusEvent.CANCELLED, from: r.psrStatus, to: 'CANCELLED', actor, remarks: dto.reason });
        }, { timeout: 60000, maxWait: 10000 });
        return this.get(dto.psrId, dto.accYear);
    }
    async close(dto) {
        const actor = this.actor();
        const out = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT count(pg_advisory_xact_lock(hashtext('purchase_shortage'), hashtext(${dto.shortageId})))::int AS locked`;
            const f = (await this.facts(tx, [dto.shortageId], null, true)).get(dto.shortageId);
            const reserved = (await this.facts(tx, [dto.shortageId])).get(dto.shortageId);
            if (!f)
                (0, purchase_errors_1.purNotFound)(`Shortage ${dto.shortageId} not found`);
            if (!f.open.greaterThan(0))
                (0, purchase_errors_1.purConflict)('Nothing of that shortage is open.', purchase_errors_1.PUR.QTY_INVALID, 'shortageId');
            const q = dto.qty == null ? (reserved?.open ?? purchase_doc_helpers_1.ZERO) : (0, purchase_doc_helpers_1.D)(dto.qty);
            if (!q.greaterThan(0) || q.greaterThan(reserved?.open ?? purchase_doc_helpers_1.ZERO))
                (0, purchase_errors_1.purRefuse)(`Qty must be more than 0 and at most the open ${reserved?.open ?? 0} (draft receipts hold the rest).`, purchase_errors_1.PUR.QTY_INVALID, 'qty');
            const p = f.value.greaterThan(0) ? this.piece(f, q) : { value: purchase_doc_helpers_1.ZERO, gst: purchase_doc_helpers_1.ZERO, heads: [] };
            const accYear = dto.closeAccYear ?? dto.accYear;
            const docDate = dto.docDate ?? (0, purchase_doc_helpers_1.isoDate)(new Date());
            const [{ n: seq }] = await tx.$queryRaw `SELECT count(*) + 1 AS n FROM purchase.pur_shortage_close WHERE psc_shortage_id = ${f.id}::uuid`;
            const ref = `${f.srcRefno ?? 'SHORT'}/X${seq}`;
            const c = await tx.purShortageClose.create({ data: {
                    pscCompanyId: f.companyId, pscBranchId: f.branchId, pscAccYear: accYear, pscShortageId: f.id, pscShortageAccYear: f.accYear, pscKind: dto.kind,
                    pscQtyBase: q, pscAmount: p.value.plus(p.gst), pscPartyId: dto.kind === 'SUPPLIER_CN' ? f.supplierId : null,
                    pscCnNo: dto.cnNo ?? null, pscCnDate: (0, purchase_doc_helpers_1.dateOf)(dto.cnDate), pscReason: dto.reason ?? null, pscCreatedBy: actor,
                }, select: { pscId: true } });
            let voucherRefno = null;
            if (p.value.plus(p.gst).greaterThan(0)) {
                const total = p.value.plus(p.gst);
                const legs = [];
                if (dto.kind === 'SUPPLIER_CN')
                    legs.push({ ledgerId: f.supplierId, drCr: 'DR', amount: (0, purchase_doc_helpers_1.num2)(total), remarks: `Shortage ${ref} — supplier CN${dto.cnNo ? ` ${dto.cnNo}` : ''}`, docRefno: ref });
                else
                    legs.push({ role: 'WRITE_OFF', drCr: 'DR', amount: (0, purchase_doc_helpers_1.num2)(total), roleTag: 'WRITE_OFF', remarks: `Shortage ${ref} written off` });
                legs.push({ role: 'SHORTAGE_RECEIVABLE', drCr: 'CR', amount: (0, purchase_doc_helpers_1.num2)(p.value), roleTag: 'SHORTAGE_RECEIVABLE', remarks: `Shortage ${ref}` });
                if (f.reason === 'SHORT_BILL')
                    legs.push({ role: 'INPUT_TAX_PENDING', drCr: 'CR', amount: (0, purchase_doc_helpers_1.num2)(p.gst), roleTag: 'INPUT_TAX_PENDING' });
                else
                    for (const hd of p.heads)
                        legs.push({ role: hd.role, drCr: 'CR', amount: (0, purchase_doc_helpers_1.num2)(hd.amt), taxId: hd.taxId, supplyNature: (f.inter ? 'INTER' : 'INTRA'), roleTag: hd.role });
                const vt = await (0, purchase_doc_helpers_1.voucherTypeId)(tx, 'PCL');
                const posted = await this.vouchers.postLegs(tx, {
                    header: { companyId: f.companyId, branchId: f.branchId, accYear, voucherTypeId: vt, voucherDate: docDate, srcModule: 'PURCHASE', srcDocType: CLOSE_DOC, srcDocId: c.pscId,
                        docLabel: 'Shortage close', docRefno: ref, docDate, usrRefno: dto.cnNo ?? null, docAmount: (0, purchase_doc_helpers_1.num2)(total), partyId: f.supplierId,
                        userId: actor, deviceId: dto.deviceId, remarks: dto.reason ?? `Shortage ${ref} ${dto.kind === 'SUPPLIER_CN' ? 'credited by the supplier' : 'written off'}`, createdBy: actor },
                    legs: legs.filter((g) => g.amount >= 0.005),
                });
                voucherRefno = posted.voucherRefno;
                await tx.purShortageClose.update({ where: { pscId_pscAccYear: { pscId: c.pscId, pscAccYear: accYear } }, data: { pscVoucherId: posted.voucherId } });
                if (dto.kind === 'SUPPLIER_CN') {
                    await (0, purchase_doc_helpers_1.raiseBillRow)(tx, { companyId: f.companyId, branchId: f.branchId, accYear, partyId: f.supplierId, billType: 'PURCHASE_RETURN', drCr: 'DR', amount: total,
                        docType: CLOSE_DOC, docId: c.pscId, voucherId: posted.voucherId, voucherTypeId: vt, voucherNo: posted.voucherSlno, voucherDate: docDate,
                        refno: posted.voucherRefno ?? ref, docDate: (0, purchase_doc_helpers_1.dateOf)(docDate), narration: `Shortage ${ref} — supplier CN${dto.cnNo ? ` ${dto.cnNo}` : ''}`, actor });
                }
            }
            return { closeId: c.pscId, accYear, qty: q, amount: p.value.plus(p.gst), openQty: f.open.minus(q), voucherRefno };
        }, { timeout: 60000, maxWait: 10000 });
        return (0, purchase_doc_helpers_1.jsonSafe)(out);
    }
    async closeUndo(dto) {
        const actor = this.actor();
        const out = await this.prisma.$transaction(async (tx) => {
            const c = await tx.purShortageClose.findFirst({ where: { pscId: dto.closeId, pscAccYear: dto.accYear, pscIsDeleted: false } });
            if (!c)
                (0, purchase_errors_1.purNotFound)(`Shortage close ${dto.closeId} not found`);
            if (c.pscReversalOfId)
                (0, purchase_errors_1.purConflict)('That row is itself an undo.', purchase_errors_1.PUR.NOT_POSTED, 'closeId');
            const [undone] = await tx.$queryRaw `SELECT count(*) AS n FROM purchase.pur_shortage_close WHERE psc_reversal_of_id = ${dto.closeId}::uuid AND NOT psc_is_deleted`;
            if (Number(undone.n) > 0)
                (0, purchase_errors_1.purConflict)('That close is already undone.', purchase_errors_1.PUR.NOT_POSTED, 'closeId');
            await (0, purchase_doc_helpers_1.assertBillsUnsettled)(tx, CLOSE_DOC, dto.closeId, 'The supplier credit');
            const rev = await tx.purShortageClose.create({ data: {
                    pscCompanyId: c.pscCompanyId, pscBranchId: c.pscBranchId, pscAccYear: c.pscAccYear, pscShortageId: c.pscShortageId, pscShortageAccYear: c.pscShortageAccYear,
                    pscKind: c.pscKind, pscQtyBase: c.pscQtyBase.negated(), pscAmount: c.pscAmount.negated(), pscPartyId: c.pscPartyId, pscCnNo: c.pscCnNo, pscCnDate: c.pscCnDate,
                    pscReason: dto.reason, pscReversalOfId: c.pscId, pscCreatedBy: actor,
                }, select: { pscId: true } });
            if (c.pscVoucherId)
                await this.vouchers.reverseLegs(tx, c.pscVoucherId, c.pscAccYear, `Shortage close undone: ${dto.reason}`, actor);
            await (0, purchase_doc_helpers_1.withdrawBillRows)(tx, CLOSE_DOC, c.pscId, actor);
            return { reversalId: rev.pscId, shortageId: c.pscShortageId };
        }, { timeout: 60000, maxWait: 10000 });
        return (0, purchase_doc_helpers_1.jsonSafe)(out);
    }
    async closes(shortageId) {
        return (0, purchase_doc_helpers_1.jsonSafe)(await this.prisma.$queryRaw `
      SELECT c.psc_id AS "closeId", c.psc_acc_year AS "accYear", c.psc_kind AS "kind", c.psc_qty_base AS "qty", c.psc_amount AS "amount",
             c.psc_cn_no AS "cnNo", c.psc_reason AS "reason", c.psc_created_on AS "createdOn"
        FROM purchase.pur_shortage_close c
       WHERE c.psc_shortage_id = ${shortageId}::uuid AND NOT c.psc_is_deleted AND c.psc_reversal_of_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM purchase.pur_shortage_close u WHERE u.psc_reversal_of_id = c.psc_id AND NOT u.psc_is_deleted)
       ORDER BY c.psc_created_on DESC`);
    }
};
exports.PurchaseShortageService = PurchaseShortageService;
exports.PurchaseShortageService = PurchaseShortageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, request_context_service_1.RequestContextService,
        voucher_posting_service_1.VoucherPostingService, stock_posting_service_1.StockPostingService])
], PurchaseShortageService);
let PurchaseShortageController = class PurchaseShortageController {
    service;
    prisma;
    ctx;
    constructor(service, prisma, ctx) {
        this.service = service;
        this.prisma = prisma;
        this.ctx = ctx;
    }
    async right(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, { userId: this.ctx.getUserId(), menuId: exports.SHORTAGE_MENU_ID, right, codePrefix: 'SHR', action });
    }
    async open(q) {
        await this.right('view', 'see shortages');
        return { success: true, message: 'Shortages fetched', data: await this.service.open(q) };
    }
    async save(dto) {
        await this.right(dto.header.psrId ? 'edit' : 'create', 'save a shortage receipt');
        if (dto.header.post)
            await this.right('post', 'post a shortage receipt');
        const data = await this.service.save(dto);
        return { success: true, message: `Shortage receipt ${data.header.psrRefno} ${dto.header.post ? 'posted' : 'saved as draft'}`, data };
    }
    async post(dto) {
        await this.right('post', 'post a shortage receipt');
        const data = await this.service.post(dto.psrId, dto.accYear);
        return { success: true, message: `Shortage receipt ${data.header.psrRefno} posted`, data };
    }
    async get(q) {
        await this.right('view', 'open a shortage receipt');
        return { success: true, message: 'Shortage receipt fetched', data: await this.service.get(q.psrId, q.accYear) };
    }
    async cancel(dto) {
        await this.right('cancel', 'cancel a shortage receipt');
        const data = await this.service.cancel(dto);
        return { success: true, message: `Shortage receipt ${data.header.psrRefno} cancelled`, data };
    }
    async close(dto) {
        await this.right('post', 'close a shortage');
        const data = await this.service.close(dto);
        return { success: true, message: `Shortage closed${data.voucherRefno ? ` — ${data.voucherRefno}` : ''}`, data };
    }
    async closeUndo(dto) {
        await this.right('cancel', 'undo a shortage close');
        return { success: true, message: 'Close undone', data: await this.service.closeUndo(dto) };
    }
    async closes(shortageId) {
        await this.right('view', 'see shortage closes');
        return { success: true, message: 'Closes fetched', data: await this.service.closes(shortageId) };
    }
};
exports.PurchaseShortageController = PurchaseShortageController;
__decorate([
    (0, common_1.Get)('open'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Shortages with qty still open (all=true: every shortage), with open value and GST.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [OpenShortagesQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseShortageController.prototype, "open", null);
__decorate([
    (0, common_1.Post)('receipt/save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Save a Shortage Receipt draft; header.post = true saves and posts (stock in at the shortage\'s cost, receivable / GRNI cleared, GST released).' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SaveShortageReceiptDto]),
    __metadata("design:returntype", Promise)
], PurchaseShortageController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('receipt/post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Post a saved Shortage Receipt draft.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ShortageReceiptRefDto]),
    __metadata("design:returntype", Promise)
], PurchaseShortageController.prototype, "post", null);
__decorate([
    (0, common_1.Get)('receipt/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'A Shortage Receipt with its lines.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ShortageReceiptRefDto]),
    __metadata("design:returntype", Promise)
], PurchaseShortageController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('receipt/cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a Shortage Receipt: stock out, voucher reversed, the shortage open again.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ShortageReceiptCancelDto]),
    __metadata("design:returntype", Promise)
], PurchaseShortageController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('close'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Close a shortage without goods: SUPPLIER_CN (bill-wise credit) or WRITE_OFF.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CloseShortageDto]),
    __metadata("design:returntype", Promise)
], PurchaseShortageController.prototype, "close", null);
__decorate([
    (0, common_1.Post)('close-undo'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Undo a shortage close: a reversing row, the voucher reversed.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CloseUndoDto]),
    __metadata("design:returntype", Promise)
], PurchaseShortageController.prototype, "closeUndo", null);
__decorate([
    (0, common_1.Get)('closes'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'The standing close rows of one shortage.' }),
    __param(0, (0, common_1.Query)('shortageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchaseShortageController.prototype, "closes", null);
exports.PurchaseShortageController = PurchaseShortageController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — Shortages'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase/shortages'),
    __metadata("design:paramtypes", [PurchaseShortageService, prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseShortageController);
//# sourceMappingURL=purchase-shortage.js.map