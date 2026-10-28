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
exports.PurchaseReturnController = exports.PurchaseReturnService = exports.SettleUndoDto = exports.SettleClaimDto = exports.OpenClaimsQueryDto = exports.SourcesQueryDto = exports.SourceLinesQueryDto = exports.ReturnCancelDto = exports.ReturnRefDto = exports.SaveReturnDto = exports.ReturnHeaderDto = exports.ReturnLineDto = exports.RETURN_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const api_version_1 = require("../../../common/constants/api-version");
const rights_1 = require("../../../common/posting/rights");
const voucher_posting_service_1 = require("../../../common/posting/voucher-posting.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const stock_posting_service_1 = require("../../stocks/posting/stock-posting.service");
const purchase_errors_1 = require("../common/purchase.errors");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
exports.RETURN_MENU_ID = 25;
const DOC = 'PURCHASE_RETURN';
const SETTLE_DOC = 'CLAIM_SETTLEMENT';
const OUTCOMES = ['RETURN', 'CLAIM_SENT', 'CLAIM_DESTROYED', 'REPLACE'];
class ReturnLineDto {
    lineNo;
    srcItemId;
    outcome;
    qty;
    freeQty;
    bucket;
    lotId;
    reasonId;
    claimAgainst;
    claimPartyId;
    remarks;
}
exports.ReturnLineDto = ReturnLineDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ReturnLineDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The source line: pur_invoice_item.pii_id or pur_grn_item.gri_id.' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReturnLineDto.prototype, "srcItemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: OUTCOMES }),
    (0, class_validator_1.IsIn)(OUTCOMES),
    __metadata("design:type", String)
], ReturnLineDto.prototype, "outcome", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'In the source line\'s unit.' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ReturnLineDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ReturnLineDto.prototype, "freeQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['SALEABLE', 'DAMAGED'], description: 'Which holding the goods leave from (default SALEABLE).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['SALEABLE', 'DAMAGED']),
    __metadata("design:type", String)
], ReturnLineDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The exact lot (default: the source line\'s lot in that bucket).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReturnLineDto.prototype, "lotId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReturnLineDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['SUPPLIER', 'TRANSPORTER', 'INSURER'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['SUPPLIER', 'TRANSPORTER', 'INSURER']),
    __metadata("design:type", String)
], ReturnLineDto.prototype, "claimAgainst", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The transporter / insurer ledger (a SUPPLIER claim is on the supplier).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReturnLineDto.prototype, "claimPartyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], ReturnLineDto.prototype, "remarks", void 0);
class ReturnHeaderDto {
    prId;
    companyId;
    branchId;
    accYear;
    deviceId;
    kind;
    srcDocId;
    srcAccYear;
    docDate;
    settlement;
    supplierCnNo;
    supplierCnDate;
    vehicleNo;
    driverName;
    ewbNo;
    remarks;
    post;
}
exports.ReturnHeaderDto = ReturnHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "prId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['AGAINST_INVOICE', 'AGAINST_GRN'] }),
    (0, class_validator_1.IsIn)(['AGAINST_INVOICE', 'AGAINST_GRN']),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "srcDocId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "srcAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['ADJUST', 'ADVANCE'], description: 'ADJUST (default): set off against the supplier\'s bills; ADVANCE: kept as an advance.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['ADJUST', 'ADVANCE']),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "settlement", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "supplierCnNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "supplierCnDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "vehicleNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "driverName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(15),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "ewbNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], ReturnHeaderDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ReturnHeaderDto.prototype, "post", void 0);
