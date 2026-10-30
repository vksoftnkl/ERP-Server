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
exports.PurchaseOrderController = exports.PurchaseOrderService = exports.PendingPoLinesQueryDto = exports.MergePurchaseOrdersDto = exports.MergeSourceDto = exports.ClonePurchaseOrderDto = exports.PurchaseOrderApproveDto = exports.PurchaseOrderReasonDto = exports.PurchaseOrderRefDto = exports.SavePurchaseOrderDto = exports.PurchaseOrderHeaderDto = exports.PurchaseOrderLineDto = exports.PURCHASE_ORDER_MENU_ID = void 0;
exports.poLineStatus = poLineStatus;
exports.poDocStatus = poDocStatus;
exports.poApprovalStatus = poApprovalStatus;
exports.poUsedQty = poUsedQty;
exports.assertPoApproved = assertPoApproved;
exports.closePosOnFirstBill = closePosOnFirstBill;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const api_version_1 = require("../../../common/constants/api-version");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const purchase_calc_1 = require("../common/purchase-calc");
const save_purchase_invoice_dto_1 = require("../invoice/dto/save-purchase-invoice.dto");
const purchase_settings_1 = require("../common/purchase-settings");
const purchase_terms_1 = require("../terms/purchase-terms");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const purchase_errors_1 = require("../common/purchase.errors");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
exports.PURCHASE_ORDER_MENU_ID = 23;
class PurchaseOrderLineDto {
    lineNo;
    itemId;
    uomId;
    qty;
    freeQty;
    rate;
    discPct;
    schPct;
    taxId;
    mrp;
    weight;
    remarks;
    lineId;
}
exports.PurchaseOrderLineDto = PurchaseOrderLineDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PurchaseOrderLineDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseOrderLineDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseOrderLineDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseOrderLineDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseOrderLineDto.prototype, "freeQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseOrderLineDto.prototype, "rate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseOrderLineDto.prototype, "discPct", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseOrderLineDto.prototype, "schPct", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseOrderLineDto.prototype, "taxId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseOrderLineDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseOrderLineDto.prototype, "weight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], PurchaseOrderLineDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The line being changed (pur_order_item.poi_id) — an amendment keeps it; blank = a new line.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseOrderLineDto.prototype, "lineId", void 0);
class PurchaseOrderHeaderDto {
    poId;
    companyId;
    branchId;
    accYear;
    deviceId;
    supplierId;
    docDate;
    expectedDate;
    godownId;
    creditDays;
    agentId;
    contact;
    termsText;
    termsId;
    remarks;
    post;
    amendReason;
}
exports.PurchaseOrderHeaderDto = PurchaseOrderHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "poId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "expectedDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseOrderHeaderDto.prototype, "creditDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'purchase.pur_agent.pag_id (Agents master, menu 28). Omit / null = no agent.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], PurchaseOrderHeaderDto.prototype, "agentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "contact", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The PO\'s own copy of the terms. Omitted: a newly picked termsId = that row\'s text; on an edit = keep the saved text.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "termsText", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'purchase.pur_terms.pte_id (PO terms master, dropdown 73) the terms came from (get: header.poTermsId + termsName). Omit = keep the saved one; null = typed terms, no master row.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], PurchaseOrderHeaderDto.prototype, "termsId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Confirm: the PO is open for GRNs and bills.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PurchaseOrderHeaderDto.prototype, "post", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Why a confirmed PO is amended (kept on the trail).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "amendReason", void 0);
class SavePurchaseOrderDto {
    header;
    lines;
    charges;
}
exports.SavePurchaseOrderDto = SavePurchaseOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: PurchaseOrderHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PurchaseOrderHeaderDto),
    __metadata("design:type", PurchaseOrderHeaderDto)
], SavePurchaseOrderDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PurchaseOrderLineDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PurchaseOrderLineDto),
    __metadata("design:type", Array)
], SavePurchaseOrderDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [save_purchase_invoice_dto_1.PurchaseChargeDto], description: 'CHG-07: estimated charges (freight, coolie …) — an ESTIMATE only: nothing posts, the line figures stay as keyed; po_charges_amt = Σ ADD − Σ DEDUCT, the PO total includes it. Payees are ignored on a PO. Every save replaces the set.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_purchase_invoice_dto_1.PurchaseChargeDto),
    __metadata("design:type", Array)
], SavePurchaseOrderDto.prototype, "charges", void 0);
class PurchaseOrderRefDto {
    poId;
    accYear;
}
exports.PurchaseOrderRefDto = PurchaseOrderRefDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseOrderRefDto.prototype, "poId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], PurchaseOrderRefDto.prototype, "accYear", void 0);
class PurchaseOrderReasonDto extends PurchaseOrderRefDto {
    reason;
    lineIds;
}
exports.PurchaseOrderReasonDto = PurchaseOrderReasonDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], PurchaseOrderReasonDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Short-close only these lines (poi_id); default every pending line.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], PurchaseOrderReasonDto.prototype, "lineIds", void 0);
class PurchaseOrderApproveDto extends PurchaseOrderRefDto {
    approve;
    reason;
}
exports.PurchaseOrderApproveDto = PurchaseOrderApproveDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'false = reject (reason required). Default approve.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PurchaseOrderApproveDto.prototype, "approve", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], PurchaseOrderApproveDto.prototype, "reason", void 0);
class ClonePurchaseOrderDto extends PurchaseOrderRefDto {
    deviceId;
    toAccYear;
    docDate;
}
exports.ClonePurchaseOrderDto = ClonePurchaseOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ClonePurchaseOrderDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The new PO\'s year (default the source\'s).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], ClonePurchaseOrderDto.prototype, "toAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Default today.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ClonePurchaseOrderDto.prototype, "docDate", void 0);
class MergeSourceDto {
    poId;
    accYear;
}
exports.MergeSourceDto = MergeSourceDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MergeSourceDto.prototype, "poId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], MergeSourceDto.prototype, "accYear", void 0);
class MergePurchaseOrdersDto {
    sources;
    accYear;
    deviceId;
    docDate;
}
exports.MergePurchaseOrdersDto = MergePurchaseOrdersDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MergeSourceDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MergeSourceDto),
    __metadata("design:type", Array)
], MergePurchaseOrdersDto.prototype, "sources", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], MergePurchaseOrdersDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MergePurchaseOrdersDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Default today.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], MergePurchaseOrdersDto.prototype, "docDate", void 0);
class PendingPoLinesQueryDto {
    companyId;
    branchId;
    supplierId;
}
exports.PendingPoLinesQueryDto = PendingPoLinesQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PendingPoLinesQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PendingPoLinesQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PendingPoLinesQueryDto.prototype, "supplierId", void 0);
const today = () => new Date().toISOString().slice(0, 10);
const isoDay = (d) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);
function poLineStatus(qty, received, shortClosed) {
    if (received.greaterThanOrEqualTo(qty) && qty.greaterThan(0))
        return 'DONE';
    if (shortClosed.greaterThan(0) && received.plus(shortClosed).greaterThanOrEqualTo(qty))
        return 'SHORT_CLOSED';
    if (received.greaterThan(0))
        return 'PART';
    return 'OPEN';
}
function poDocStatus(status, approval, lineStatuses) {
    if (status === 'CANCELLED')
        return 'CANCELLED';
    if (status === 'DRAFT')
        return 'DRAFT';
    if (approval === 'AWAITING')
        return 'AWAITING_APPROVAL';
    if (approval === 'REJECTED')
        return 'NOT_APPROVED';
    const open = lineStatuses.filter((x) => x === 'OPEN' || x === 'PART').length;
    if (!open)
        return lineStatuses.every((x) => x === 'DONE') ? 'RECEIVED' : 'CLOSED';
    return lineStatuses.some((x) => x !== 'OPEN') ? 'PART_RECEIVED' : 'CONFIRMED';
}
function poApprovalStatus(a) {
    void a.chargesEstimate;
    const value = a.goods.taxable.plus(a.goods.cgst).plus(a.goods.sgst).plus(a.goods.igst).plus(a.goods.cess);
    const above = a.limit.greaterThan(0) && value.greaterThan(a.limit);
    let status = a.current ?? 'NOT_REQUIRED';
    if (a.confirming)
        status = above ? 'AWAITING' : 'NOT_REQUIRED';
    if (a.amending) {
        if (!above)
            status = 'NOT_REQUIRED';
        else if (status !== 'APPROVED' || value.greaterThan(a.currentGoodsValue ?? 0))
            status = 'AWAITING';
    }
    return { status, value };
}
const PO_AUDIT = { screenName: 'purchase order', tableName: 'pur_order' };
async function poUsedQty(tx, poId) {
    const rows = await tx.$queryRaw `
    SELECT src_item_id AS id, SUM(q) AS q FROM (
      SELECT gri.gri_src_item_id AS src_item_id, (gri.gri_received_qty + gri.gri_damaged_qty) * gri.gri_to_base_factor AS q
        FROM purchase.pur_grn_item gri JOIN purchase.pur_grn g ON g.grn_id = gri.gri_grn_id AND g.grn_acc_year = gri.gri_acc_year
       WHERE gri.gri_src_doc_type = 'PURCHASE_ORDER' AND gri.gri_src_doc_id = ${poId}::uuid AND NOT gri.gri_is_deleted AND NOT g.grn_is_deleted AND g.grn_status <> 'CANCELLED'
      UNION ALL
      SELECT pii.pii_src_item_id, pii.pii_billed_qty * pii.pii_to_base_factor
        FROM purchase.pur_invoice_item pii JOIN purchase.pur_invoice p ON p.pi_id = pii.pii_pi_id AND p.pi_acc_year = pii.pii_acc_year
       WHERE pii.pii_src_doc_type = 'PURCHASE_ORDER' AND pii.pii_src_doc_id = ${poId}::uuid AND NOT pii.pii_is_deleted AND NOT p.pi_is_deleted AND p.pi_status <> 'CANCELLED'
    ) x GROUP BY src_item_id`;
    return new Map(rows.map((r) => [r.id, (0, purchase_doc_helpers_1.D)(r.q)]));
}
async function assertPoApproved(tx, poId) {
    const [po] = await tx.$queryRaw `
    SELECT po_refno, po_approval_status FROM purchase.pur_order WHERE po_id = ${poId}::uuid AND NOT po_is_deleted LIMIT 1`;
    if (po && (po.po_approval_status === 'AWAITING' || po.po_approval_status === 'REJECTED'))
        (0, purchase_errors_1.purConflict)(`${po.po_refno} is ${po.po_approval_status === 'AWAITING' ? 'waiting for approval' : 'not approved'} — it cannot feed a GRN or a bill yet.`, 'PUR_PO_NOT_APPROVED', 'lines.poItemId');
}
async function shortCloseIn(tx, poId, accYear, reason, actor, lineIds) {
    const used = await poUsedQty(tx, poId);
    const lines = await tx.purOrderItem.findMany({ where: { poiPoId: poId, poiAccYear: accYear, poiIsDeleted: false } });
    let closed = 0;
    for (const l of lines) {
        if (lineIds?.length && !lineIds.includes(l.poiId))
            continue;
        const f = l.poiToBaseFactor.isZero() ? (0, purchase_doc_helpers_1.D)(1) : l.poiToBaseFactor;
        const pending = l.poiQty.minus((used.get(l.poiId) ?? purchase_doc_helpers_1.ZERO).dividedBy(f)).minus(l.poiShortClosedQty);
        if (!pending.greaterThan(0))
            continue;
        await tx.purOrderItem.update({ where: { poiId_poiAccYear: { poiId: l.poiId, poiAccYear: accYear } },
            data: { poiShortClosedQty: l.poiShortClosedQty.plus(pending), poiShortCloseReason: reason.slice(0, 250), poiModifiedBy: actor, poiModifiedOn: new Date() } });
        closed++;
    }
    return closed;
}
async function closePosOnFirstBill(tx, a) {
    const settings = await (0, purchase_settings_1.loadPurchaseSettings)(tx, a.companyId, a.branchId);
    if (!settings.closePoOnFirstBill)
        return [];
    const pos = await tx.$queryRaw `
    WITH mine AS (
      SELECT pii.pii_src_doc_id AS po_id FROM purchase.pur_invoice_item pii
       WHERE pii.pii_pi_id = ${a.piId}::uuid AND pii.pii_acc_year = ${a.accYear} AND pii.pii_src_doc_type = 'PURCHASE_ORDER' AND NOT pii.pii_is_deleted
      UNION
      SELECT gri.gri_src_doc_id FROM purchase.pur_invoice_item pii
        JOIN purchase.pur_grn_item gri ON gri.gri_id = pii.pii_src_item_id
       WHERE pii.pii_pi_id = ${a.piId}::uuid AND pii.pii_acc_year = ${a.accYear} AND pii.pii_src_doc_type = 'GRN' AND NOT pii.pii_is_deleted
         AND gri.gri_src_doc_type = 'PURCHASE_ORDER')
    SELECT po.po_id, po.po_acc_year, po.po_refno, po.po_company_id, po.po_branch_id, po.po_status
      FROM purchase.pur_order po JOIN mine ON mine.po_id = po.po_id
     WHERE po.po_status = 'POSTED' AND NOT po.po_is_deleted
       AND NOT EXISTS (
         SELECT 1 FROM purchase.pur_invoice p JOIN purchase.pur_invoice_item x ON x.pii_pi_id = p.pi_id AND x.pii_acc_year = p.pi_acc_year AND NOT x.pii_is_deleted
           LEFT JOIN purchase.pur_grn_item g2 ON x.pii_src_doc_type = 'GRN' AND g2.gri_id = x.pii_src_item_id
          WHERE p.pi_status = 'POSTED' AND NOT p.pi_is_deleted AND p.pi_id <> ${a.piId}::uuid
            AND ((x.pii_src_doc_type = 'PURCHASE_ORDER' AND x.pii_src_doc_id = po.po_id)
                 OR (g2.gri_src_doc_type = 'PURCHASE_ORDER' AND g2.gri_src_doc_id = po.po_id)))`;
    const notes = [];
    for (const po of pos) {
        const reason = `Closed on its first bill ${a.refno} (purchase.close_po_on_first_bill)`;
        const n = await shortCloseIn(tx, po.po_id, po.po_acc_year, reason, a.actor);
        if (!n)
            continue;
        await tx.purOrder.update({ where: { poId_poAccYear: { poId: po.po_id, poAccYear: po.po_acc_year } },
            data: { poIsShortClosed: true, poShortCloseReason: reason.slice(0, 250), poModifiedBy: a.actor, poModifiedOn: new Date() } });
        await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: po.po_company_id, branchId: po.po_branch_id, accYear: po.po_acc_year, docType: purchase_doc_helpers_1.TxnStatusDocType.PURCHASE_ORDER, docId: po.po_id,
            refno: po.po_refno, event: purchase_doc_helpers_1.TxnStatusEvent.CLOSED, from: 'POSTED', to: 'POSTED', actor: a.actor, remarks: reason });
        notes.push({ code: 'PUR_PO_CLOSED_ON_FIRST_BILL', field: 'header', message: `${po.po_refno}: the rest (${n} line${n === 1 ? '' : 's'}) is short-closed — first bill of the PO.` });
    }
    return notes;
}
let PurchaseOrderService = class PurchaseOrderService {
    prisma;
    ctx;
    audit;
    constructor(prisma, ctx, audit) {
        this.prisma = prisma;
        this.ctx = ctx;
        this.audit = audit;
    }
    actor() {
        const u = this.ctx.getUserId();
        if (!u)
            (0, purchase_errors_1.purRefuse)('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
        return u;
    }
    async compute(tx, dto) {
        const h = dto.header;
        const sup = await (0, purchase_doc_helpers_1.supplierRow)(tx, h.supplierId);
        const inter = await (0, purchase_doc_helpers_1.isInterState)(tx, h.branchId, sup);
        const units = await (0, purchase_doc_helpers_1.loadUnits)(tx, dto.lines.map((l) => l.uomId));
        const problems = dto.lines.flatMap((l, i) => {
            const u = units.get(l.uomId);
            return !u || u.iuc_item_id !== l.itemId ? [{ field: `lines.${i}.uomId`, code: purchase_errors_1.PUR.UNIT_NOT_FOUND, message: `Line ${l.lineNo}: unit not found for the item` }] : [];
        });
        if (problems.length)
            (0, purchase_errors_1.purRefuseMany)(problems[0].message, problems);
        for (const l of dto.lines)
            if (!l.taxId)
                l.taxId = units.get(l.uomId)?.item_default_tax_id ?? undefined;
        const taxes = await (0, purchase_doc_helpers_1.loadTaxRates)(tx, dto.lines.map((l) => l.taxId));
        const lineIns = dto.lines.map((l) => ({ key: String(l.lineNo), billedQty: l.qty, freeQty: l.freeQty ?? 0, rate: l.rate, discPct: l.discPct, schPct: l.schPct,
            gstPct: l.taxId ? taxes.get(l.taxId)?.tax_rate_perc ?? 0 : 0, toBaseFactor: units.get(l.uomId).iuc_to_base_factor, weight: l.weight ?? 0 }));
        const calc = (0, purchase_calc_1.calcPurchase)({ interState: inter, roundOffStep: 0, lines: lineIns });
        const charges = await this.estimateCharges(tx, dto.charges ?? [], lineIns, inter);
        const agent = await this.agentOf(tx, dto.header.agentId, dto.header.companyId);
        return { sup, units, calc, charges, agent };
    }
    async agentOf(db, agentId, companyId) {
        if (!agentId)
            return null;
        const [a] = await db.$queryRaw `
      SELECT pag_id, pag_name, pag_is_active, pag_company_id FROM purchase.pur_agent WHERE pag_id = ${agentId}::uuid AND NOT pag_is_deleted`;
        if (!a || (a.pag_company_id && a.pag_company_id !== companyId))
            (0, purchase_errors_1.purNotFound)(`Agent ${agentId} not found`, 'PUR_AGENT_NOT_FOUND', 'header.agentId');
        if (!a.pag_is_active)
            (0, purchase_errors_1.purRefuse)(`Agent ${a.pag_name} is inactive.`, 'PUR_AGENT_INACTIVE', 'header.agentId');
        return { id: a.pag_id, name: a.pag_name };
    }
    async estimateCharges(db, charges, lineIns, inter) {
        if (!charges.length)
            return { rows: [], total: purchase_doc_helpers_1.ZERO };
        const ids = [...new Set(charges.map((c) => c.chgId))];
        const masters = await db.$queryRaw `
      SELECT chg_id, chg_name, chg_type, chg_method, chg_default_rate, chg_cost_alloc, chg_on_bill, chg_role, chg_ledger_code, chg_before_tax, chg_landing_cost
        FROM public.charge_master WHERE chg_id = ANY(${ids}::uuid[]) AND NOT chg_is_deleted AND chg_module IN ('P','B')`;
        const by = new Map(masters.map((m) => [m.chg_id, m]));
        const problems = charges.flatMap((c, i) => (by.has(c.chgId) ? [] : [{ field: `charges.${i}.chgId`, code: purchase_errors_1.PUR.CHARGE_NOT_FOUND, message: `Charge ${c.chgId} is not a purchase charge` }]));
        if (problems.length)
            (0, purchase_errors_1.purRefuseMany)(problems[0].message, problems);
        const ins = charges.map((c, i) => {
            const m = by.get(c.chgId);
            return { key: String(i), type: m.chg_type === 'DEDUCT' ? 'DEDUCT' : 'ADD', method: m.chg_method, rate: c.rate ?? m.chg_default_rate ?? 0,
                amount: c.amount ?? null, alloc: (m.chg_cost_alloc && m.chg_cost_alloc !== 'NONE' ? m.chg_cost_alloc : 'VALUE'),
                beforeTax: false, onBill: false, landingCost: true, taxPct: 0, payees: [] };
        });
        const out = (0, purchase_calc_1.calcPurchase)({ interState: inter, roundOffStep: 0, lines: lineIns, charges: ins });
        let total = purchase_doc_helpers_1.ZERO;
        const rows = charges.map((c, i) => {
            const m = by.get(c.chgId);
            const amount = out.charges[i].amount.abs();
            const signed = m.chg_type === 'DEDUCT' ? amount.negated() : amount;
            total = total.plus(signed);
            return { chgId: c.chgId, chgName: m.chg_name, role: m.chg_role, type: m.chg_type, method: m.chg_method, rate: (0, purchase_doc_helpers_1.D)(c.rate ?? m.chg_default_rate ?? 0),
                amount, signedAmount: signed, onBill: m.chg_on_bill, ledgerId: m.chg_ledger_code, costAlloc: m.chg_cost_alloc, beforeTax: m.chg_before_tax, landingCost: m.chg_landing_cost };
        });
        return { rows, total };
    }
    async preview(dto) {
        const { calc, charges, agent } = await this.compute(this.prisma, dto);
        const tax = calc.cgst.plus(calc.sgst).plus(calc.igst).plus(calc.cess);
        const net = calc.taxable.plus(tax);
        return (0, purchase_doc_helpers_1.jsonSafe)({
            header: { agentId: agent?.id ?? null, agentName: agent?.name ?? null },
            lines: calc.lines.map((o) => ({ key: o.key, gross: o.gross, discAmt: o.discAmt, taxable: o.taxable, gstPct: o.gstPct, tax: o.cgst.plus(o.sgst).plus(o.igst).plus(o.cess), total: o.total })),
            charges: charges.rows.map((c) => ({ ...c, rate: c.rate.toString(), amount: c.amount.toFixed(2), signedAmount: c.signedAmount.toFixed(2) })),
            totals: { gross: calc.gross, taxable: calc.taxable, tax, net,
                lines: dto.lines.length, orderedValue: net.toFixed(2), chargesEstimate: charges.total.toFixed(2), poTotal: net.plus(charges.total).toFixed(2) },
        });
    }
    async save(dto) {
        const actor = this.actor();
        const id = await this.prisma.$transaction(async (tx) => this.saveIn(tx, dto, actor), { timeout: 60000, maxWait: 10000 });
        return this.get(id, dto.header.accYear);
    }
    async saveIn(tx, dto, actor, opts = {}) {
        const h = dto.header;
        const { sup, units, calc, charges, agent } = await this.compute(tx, dto);
        let poId = h.poId ?? null;
        let slno, refno, isNew = false;
        let cur = null;
        let before = null;
        if (poId) {
            cur = await tx.purOrder.findFirst({ where: { poId, poAccYear: h.accYear, poIsDeleted: false } });
            if (!cur)
                (0, purchase_errors_1.purNotFound)(`Purchase order ${poId} not found`);
            if (cur.poStatus === 'CANCELLED')
                (0, purchase_errors_1.purConflict)(`${cur.poRefno} is cancelled.`, purchase_errors_1.PUR.NOT_DRAFT, 'poId');
            await tx.$executeRaw `SELECT 1 FROM purchase.pur_order WHERE po_id = ${poId}::uuid AND po_acc_year = ${h.accYear} FOR UPDATE`;
            before = await this.getDoc(tx, poId, h.accYear);
            slno = cur.poSlno;
            refno = cur.poRefno;
        }
        else {
            ({ slno, refno } = await (0, purchase_doc_helpers_1.allocateDocNumber)(tx, 'PO', h.companyId, h.branchId, h.accYear, h.deviceId));
            isNew = true;
        }
        const amending = cur?.poStatus === 'POSTED';
        const tax = calc.cgst.plus(calc.sgst).plus(calc.igst).plus(calc.cess);
        const net = calc.taxable.plus(tax);
        const confirming = !amending && !!h.post;
        const settings = await (0, purchase_settings_1.loadPurchaseSettings)(tx, h.companyId, h.branchId);
        const limit = (0, purchase_doc_helpers_1.D)(settings.poApprovalAbove ?? 0);
        const approval = poApprovalStatus({ limit, goods: calc, chargesEstimate: charges.total, confirming, amending,
            current: cur?.poApprovalStatus ?? null, currentGoodsValue: cur?.poNetAmt ?? null }).status;
        const keepTerms = !!cur && !!h.termsId && h.termsId === cur.poTermsId;
        const terms = h.termsId ? await (0, purchase_terms_1.termsOf)(tx, h.termsId, h.companyId, 'header.termsId', { keep: keepTerms }) : null;
        const termsText = (0, module_shared_utils_1.isPresentField)(h, 'termsText') ? (h.termsText ?? null) : terms && !keepTerms ? terms.text : cur ? undefined : null;
        const data = {
            poCompanyId: h.companyId, poBranchId: h.branchId, poAccYear: h.accYear, poDeviceId: h.deviceId, poSlno: slno, poRefno: refno,
            poDocDate: new Date(`${h.docDate}T00:00:00Z`), poSupplierId: h.supplierId, poExpectedDate: h.expectedDate ? new Date(`${h.expectedDate}T00:00:00Z`) : null,
            poDeliverGodownId: h.godownId ?? null, poAgentId: agent?.id ?? null, poContact: h.contact ?? null, poCreditDays: h.creditDays ?? sup.sup_credit_days ?? null,
            ...(termsText !== undefined ? { poTermsText: termsText } : {}), ...(h.termsId !== undefined ? { poTermsId: h.termsId } : {}), poGrossAmt: calc.gross, poTaxableAmt: calc.taxable, poTaxAmt: tax, poChargesAmt: charges.total, poNetAmt: net,
            poRemarks: h.remarks ?? null, poStatus: amending ? 'POSTED' : h.post ? 'POSTED' : 'DRAFT', poApprovalStatus: approval,
        };
        if (amending && cur.poSupplierId !== h.supplierId) {
            const used0 = await poUsedQty(tx, poId);
            if ([...used0.values()].some((q) => q.greaterThan(0)))
                (0, purchase_errors_1.purConflict)(`${refno}: goods came from this supplier — the supplier cannot change now.`, purchase_errors_1.PUR.NOT_DRAFT, 'header.supplierId');
        }
        if (isNew)
            poId = (await tx.purOrder.create({ data: { ...data, poCreatedBy: actor }, select: { poId: true } })).poId;
        else
            await tx.purOrder.update({ where: { poId_poAccYear: { poId: poId, poAccYear: h.accYear } },
                data: { ...data, poModifiedBy: actor, poModifiedOn: new Date(), ...(amending ? { poRevisionNo: { increment: 1 } } : {}) } });
        const lineData = (i) => {
            const l = dto.lines[i], o = calc.lines[i], u = units.get(l.uomId);
            return {
                poiLineNo: l.lineNo, poiItemId: l.itemId, poiUomId: l.uomId, poiBaseUomId: u.base_iuc_id, poiToBaseFactor: u.iuc_to_base_factor, poiHsnCode: u.item_hsn_code,
                poiWeight: l.weight ?? null, poiQty: (0, purchase_doc_helpers_1.D)(l.qty), poiFreeQty: (0, purchase_doc_helpers_1.D)(l.freeQty), poiRate: (0, purchase_doc_helpers_1.D)(l.rate), poiDiscPct: (0, purchase_doc_helpers_1.D)(l.discPct), poiDiscAmt: o.discAmt,
                poiSchPct: (0, purchase_doc_helpers_1.D)(l.schPct), poiSchAmt: o.schAmt, poiGrossAmt: o.gross, poiTaxableAmt: o.taxable, poiTaxId: l.taxId ?? null, poiGstPct: o.gstPct,
                poiCgstAmt: o.cgst, poiSgstAmt: o.sgst, poiIgstAmt: o.igst, poiCessAmt: o.cess, poiTotalAmt: o.total, poiMrp: l.mrp ?? null,
                poiRemarks: l.remarks ?? null,
            };
        };
        if (!amending) {
            if (!isNew)
                await tx.purOrderItem.deleteMany({ where: { poiPoId: poId, poiAccYear: h.accYear } });
            for (let i = 0; i < dto.lines.length; i++)
                await tx.purOrderItem.create({ data: { ...lineData(i), poiPoId: poId, poiCompanyId: h.companyId, poiBranchId: h.branchId, poiAccYear: h.accYear, poiCreatedBy: actor } });
        }
        else {
            const used = await poUsedQty(tx, poId);
            const existing = await tx.purOrderItem.findMany({ where: { poiPoId: poId, poiAccYear: h.accYear, poiIsDeleted: false } });
            const byId = new Map(existing.map((e) => [e.poiId, e]));
            const kept = new Set();
            const problems = [];
            for (let i = 0; i < dto.lines.length; i++) {
                const l = dto.lines[i];
                const e = l.lineId ? byId.get(l.lineId) : undefined;
                if (l.lineId && !e) {
                    problems.push({ field: `lines.${i}.lineId`, code: purchase_errors_1.PUR.NOT_FOUND, message: `Line ${l.lineNo}: not a line of ${refno}` });
                    continue;
                }
                if (!e)
                    continue;
                kept.add(e.poiId);
                const f = e.poiToBaseFactor.isZero() ? (0, purchase_doc_helpers_1.D)(1) : e.poiToBaseFactor;
                const came = (used.get(e.poiId) ?? purchase_doc_helpers_1.ZERO).dividedBy(f);
                if (came.greaterThan(0) && (e.poiItemId !== l.itemId || e.poiUomId !== l.uomId))
                    problems.push({ field: `lines.${i}.itemId`, code: purchase_errors_1.PUR.QTY_INVALID, message: `Line ${l.lineNo}: goods came against it — its item and unit cannot change` });
                const floor = came.plus(e.poiShortClosedQty);
                if ((0, purchase_doc_helpers_1.D)(l.qty).lessThan(floor))
                    problems.push({ field: `lines.${i}.qty`, code: purchase_errors_1.PUR.QTY_INVALID, message: `Line ${l.lineNo}: ${floor.toDecimalPlaces(3)} already received / closed — the qty cannot go below it` });
            }
            for (const e of existing) {
                if (kept.has(e.poiId))
                    continue;
                if ((used.get(e.poiId) ?? purchase_doc_helpers_1.ZERO).greaterThan(0))
                    problems.push({ field: 'lines', code: purchase_errors_1.PUR.QTY_INVALID, message: `Line ${e.poiLineNo}: goods came against it — it cannot be removed (short-close it instead)` });
            }
            if (problems.length)
                (0, purchase_errors_1.purRefuseMany)(problems[0].message, problems);
            for (const e of existing)
                if (!kept.has(e.poiId))
                    await tx.purOrderItem.delete({ where: { poiId_poiAccYear: { poiId: e.poiId, poiAccYear: h.accYear } } });
            for (let i = 0; i < dto.lines.length; i++) {
                const l = dto.lines[i];
                if (l.lineId)
                    await tx.purOrderItem.update({ where: { poiId_poiAccYear: { poiId: l.lineId, poiAccYear: h.accYear } }, data: { ...lineData(i), poiModifiedBy: actor, poiModifiedOn: new Date() } });
                else
                    await tx.purOrderItem.create({ data: { ...lineData(i), poiPoId: poId, poiCompanyId: h.companyId, poiBranchId: h.branchId, poiAccYear: h.accYear, poiCreatedBy: actor } });
            }
        }
        await tx.$executeRaw `DELETE FROM public.txn_charge_detail WHERE cd_doc_type = 'PURCHASE_ORDER' AND cd_doc_id = ${poId}::uuid AND cd_acc_year = ${h.accYear}::bpchar`;
        let n = 0;
        for (const c of charges.rows) {
            await tx.$executeRaw `
        INSERT INTO public.txn_charge_detail (cd_doc_type, cd_doc_id, cd_slno, cd_comp_id, cd_branch_id, cd_acc_year, cd_voucher_no,
          cd_chg_id, cd_chg_name, cd_role, cd_method, cd_type, cd_apply_on, cd_ledger_code, cd_landing_cost, cd_cost_alloc, cd_before_tax, cd_tax_apl, cd_sep_post,
          cd_rate, cd_amount, cd_net_amt, cd_on_bill, cd_remarks, cd_created_by)
        VALUES ('PURCHASE_ORDER', ${poId}::uuid, ${++n}::int, ${h.companyId}::uuid, ${h.branchId}::uuid, ${h.accYear}::bpchar, ${slno}::bigint,
          ${c.chgId}::uuid, ${c.chgName}, ${c.role}, ${c.method}, ${c.type}, ${c.costAlloc ?? 'VALUE'}, ${c.ledgerId}::uuid, ${c.landingCost}, ${c.costAlloc}, ${c.beforeTax}, false, false,
          ${c.rate}::numeric, ${c.amount}::numeric, ${c.amount}::numeric, ${c.onBill}, 'estimate', ${actor})`;
        }
        const log = (event, from, to, remarks) => (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.PURCHASE_ORDER, docId: poId, refno, event, from, to, actor, deviceId: h.deviceId, remarks });
        if (isNew)
            await log(purchase_doc_helpers_1.TxnStatusEvent.CREATED, null, 'DRAFT', opts.auditNote);
        if (confirming)
            await log(purchase_doc_helpers_1.TxnStatusEvent.POSTED, 'DRAFT', 'POSTED');
        if (amending)
            await log(purchase_doc_helpers_1.TxnStatusEvent.AMENDED, 'POSTED', 'POSTED', `Revision ${(cur.poRevisionNo ?? 1) + 1}${h.amendReason ? `: ${h.amendReason}` : ''}`.slice(0, 250));
        if ((confirming || amending) && approval === 'AWAITING' && cur?.poApprovalStatus !== 'AWAITING')
            await log(purchase_doc_helpers_1.TxnStatusEvent.SUBMITTED, 'POSTED', 'POSTED', `Waiting for approval — PO value ${net.toFixed(2)} is above ${limit.toFixed(2)}`);
        const after = await this.getDoc(tx, poId, h.accYear);
        await this.audit.logDocumentRevision({ ...PO_AUDIT, docId: poId, displayName: refno, before, after, userId: actor, branchId: h.branchId, deviceId: h.deviceId,
            notes: opts.auditNote ?? (amending ? `Amended (revision ${(cur.poRevisionNo ?? 1) + 1})${h.amendReason ? ` — ${h.amendReason}` : ''}` : isNew ? 'Created' : 'Saved') + (confirming ? ' and confirmed' : '') }, tx);
        return poId;
    }
    async get(poId, accYear) {
        const doc = await this.getDoc(this.prisma, poId, accYear);
        const ctx = await this.lineContext(this.prisma, String(doc.header.poCompanyId), String(doc.header.poBranchId), doc.header.poDeliverGodownId ?? null, doc.lines.map((l) => ({ id: String(l.poiId), itemId: String(l.poiItemId), factor: (0, purchase_doc_helpers_1.D)(l.poiToBaseFactor) })));
        return (0, purchase_doc_helpers_1.jsonSafe)({ ...doc, lines: doc.lines.map((l) => ({ ...l, ...ctx.get(String(l.poiId)) })) });
    }
    async lineContext(db, companyId, branchId, godownId, lines) {
        const out = new Map();
        const items = [...new Set(lines.map((l) => l.itemId))];
        if (!items.length)
            return out;
        const [last, stock, reorder] = await Promise.all([
            db.$queryRaw `
        SELECT DISTINCT ON (pii.pii_item_id) pii.pii_item_id AS item_id, pi.pi_refno AS refno, pi.pi_doc_date AS doc_date,
               pii.pii_rate / NULLIF(pii.pii_to_base_factor, 0) AS rate_base
          FROM purchase.pur_invoice_item pii
          JOIN purchase.pur_invoice pi ON pi.pi_id = pii.pii_pi_id AND pi.pi_acc_year = pii.pii_acc_year
         WHERE pi.pi_company_id = ${companyId}::uuid AND pii.pii_item_id = ANY(${items}::uuid[])
           AND pi.pi_status = 'POSTED' AND NOT pi.pi_is_deleted AND NOT pii.pii_is_deleted AND pii.pii_billed_qty > 0
         ORDER BY pii.pii_item_id, pi.pi_doc_date DESC, pi.pi_created_on DESC`,
            db.$queryRaw `
        SELECT sbl_item_id AS item_id, SUM(sbl_on_hand_qty) AS q FROM stock.stock_balance
         WHERE sbl_company_id = ${companyId}::uuid AND sbl_branch_id = ${branchId}::uuid AND sbl_item_id = ANY(${items}::uuid[])
           AND sbl_bucket = 'SALEABLE' AND NOT sbl_is_deleted GROUP BY 1`,
            db.$queryRaw `
        SELECT DISTINCT ON (ir.ir_item_id) ir.ir_item_id AS item_id, ir.ir_reorder_level AS level, ir.ir_reorder_qty AS qty, iuc.iuc_to_base_factor AS factor
          FROM inventory.item_reorders ir LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = ir.ir_uc_unit_id
         WHERE ir.ir_branch_id = ${branchId}::uuid AND ir.ir_item_id = ANY(${items}::uuid[]) AND ir.ir_is_active AND NOT ir.ir_is_deleted
           AND (ir.ir_godown_id IS NULL OR ir.ir_godown_id = ${godownId}::uuid)
         ORDER BY ir.ir_item_id, (ir.ir_godown_id IS NOT NULL) DESC, ir.ir_modified_on DESC NULLS LAST`,
        ]);
        const lastBy = new Map(last.map((r) => [r.item_id, r])), stockBy = new Map(stock.map((r) => [r.item_id, (0, purchase_doc_helpers_1.D)(r.q)])), roBy = new Map(reorder.map((r) => [r.item_id, r]));
        const inUnit = (base, f) => (f.isZero() ? base : base.dividedBy(f)).toDecimalPlaces(3).toString();
        for (const l of lines) {
            const lr = lastBy.get(l.itemId), ro = roBy.get(l.itemId);
            const roF = (0, purchase_doc_helpers_1.D)(ro?.factor ?? 1);
            out.set(l.id, {
                lastRate: lr?.rate_base != null ? (0, purchase_doc_helpers_1.D)(lr.rate_base).times(l.factor).toDecimalPlaces(2).toFixed(2) : null, lastRateRefno: lr?.refno ?? null,
                lastRateDate: lr ? isoDay(lr.doc_date) : null,
                stockQty: inUnit(stockBy.get(l.itemId) ?? purchase_doc_helpers_1.ZERO, l.factor),
                reorderLevel: ro?.level != null ? inUnit((0, purchase_doc_helpers_1.D)(ro.level).times(roF), l.factor) : null,
                reorderQty: ro?.qty != null ? inUnit((0, purchase_doc_helpers_1.D)(ro.qty).times(roF), l.factor) : null,
            });
        }
        return out;
    }
    async getDoc(db, poId, accYear) {
        const header = await db.purOrder.findFirst({ where: { poId, poAccYear: accYear, poIsDeleted: false } });
        if (!header)
            (0, purchase_errors_1.purNotFound)(`Purchase order ${poId} not found`);
        const lines = await db.purOrderItem.findMany({ where: { poiPoId: poId, poiAccYear: accYear, poiIsDeleted: false }, orderBy: { poiLineNo: 'asc' } });
        const used = await poUsedQty(db, poId);
        const [sup] = await db.$queryRaw `SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${header.poSupplierId}::uuid`;
        const names = await (0, purchase_doc_helpers_1.unitNames)(db, lines.map((l) => l.poiUomId));
        const [appr] = header.poApprovalStatus === 'APPROVED' || header.poApprovalStatus === 'REJECTED' ? await db.$queryRaw `
      SELECT COALESCE(u.usr_login_name, t.tsl_changed_by::text) AS by, t.tsl_changed_on AS on, t.tsl_remarks AS remarks
        FROM public.txn_status_log t LEFT JOIN public.user_master u ON u.usr_id = t.tsl_changed_by
       WHERE t.tsl_src_doc_id = ${poId}::uuid AND t.tsl_event IN ('APPROVED', 'REJECTED') AND NOT t.tsl_is_deleted
       ORDER BY t.tsl_seq_no DESC LIMIT 1` : [];
        const [amend] = await db.$queryRaw `
      SELECT t.tsl_remarks AS remarks FROM public.txn_status_log t
       WHERE t.tsl_src_doc_id = ${poId}::uuid AND t.tsl_event = 'AMENDED' AND NOT t.tsl_is_deleted ORDER BY t.tsl_seq_no DESC LIMIT 1`;
        const [names2] = await db.$queryRaw `
      SELECT (SELECT gdl_name FROM inventory.godown_locations WHERE gdl_id = ${header.poDeliverGodownId}::uuid) AS godown,
             (SELECT pag_name FROM purchase.pur_agent WHERE pag_id = ${header.poAgentId}::uuid) AS agent,
             (SELECT pte_name FROM purchase.pur_terms WHERE pte_id = ${header.poTermsId}::uuid) AS terms`;
        const charges = await db.$queryRaw `
      SELECT cd_id AS "cdId", cd_slno AS "slNo", cd_chg_id AS "chgId", cd_chg_name AS "chgName", cd_role AS "role", cd_type AS "type", cd_method AS "method",
             cd_rate AS "rate", cd_amount AS "amount", CASE WHEN cd_type = 'DEDUCT' THEN -cd_amount ELSE cd_amount END AS "signedAmount", cd_on_bill AS "onBill"
        FROM public.txn_charge_detail
       WHERE cd_doc_type = 'PURCHASE_ORDER' AND cd_doc_id = ${poId}::uuid AND cd_acc_year = ${accYear}::bpchar AND NOT cd_is_deleted ORDER BY cd_slno`;
        let recdValue = purchase_doc_helpers_1.ZERO, pendValue = purchase_doc_helpers_1.ZERO, closedValue = purchase_doc_helpers_1.ZERO, closedLines = 0;
        const outLines = lines.map((l) => {
            const f = l.poiToBaseFactor.isZero() ? (0, purchase_doc_helpers_1.D)(1) : l.poiToBaseFactor;
            const received = (used.get(l.poiId) ?? purchase_doc_helpers_1.ZERO).dividedBy(f).toDecimalPlaces(6);
            const pendingRaw = l.poiQty.minus(received).minus(l.poiShortClosedQty);
            const pending = pendingRaw.isNegative() ? purchase_doc_helpers_1.ZERO : pendingRaw;
            const unit = l.poiQty.isZero() ? purchase_doc_helpers_1.ZERO : l.poiTotalAmt.dividedBy(l.poiQty);
            recdValue = recdValue.plus(client_1.Prisma.Decimal.min(received, l.poiQty).times(unit));
            pendValue = pendValue.plus(pending.times(unit));
            if (l.poiShortClosedQty.greaterThan(0)) {
                closedLines++;
                closedValue = closedValue.plus(l.poiShortClosedQty.times(unit));
            }
            return { ...l, ...names.get(l.poiUomId), receivedQty: received.toString(), pendingQty: pending.toString(),
                lineStatus: poLineStatus(l.poiQty, received, l.poiShortClosedQty) };
        });
        const docStatus = poDocStatus(header.poStatus, header.poApprovalStatus, outLines.map((l) => l.lineStatus));
        const net = header.poNetAmt, chg = header.poChargesAmt ?? purchase_doc_helpers_1.ZERO;
        return (0, purchase_doc_helpers_1.jsonSafe)({
            header: { ...header, supplierName: sup?.sup_name ?? null, approvedBy: appr?.by ?? null, approvedOn: appr?.on ?? null, approvalRemarks: appr?.remarks ?? null,
                deliverGodownName: names2?.godown ?? null, agentName: names2?.agent ?? null, termsName: names2?.terms ?? null, revisionNo: header.poRevisionNo ?? 1,
                lastAmendReason: amend?.remarks ?? null, docStatus },
            lines: outLines,
            charges,
            totals: { lines: outLines.length, orderedValue: net.toFixed(2), receivedValue: (0, purchase_doc_helpers_1.r2)(recdValue).toFixed(2), pendingValue: (0, purchase_doc_helpers_1.r2)(pendValue).toFixed(2),
                shortClosedLines: closedLines, shortClosedValue: (0, purchase_doc_helpers_1.r2)(closedValue).toFixed(2), chargesEstimate: chg.toFixed(2), poTotal: net.plus(chg).toFixed(2) },
        });
    }
    async cancel(dto) {
        const actor = this.actor();
        await this.prisma.$transaction(async (tx) => {
            const cur = await tx.purOrder.findFirst({ where: { poId: dto.poId, poAccYear: dto.accYear, poIsDeleted: false } });
            if (!cur)
                (0, purchase_errors_1.purNotFound)(`Purchase order ${dto.poId} not found`);
            const used = await poUsedQty(tx, dto.poId);
            if ([...used.values()].some((q) => q.greaterThan(0)))
                (0, purchase_errors_1.purConflict)(`${cur.poRefno} has goods received against it — short-close the rest instead.`, purchase_errors_1.PUR.NOT_DRAFT, 'poId');
            await tx.purOrder.update({ where: { poId_poAccYear: { poId: dto.poId, poAccYear: dto.accYear } }, data: { poStatus: 'CANCELLED', poModifiedBy: actor, poModifiedOn: new Date() } });
            await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: cur.poCompanyId, branchId: cur.poBranchId, accYear: dto.accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.PURCHASE_ORDER, docId: dto.poId, refno: cur.poRefno, event: purchase_doc_helpers_1.TxnStatusEvent.CANCELLED, from: cur.poStatus, to: 'CANCELLED', actor, remarks: dto.reason });
        });
        return this.get(dto.poId, dto.accYear);
    }
    async shortClose(dto) {
        const actor = this.actor();
        await this.prisma.$transaction(async (tx) => {
            const cur = await tx.purOrder.findFirst({ where: { poId: dto.poId, poAccYear: dto.accYear, poIsDeleted: false } });
            if (!cur)
                (0, purchase_errors_1.purNotFound)(`Purchase order ${dto.poId} not found`);
            if (cur.poStatus !== 'POSTED')
                (0, purchase_errors_1.purConflict)(`${cur.poRefno} is ${cur.poStatus} — only a confirmed PO is short-closed.`, purchase_errors_1.PUR.NOT_POSTED, 'poId');
            const closed = await shortCloseIn(tx, dto.poId, dto.accYear, dto.reason, actor, dto.lineIds);
            if (!closed)
                (0, purchase_errors_1.purConflict)('Nothing is pending on this PO.', purchase_errors_1.PUR.QTY_INVALID, 'poId');
            if (!dto.lineIds?.length)
                await tx.purOrder.update({ where: { poId_poAccYear: { poId: dto.poId, poAccYear: dto.accYear } }, data: { poIsShortClosed: true, poShortCloseReason: dto.reason, poModifiedBy: actor, poModifiedOn: new Date() } });
            await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: cur.poCompanyId, branchId: cur.poBranchId, accYear: dto.accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.PURCHASE_ORDER, docId: dto.poId, refno: cur.poRefno, event: purchase_doc_helpers_1.TxnStatusEvent.CLOSED, from: cur.poStatus, to: cur.poStatus, actor, remarks: `Short-closed: ${dto.reason}` });
        });
        return this.get(dto.poId, dto.accYear);
    }
    async approve(dto) {
        const actor = this.actor();
        const approve = dto.approve !== false;
        if (!approve && !dto.reason?.trim())
            (0, purchase_errors_1.purRefuse)('Say why the PO is not approved.', purchase_errors_1.PUR.QTY_INVALID, 'reason');
        await this.prisma.$transaction(async (tx) => {
            const cur = await tx.purOrder.findFirst({ where: { poId: dto.poId, poAccYear: dto.accYear, poIsDeleted: false } });
            if (!cur)
                (0, purchase_errors_1.purNotFound)(`Purchase order ${dto.poId} not found`);
            if (cur.poStatus !== 'POSTED' || cur.poApprovalStatus !== 'AWAITING')
                (0, purchase_errors_1.purConflict)(`${cur.poRefno} is not waiting for approval.`, 'PUR_PO_NOT_AWAITING', 'poId');
            await tx.purOrder.update({ where: { poId_poAccYear: { poId: dto.poId, poAccYear: dto.accYear } },
                data: { poApprovalStatus: approve ? 'APPROVED' : 'REJECTED', poModifiedBy: actor, poModifiedOn: new Date() } });
            await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: cur.poCompanyId, branchId: cur.poBranchId, accYear: dto.accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.PURCHASE_ORDER, docId: dto.poId,
                refno: cur.poRefno, event: approve ? purchase_doc_helpers_1.TxnStatusEvent.APPROVED : purchase_doc_helpers_1.TxnStatusEvent.REJECTED, from: 'POSTED', to: 'POSTED', actor,
                remarks: (dto.reason?.trim() || (approve ? `Approved at ${cur.poNetAmt.toFixed(2)}` : '')).slice(0, 250) });
        });
        return this.get(dto.poId, dto.accYear);
    }
    async clone(dto) {
        const actor = this.actor();
        const src = await this.getDoc(this.prisma, dto.poId, dto.accYear);
        const h = src.header;
        const save = {
            header: { companyId: String(h.poCompanyId), branchId: String(h.poBranchId), accYear: dto.toAccYear ?? dto.accYear, deviceId: dto.deviceId,
                supplierId: String(h.poSupplierId), docDate: dto.docDate ?? today(), godownId: h.poDeliverGodownId ?? undefined,
                creditDays: h.poCreditDays ?? undefined, contact: h.poContact ?? undefined, agentId: h.poAgentId ?? undefined,
                termsText: h.poTermsText ?? undefined, termsId: (await (0, purchase_terms_1.pickableTermsId)(this.prisma, h.poTermsId, String(h.poCompanyId))) ?? undefined, remarks: `Copy of ${h.poRefno}`.slice(0, 500) },
            charges: (src.charges ?? []).map((c) => ({ chgId: String(c.chgId), rate: Number(c.rate), amount: Number(c.amount) })),
            lines: src.lines.map((l, i) => ({ lineNo: i + 1, itemId: String(l.poiItemId), uomId: String(l.poiUomId), qty: Number(l.poiQty), freeQty: Number(l.poiFreeQty ?? 0),
                rate: Number(l.poiRate), discPct: Number(l.poiDiscPct ?? 0), schPct: Number(l.poiSchPct ?? 0), taxId: l.poiTaxId ?? undefined,
                mrp: l.poiMrp != null ? Number(l.poiMrp) : undefined, weight: l.poiWeight != null ? Number(l.poiWeight) : undefined, remarks: l.poiRemarks ?? undefined })),
        };
        const id = await this.prisma.$transaction(async (tx) => this.saveIn(tx, save, actor, { auditNote: `Cloned from ${h.poRefno}` }), { timeout: 60000, maxWait: 10000 });
        return this.get(id, save.header.accYear);
    }
    async merge(dto) {
        const actor = this.actor();
        const keys = new Set(dto.sources.map((x) => `${x.poId}|${x.accYear}`));
        if (keys.size < 2)
            (0, purchase_errors_1.purRefuse)('Pick at least two different purchase orders to merge.', purchase_errors_1.PUR.QTY_INVALID, 'sources');
        const id = await this.prisma.$transaction(async (tx) => {
            const srcs = [];
            for (const x of dto.sources) {
                const po = await tx.purOrder.findFirst({ where: { poId: x.poId, poAccYear: x.accYear, poIsDeleted: false } });
                if (!po)
                    (0, purchase_errors_1.purNotFound)(`Purchase order ${x.poId} not found`);
                if (po.poStatus !== 'POSTED')
                    (0, purchase_errors_1.purConflict)(`${po.poRefno} is ${po.poStatus} — only confirmed orders are merged.`, purchase_errors_1.PUR.NOT_POSTED, 'sources');
                srcs.push(po);
            }
            const first = srcs[0];
            for (const po of srcs) {
                if (po.poSupplierId !== first.poSupplierId)
                    (0, purchase_errors_1.purConflict)(`${po.poRefno} is from another supplier — merge one supplier's orders only.`, 'PUR_SUPPLIER_MISMATCH', 'sources');
                if (po.poCompanyId !== first.poCompanyId || po.poBranchId !== first.poBranchId)
                    (0, purchase_errors_1.purConflict)(`${po.poRefno} is from another branch.`, 'PUR_BRANCH_MISMATCH', 'sources');
            }
            const merged = new Map();
            for (const po of srcs) {
                const used = await poUsedQty(tx, po.poId);
                const lines = await tx.purOrderItem.findMany({ where: { poiPoId: po.poId, poiAccYear: po.poAccYear, poiIsDeleted: false }, orderBy: { poiLineNo: 'asc' } });
                for (const l of lines) {
                    const f = l.poiToBaseFactor.isZero() ? (0, purchase_doc_helpers_1.D)(1) : l.poiToBaseFactor;
                    const pending = l.poiQty.minus((used.get(l.poiId) ?? purchase_doc_helpers_1.ZERO).dividedBy(f)).minus(l.poiShortClosedQty);
                    if (!pending.greaterThan(0))
                        continue;
                    const k = [l.poiItemId, l.poiUomId, l.poiRate.toString(), l.poiDiscPct.toString(), l.poiSchPct.toString(), l.poiTaxId ?? ''].join('|');
                    const a = merged.get(k);
                    if (a)
                        a.qty = a.qty.plus(pending);
                    else
                        merged.set(k, { itemId: l.poiItemId, uomId: l.poiUomId, qty: pending, rate: l.poiRate, discPct: l.poiDiscPct, schPct: l.poiSchPct, taxId: l.poiTaxId, mrp: l.poiMrp, weight: l.poiWeight });
                }
            }
            if (!merged.size)
                (0, purchase_errors_1.purConflict)('Nothing is pending on these orders.', purchase_errors_1.PUR.QTY_INVALID, 'sources');
            const refs = srcs.map((p) => p.poRefno);
            const save = {
                header: { companyId: first.poCompanyId, branchId: first.poBranchId, accYear: dto.accYear, deviceId: dto.deviceId, supplierId: first.poSupplierId,
                    docDate: dto.docDate ?? today(), godownId: first.poDeliverGodownId ?? undefined, creditDays: first.poCreditDays ?? undefined,
                    remarks: `Merged from ${refs.join(', ')}`.slice(0, 500) },
                lines: [...merged.values()].map((a, i) => ({ lineNo: i + 1, itemId: a.itemId, uomId: a.uomId, qty: Number(a.qty.toDecimalPlaces(6)), rate: Number(a.rate),
                    discPct: Number(a.discPct), schPct: Number(a.schPct), taxId: a.taxId ?? undefined, mrp: a.mrp != null ? Number(a.mrp) : undefined, weight: a.weight != null ? Number(a.weight) : undefined })),
            };
            const newId = await this.saveIn(tx, save, actor, { auditNote: `Merged from ${refs.join(', ')}` });
            const [nw] = await tx.$queryRaw `SELECT po_refno FROM purchase.pur_order WHERE po_id = ${newId}::uuid`;
            for (const po of srcs) {
                const reason = `Merged into ${nw.po_refno}`;
                await shortCloseIn(tx, po.poId, po.poAccYear, reason, actor);
                await tx.purOrder.update({ where: { poId_poAccYear: { poId: po.poId, poAccYear: po.poAccYear } }, data: { poIsShortClosed: true, poShortCloseReason: reason, poModifiedBy: actor, poModifiedOn: new Date() } });
                await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: po.poCompanyId, branchId: po.poBranchId, accYear: po.poAccYear, docType: purchase_doc_helpers_1.TxnStatusDocType.PURCHASE_ORDER, docId: po.poId, refno: po.poRefno,
                    event: purchase_doc_helpers_1.TxnStatusEvent.CLOSED, from: 'POSTED', to: 'POSTED', actor, deviceId: dto.deviceId, remarks: reason });
            }
            return newId;
        }, { timeout: 60000, maxWait: 10000 });
        return this.get(id, dto.accYear);
    }
    async revisions(poId) {
        const rows = await this.prisma.$queryRaw `
      SELECT l.log_rev_no AS "revNo", l.log_date AS "savedOn", l.log_action::text AS "action", l.log_notes AS "notes",
             COALESCE(u.usr_login_name, l.log_user_id::text) AS "savedBy", l.log_original_record AS "before", l.log_modified_record AS "after"
        FROM audit.audit_log l LEFT JOIN public.user_master u ON u.usr_id = l.log_user_id
       WHERE l.log_table_name = 'pur_order' AND l.log_pk = ${poId} AND l.log_rev_no IS NOT NULL
       ORDER BY l.log_rev_no DESC`;
        return (0, purchase_doc_helpers_1.jsonSafe)(rows);
    }
    async pendingLines(q) {
        const rows = await this.prisma.$queryRaw `
      WITH used AS (
        SELECT gri.gri_src_item_id AS id, SUM((gri.gri_received_qty + gri.gri_damaged_qty) * gri.gri_to_base_factor) AS q
          FROM purchase.pur_grn_item gri JOIN purchase.pur_grn g ON g.grn_id = gri.gri_grn_id AND g.grn_acc_year = gri.gri_acc_year
         WHERE gri.gri_src_doc_type = 'PURCHASE_ORDER' AND NOT gri.gri_is_deleted AND NOT g.grn_is_deleted AND g.grn_status <> 'CANCELLED' GROUP BY 1
        UNION ALL
        SELECT pii.pii_src_item_id, SUM(pii.pii_billed_qty * pii.pii_to_base_factor)
          FROM purchase.pur_invoice_item pii JOIN purchase.pur_invoice p ON p.pi_id = pii.pii_pi_id AND p.pi_acc_year = pii.pii_acc_year
         WHERE pii.pii_src_doc_type = 'PURCHASE_ORDER' AND NOT pii.pii_is_deleted AND NOT p.pi_is_deleted AND p.pi_status <> 'CANCELLED' GROUP BY 1)
      SELECT po.po_id AS "poId", po.po_acc_year AS "accYear", po.po_refno AS "refno", po.po_doc_date AS "docDate",
             poi.poi_id AS "poiId", poi.poi_line_no AS "lineNo", poi.poi_item_id AS "itemId", im.item_name_en AS "itemName",
             poi.poi_uom_id AS "uomId", u.unit_name AS "unitName", poi.poi_rate AS "rate", poi.poi_disc_pct AS "discPct", poi.poi_sch_pct AS "schPct",
             poi.poi_tax_id AS "taxId", poi.poi_mrp AS "mrp", poi.poi_qty AS "orderedQty",
             poi.poi_qty - COALESCE((SELECT SUM(q) FROM used WHERE used.id = poi.poi_id), 0) / NULLIF(poi.poi_to_base_factor, 0) - poi.poi_short_closed_qty AS "pendingQty"
        FROM purchase.pur_order po
        JOIN purchase.pur_order_item poi ON poi.poi_po_id = po.po_id AND poi.poi_acc_year = po.po_acc_year AND NOT poi.poi_is_deleted
        JOIN inventory.item_master im ON im.item_id = poi.poi_item_id
        JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = poi.poi_uom_id
        JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE po.po_company_id = ${q.companyId}::uuid AND po.po_branch_id = ${q.branchId}::uuid AND po.po_supplier_id = ${q.supplierId}::uuid
         AND po.po_status = 'POSTED' AND NOT po.po_is_deleted AND po.po_approval_status NOT IN ('AWAITING', 'REJECTED')
       ORDER BY po.po_doc_date, po.po_refno, poi.poi_line_no`;
        return (0, purchase_doc_helpers_1.jsonSafe)(rows.filter((r) => (0, purchase_doc_helpers_1.D)(r.pendingQty).greaterThan(0)));
    }
};
exports.PurchaseOrderService = PurchaseOrderService;
exports.PurchaseOrderService = PurchaseOrderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, request_context_service_1.RequestContextService, audit_log_service_1.AuditLogService])
], PurchaseOrderService);
let PurchaseOrderController = class PurchaseOrderController {
    service;
    prisma;
    ctx;
    constructor(service, prisma, ctx) {
        this.service = service;
        this.prisma = prisma;
        this.ctx = ctx;
    }
    async right(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, { userId: this.ctx.getUserId(), menuId: exports.PURCHASE_ORDER_MENU_ID, right, codePrefix: 'PO', action });
    }
    async save(dto) {
        await this.right(dto.header.poId ? 'edit' : 'create', 'save a purchase order');
        if (dto.header.post)
            await this.right('post', 'confirm a purchase order');
        if (dto.header.poId) {
            const [cur] = await this.prisma.$queryRaw `SELECT po_status FROM purchase.pur_order WHERE po_id = ${dto.header.poId}::uuid AND po_acc_year = ${dto.header.accYear}`;
            if (cur?.po_status === 'POSTED')
                await this.right('amend', 'amend a confirmed purchase order');
        }
        const data = await this.service.save(dto);
        return { success: true, message: `Purchase order ${data.header.poRefno} ${dto.header.post ? 'confirmed' : 'saved'}`, data };
    }
    async validate(dto) {
        await this.right('view', 'check a purchase order');
        return { success: true, message: 'Purchase order calculated', data: await this.service.preview(dto) };
    }
    async get(q) {
        await this.right('view', 'open a purchase order');
        return { success: true, message: 'Purchase order fetched', data: await this.service.get(q.poId, q.accYear) };
    }
    async pending(q) {
        await this.right('view', 'read pending purchase orders');
        return { success: true, message: 'Pending PO lines', data: await this.service.pendingLines(q) };
    }
    async cancel(dto) {
        await this.right('cancel', 'cancel a purchase order');
        const data = await this.service.cancel(dto);
        return { success: true, message: `Purchase order ${data.header.poRefno} cancelled`, data };
    }
    async shortClose(dto) {
        await this.right('edit', 'short-close a purchase order');
        const data = await this.service.shortClose(dto);
        return { success: true, message: `Purchase order ${data.header.poRefno} short-closed`, data };
    }
    async approve(dto) {
        await this.right('override', 'approve a purchase order');
        const data = await this.service.approve(dto);
        return { success: true, message: `Purchase order ${data.header.poRefno} ${dto.approve === false ? 'not approved' : 'approved'}`, data };
    }
    async clone(dto) {
        await this.right('create', 'copy a purchase order');
        const data = await this.service.clone(dto);
        return { success: true, message: `Purchase order ${data.header.poRefno} made from the copy`, data };
    }
    async merge(dto) {
        await this.right('create', 'merge purchase orders');
        await this.right('edit', 'short-close the merged purchase orders');
        const data = await this.service.merge(dto);
        return { success: true, message: `Purchase order ${data.header.poRefno} made from ${dto.sources.length} orders`, data };
    }
    async revisions(q) {
        await this.right('view', 'read the history of a purchase order');
        return { success: true, message: 'Purchase order revisions', data: await this.service.revisions(q.poId) };
    }
};
exports.PurchaseOrderController = PurchaseOrderController;
__decorate([
    (0, common_1.Post)('save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Save a PO draft; header.post = true confirms it (open for GRNs / bills).' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SavePurchaseOrderDto]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'The server\'s figures for a PO being keyed — line taxable / tax / total and the totals. Writes nothing.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SavePurchaseOrderDto]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "validate", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'A PO with received / pending per line (derived).' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PurchaseOrderRefDto]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('pending-lines'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'A supplier\'s confirmed PO lines with qty still pending.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PendingPoLinesQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "pending", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a PO nothing has been received against.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PurchaseOrderReasonDto]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('short-close'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Close what is still pending (all lines, or lineIds), with a reason.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PurchaseOrderReasonDto]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "shortClose", null);
__decorate([
    (0, common_1.Post)('approve'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Approve (approve:false = reject, with a reason) a PO waiting for approval — purchase.po_approval_above.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PurchaseOrderApproveDto]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)('clone'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'A new draft PO with the lines of this one (DOC-01).' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ClonePurchaseOrderDto]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "clone", null);
__decorate([
    (0, common_1.Post)('merge'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'The pending of several confirmed POs of one supplier → one new draft; the sources are short-closed (DOC-01).' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [MergePurchaseOrdersDto]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "merge", null);
__decorate([
    (0, common_1.Get)('revisions'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Every saved version of a PO, newest first, before / after (audit log).' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PurchaseOrderRefDto]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "revisions", null);
exports.PurchaseOrderController = PurchaseOrderController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — Order'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase/orders'),
    __metadata("design:paramtypes", [PurchaseOrderService, prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseOrderController);
//# sourceMappingURL=purchase-order.js.map