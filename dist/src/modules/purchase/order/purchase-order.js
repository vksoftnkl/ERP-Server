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
exports.PurchaseOrderController = exports.PurchaseOrderService = exports.PendingPoLinesQueryDto = exports.PurchaseOrderReasonDto = exports.PurchaseOrderRefDto = exports.SavePurchaseOrderDto = exports.PurchaseOrderHeaderDto = exports.PurchaseOrderLineDto = exports.PURCHASE_ORDER_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const api_version_1 = require("../../../common/constants/api-version");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const purchase_calc_1 = require("../common/purchase-calc");
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
    contact;
    termsText;
    remarks;
    post;
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
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "contact", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PurchaseOrderHeaderDto.prototype, "termsText", void 0);
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
class SavePurchaseOrderDto {
    header;
    lines;
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
let PurchaseOrderService = class PurchaseOrderService {
    prisma;
    ctx;
    constructor(prisma, ctx) {
        this.prisma = prisma;
        this.ctx = ctx;
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
        const calc = (0, purchase_calc_1.calcPurchase)({
            interState: inter, roundOffStep: 0,
            lines: dto.lines.map((l) => ({ key: String(l.lineNo), billedQty: l.qty, freeQty: l.freeQty ?? 0, rate: l.rate, discPct: l.discPct, schPct: l.schPct,
                gstPct: l.taxId ? taxes.get(l.taxId)?.tax_rate_perc ?? 0 : 0, toBaseFactor: units.get(l.uomId).iuc_to_base_factor, weight: l.weight ?? 0 })),
        });
        return { sup, units, calc };
    }
    async preview(dto) {
        const { calc } = await this.compute(this.prisma, dto);
        const tax = calc.cgst.plus(calc.sgst).plus(calc.igst).plus(calc.cess);
        return (0, purchase_doc_helpers_1.jsonSafe)({
            lines: calc.lines.map((o) => ({ key: o.key, gross: o.gross, discAmt: o.discAmt, taxable: o.taxable, gstPct: o.gstPct, tax: o.cgst.plus(o.sgst).plus(o.igst).plus(o.cess), total: o.total })),
            totals: { gross: calc.gross, taxable: calc.taxable, tax, net: calc.taxable.plus(tax) },
        });
    }
    async save(dto) {
        const actor = this.actor();
        const h = dto.header;
        const id = await this.prisma.$transaction(async (tx) => {
            const { sup, units, calc } = await this.compute(tx, dto);
            let poId = h.poId ?? null;
            let slno, refno, isNew = false;
            if (poId) {
                const cur = await tx.purOrder.findFirst({ where: { poId, poAccYear: h.accYear, poIsDeleted: false } });
                if (!cur)
                    (0, purchase_errors_1.purNotFound)(`Purchase order ${poId} not found`);
                if (cur.poStatus !== 'DRAFT') {
                    const used = await this.usedQty(tx, poId);
                    if ([...used.values()].some((q) => q.greaterThan(0)))
                        (0, purchase_errors_1.purConflict)(`${cur.poRefno} has goods received against it — raise qty or short-close instead.`, purchase_errors_1.PUR.NOT_DRAFT, 'poId');
                }
                slno = cur.poSlno;
                refno = cur.poRefno;
                await tx.purOrderItem.deleteMany({ where: { poiPoId: poId, poiAccYear: h.accYear } });
            }
            else {
                ({ slno, refno } = await (0, purchase_doc_helpers_1.allocateDocNumber)(tx, 'PO', h.companyId, h.branchId, h.accYear, h.deviceId));
                isNew = true;
            }
            const tax = calc.cgst.plus(calc.sgst).plus(calc.igst).plus(calc.cess);
            const data = {
                poCompanyId: h.companyId, poBranchId: h.branchId, poAccYear: h.accYear, poDeviceId: h.deviceId, poSlno: slno, poRefno: refno,
                poDocDate: new Date(`${h.docDate}T00:00:00Z`), poSupplierId: h.supplierId, poExpectedDate: h.expectedDate ? new Date(`${h.expectedDate}T00:00:00Z`) : null,
                poDeliverGodownId: h.godownId ?? null, poContact: h.contact ?? null, poCreditDays: h.creditDays ?? sup.sup_credit_days ?? null,
                poTermsText: h.termsText ?? null, poGrossAmt: calc.gross, poTaxableAmt: calc.taxable, poTaxAmt: tax, poNetAmt: calc.taxable.plus(tax),
                poRemarks: h.remarks ?? null, poStatus: h.post ? 'POSTED' : 'DRAFT',
            };
            if (isNew)
                poId = (await tx.purOrder.create({ data: { ...data, poCreatedBy: actor }, select: { poId: true } })).poId;
            else
                await tx.purOrder.update({ where: { poId_poAccYear: { poId: poId, poAccYear: h.accYear } }, data: { ...data, poModifiedBy: actor, poModifiedOn: new Date(), poRevisionNo: { increment: 1 } } });
            for (let i = 0; i < dto.lines.length; i++) {
                const l = dto.lines[i], o = calc.lines[i], u = units.get(l.uomId);
                await tx.purOrderItem.create({ data: {
                        poiPoId: poId, poiCompanyId: h.companyId, poiBranchId: h.branchId, poiAccYear: h.accYear, poiLineNo: l.lineNo,
                        poiItemId: l.itemId, poiUomId: l.uomId, poiBaseUomId: u.base_iuc_id, poiToBaseFactor: u.iuc_to_base_factor, poiHsnCode: u.item_hsn_code,
                        poiWeight: l.weight ?? null, poiQty: (0, purchase_doc_helpers_1.D)(l.qty), poiFreeQty: (0, purchase_doc_helpers_1.D)(l.freeQty), poiRate: (0, purchase_doc_helpers_1.D)(l.rate), poiDiscPct: (0, purchase_doc_helpers_1.D)(l.discPct), poiDiscAmt: o.discAmt,
                        poiSchPct: (0, purchase_doc_helpers_1.D)(l.schPct), poiSchAmt: o.schAmt, poiGrossAmt: o.gross, poiTaxableAmt: o.taxable, poiTaxId: l.taxId ?? null, poiGstPct: o.gstPct,
                        poiCgstAmt: o.cgst, poiSgstAmt: o.sgst, poiIgstAmt: o.igst, poiCessAmt: o.cess, poiTotalAmt: o.total, poiMrp: l.mrp ?? null,
                        poiRemarks: l.remarks ?? null, poiCreatedBy: actor,
                    } });
            }
            if (isNew)
                await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.PURCHASE_ORDER, docId: poId, refno, event: purchase_doc_helpers_1.TxnStatusEvent.CREATED, from: null, to: 'DRAFT', actor, deviceId: h.deviceId });
            if (h.post)
                await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.PURCHASE_ORDER, docId: poId, refno, event: purchase_doc_helpers_1.TxnStatusEvent.POSTED, from: 'DRAFT', to: 'POSTED', actor, deviceId: h.deviceId });
            return poId;
        }, { timeout: 60000, maxWait: 10000 });
        return this.get(id, h.accYear);
    }
    async usedQty(tx, poId) {
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
    async get(poId, accYear) {
        const header = await this.prisma.purOrder.findFirst({ where: { poId, poAccYear: accYear, poIsDeleted: false } });
        if (!header)
            (0, purchase_errors_1.purNotFound)(`Purchase order ${poId} not found`);
        const lines = await this.prisma.purOrderItem.findMany({ where: { poiPoId: poId, poiAccYear: accYear, poiIsDeleted: false }, orderBy: { poiLineNo: 'asc' } });
        const used = await this.usedQty(this.prisma, poId);
        const [sup] = await this.prisma.$queryRaw `SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${header.poSupplierId}::uuid`;
        const names = await (0, purchase_doc_helpers_1.unitNames)(this.prisma, lines.map((l) => l.poiUomId));
        return (0, purchase_doc_helpers_1.jsonSafe)({
            header: { ...header, supplierName: sup?.sup_name ?? null },
            lines: lines.map((l) => {
                const f = l.poiToBaseFactor.isZero() ? (0, purchase_doc_helpers_1.D)(1) : l.poiToBaseFactor;
                const received = (used.get(l.poiId) ?? purchase_doc_helpers_1.ZERO).dividedBy(f).toDecimalPlaces(6);
                const pending = l.poiQty.minus(received).minus(l.poiShortClosedQty);
                return { ...l, ...names.get(l.poiUomId), receivedQty: received.toString(), pendingQty: (pending.isNegative() ? purchase_doc_helpers_1.ZERO : pending).toString() };
            }),
        });
    }
    async cancel(dto) {
        const actor = this.actor();
        await this.prisma.$transaction(async (tx) => {
            const cur = await tx.purOrder.findFirst({ where: { poId: dto.poId, poAccYear: dto.accYear, poIsDeleted: false } });
            if (!cur)
                (0, purchase_errors_1.purNotFound)(`Purchase order ${dto.poId} not found`);
            const used = await this.usedQty(tx, dto.poId);
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
            const used = await this.usedQty(tx, dto.poId);
            const lines = await tx.purOrderItem.findMany({ where: { poiPoId: dto.poId, poiAccYear: dto.accYear, poiIsDeleted: false } });
            let closed = 0;
            for (const l of lines) {
                if (dto.lineIds?.length && !dto.lineIds.includes(l.poiId))
                    continue;
                const f = l.poiToBaseFactor.isZero() ? (0, purchase_doc_helpers_1.D)(1) : l.poiToBaseFactor;
                const pending = l.poiQty.minus((used.get(l.poiId) ?? purchase_doc_helpers_1.ZERO).dividedBy(f)).minus(l.poiShortClosedQty);
                if (!pending.greaterThan(0))
                    continue;
                await tx.purOrderItem.update({ where: { poiId_poiAccYear: { poiId: l.poiId, poiAccYear: dto.accYear } },
                    data: { poiShortClosedQty: l.poiShortClosedQty.plus(pending), poiShortCloseReason: dto.reason, poiModifiedBy: actor, poiModifiedOn: new Date() } });
                closed++;
            }
            if (!closed)
                (0, purchase_errors_1.purConflict)('Nothing is pending on this PO.', purchase_errors_1.PUR.QTY_INVALID, 'poId');
            if (!dto.lineIds?.length)
                await tx.purOrder.update({ where: { poId_poAccYear: { poId: dto.poId, poAccYear: dto.accYear } }, data: { poIsShortClosed: true, poShortCloseReason: dto.reason, poModifiedBy: actor, poModifiedOn: new Date() } });
            await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: cur.poCompanyId, branchId: cur.poBranchId, accYear: dto.accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.PURCHASE_ORDER, docId: dto.poId, refno: cur.poRefno, event: purchase_doc_helpers_1.TxnStatusEvent.CLOSED, from: cur.poStatus, to: cur.poStatus, actor, remarks: `Short-closed: ${dto.reason}` });
        });
        return this.get(dto.poId, dto.accYear);
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
         AND po.po_status = 'POSTED' AND NOT po.po_is_deleted
       ORDER BY po.po_doc_date, po.po_refno, poi.poi_line_no`;
        return (0, purchase_doc_helpers_1.jsonSafe)(rows.filter((r) => (0, purchase_doc_helpers_1.D)(r.pendingQty).greaterThan(0)));
    }
};
exports.PurchaseOrderService = PurchaseOrderService;
exports.PurchaseOrderService = PurchaseOrderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
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
exports.PurchaseOrderController = PurchaseOrderController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — Order'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase/orders'),
    __metadata("design:paramtypes", [PurchaseOrderService, prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseOrderController);
//# sourceMappingURL=purchase-order.js.map