class SaveReturnDto {
    header;
    lines;
}
exports.SaveReturnDto = SaveReturnDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReturnHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ReturnHeaderDto),
    __metadata("design:type", ReturnHeaderDto)
], SaveReturnDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ReturnLineDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ReturnLineDto),
    __metadata("design:type", Array)
], SaveReturnDto.prototype, "lines", void 0);
class ReturnRefDto {
    prId;
    accYear;
}
exports.ReturnRefDto = ReturnRefDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReturnRefDto.prototype, "prId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], ReturnRefDto.prototype, "accYear", void 0);
class ReturnCancelDto extends ReturnRefDto {
    reason;
}
exports.ReturnCancelDto = ReturnCancelDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], ReturnCancelDto.prototype, "reason", void 0);
class SourceLinesQueryDto {
    kind;
    srcDocId;
    srcAccYear;
    exceptPrId;
}
exports.SourceLinesQueryDto = SourceLinesQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['AGAINST_INVOICE', 'AGAINST_GRN'] }),
    (0, class_validator_1.IsIn)(['AGAINST_INVOICE', 'AGAINST_GRN']),
    __metadata("design:type", String)
], SourceLinesQueryDto.prototype, "kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SourceLinesQueryDto.prototype, "srcDocId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], SourceLinesQueryDto.prototype, "srcAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The return being edited — its own rows do not count as already returned.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SourceLinesQueryDto.prototype, "exceptPrId", void 0);
class SourcesQueryDto {
    companyId;
    branchId;
    supplierId;
    kind;
}
exports.SourcesQueryDto = SourcesQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SourcesQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SourcesQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SourcesQueryDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['AGAINST_INVOICE', 'AGAINST_GRN'] }),
    (0, class_validator_1.IsIn)(['AGAINST_INVOICE', 'AGAINST_GRN']),
    __metadata("design:type", String)
], SourcesQueryDto.prototype, "kind", void 0);
class OpenClaimsQueryDto {
    companyId;
    branchId;
    supplierId;
}
exports.OpenClaimsQueryDto = OpenClaimsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], OpenClaimsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], OpenClaimsQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], OpenClaimsQueryDto.prototype, "supplierId", void 0);
class SettleClaimDto {
    returnItemId;
    accYear;
    settleAccYear;
    deviceId;
    action;
    amount;
    receivedAs;
    cnNo;
    cnDate;
    docDate;
    reason;
}
exports.SettleClaimDto = SettleClaimDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SettleClaimDto.prototype, "returnItemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The return row\'s year.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], SettleClaimDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The settlement\'s own year (default: the row\'s).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], SettleClaimDto.prototype, "settleAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SettleClaimDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['CREDIT', 'SHORT_SETTLED', 'REJECTED'] }),
    (0, class_validator_1.IsIn)(['CREDIT', 'SHORT_SETTLED', 'REJECTED']),
    __metadata("design:type", String)
], SettleClaimDto.prototype, "action", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'CREDIT: what the party allowed (default the whole open amount). SHORT_SETTLED / REJECTED: always the open amount.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SettleClaimDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['CN', 'ADJUST'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['CN', 'ADJUST']),
    __metadata("design:type", String)
], SettleClaimDto.prototype, "receivedAs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], SettleClaimDto.prototype, "cnNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SettleClaimDto.prototype, "cnDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SettleClaimDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], SettleClaimDto.prototype, "reason", void 0);
class SettleUndoDto {
    settlementId;
    accYear;
    reason;
}
exports.SettleUndoDto = SettleUndoDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SettleUndoDto.prototype, "settlementId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], SettleUndoDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], SettleUndoDto.prototype, "reason", void 0);
let PurchaseReturnService = class PurchaseReturnService {
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
    rules() { return (0, purchase_doc_helpers_1.stockRules)('OUT', DOC, 'Purchase Return', 'PURCHASE_RETURN', purchase_doc_helpers_1.TxnStatusDocType.PURCHASE_RETURN); }
    async sourceDoc(db, kind, id, accYear) {
        if (kind === 'AGAINST_INVOICE') {
            const pi = await db.purInvoice.findFirst({ where: { piId: id, piAccYear: accYear, piIsDeleted: false } });
            if (!pi)
                (0, purchase_errors_1.purNotFound)(`Purchase bill ${id} not found`);
            return { id, accYear, refno: pi.piRefno, supplierId: pi.piSupplierId, supplierInvNo: pi.piSupplierInvNo, status: pi.piStatus, docType: 'PURCHASE_BILL' };
        }
        const g = await db.purGrn.findFirst({ where: { grnId: id, grnAccYear: accYear, grnIsDeleted: false } });
        if (!g)
            (0, purchase_errors_1.purNotFound)(`GRN ${id} not found`);
        return { id, accYear, refno: g.grnRefno, supplierId: g.grnSupplierId, supplierInvNo: g.grnChallanNo, status: g.grnStatus, docType: 'GRN' };
    }
    async sourceLines(db, src) {
        const out = new Map();
        if (src.docType === 'PURCHASE_BILL') {
            const ls = await db.purInvoiceItem.findMany({ where: { piiPiId: src.id, piiAccYear: src.accYear, piiIsDeleted: false }, orderBy: { piiLineNo: 'asc' } });
            for (const l of ls)
                out.set(l.piiId, {
                    srcItemId: l.piiId, lineNo: l.piiLineNo, itemId: l.piiItemId, uomId: l.piiUomId, baseUomId: l.piiBaseUomId, factor: l.piiToBaseFactor, hsn: l.piiHsnCode,
                    inQty: l.piiReceivedQty.plus(l.piiDamagedQty).plus(l.piiFreeQty), basisQty: l.piiBilledQty,
                    taxable: l.piiTaxableAmt, cgst: l.piiCgstAmt, sgst: l.piiSgstAmt, igst: l.piiIgstAmt, cess: l.piiCessAmt,
                    taxId: l.piiTaxId, gstPct: l.piiGstPct, rate: l.piiRate,
                });
        }
        else {
            const ls = await db.purGrnItem.findMany({ where: { griGrnId: src.id, griAccYear: src.accYear, griIsDeleted: false }, orderBy: { griLineNo: 'asc' } });
            for (const l of ls)
                out.set(l.griId, {
                    srcItemId: l.griId, lineNo: l.griLineNo, itemId: l.griItemId, uomId: l.griUomId, baseUomId: l.griBaseUomId, factor: l.griToBaseFactor, hsn: l.griHsnCode,
                    inQty: l.griReceivedQty.plus(l.griDamagedQty).plus(l.griFreeQty), basisQty: l.griReceivedQty.plus(l.griDamagedQty),
                    taxable: l.griValue, cgst: purchase_doc_helpers_1.ZERO, sgst: purchase_doc_helpers_1.ZERO, igst: purchase_doc_helpers_1.ZERO, cess: purchase_doc_helpers_1.ZERO, taxId: null, gstPct: purchase_doc_helpers_1.ZERO, rate: l.griProvisionalRate,
                });
        }
        return out;
    }
    async returnedQty(db, srcId, exceptPrId) {
        const rows = await db.$queryRaw `
      SELECT pri.pri_src_item_id AS id, SUM(pri.pri_qty + pri.pri_free_qty) AS q
        FROM purchase.pur_return_item pri JOIN purchase.pur_return pr ON pr.pr_id = pri.pri_pr_id AND pr.pr_acc_year = pri.pri_acc_year
       WHERE pri.pri_src_doc_id = ${srcId}::uuid AND NOT pri.pri_is_deleted AND NOT pr.pr_is_deleted AND pr.pr_status <> 'CANCELLED'
         AND (${exceptPrId ?? null}::uuid IS NULL OR pr.pr_id <> ${exceptPrId ?? null}::uuid)
       GROUP BY 1`;
        return new Map(rows.map((r) => [r.id, (0, purchase_doc_helpers_1.D)(r.q)]));
    }
    async sourceLots(db, src) {
        return db.$queryRaw `
      SELECT line_id, lot_id, bucket, godown_id, batch_no, expiry, mrp, qty FROM (
        SELECT pia_line_id AS line_id, pia_lot_id AS lot_id, pia_bucket AS bucket, pia_godown_id AS godown_id, pia_batch_no AS batch_no,
               pia_expiry_date AS expiry, pia_mrp AS mrp, pia_qty + pia_free_qty AS qty, 0 AS line_no, pia_row_no AS row_no
          FROM purchase.pur_item_alloc
         WHERE pia_doc_type = ${src.docType} AND pia_doc_id = ${src.id}::uuid AND pia_acc_year = ${src.accYear}::bpchar
           AND NOT pia_is_deleted AND pia_lot_id IS NOT NULL
        UNION ALL
        SELECT pii.pii_id, a.pia_lot_id, a.pia_bucket, a.pia_godown_id, a.pia_batch_no, a.pia_expiry_date, a.pia_mrp, a.pia_qty + a.pia_free_qty,
               pii.pii_line_no, a.pia_row_no
          FROM purchase.pur_invoice_item pii
          JOIN purchase.pur_item_alloc a ON a.pia_doc_type = 'GRN' AND a.pia_line_id = pii.pii_src_item_id AND a.pia_acc_year = pii.pii_src_doc_year
         WHERE ${src.docType} = 'PURCHASE_BILL' AND pii.pii_pi_id = ${src.id}::uuid AND pii.pii_acc_year = ${src.accYear}::bpchar
           AND pii.pii_src_doc_type = 'GRN' AND NOT pii.pii_is_deleted AND NOT a.pia_is_deleted AND a.pia_lot_id IS NOT NULL
      ) x
       ORDER BY line_no, row_no`;
    }
    async billedGrnLines(db, grnId) {
        const rows = await db.$queryRaw `
      SELECT x.pii_src_item_id AS id, p.pi_refno AS refno FROM purchase.pur_invoice_item x
        JOIN purchase.pur_invoice p ON p.pi_id = x.pii_pi_id AND p.pi_acc_year = x.pii_acc_year
       WHERE x.pii_src_doc_type = 'GRN' AND x.pii_src_doc_id = ${grnId}::uuid AND NOT x.pii_is_deleted
         AND NOT p.pi_is_deleted AND p.pi_status <> 'CANCELLED'`;
        return new Map(rows.map((r) => [r.id, r.refno]));
    }
    money(s, qty) {
        const per = (v) => (s.basisQty.isZero() ? purchase_doc_helpers_1.ZERO : (0, purchase_doc_helpers_1.r2)(v.times(qty).dividedBy(s.basisQty)));
        const taxable = per(s.taxable), cgst = per(s.cgst), sgst = per(s.sgst), igst = per(s.igst), cess = per(s.cess);
        return { taxable, cgst, sgst, igst, cess, tax: cgst.plus(sgst).plus(igst).plus(cess), total: taxable.plus(cgst).plus(sgst).plus(igst).plus(cess) };
    }
    async sources(q) {
        if (q.kind === 'AGAINST_INVOICE') {
            return (0, purchase_doc_helpers_1.jsonSafe)(await this.prisma.$queryRaw `
        SELECT pi.pi_id AS "srcDocId", pi.pi_acc_year AS "srcAccYear", pi.pi_refno AS "refno", pi.pi_supplier_inv_no AS "supplierRef",
               pi.pi_doc_date AS "docDate", pi.pi_net_payable AS "amount"
          FROM purchase.pur_invoice pi
         WHERE pi.pi_company_id = ${q.companyId}::uuid AND pi.pi_branch_id = ${q.branchId}::uuid AND pi.pi_supplier_id = ${q.supplierId}::uuid
           AND pi.pi_status = 'POSTED' AND NOT pi.pi_is_deleted
         ORDER BY pi.pi_doc_date DESC, pi.pi_created_on DESC LIMIT 60`);
        }
        return (0, purchase_doc_helpers_1.jsonSafe)(await this.prisma.$queryRaw `
      SELECT g.grn_id AS "srcDocId", g.grn_acc_year AS "srcAccYear", g.grn_refno AS "refno", g.grn_challan_no AS "supplierRef",
             g.grn_doc_date AS "docDate", g.grn_provisional_value AS "amount"
        FROM purchase.pur_grn g
       WHERE g.grn_company_id = ${q.companyId}::uuid AND g.grn_branch_id = ${q.branchId}::uuid AND g.grn_supplier_id = ${q.supplierId}::uuid
         AND g.grn_status = 'POSTED' AND NOT g.grn_is_deleted
       ORDER BY g.grn_doc_date DESC, g.grn_created_on DESC LIMIT 60`);
    }
    async sourceLinesView(q) {
        const src = await this.sourceDoc(this.prisma, q.kind, q.srcDocId, q.srcAccYear);
        const [lines, returned, lots] = await Promise.all([
            this.sourceLines(this.prisma, src), this.returnedQty(this.prisma, src.id, q.exceptPrId), this.sourceLots(this.prisma, src),
        ]);
        const names = await (0, purchase_doc_helpers_1.unitNames)(this.prisma, [...lines.values()].map((l) => l.uomId));
        const [sup] = await this.prisma.$queryRaw `SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${src.supplierId}::uuid`;
        return (0, purchase_doc_helpers_1.jsonSafe)({
            source: { ...src, supplierName: sup?.sup_name ?? null },
            lines: [...lines.values()].map((l) => {
                const done = returned.get(l.srcItemId) ?? purchase_doc_helpers_1.ZERO;
                const one = this.money(l, (0, purchase_doc_helpers_1.D)(1));
                return {
                    srcItemId: l.srcItemId, lineNo: l.lineNo, itemId: l.itemId, uomId: l.uomId, ...names.get(l.uomId),
                    inQty: l.inQty, returnedQty: done, returnableQty: l.inQty.minus(done).isNegative() ? purchase_doc_helpers_1.ZERO : l.inQty.minus(done),
                    rate: l.rate, gstPct: l.gstPct, unitTaxable: l.basisQty.isZero() ? purchase_doc_helpers_1.ZERO : l.taxable.dividedBy(l.basisQty).toDecimalPlaces(4),
                    unitTotal: one.total,
                    lots: lots.filter((x) => x.line_id === l.srcItemId).map((x) => ({ lotId: x.lot_id, bucket: x.bucket, godownId: x.godown_id, batchNo: x.batch_no, expiryDate: x.expiry, mrp: x.mrp, qty: x.qty })),
                };
            }),
        });
    }
    async save(dto) {
        const actor = this.actor();
        const h = dto.header;
        const id = await this.prisma.$transaction(async (tx) => {
            const src = await this.sourceDoc(tx, h.kind, h.srcDocId, h.srcAccYear);
            if (src.status !== 'POSTED')
                (0, purchase_errors_1.purConflict)(`${src.refno} is ${src.status} — only a posted ${h.kind === 'AGAINST_GRN' ? 'GRN' : 'bill'} takes a return.`, purchase_errors_1.PUR.NOT_POSTED, 'header.srcDocId');
            const lines = await this.sourceLines(tx, src);
            const lots = await this.sourceLots(tx, src);
            const returned = await this.returnedQty(tx, src.id, h.prId);
            const billed = src.docType === 'GRN' ? await this.billedGrnLines(tx, src.id) : new Map();
            const problems = [];
            const want = new Map();
            const resolved = dto.lines.map((l, i) => {
                const s = lines.get(l.srcItemId);
                if (!s) {
                    problems.push({ field: `lines.${i}.srcItemId`, code: purchase_errors_1.PUR.NOT_FOUND, message: `Line ${l.lineNo}: that line is not on ${src.refno}` });
                    return null;
                }
                if (billed.has(l.srcItemId))
                    problems.push({ field: `lines.${i}.srcItemId`, code: purchase_errors_1.PUR.GRN_LINE_BILLED, message: `Line ${l.lineNo}: ${src.refno} line ${s.lineNo} is billed in ${billed.get(l.srcItemId)} — return it against that bill` });
                const q = (0, purchase_doc_helpers_1.D)(l.qty).plus((0, purchase_doc_helpers_1.D)(l.freeQty));
                if (!q.greaterThan(0))
                    problems.push({ field: `lines.${i}.qty`, code: purchase_errors_1.PUR.QTY_INVALID, message: `Line ${l.lineNo}: nothing to return` });
                want.set(l.srcItemId, (want.get(l.srcItemId) ?? purchase_doc_helpers_1.ZERO).plus(q));
                if (h.kind === 'AGAINST_GRN' && l.outcome !== 'RETURN')
                    problems.push({ field: `lines.${i}.outcome`, code: purchase_errors_1.PUR.QTY_INVALID, message: `Line ${l.lineNo}: goods not yet billed can only be RETURNED — claim after the bill` });
                const claim = l.outcome === 'CLAIM_SENT' || l.outcome === 'CLAIM_DESTROYED';
                const against = claim ? (l.claimAgainst ?? 'SUPPLIER') : null;
                if (claim && against !== 'SUPPLIER' && !l.claimPartyId)
                    problems.push({ field: `lines.${i}.claimPartyId`, code: purchase_errors_1.PUR.NOT_FOUND, message: `Line ${l.lineNo}: name the ${against?.toLowerCase()} the claim is on` });
                const bucket = l.bucket ?? 'SALEABLE';
                const mine = lots.filter((x) => x.line_id === l.srcItemId && x.bucket === bucket);
                const lot = l.lotId ? mine.find((x) => x.lot_id === l.lotId) : mine[0];
                if (!lot)
                    problems.push({ field: `lines.${i}.lotId`, code: purchase_errors_1.PUR.NOT_FOUND, message: `Line ${l.lineNo}: ${src.refno} line ${s.lineNo} brought nothing into ${bucket.toLowerCase()} to return from` });
                return { l, s, bucket, lot, against, claimParty: claim ? (against === 'SUPPLIER' ? src.supplierId : l.claimPartyId) : null };
            });
            for (const [srcItemId, q] of want) {
                const s = lines.get(srcItemId);
                if (!s)
                    continue;
                const left = s.inQty.minus(returned.get(srcItemId) ?? purchase_doc_helpers_1.ZERO);
                if (q.greaterThan(left))
                    problems.push({ field: 'lines', code: 'PUR_RETURN_QTY_EXCEEDS', message: `${src.refno} line ${s.lineNo}: ${q} to return, only ${left.isNegative() ? 0 : left} left of what came in` });
            }
            if (problems.length)
                (0, purchase_errors_1.purRefuseMany)(problems[0].message, problems);
            let prId = h.prId ?? null;
            let slno, refno, isNew = false;
            if (prId) {
                const cur = await tx.purReturn.findFirst({ where: { prId, prAccYear: h.accYear, prIsDeleted: false } });
                if (!cur)
                    (0, purchase_errors_1.purNotFound)(`Return ${prId} not found`);
                if (cur.prStatus !== 'DRAFT')
                    (0, purchase_errors_1.purConflict)(`${cur.prRefno} is ${cur.prStatus} — only a draft can be edited.`, purchase_errors_1.PUR.NOT_DRAFT, 'prId');
                slno = cur.prSlno;
                refno = cur.prRefno;
                await tx.purItemAlloc.deleteMany({ where: { piaDocType: DOC, piaDocId: prId, piaAccYear: h.accYear } });
                await tx.purReturnItem.deleteMany({ where: { priPrId: prId, priAccYear: h.accYear } });
            }
            else {
                ({ slno, refno } = await (0, purchase_doc_helpers_1.allocateDocNumber)(tx, 'PRN', h.companyId, h.branchId, h.accYear, h.deviceId));
                isNew = true;
            }
            let returnValue = purchase_doc_helpers_1.ZERO, claimValue = purchase_doc_helpers_1.ZERO, itcReversed = purchase_doc_helpers_1.ZERO, replaceBase = purchase_doc_helpers_1.ZERO;
            const rows = resolved.map((r) => {
                const m = this.money(r.s, (0, purchase_doc_helpers_1.D)(r.l.qty));
                const o = r.l.outcome;
                if (o === 'RETURN')
                    returnValue = returnValue.plus(m.total);
                if (o === 'CLAIM_SENT')
                    claimValue = claimValue.plus(m.total);
                if (o === 'CLAIM_DESTROYED') {
                    claimValue = claimValue.plus(m.taxable);
                    itcReversed = itcReversed.plus(m.tax);
                }
                if (o === 'REPLACE')
                    replaceBase = replaceBase.plus((0, purchase_doc_helpers_1.D)(r.l.qty).plus((0, purchase_doc_helpers_1.D)(r.l.freeQty)).times(r.s.factor));
                return { ...r, m };
            });
            const data = {
                prCompanyId: h.companyId, prBranchId: h.branchId, prAccYear: h.accYear, prDeviceId: h.deviceId, prSlno: slno, prRefno: refno,
                prDocDate: (0, purchase_doc_helpers_1.dateOf)(h.docDate), prKind: h.kind, prSrcDocId: src.id, prSrcAccYear: src.accYear, prSupplierId: src.supplierId,
                prGodownId: rows[0]?.lot?.godown_id ?? null, prSettlement: h.settlement ?? 'ADJUST',
                prSupplierCnNo: h.supplierCnNo ?? null, prSupplierCnDate: (0, purchase_doc_helpers_1.dateOf)(h.supplierCnDate), prEwbNo: h.ewbNo ?? null,
                prVehicleNo: h.vehicleNo ?? null, prDriverName: h.driverName ?? null, prOurRef: src.refno,
                prReturnValue: returnValue, prClaimValue: claimValue, prItcReversed: itcReversed, prReplaceQtyBase: replaceBase,
                prRemarks: h.remarks ?? null, prStatus: 'DRAFT',
            };
            if (isNew)
                prId = (await tx.purReturn.create({ data: { ...data, prCreatedBy: actor }, select: { prId: true } })).prId;
            else
                await tx.purReturn.update({ where: { prId_prAccYear: { prId: prId, prAccYear: h.accYear } }, data: { ...data, prModifiedBy: actor, prModifiedOn: new Date(), prRevisionNo: { increment: 1 } } });
            for (const r of rows) {
                const { l, s, m } = r;
                const row = await tx.purReturnItem.create({ data: {
                        priPrId: prId, priCompanyId: h.companyId, priBranchId: h.branchId, priAccYear: h.accYear, priLineNo: l.lineNo,
                        priItemId: s.itemId, priUomId: s.uomId, priBaseUomId: s.baseUomId, priToBaseFactor: s.factor, priHsnCode: s.hsn,
                        priSrcDocType: src.docType, priSrcDocId: src.id, priSrcDocYear: src.accYear, priSrcItemId: s.srcItemId, priSrcDocLineNo: s.lineNo, priSrcDocRefno: src.refno,
                        priOutcome: l.outcome, priReasonId: l.reasonId ?? null, priQty: (0, purchase_doc_helpers_1.D)(l.qty), priFreeQty: (0, purchase_doc_helpers_1.D)(l.freeQty), priRate: s.rate,
                        priGrossAmt: m.taxable, priTaxableAmt: m.taxable, priTaxId: s.taxId, priGstPct: s.gstPct,
                        priCgstAmt: m.cgst, priSgstAmt: m.sgst, priIgstAmt: m.igst, priCessAmt: m.cess, priTotalAmt: m.total,
                        priItcReversedInBooks: l.outcome !== 'REPLACE' && h.kind === 'AGAINST_INVOICE',
                        priSupplierCnStatus: l.outcome === 'RETURN' && h.kind === 'AGAINST_INVOICE' ? 'PENDING' : 'NONE',
                        priClaimAgainst: r.against, priClaimPartyId: r.claimParty, priRemarks: l.remarks ?? null, priCreatedBy: actor,
                    }, select: { priId: true } });
                await tx.purItemAlloc.create({ data: {
                        piaCompanyId: h.companyId, piaBranchId: h.branchId, piaAccYear: h.accYear, piaDocType: DOC, piaDocId: prId, piaLineId: row.priId, piaRowNo: 1,
                        piaGodownId: r.lot.godown_id, piaBucket: r.lot.bucket, piaLotId: r.lot.lot_id, piaBatchNo: r.lot.batch_no, piaExpiryDate: r.lot.expiry, piaMrp: r.lot.mrp,
                        piaQty: (0, purchase_doc_helpers_1.D)(l.qty), piaFreeQty: (0, purchase_doc_helpers_1.D)(l.freeQty), piaCreatedBy: actor,
                    } });
            }
            if (isNew)
                await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.PURCHASE_RETURN, docId: prId, refno, event: purchase_doc_helpers_1.TxnStatusEvent.CREATED, from: null, to: 'DRAFT', actor, deviceId: h.deviceId });
            if (h.post)
                await this.postInTx(tx, prId, h.accYear, actor);
            return prId;
        }, { timeout: 60000, maxWait: 10000 });
        return this.get(id, h.accYear);
    }
    async post(prId, accYear) {
        const actor = this.actor();
        await this.prisma.$transaction((tx) => this.postInTx(tx, prId, accYear, actor), { timeout: 60000, maxWait: 10000 });
        return this.get(prId, accYear);
    }
    async postInTx(tx, prId, accYear, actor) {
        const pr = await tx.purReturn.findFirst({ where: { prId, prAccYear: accYear, prIsDeleted: false } });
        if (!pr)
            (0, purchase_errors_1.purNotFound)(`Return ${prId} not found`);
        if (pr.prStatus !== 'DRAFT')
            (0, purchase_errors_1.purConflict)(`${pr.prRefno} is ${pr.prStatus} — only a draft can be posted.`, purchase_errors_1.PUR.NOT_DRAFT, 'prId');
        const lines = await tx.purReturnItem.findMany({ where: { priPrId: prId, priAccYear: accYear, priIsDeleted: false }, orderBy: { priLineNo: 'asc' } });
        const allocs = await tx.purItemAlloc.findMany({ where: { piaDocType: DOC, piaDocId: prId, piaAccYear: accYear, piaIsDeleted: false } });
        const allocOf = new Map(allocs.map((a) => [a.piaLineId, a]));
        const postedOn = new Date();
        const docDate = (0, purchase_doc_helpers_1.isoDate)(pr.prDocDate);
        const { perRow } = await (0, purchase_doc_helpers_1.postShadowStock)(tx, this.stockPosting, { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, deviceId: pr.prDeviceId, sessionId: pr.prSessionId, docType: DOC, docId: prId,
            refno: pr.prRefno, revision: pr.prRevisionNo, usrRefno: pr.prSupplierCnNo, docDate, supplierId: pr.prSupplierId, remarks: `Return ${pr.prRefno} (${pr.prOurRef})` }, this.rules(), lines.map((l) => {
            const a = allocOf.get(l.priId);
            return { itemId: l.priItemId, uomId: l.priUomId, baseUomId: l.priBaseUomId, factor: l.priToBaseFactor, godownId: a.piaGodownId, bucket: a.piaBucket,
                lotId: a.piaLotId, batchNo: a.piaBatchNo, expiryDate: a.piaExpiryDate, mrp: a.piaMrp, supplierId: pr.prSupplierId,
                qty: l.priQty, freeQty: l.priFreeQty, costRate: purchase_doc_helpers_1.ZERO };
        }), actor, postedOn);
        for (let i = 0; i < lines.length; i++) {
            const a = allocOf.get(lines[i].priId);
            await tx.purReturnItem.update({ where: { priId_priAccYear: { priId: lines[i].priId, priAccYear: accYear } }, data: { priLotCostValue: perRow[i].cost } });
            if (perRow[i].sviId)
                await tx.purItemAlloc.update({ where: { piaId_piaAccYear: { piaId: a.piaId, piaAccYear: accYear } }, data: { piaSviId: perRow[i].sviId, piaSviAccYear: accYear } });
        }
        const vt = await (0, purchase_doc_helpers_1.voucherTypeId)(tx, 'PRN');
        const nature = lines.some((l) => l.priIgstAmt.greaterThan(0)) ? 'INTER' : 'INTRA';
        const legs = [];
        const add = (leg) => { if (leg.amount >= 0.005)
            legs.push(leg); };
        const claimByParty = new Map();
        let supplierDr = purchase_doc_helpers_1.ZERO, grniDr = purchase_doc_helpers_1.ZERO, replaceDr = purchase_doc_helpers_1.ZERO, itcRev = purchase_doc_helpers_1.ZERO, stockCr = purchase_doc_helpers_1.ZERO;
        const inputCr = new Map();
        const creditInput = (l) => {
            for (const [role, v] of [['INPUT_CGST', l.priCgstAmt], ['INPUT_SGST', l.priSgstAmt], ['INPUT_IGST', l.priIgstAmt], ['INPUT_CESS', l.priCessAmt]]) {
                if (v.isZero())
                    continue;
                const k = `${role}|${l.priTaxId ?? ''}`;
                const cur = inputCr.get(k) ?? { role, taxId: l.priTaxId, amt: purchase_doc_helpers_1.ZERO };
                cur.amt = cur.amt.plus(v);
                inputCr.set(k, cur);
            }
        };
        lines.forEach((l, i) => {
            stockCr = stockCr.plus(perRow[i].cost);
            const tax = l.priCgstAmt.plus(l.priSgstAmt).plus(l.priIgstAmt).plus(l.priCessAmt);
            if (pr.prKind === 'AGAINST_GRN') {
                grniDr = grniDr.plus(l.priTaxableAmt);
                return;
            }
            switch (l.priOutcome) {
                case 'RETURN':
                    supplierDr = supplierDr.plus(l.priTotalAmt);
                    creditInput(l);
                    break;
                case 'CLAIM_SENT':
                    claimByParty.set(l.priClaimPartyId, (claimByParty.get(l.priClaimPartyId) ?? purchase_doc_helpers_1.ZERO).plus(l.priTotalAmt));
                    creditInput(l);
                    break;
                case 'CLAIM_DESTROYED':
                    claimByParty.set(l.priClaimPartyId, (claimByParty.get(l.priClaimPartyId) ?? purchase_doc_helpers_1.ZERO).plus(l.priTaxableAmt));
                    itcRev = itcRev.plus(tax);
                    creditInput(l);
                    break;
                case 'REPLACE':
                    replaceDr = replaceDr.plus(l.priTaxableAmt);
                    break;
            }
        });
        add({ ledgerId: pr.prSupplierId, drCr: 'DR', amount: (0, purchase_doc_helpers_1.num2)(supplierDr), remarks: `Return ${pr.prRefno} against ${pr.prOurRef}`, docRefno: pr.prRefno });
        add({ role: 'GRNI', drCr: 'DR', amount: (0, purchase_doc_helpers_1.num2)(grniDr), roleTag: 'GRNI', remarks: `Return ${pr.prRefno} against ${pr.prOurRef}` });
        for (const [, amt] of claimByParty)
            add({ role: 'CLAIM_RECEIVABLE', drCr: 'DR', amount: (0, purchase_doc_helpers_1.num2)(amt), roleTag: 'CLAIM_RECEIVABLE', remarks: `Claim · ${pr.prRefno}` });
        add({ role: 'SHORTAGE_RECEIVABLE', drCr: 'DR', amount: (0, purchase_doc_helpers_1.num2)(replaceDr), roleTag: 'SHORTAGE_RECEIVABLE', remarks: `Replacement due · ${pr.prRefno}` });
        add({ role: 'ITC_REVERSAL', drCr: 'DR', amount: (0, purchase_doc_helpers_1.num2)(itcRev), roleTag: 'ITC_REVERSAL', remarks: `GST on destroyed goods · ${pr.prRefno}` });
        for (const v of inputCr.values())
            add({ role: v.role, drCr: 'CR', amount: (0, purchase_doc_helpers_1.num2)(v.amt), taxId: v.taxId, supplyNature: nature, roleTag: v.role });
        add({ role: 'INVENTORY', drCr: 'CR', amount: (0, purchase_doc_helpers_1.num2)(stockCr), roleTag: 'INVENTORY', remarks: `Return ${pr.prRefno}` });
        const cents = (x) => Math.round(x * 100);
        const dr = legs.filter((g) => g.drCr === 'DR').reduce((s, g) => s + cents(g.amount), 0);
        const cr = legs.filter((g) => g.drCr === 'CR').reduce((s, g) => s + cents(g.amount), 0);
        if (dr !== cr)
            add({ role: 'PURCHASE_PRICE_VARIANCE', drCr: dr > cr ? 'CR' : 'DR', amount: Math.abs(dr - cr) / 100, roleTag: 'PURCHASE_PRICE_VARIANCE', remarks: `Bill value vs lot cost · ${pr.prRefno}` });
        const docAmount = supplierDr.plus(grniDr).plus([...claimByParty.values()].reduce((s, v) => s.plus(v), purchase_doc_helpers_1.ZERO)).plus(replaceDr);
        const posted = await this.vouchers.postLegs(tx, {
            header: { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, voucherTypeId: vt, voucherDate: docDate, srcModule: 'PURCHASE', srcDocType: DOC, srcDocId: prId,
                docLabel: 'Purchase Return', docRefno: pr.prRefno, docDate, usrRefno: pr.prSupplierCnNo, docAmount: (0, purchase_doc_helpers_1.num2)(docAmount), partyId: pr.prSupplierId,
                userId: actor, sessionId: pr.prSessionId, deviceId: pr.prDeviceId, remarks: pr.prRemarks ?? `Return against ${pr.prOurRef}`, createdBy: actor,
                presetRefno: pr.prRefno, presetNo: pr.prSlno },
            legs,
        });
        await (0, purchase_doc_helpers_1.raiseBillRow)(tx, { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, partyId: pr.prSupplierId, billType: 'PURCHASE_RETURN', drCr: 'DR',
            amount: supplierDr, docType: DOC, docId: prId, voucherId: posted.voucherId, voucherTypeId: vt, voucherNo: pr.prSlno, voucherDate: docDate,
            refno: pr.prRefno, docDate: pr.prDocDate, narration: `Return ${pr.prRefno} against ${pr.prOurRef}${pr.prSettlement === 'ADVANCE' ? ' (advance)' : ''}`, actor });
        for (const l of lines.filter((x) => x.priOutcome === 'REPLACE')) {
            const base = l.priQty.plus(l.priFreeQty).times(l.priToBaseFactor);
            await tx.purShortage.create({ data: {
                    pshCompanyId: pr.prCompanyId, pshBranchId: pr.prBranchId, pshAccYear: accYear, pshSupplierId: pr.prSupplierId, pshItemId: l.priItemId,
                    pshSrcDocType: DOC, pshSrcDocId: prId, pshSrcDocYear: accYear, pshSrcItemId: l.priId, pshSrcDocRefno: pr.prRefno,
                    pshReason: 'REPLACE', pshQtyBase: base, pshValue: l.priTaxableAmt, pshGstPending: purchase_doc_helpers_1.ZERO,
                    pshOriginCostRate: base.isZero() ? purchase_doc_helpers_1.ZERO : l.priTaxableAmt.dividedBy(base).toDecimalPlaces(6), pshCreatedBy: actor,
                } });
        }
        await tx.purReturn.update({ where: { prId_prAccYear: { prId, prAccYear: accYear } }, data: { prStatus: 'POSTED', prPostedVoucherId: posted.voucherId, prModifiedBy: actor, prModifiedOn: postedOn } });
        await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.PURCHASE_RETURN, docId: prId, refno: pr.prRefno, event: purchase_doc_helpers_1.TxnStatusEvent.POSTED, from: 'DRAFT', to: 'POSTED', actor, deviceId: pr.prDeviceId });
    }
    async get(prId, accYear) {
        const header = await this.prisma.purReturn.findFirst({ where: { prId, prAccYear: accYear, prIsDeleted: false } });
        if (!header)
            (0, purchase_errors_1.purNotFound)(`Return ${prId} not found`);
        const [lines, allocs, sup] = await Promise.all([
            this.prisma.purReturnItem.findMany({ where: { priPrId: prId, priAccYear: accYear, priIsDeleted: false }, orderBy: { priLineNo: 'asc' } }),
            this.prisma.purItemAlloc.findMany({ where: { piaDocType: DOC, piaDocId: prId, piaAccYear: accYear, piaIsDeleted: false } }),
            this.prisma.$queryRaw `SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${header.prSupplierId}::uuid`,
        ]);
        const names = await (0, purchase_doc_helpers_1.unitNames)(this.prisma, lines.map((l) => l.priUomId));
        const settled = await this.settledByItem(this.prisma, lines.map((l) => l.priId));
        return (0, purchase_doc_helpers_1.jsonSafe)({
            header: { ...header, supplierName: sup[0]?.sup_name ?? null },
            lines: lines.map((l) => {
                const a = allocs.find((x) => x.piaLineId === l.priId);
                const claimValue = this.claimValueOf(l);
                const done = settled.get(l.priId) ?? purchase_doc_helpers_1.ZERO;
                return { ...l, ...names.get(l.priUomId), bucket: a?.piaBucket ?? null, lotId: a?.piaLotId ?? null, batchNo: a?.piaBatchNo ?? null, expiryDate: a?.piaExpiryDate ?? null,
                    claimValue, claimSettled: done, claimOpen: claimValue.minus(done) };
            }),
        });
    }
    async cancel(dto) {
        const actor = this.actor();
        await this.prisma.$transaction(async (tx) => {
            const pr = await tx.purReturn.findFirst({ where: { prId: dto.prId, prAccYear: dto.accYear, prIsDeleted: false } });
            if (!pr)
                (0, purchase_errors_1.purNotFound)(`Return ${dto.prId} not found`);
            if (pr.prStatus === 'CANCELLED')
                (0, purchase_errors_1.purConflict)(`${pr.prRefno} is already cancelled.`, purchase_errors_1.PUR.NOT_POSTED, 'prId');
            const [own] = await tx.$queryRaw `
        SELECT count(*) AS n FROM purchase.pur_return_item ri
         WHERE ri.pri_pr_id = ${dto.prId}::uuid AND ri.pri_acc_year = ${dto.accYear}::bpchar AND NOT ri.pri_is_deleted
           AND NOT EXISTS (SELECT 1 FROM purchase.pur_item_alloc a WHERE a.pia_doc_type = ${DOC} AND a.pia_line_id = ri.pri_id AND a.pia_acc_year = ri.pri_acc_year AND NOT a.pia_is_deleted)`;
            if (Number(own.n) > 0)
                (0, purchase_errors_1.purConflict)(`${pr.prRefno} is the debit note of bill ${pr.prOurRef ?? ''} for goods rejected at the GRN — it is cancelled with that bill.`, purchase_errors_1.PUR.EDIT_LOCKED_PAID, 'prId');
            if (pr.prKind === 'AGAINST_GRN' && pr.prStatus === 'POSTED') {
                const billed = await this.billedGrnLines(tx, pr.prSrcDocId);
                const [hit] = await tx.$queryRaw `
          SELECT pri_src_item_id AS id FROM purchase.pur_return_item WHERE pri_pr_id = ${dto.prId}::uuid AND pri_acc_year = ${dto.accYear}::bpchar
             AND NOT pri_is_deleted AND pri_src_item_id = ANY(${[...billed.keys()]}::uuid[]) LIMIT 1`;
                if (hit)
                    (0, purchase_errors_1.purConflict)(`${pr.prRefno}: its GRN line is billed in ${billed.get(hit.id)} — cancel that bill first.`, purchase_errors_1.PUR.GRN_LINE_BILLED, 'prId');
            }
            if (pr.prStatus === 'POSTED') {
                await (0, purchase_doc_helpers_1.assertBillsUnsettled)(tx, DOC, dto.prId, pr.prRefno);
                await (0, purchase_doc_helpers_1.assertShortagesUntouched)(tx, dto.prId, pr.prRefno);
                const items = await tx.purReturnItem.findMany({ where: { priPrId: dto.prId, priAccYear: dto.accYear, priIsDeleted: false }, select: { priId: true } });
                const settled = await this.settledByItem(tx, items.map((i) => i.priId));
                if ([...settled.values()].some((v) => !v.isZero()))
                    (0, purchase_errors_1.purConflict)(`${pr.prRefno}: a claim on it is already settled — undo the settlement first.`, purchase_errors_1.PUR.EDIT_LOCKED_PAID, 'prId');
                await (0, purchase_doc_helpers_1.cancelShadowStock)(tx, this.stockPosting, DOC, dto.prId, dto.accYear, pr.prCompanyId, pr.prBranchId, this.rules(), actor, dto.reason);
                if (pr.prPostedVoucherId)
                    await this.vouchers.reverseLegs(tx, pr.prPostedVoucherId, dto.accYear, `Return ${pr.prRefno} cancelled: ${dto.reason}`, actor);
                await (0, purchase_doc_helpers_1.withdrawBillRows)(tx, DOC, dto.prId, actor);
                await tx.purShortage.updateMany({ where: { pshSrcDocType: DOC, pshSrcDocId: dto.prId, pshIsDeleted: false }, data: { pshIsDeleted: true, pshModifiedBy: actor, pshModifiedOn: new Date() } });
            }
            await tx.purReturn.update({ where: { prId_prAccYear: { prId: dto.prId, prAccYear: dto.accYear } }, data: { prStatus: 'CANCELLED', prModifiedBy: actor, prModifiedOn: new Date() } });
            await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear: dto.accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.PURCHASE_RETURN, docId: dto.prId, refno: pr.prRefno, event: purchase_doc_helpers_1.TxnStatusEvent.CANCELLED, from: pr.prStatus, to: 'CANCELLED', actor, remarks: dto.reason });
        }, { timeout: 60000, maxWait: 10000 });
        return this.get(dto.prId, dto.accYear);
    }
    claimValueOf(l) {
        return l.priOutcome === 'CLAIM_SENT' ? l.priTotalAmt : l.priOutcome === 'CLAIM_DESTROYED' ? l.priTaxableAmt : purchase_doc_helpers_1.ZERO;
    }
    async settledByItem(db, priIds) {
        if (!priIds.length)
            return new Map();
        const rows = await db.$queryRaw `
      SELECT pcs_return_item_id AS id, SUM(pcs_amount) AS s FROM purchase.pur_claim_settlement
       WHERE pcs_return_item_id = ANY(${priIds}::uuid[]) AND NOT pcs_is_deleted GROUP BY 1`;
        return new Map(rows.map((r) => [r.id, (0, purchase_doc_helpers_1.D)(r.s)]));
    }
    async openClaims(q) {
        const rows = await this.prisma.$queryRaw `
      SELECT pri.pri_id AS "returnItemId", pri.pri_acc_year AS "accYear", pr.pr_id AS "prId", pr.pr_refno AS "refno", pr.pr_doc_date AS "docDate",
             pri.pri_line_no AS "lineNo", im.item_name_en AS "itemName", pri.pri_outcome AS "outcome", pri.pri_claim_against AS "claimAgainst",
             pri.pri_claim_party_id AS "claimPartyId", lm.led_name AS "partyName", pr.pr_supplier_id AS "supplierId",
             CASE pri.pri_outcome WHEN 'CLAIM_SENT' THEN pri.pri_total_amt ELSE pri.pri_taxable_amt END AS "claimValue",
             COALESCE((SELECT SUM(pcs_amount) FROM purchase.pur_claim_settlement s WHERE s.pcs_return_item_id = pri.pri_id AND NOT s.pcs_is_deleted), 0) AS "settled",
             (SELECT s.pcs_id FROM purchase.pur_claim_settlement s WHERE s.pcs_return_item_id = pri.pri_id AND NOT s.pcs_is_deleted AND s.pcs_reversal_of_id IS NULL
                 AND NOT EXISTS (SELECT 1 FROM purchase.pur_claim_settlement u WHERE u.pcs_reversal_of_id = s.pcs_id AND NOT u.pcs_is_deleted)
               ORDER BY s.pcs_created_on DESC LIMIT 1) AS "lastSettlementId"
        FROM purchase.pur_return_item pri
        JOIN purchase.pur_return pr ON pr.pr_id = pri.pri_pr_id AND pr.pr_acc_year = pri.pri_acc_year
        JOIN inventory.item_master im ON im.item_id = pri.pri_item_id
        LEFT JOIN accounts.acc_ledger_master lm ON lm.led_id = pri.pri_claim_party_id
       WHERE pr.pr_company_id = ${q.companyId}::uuid AND pr.pr_branch_id = ${q.branchId}::uuid AND pr.pr_status = 'POSTED' AND NOT pr.pr_is_deleted
         AND NOT pri.pri_is_deleted AND pri.pri_outcome IN ('CLAIM_SENT', 'CLAIM_DESTROYED')
         AND (${q.supplierId ?? null}::uuid IS NULL OR pr.pr_supplier_id = ${q.supplierId ?? null}::uuid)
       ORDER BY pr.pr_doc_date, pr.pr_refno, pri.pri_line_no`;
        return (0, purchase_doc_helpers_1.jsonSafe)(rows.map((r) => ({ ...r, open: (0, purchase_doc_helpers_1.D)(r.claimValue).minus((0, purchase_doc_helpers_1.D)(r.settled)) })));
    }
    async settle(dto) {
        const actor = this.actor();
        const out = await this.prisma.$transaction(async (tx) => {
            const l = await tx.purReturnItem.findFirst({ where: { priId: dto.returnItemId, priAccYear: dto.accYear, priIsDeleted: false } });
            if (!l)
                (0, purchase_errors_1.purNotFound)(`Return row ${dto.returnItemId} not found`);
            const pr = await tx.purReturn.findFirst({ where: { prId: l.priPrId, prAccYear: dto.accYear, prIsDeleted: false } });
            if (!pr || pr.prStatus !== 'POSTED')
                (0, purchase_errors_1.purConflict)('Only a claim on a posted return is settled.', purchase_errors_1.PUR.NOT_POSTED, 'returnItemId');
            if (l.priOutcome !== 'CLAIM_SENT' && l.priOutcome !== 'CLAIM_DESTROYED')
                (0, purchase_errors_1.purConflict)(`Line ${l.priLineNo} of ${pr.prRefno} is a ${l.priOutcome}, not a claim.`, purchase_errors_1.PUR.QTY_INVALID, 'returnItemId');
            await tx.$queryRaw `SELECT count(pg_advisory_xact_lock(hashtext('purchase_claim'), hashtext(${dto.returnItemId})))::int AS locked`;
            const value = this.claimValueOf(l);
            const open = value.minus((await this.settledByItem(tx, [l.priId])).get(l.priId) ?? purchase_doc_helpers_1.ZERO);
            if (!open.greaterThan(0))
                (0, purchase_errors_1.purConflict)(`The claim on ${pr.prRefno} line ${l.priLineNo} is fully settled.`, purchase_errors_1.PUR.EDIT_LOCKED_PAID, 'returnItemId');
            const amount = dto.action === 'CREDIT' ? (0, purchase_doc_helpers_1.r2)((0, purchase_doc_helpers_1.D)(dto.amount ?? open)) : open;
            if (!amount.greaterThan(0) || amount.greaterThan(open))
                (0, purchase_errors_1.purRefuse)(`Amount must be more than 0 and at most the open ${open.toFixed(2)}.`, purchase_errors_1.PUR.QTY_INVALID, 'amount');
            const accYear = dto.settleAccYear ?? dto.accYear;
            const docDate = dto.docDate ?? (0, purchase_doc_helpers_1.isoDate)(new Date());
            const party = l.priClaimPartyId;
            const tax = l.priCgstAmt.plus(l.priSgstAmt).plus(l.priIgstAmt).plus(l.priCessAmt);
            const reavail = dto.action === 'REJECTED' && l.priOutcome === 'CLAIM_SENT' && !l.priTotalAmt.isZero() ? (0, purchase_doc_helpers_1.r2)(tax.times(amount).dividedBy(l.priTotalAmt)) : purchase_doc_helpers_1.ZERO;
            const [{ n: seq }] = await tx.$queryRaw `SELECT count(*) + 1 AS n FROM purchase.pur_claim_settlement WHERE pcs_return_item_id = ${l.priId}::uuid`;
            const ref = `${pr.prRefno}/L${l.priLineNo}/S${seq}`;
            const s = await tx.purClaimSettlement.create({ data: {
                    pcsCompanyId: pr.prCompanyId, pcsBranchId: pr.prBranchId, pcsAccYear: accYear, pcsDeviceId: dto.deviceId,
                    pcsReturnItemId: l.priId, pcsReturnItemAccYear: dto.accYear, pcsAction: dto.action, pcsReceivedAs: dto.action === 'CREDIT' ? (dto.receivedAs ?? 'CN') : null,
                    pcsAmount: amount, pcsGstReavailed: reavail, pcsCnNo: dto.cnNo ?? null, pcsCnDate: (0, purchase_doc_helpers_1.dateOf)(dto.cnDate), pcsReason: dto.reason ?? null,
                    pcsDocDate: (0, purchase_doc_helpers_1.dateOf)(docDate), pcsCreatedBy: actor,
                }, select: { pcsId: true } });
            const label = `Claim ${pr.prRefno}/L${l.priLineNo}`;
            const legs = [{ role: 'CLAIM_RECEIVABLE', drCr: 'CR', amount: (0, purchase_doc_helpers_1.num2)(amount), roleTag: 'CLAIM_RECEIVABLE', remarks: label }];
            if (dto.action === 'CREDIT')
                legs.push({ ledgerId: party, drCr: 'DR', amount: (0, purchase_doc_helpers_1.num2)(amount), remarks: `${label} — credit${dto.cnNo ? ` CN ${dto.cnNo}` : ''}`, docRefno: pr.prRefno });
            else {
                if (reavail.greaterThan(0)) {
                    const heads = [['INPUT_CGST', l.priCgstAmt], ['INPUT_SGST', l.priSgstAmt], ['INPUT_IGST', l.priIgstAmt], ['INPUT_CESS', l.priCessAmt]];
                    let given = purchase_doc_helpers_1.ZERO;
                    const live = heads.filter(([, v]) => !v.isZero());
                    live.forEach(([role, v], k) => {
                        const part = k === live.length - 1 ? reavail.minus(given) : (0, purchase_doc_helpers_1.r2)(reavail.times(v).dividedBy(tax));
                        given = given.plus(part);
                        legs.push({ role, drCr: 'DR', amount: (0, purchase_doc_helpers_1.num2)(part), taxId: l.priTaxId, supplyNature: (l.priIgstAmt.greaterThan(0) ? 'INTER' : 'INTRA'), roleTag: role, remarks: `${label} — GST re-availed` });
                    });
                }
                legs.push({ role: 'WRITE_OFF', drCr: 'DR', amount: (0, purchase_doc_helpers_1.num2)(amount.minus(reavail)), roleTag: 'WRITE_OFF', remarks: `${label} — ${dto.action === 'REJECTED' ? 'rejected' : 'short-settled'}` });
            }
            const vt = await (0, purchase_doc_helpers_1.voucherTypeId)(tx, 'PCL');
            const posted = await this.vouchers.postLegs(tx, {
                header: { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, voucherTypeId: vt, voucherDate: docDate, srcModule: 'PURCHASE', srcDocType: SETTLE_DOC, srcDocId: s.pcsId,
                    docLabel: 'Claim settlement', docRefno: ref, docDate, usrRefno: dto.cnNo ?? null, docAmount: (0, purchase_doc_helpers_1.num2)(amount), partyId: party,
                    userId: actor, deviceId: dto.deviceId, remarks: dto.reason ?? `${label} ${dto.action.toLowerCase()}`, createdBy: actor },
                legs: legs.filter((g) => g.amount >= 0.005),
            });
            await tx.purClaimSettlement.update({ where: { pcsId_pcsAccYear: { pcsId: s.pcsId, pcsAccYear: accYear } }, data: { pcsVoucherId: posted.voucherId } });
            if (dto.action === 'CREDIT') {
                await (0, purchase_doc_helpers_1.raiseBillRow)(tx, { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, partyId: party, billType: 'PURCHASE_RETURN', drCr: 'DR', amount,
                    docType: SETTLE_DOC, docId: s.pcsId, voucherId: posted.voucherId, voucherTypeId: vt, voucherNo: posted.voucherSlno, voucherDate: docDate,
                    refno: posted.voucherRefno ?? ref, docDate: (0, purchase_doc_helpers_1.dateOf)(docDate), narration: `${label} — credit${dto.cnNo ? ` CN ${dto.cnNo}` : ''}`, actor });
            }
            await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.CLAIM_SETTLEMENT, docId: s.pcsId, refno: ref,
                event: purchase_doc_helpers_1.TxnStatusEvent.POSTED, from: null, to: dto.action, actor, deviceId: dto.deviceId, remarks: dto.reason ?? null });
            return { settlementId: s.pcsId, accYear, amount, open: open.minus(amount), voucherRefno: posted.voucherRefno };
        }, { timeout: 60000, maxWait: 10000 });
        return (0, purchase_doc_helpers_1.jsonSafe)(out);
    }
    async settleUndo(dto) {
        const actor = this.actor();
        const out = await this.prisma.$transaction(async (tx) => {
            const s = await tx.purClaimSettlement.findFirst({ where: { pcsId: dto.settlementId, pcsAccYear: dto.accYear, pcsIsDeleted: false } });
            if (!s)
                (0, purchase_errors_1.purNotFound)(`Settlement ${dto.settlementId} not found`);
            if (s.pcsReversalOfId)
                (0, purchase_errors_1.purConflict)('That row is itself an undo.', purchase_errors_1.PUR.NOT_POSTED, 'settlementId');
            const [undone] = await tx.$queryRaw `SELECT count(*) AS n FROM purchase.pur_claim_settlement WHERE pcs_reversal_of_id = ${dto.settlementId}::uuid AND NOT pcs_is_deleted`;
            if (Number(undone.n) > 0)
                (0, purchase_errors_1.purConflict)('That settlement is already undone.', purchase_errors_1.PUR.NOT_POSTED, 'settlementId');
            await (0, purchase_doc_helpers_1.assertBillsUnsettled)(tx, SETTLE_DOC, dto.settlementId, 'The credit');
            const rev = await tx.purClaimSettlement.create({ data: {
                    pcsCompanyId: s.pcsCompanyId, pcsBranchId: s.pcsBranchId, pcsAccYear: s.pcsAccYear, pcsDeviceId: s.pcsDeviceId,
                    pcsReturnItemId: s.pcsReturnItemId, pcsReturnItemAccYear: s.pcsReturnItemAccYear, pcsAction: s.pcsAction, pcsReceivedAs: s.pcsReceivedAs,
                    pcsAmount: s.pcsAmount.negated(), pcsGstReavailed: s.pcsGstReavailed.negated(), pcsCnNo: s.pcsCnNo, pcsCnDate: s.pcsCnDate,
                    pcsReason: dto.reason, pcsDocDate: new Date(), pcsReversalOfId: s.pcsId, pcsCreatedBy: actor,
                }, select: { pcsId: true } });
            if (s.pcsVoucherId)
                await this.vouchers.reverseLegs(tx, s.pcsVoucherId, s.pcsAccYear, `Claim settlement undone: ${dto.reason}`, actor);
            await (0, purchase_doc_helpers_1.withdrawBillRows)(tx, SETTLE_DOC, s.pcsId, actor);
            return { reversalId: rev.pcsId, returnItemId: s.pcsReturnItemId };
        }, { timeout: 60000, maxWait: 10000 });
        return (0, purchase_doc_helpers_1.jsonSafe)(out);
    }
};
exports.PurchaseReturnService = PurchaseReturnService;
exports.PurchaseReturnService = PurchaseReturnService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, request_context_service_1.RequestContextService,
        voucher_posting_service_1.VoucherPostingService, stock_posting_service_1.StockPostingService])
], PurchaseReturnService);
let PurchaseReturnController = class PurchaseReturnController {
    service;
    prisma;
    ctx;
    constructor(service, prisma, ctx) {
        this.service = service;
        this.prisma = prisma;
        this.ctx = ctx;
    }
    async right(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, { userId: this.ctx.getUserId(), menuId: exports.RETURN_MENU_ID, right, codePrefix: 'PRN', action });
    }
    async save(dto) {
        await this.right(dto.header.prId ? 'edit' : 'create', 'save a purchase return');
        if (dto.header.post)
            await this.right('post', 'post a purchase return');
        const data = await this.service.save(dto);
        return { success: true, message: `Return ${data.header.prRefno} ${dto.header.post ? 'posted' : 'saved as draft'}`, data };
    }
    async post(dto) {
        await this.right('post', 'post a purchase return');
        const data = await this.service.post(dto.prId, dto.accYear);
        return { success: true, message: `Return ${data.header.prRefno} posted`, data };
    }
    async get(q) {
        await this.right('view', 'open a purchase return');
        return { success: true, message: 'Return fetched', data: await this.service.get(q.prId, q.accYear) };
    }
    async cancel(dto) {
        await this.right('cancel', 'cancel a purchase return');
        const data = await this.service.cancel(dto);
        return { success: true, message: `Return ${data.header.prRefno} cancelled`, data };
    }
    async sources(q) {
        await this.right('view', 'pick a bill to return against');
        return { success: true, message: 'Sources fetched', data: await this.service.sources(q) };
    }
    async sourceLines(q) {
        await this.right('view', 'read a bill to return against');
        return { success: true, message: 'Source lines fetched', data: await this.service.sourceLinesView(q) };
    }
    async openClaims(q) {
        await this.right('view', 'see open claims');
        return { success: true, message: 'Claims fetched', data: await this.service.openClaims(q) };
    }
    async settle(dto) {
        await this.right('post', 'settle a claim');
        const data = await this.service.settle(dto);
        return { success: true, message: `Claim settled — ${data.voucherRefno ?? ''}`.trim(), data };
    }
    async settleUndo(dto) {
        await this.right('cancel', 'undo a claim settlement');
        return { success: true, message: 'Settlement undone', data: await this.service.settleUndo(dto) };
    }
};
exports.PurchaseReturnController = PurchaseReturnController;
__decorate([
    (0, common_1.Post)('returns/save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Save a return draft (rows against a posted bill / GRN); header.post = true saves and posts.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SaveReturnDto]),
    __metadata("design:returntype", Promise)
], PurchaseReturnController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('returns/post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Post a saved return draft: stock out of the exact lots, debit note / claim / replacement.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ReturnRefDto]),
    __metadata("design:returntype", Promise)
], PurchaseReturnController.prototype, "post", null);
__decorate([
    (0, common_1.Get)('returns/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'A return with its rows, lots and each claim row\'s open amount.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ReturnRefDto]),
    __metadata("design:returntype", Promise)
], PurchaseReturnController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('returns/cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a return: a posted one only while its debit is unadjusted and no claim settled.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ReturnCancelDto]),
    __metadata("design:returntype", Promise)
], PurchaseReturnController.prototype, "cancel", null);
__decorate([
    (0, common_1.Get)('returns/sources'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'A supplier\'s posted bills (or GRNs) a return can be made against.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SourcesQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseReturnController.prototype, "sources", null);
__decorate([
    (0, common_1.Get)('returns/source-lines'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'The lines of a bill / GRN: came in, already returned, returnable, per-unit money, lots.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SourceLinesQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseReturnController.prototype, "sourceLines", null);
__decorate([
    (0, common_1.Get)('claims/open'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Claim rows of posted returns with value, settled and open.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [OpenClaimsQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseReturnController.prototype, "openClaims", null);
__decorate([
    (0, common_1.Post)('claims/settle'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Settle a claim row: CREDIT (credit note from the party), SHORT_SETTLED (rest written off) or REJECTED.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SettleClaimDto]),
    __metadata("design:returntype", Promise)
], PurchaseReturnController.prototype, "settle", null);
__decorate([
    (0, common_1.Post)('claims/settle-undo'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Undo a claim settlement: a reversing row, the voucher reversed.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SettleUndoDto]),
    __metadata("design:returntype", Promise)
], PurchaseReturnController.prototype, "settleUndo", null);
exports.PurchaseReturnController = PurchaseReturnController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — Return / Claim'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase'),
    __metadata("design:paramtypes", [PurchaseReturnService, prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseReturnController);
//# sourceMappingURL=purchase-return.js.map