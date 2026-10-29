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
exports.PurchaseLabelsController = exports.PurchaseGrnController = exports.PurchaseGrnService = exports.GrnCancelDto = exports.LabelsFromDocDto = exports.GrnRefDto = exports.SaveGrnDto = exports.GrnHeaderDto = exports.GrnLineDto = exports.GRN_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const purchase_order_1 = require("../order/purchase-order");
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
const selling_price_bulk_service_1 = require("../../stocks/selling-price-bulk/selling-price-bulk.service");
const purchase_settings_1 = require("../common/purchase-settings");
const purchase_calc_1 = require("../common/purchase-calc");
const purchase_errors_1 = require("../common/purchase.errors");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
const save_purchase_invoice_dto_1 = require("../invoice/dto/save-purchase-invoice.dto");
exports.GRN_MENU_ID = 196;
const DOC = 'GRN';
class GrnLineDto {
    lineNo;
    itemId;
    uomId;
    poItemId;
    poItemAccYear;
    challanQty;
    receivedQty;
    damagedQty;
    damageReasonId;
    freeQty;
    excessQty;
    excessAction;
    rate;
    mrp;
    sellA;
    sellB;
    sellC;
    sellD;
    weight;
    remarks;
    allocs;
}
exports.GrnLineDto = GrnLineDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GrnLineDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GrnLineDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GrnLineDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The PO line it receives (pur_order_item.poi_id).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GrnLineDto.prototype, "poItemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], GrnLineDto.prototype, "poItemAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'What the challan / bill says came.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GrnLineDto.prototype, "challanQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GrnLineDto.prototype, "receivedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GrnLineDto.prototype, "damagedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GrnLineDto.prototype, "damageReasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GrnLineDto.prototype, "freeQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GrnLineDto.prototype, "excessQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['HOLD_FOR_BILL', 'RETURN', 'KEEP_FREE'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['HOLD_FOR_BILL', 'RETURN', 'KEEP_FREE']),
    __metadata("design:type", String)
], GrnLineDto.prototype, "excessAction", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Provisional net rate per unit, without tax (default: the PO line\'s).' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GrnLineDto.prototype, "rate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], GrnLineDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], GrnLineDto.prototype, "sellA", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'price_set_at = GRN: price level B written at post.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], GrnLineDto.prototype, "sellB", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'price_set_at = GRN: price level C written at post.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], GrnLineDto.prototype, "sellC", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'price_set_at = GRN: price level D written at post.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], GrnLineDto.prototype, "sellD", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], GrnLineDto.prototype, "weight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], GrnLineDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [save_purchase_invoice_dto_1.PurchaseAllocDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_purchase_invoice_dto_1.PurchaseAllocDto),
    __metadata("design:type", Array)
], GrnLineDto.prototype, "allocs", void 0);
class GrnHeaderDto {
    grnId;
    companyId;
    branchId;
    accYear;
    deviceId;
    supplierId;
    godownId;
    docDate;
    receivedAt;
    challanNo;
    challanDate;
    supplierInvNo;
    receivedBy;
    payCoolie;
    supervisorId;
    vehicleNo;
    driverName;
    ewbNo;
    packagesSent;
    packagesReceived;
    remarks;
    post;
}
exports.GrnHeaderDto = GrnHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "grnId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "receivedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "challanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "challanDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "supplierInvNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Employees who received / unloaded (the coolie payees).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], GrnHeaderDto.prototype, "receivedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Pay the unloading coolie to receivedBy (default true when no charges are sent): the company\'s off-bill UNLOADING charge, split per loadman, owed to each one\'s staff ledger.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GrnHeaderDto.prototype, "payCoolie", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "supervisorId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "vehicleNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "driverName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(15),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "ewbNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GrnHeaderDto.prototype, "packagesSent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GrnHeaderDto.prototype, "packagesReceived", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GrnHeaderDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GrnHeaderDto.prototype, "post", void 0);
class SaveGrnDto {
    header;
    lines;
    charges;
}
exports.SaveGrnDto = SaveGrnDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: GrnHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GrnHeaderDto),
    __metadata("design:type", GrnHeaderDto)
], SaveGrnDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [GrnLineDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => GrnLineDto),
    __metadata("design:type", Array)
], SaveGrnDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [save_purchase_invoice_dto_1.PurchaseChargeDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_purchase_invoice_dto_1.PurchaseChargeDto),
    __metadata("design:type", Array)
], SaveGrnDto.prototype, "charges", void 0);
class GrnRefDto {
    grnId;
    accYear;
}
exports.GrnRefDto = GrnRefDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GrnRefDto.prototype, "grnId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], GrnRefDto.prototype, "accYear", void 0);
class LabelsFromDocDto {
    docType;
    docId;
    accYear;
}
exports.LabelsFromDocDto = LabelsFromDocDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['GRN', 'PURCHASE_BILL'] }),
    (0, class_validator_1.IsIn)(['GRN', 'PURCHASE_BILL']),
    __metadata("design:type", String)
], LabelsFromDocDto.prototype, "docType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], LabelsFromDocDto.prototype, "docId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], LabelsFromDocDto.prototype, "accYear", void 0);
class GrnCancelDto extends GrnRefDto {
    reason;
}
exports.GrnCancelDto = GrnCancelDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], GrnCancelDto.prototype, "reason", void 0);
let PurchaseGrnService = class PurchaseGrnService {
    prisma;
    ctx;
    vouchers;
    stockPosting;
    prices;
    constructor(prisma, ctx, vouchers, stockPosting, prices) {
        this.prisma = prisma;
        this.ctx = ctx;
        this.vouchers = vouchers;
        this.stockPosting = stockPosting;
        this.prices = prices;
    }
    actor() {
        const u = this.ctx.getUserId();
        if (!u)
            (0, purchase_errors_1.purRefuse)('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
        return u;
    }
    rules() { return (0, purchase_doc_helpers_1.stockRules)('IN', DOC, 'GRN', 'PURCHASE', purchase_doc_helpers_1.TxnStatusDocType.GRN); }
    async save(dto) {
        const actor = this.actor();
        const h = dto.header;
        const warnings = [];
        const id = await this.prisma.$transaction(async (tx) => {
            await (0, purchase_doc_helpers_1.supplierRow)(tx, h.supplierId);
            const units = await (0, purchase_doc_helpers_1.loadUnits)(tx, dto.lines.map((l) => l.uomId));
            const problems = [];
            dto.lines.forEach((l, i) => {
                const u = units.get(l.uomId);
                if (!u || u.iuc_item_id !== l.itemId)
                    problems.push({ field: `lines.${i}.uomId`, code: purchase_errors_1.PUR.UNIT_NOT_FOUND, message: `Line ${l.lineNo}: unit not found for the item` });
                if ((0, purchase_doc_helpers_1.D)(l.receivedQty).plus((0, purchase_doc_helpers_1.D)(l.damagedQty)).plus((0, purchase_doc_helpers_1.D)(l.freeQty)).isZero())
                    problems.push({ field: `lines.${i}.receivedQty`, code: purchase_errors_1.PUR.QTY_INVALID, message: `Line ${l.lineNo}: nothing received` });
            });
            if (problems.length)
                (0, purchase_errors_1.purRefuseMany)(problems[0].message, problems);
            const settings = await (0, purchase_settings_1.loadPurchaseSettings)(tx, h.companyId, h.branchId);
            const priceAtGrn = settings.allowPriceUpdate && settings.priceUpdate === 'UPDATE_PRICES' && settings.priceSetAt === 'GRN';
            const excessOf = [];
            for (let i = 0; i < dto.lines.length; i++) {
                const l = dto.lines[i];
                let excess = purchase_doc_helpers_1.ZERO;
                if (l.poItemId) {
                    const pendingBase = await this.poPendingBase(tx, l.poItemId, h.grnId ?? null);
                    const f = units.get(l.uomId).iuc_to_base_factor;
                    const inBase = (0, purchase_doc_helpers_1.D)(l.receivedQty).plus((0, purchase_doc_helpers_1.D)(l.damagedQty)).times(f);
                    if (pendingBase != null && inBase.greaterThan(pendingBase))
                        excess = inBase.minus(client_1.Prisma.Decimal.max(pendingBase, 0)).dividedBy(f).toDecimalPlaces(4);
                }
                const action = l.excessAction ?? (excess.greaterThan(0) ? 'HOLD_FOR_BILL' : null);
                if (action === 'RETURN') {
                    if (excess.greaterThan(0))
                        problems.push({ field: `lines.${i}.receivedQty`, code: 'PUR_EXCESS_IN_RECEIVED',
                            message: `Line ${l.lineNo}: ${excess.toString()} over the PO is still in Received — what goes back at the gate is not received (key it as Excess).` });
                    excessOf.push((0, purchase_doc_helpers_1.D)(l.excessQty));
                }
                else if (excess.greaterThan(0) && action === 'KEEP_FREE') {
                    const take = client_1.Prisma.Decimal.min(excess, (0, purchase_doc_helpers_1.D)(l.receivedQty));
                    l.receivedQty = Number((0, purchase_doc_helpers_1.D)(l.receivedQty).minus(take));
                    l.freeQty = Number((0, purchase_doc_helpers_1.D)(l.freeQty).plus(take));
                    let left = take;
                    for (const a of l.allocs ?? []) {
                        if ((a.bucket ?? 'SALEABLE') !== 'SALEABLE' || !left.greaterThan(0))
                            continue;
                        const m = client_1.Prisma.Decimal.min(left, (0, purchase_doc_helpers_1.D)(a.qty));
                        a.qty = Number((0, purchase_doc_helpers_1.D)(a.qty).minus(m));
                        a.freeQty = Number((0, purchase_doc_helpers_1.D)(a.freeQty).plus(m));
                        left = left.minus(m);
                    }
                    warnings.push({ field: `lines.${i}.receivedQty`, code: 'PUR_EXCESS_KEPT_FREE', message: `Line ${l.lineNo}: ${take.toString()} over the PO taken as free goods (no value).` });
                    excessOf.push(take);
                }
                else {
                    if (excess.greaterThan(0))
                        warnings.push({ field: `lines.${i}.receivedQty`, code: 'PUR_EXCESS_HELD',
                            message: `Line ${l.lineNo}: ${excess.toString()} over the PO — received at the provisional rate; the bill must cover it.` });
                    excessOf.push(excess);
                }
                l.excessAction = excessOf[i].greaterThan(0) ? (action ?? undefined) : undefined;
            }
            if (problems.length)
                (0, purchase_errors_1.purRefuseMany)(problems[0].message, problems);
            const shelf = await (0, purchase_doc_helpers_1.shelfLifeIssues)(tx, settings.shelfLifeMode, settings.minShelfLifePct, h.docDate, dto.lines.flatMap((l, i) => (l.allocs ?? []).map((a) => ({ lineNo: l.lineNo, index: i, itemId: l.itemId, bucket: a.bucket, mfgDate: (0, purchase_doc_helpers_1.dateOf)(a.mfgDate), expiryDate: (0, purchase_doc_helpers_1.dateOf)(a.expiryDate) }))));
            if (shelf.length && settings.shelfLifeMode === 'REFUSE' && h.post)
                (0, purchase_errors_1.purRefuseMany)(shelf[0].message, shelf);
            if (!h.post)
                warnings.push(...shelf);
            if (!dto.charges?.length && h.receivedBy?.length && h.payCoolie !== false)
                dto.charges = await this.coolieFor(tx, h.receivedBy);
            for (const c of dto.charges ?? [])
                if (c.payees?.length)
                    c.payees = await (0, purchase_doc_helpers_1.payeeLedgers)(tx, c.payees, 'header.receivedBy');
            const chg = await this.loadCharges(tx, dto.charges ?? []);
            const calc = (0, purchase_calc_1.calcPurchase)({
                interState: false, roundOffStep: 0, charges: chg,
                lines: dto.lines.map((l) => ({ key: String(l.lineNo), billedQty: (0, purchase_doc_helpers_1.D)(l.receivedQty).plus((0, purchase_doc_helpers_1.D)(l.damagedQty)), damagedQty: l.damagedQty ?? 0,
                    receivedQty: l.receivedQty, freeQty: l.freeQty ?? 0, rate: l.rate, gstPct: 0, toBaseFactor: units.get(l.uomId).iuc_to_base_factor, weight: l.weight ?? 0 })),
            });
            let grnId = h.grnId ?? null;
            let slno, refno, isNew = false;
            if (grnId) {
                const cur = await tx.purGrn.findFirst({ where: { grnId, grnAccYear: h.accYear, grnIsDeleted: false } });
                if (!cur)
                    (0, purchase_errors_1.purNotFound)(`GRN ${grnId} not found`);
                if (cur.grnStatus !== 'DRAFT')
                    (0, purchase_errors_1.purConflict)(`${cur.grnRefno} is ${cur.grnStatus} — only a draft can be edited.`, purchase_errors_1.PUR.NOT_DRAFT, 'grnId');
                slno = cur.grnSlno;
                refno = cur.grnRefno;
                await tx.purItemAlloc.deleteMany({ where: { piaDocType: DOC, piaDocId: grnId, piaAccYear: h.accYear } });
                await tx.purGrnItem.deleteMany({ where: { griGrnId: grnId, griAccYear: h.accYear } });
                await tx.$executeRaw `DELETE FROM public.txn_charge_detail WHERE cd_doc_type = ${DOC} AND cd_doc_id = ${grnId}::uuid AND cd_acc_year = ${h.accYear}::bpchar`;
            }
            else {
                ({ slno, refno } = await (0, purchase_doc_helpers_1.allocateDocNumber)(tx, 'GRN', h.companyId, h.branchId, h.accYear, h.deviceId));
                isNew = true;
            }
            const provisional = calc.lines.reduce((s, l) => s.plus(l.netGross), purchase_doc_helpers_1.ZERO);
            const data = {
                grnCompanyId: h.companyId, grnBranchId: h.branchId, grnAccYear: h.accYear, grnDeviceId: h.deviceId, grnSlno: slno, grnRefno: refno,
                grnDocDate: (0, purchase_doc_helpers_1.dateOf)(h.docDate), grnSupplierId: h.supplierId, grnGodownId: h.godownId, grnChallanNo: h.challanNo ?? null,
                grnChallanDate: (0, purchase_doc_helpers_1.dateOf)(h.challanDate), grnSupplierInvNo: h.supplierInvNo ?? null,
                grnReceivedAt: h.receivedAt ? new Date(h.receivedAt) : new Date(), grnReceivedBy: h.receivedBy ?? [], grnSupervisorId: h.supervisorId ?? null,
                grnVehicleNo: h.vehicleNo ?? null, grnDriverName: h.driverName ?? null, grnEwbNo: h.ewbNo ?? null,
                grnPackagesSent: h.packagesSent ?? null, grnPackagesReceived: h.packagesReceived ?? null,
                grnProvisionalValue: provisional, grnOffbillCharges: calc.offbillCharges, grnRemarks: h.remarks ?? null, grnStatus: 'DRAFT',
            };
            if (isNew)
                grnId = (await tx.purGrn.create({ data: { ...data, grnCreatedBy: actor }, select: { grnId: true } })).grnId;
            else
                await tx.purGrn.update({ where: { grnId_grnAccYear: { grnId: grnId, grnAccYear: h.accYear } }, data: { ...data, grnModifiedBy: actor, grnModifiedOn: new Date(), grnRevisionNo: { increment: 1 } } });
            for (let i = 0; i < dto.lines.length; i++) {
                const l = dto.lines[i], o = calc.lines[i], u = units.get(l.uomId);
                const row = await tx.purGrnItem.create({ data: {
                        griGrnId: grnId, griCompanyId: h.companyId, griBranchId: h.branchId, griAccYear: h.accYear, griLineNo: l.lineNo,
                        griItemId: l.itemId, griUomId: l.uomId, griBaseUomId: u.base_iuc_id, griToBaseFactor: u.iuc_to_base_factor, griHsnCode: u.item_hsn_code, griWeight: l.weight ?? null,
                        griSrcDocType: l.poItemId ? 'PURCHASE_ORDER' : null, griSrcDocId: l.poItemId ? await this.poIdOf(tx, l.poItemId) : null,
                        griSrcDocYear: l.poItemId ? (l.poItemAccYear ?? h.accYear) : null, griSrcItemId: l.poItemId ?? null,
                        griChallanQty: (0, purchase_doc_helpers_1.D)(l.challanQty ?? (0, purchase_doc_helpers_1.D)(l.receivedQty).plus((0, purchase_doc_helpers_1.D)(l.damagedQty))), griReceivedQty: (0, purchase_doc_helpers_1.D)(l.receivedQty), griDamagedQty: (0, purchase_doc_helpers_1.D)(l.damagedQty),
                        griDamageReasonId: l.damageReasonId ?? null, griFreeQty: (0, purchase_doc_helpers_1.D)(l.freeQty), griExcessQty: excessOf[i], griExcessAction: l.excessAction ?? null,
                        griProvisionalRate: (0, purchase_doc_helpers_1.D)(l.rate), griOffbillShare: o.offbillShare, griValue: o.netGross, griMrp: l.mrp ?? null, griSellA: l.sellA ?? null,
                        griSellB: l.sellB ?? null, griSellC: l.sellC ?? null, griSellD: l.sellD ?? null,
                        griPriceUpdateResult: priceAtGrn ? 'NONE' : 'OFF',
                        griRemarks: l.remarks ?? null, griCreatedBy: actor,
                    }, select: { griId: true } });
                const allocs = l.allocs?.length ? l.allocs : [
                    ...((0, purchase_doc_helpers_1.D)(l.receivedQty).plus((0, purchase_doc_helpers_1.D)(l.freeQty)).greaterThan(0) ? [{ bucket: 'SALEABLE', qty: l.receivedQty, freeQty: l.freeQty ?? 0 }] : []),
                    ...((0, purchase_doc_helpers_1.D)(l.damagedQty).greaterThan(0) ? [{ bucket: 'DAMAGED', qty: l.damagedQty, freeQty: 0 }] : []),
                ];
                const sum = allocs.reduce((s, a) => s.plus((0, purchase_doc_helpers_1.D)(a.qty)).plus((0, purchase_doc_helpers_1.D)(a.freeQty)), purchase_doc_helpers_1.ZERO);
                const want = (0, purchase_doc_helpers_1.D)(l.receivedQty).plus((0, purchase_doc_helpers_1.D)(l.damagedQty)).plus((0, purchase_doc_helpers_1.D)(l.freeQty));
                if (!sum.equals(want))
                    (0, purchase_errors_1.purRefuse)(`Line ${l.lineNo}: the batch split adds up to ${sum}, it must be ${want} (received + damaged + free)`, purchase_errors_1.PUR.ALLOC_SUM_MISMATCH, `lines.${i}.allocs`);
                let k = 0;
                for (const a of allocs) {
                    await tx.purItemAlloc.create({ data: {
                            piaCompanyId: h.companyId, piaBranchId: h.branchId, piaAccYear: h.accYear, piaDocType: DOC, piaDocId: grnId, piaLineId: row.griId, piaRowNo: ++k,
                            piaGodownId: a.godownId ?? h.godownId, piaBucket: a.bucket ?? 'SALEABLE', piaBatchNo: a.batchNo?.trim() || null,
                            piaMfgDate: (0, purchase_doc_helpers_1.dateOf)(a.mfgDate), piaExpiryDate: (0, purchase_doc_helpers_1.dateOf)(a.expiryDate), piaMrp: a.mrp ?? l.mrp ?? null, piaSalePrice: a.salePrice ?? l.sellA ?? null,
                            piaSerialNo: a.serialNo?.trim() || null, piaSizeId: a.sizeId ?? null, piaColourId: a.colourId ?? null, piaModel: a.model ?? null,
                            piaQty: (0, purchase_doc_helpers_1.D)(a.qty), piaFreeQty: (0, purchase_doc_helpers_1.D)(a.freeQty), piaCreatedBy: actor,
                        } });
                }
            }
            await this.writeCharges(tx, dto, calc.charges, grnId, slno, h, actor);
            if (isNew)
                await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.GRN, docId: grnId, refno, event: purchase_doc_helpers_1.TxnStatusEvent.CREATED, from: null, to: 'DRAFT', actor, deviceId: h.deviceId });
            if (h.post)
                warnings.push(...await this.postInTx(tx, grnId, h.accYear, actor));
            return grnId;
        }, { timeout: 60000, maxWait: 10000 });
        return { ...(await this.get(id, h.accYear)), warnings };
    }
    async poPendingBase(tx, poiId, exceptGrnId) {
        const [r] = await tx.$queryRaw `
      SELECT (poi.poi_qty - poi.poi_short_closed_qty) * poi.poi_to_base_factor
             - COALESCE((SELECT SUM((gri.gri_received_qty + gri.gri_damaged_qty) * gri.gri_to_base_factor)
                           FROM purchase.pur_grn_item gri JOIN purchase.pur_grn g ON g.grn_id = gri.gri_grn_id AND g.grn_acc_year = gri.gri_acc_year
                          WHERE gri.gri_src_doc_type = 'PURCHASE_ORDER' AND gri.gri_src_item_id = poi.poi_id AND NOT gri.gri_is_deleted
                            AND NOT g.grn_is_deleted AND g.grn_status <> 'CANCELLED' AND g.grn_id IS DISTINCT FROM ${exceptGrnId}::uuid), 0)
             - COALESCE((SELECT SUM(pii.pii_billed_qty * pii.pii_to_base_factor)
                           FROM purchase.pur_invoice_item pii JOIN purchase.pur_invoice p ON p.pi_id = pii.pii_pi_id AND p.pi_acc_year = pii.pii_acc_year
                          WHERE pii.pii_src_doc_type = 'PURCHASE_ORDER' AND pii.pii_src_item_id = poi.poi_id AND NOT pii.pii_is_deleted
                            AND NOT p.pi_is_deleted AND p.pi_status <> 'CANCELLED'), 0) AS pending
        FROM purchase.pur_order_item poi WHERE poi.poi_id = ${poiId}::uuid AND NOT poi.poi_is_deleted`;
        return r ? (0, purchase_doc_helpers_1.D)(r.pending) : null;
    }
    async coolieFor(tx, employees) {
        const [c] = await tx.$queryRaw `
      SELECT chg_id FROM public.charge_master
       WHERE chg_role = 'UNLOADING' AND chg_module IN ('P','B') AND NOT chg_on_bill AND chg_is_active AND NOT chg_is_deleted
       ORDER BY chg_module, chg_code LIMIT 1`;
        return c ? [{ chgId: c.chg_id, payees: employees.map((partyId) => ({ partyId })) }] : [];
    }
    async poIdOf(tx, poiId) {
        const [r] = await tx.$queryRaw `SELECT poi_po_id AS id FROM purchase.pur_order_item WHERE poi_id = ${poiId}::uuid LIMIT 1`;
        if (!r)
            (0, purchase_errors_1.purRefuse)(`PO line ${poiId} not found`, purchase_errors_1.PUR.NOT_FOUND, 'lines.poItemId', 404);
        await (0, purchase_order_1.assertPoApproved)(tx, r.id);
        return r.id;
    }
    async loadCharges(tx, charges) {
        if (!charges.length)
            return [];
        const ids = charges.map((c) => c.chgId);
        const rows = await tx.$queryRaw `
      SELECT chg_id, chg_type, chg_method, chg_default_rate, chg_cost_alloc, chg_on_bill, chg_name FROM public.charge_master
       WHERE chg_id = ANY(${ids}::uuid[]) AND NOT chg_is_deleted AND chg_module IN ('P','B')`;
        const by = new Map(rows.map((r) => [r.chg_id, r]));
        return charges.map((c, i) => {
            const m = by.get(c.chgId);
            if (!m)
                (0, purchase_errors_1.purRefuse)(`Charge ${c.chgId} is not a purchase charge`, purchase_errors_1.PUR.CHARGE_NOT_FOUND, `charges.${i}.chgId`);
            if (m.chg_on_bill)
                (0, purchase_errors_1.purRefuse)(`${m.chg_name} is a supplier's-bill charge — it belongs on the purchase invoice, not the GRN.`, purchase_errors_1.PUR.CHARGE_NOT_FOUND, `charges.${i}.chgId`);
            return { key: String(i), type: m.chg_type === 'DEDUCT' ? 'DEDUCT' : 'ADD', method: m.chg_method, rate: c.rate ?? m.chg_default_rate ?? 0,
                amount: c.amount ?? null, alloc: (m.chg_cost_alloc && m.chg_cost_alloc !== 'NONE' ? m.chg_cost_alloc : 'VALUE'),
                beforeTax: false, onBill: false, landingCost: true, taxPct: 0, payees: (c.payees ?? []).map((p) => ({ partyId: p.partyId, amount: p.amount ?? null })) };
        });
    }
    async writeCharges(tx, dto, out, grnId, slno, h, actor) {
        let n = 0;
        for (let i = 0; i < (dto.charges ?? []).length; i++) {
            const c = dto.charges[i];
            const [m] = await tx.$queryRaw `
        SELECT chg_name, chg_role, chg_method, chg_type, chg_cost_alloc, chg_ledger_code, chg_default_rate FROM public.charge_master WHERE chg_id = ${c.chgId}::uuid`;
            const rows = out[i].payees.length ? out[i].payees : [{ partyId: null, amount: out[i].amount }];
            for (const r of rows) {
                await tx.$executeRaw `
          INSERT INTO public.txn_charge_detail (cd_doc_type, cd_doc_id, cd_slno, cd_comp_id, cd_branch_id, cd_acc_year, cd_voucher_no,
            cd_chg_id, cd_chg_name, cd_role, cd_method, cd_type, cd_apply_on, cd_ledger_code, cd_landing_cost, cd_cost_alloc, cd_before_tax, cd_tax_apl, cd_sep_post,
            cd_rate, cd_amount, cd_net_amt, cd_on_bill, cd_party_id, cd_created_by)
          VALUES (${DOC}, ${grnId}::uuid, ${++n}::int, ${h.companyId}::uuid, ${h.branchId}::uuid, ${h.accYear}::bpchar, ${slno}::bigint,
            ${c.chgId}::uuid, ${m.chg_name}, ${m.chg_role}, ${m.chg_method}, ${m.chg_type}, ${m.chg_cost_alloc ?? 'VALUE'}, ${m.chg_ledger_code}::uuid, true,
            ${m.chg_cost_alloc}, false, false, false, ${c.rate ?? m.chg_default_rate ?? 0}::numeric, ${r.amount.abs()}::numeric, ${r.amount.abs()}::numeric,
            false, ${r.partyId}::uuid, ${actor})`;
            }
        }
    }
    async post(grnId, accYear) {
        const actor = this.actor();
        const warnings = await this.prisma.$transaction((tx) => this.postInTx(tx, grnId, accYear, actor), { timeout: 60000, maxWait: 10000 });
        return { ...(await this.get(grnId, accYear)), warnings };
    }
    async postInTx(tx, grnId, accYear, actor) {
        const notes = [];
        const g = await tx.purGrn.findFirst({ where: { grnId, grnAccYear: accYear, grnIsDeleted: false } });
        if (!g)
            (0, purchase_errors_1.purNotFound)(`GRN ${grnId} not found`);
        if (g.grnStatus !== 'DRAFT')
            (0, purchase_errors_1.purConflict)(`${g.grnRefno} is ${g.grnStatus} — only a draft can be posted.`, purchase_errors_1.PUR.NOT_DRAFT, 'grnId');
        const lines = await tx.purGrnItem.findMany({ where: { griGrnId: grnId, griAccYear: accYear, griIsDeleted: false }, orderBy: { griLineNo: 'asc' } });
        const allocs = await tx.purItemAlloc.findMany({ where: { piaDocType: DOC, piaDocId: grnId, piaAccYear: accYear, piaIsDeleted: false }, orderBy: { piaRowNo: 'asc' } });
        const byLine = new Map(lines.map((l) => [l.griId, l]));
        const postedOn = new Date();
        const docDate = (0, purchase_doc_helpers_1.isoDate)(g.grnDocDate);
        const settings = await (0, purchase_settings_1.loadPurchaseSettings)(tx, g.grnCompanyId, g.grnBranchId);
        const shelf = await (0, purchase_doc_helpers_1.shelfLifeIssues)(tx, settings.shelfLifeMode, settings.minShelfLifePct, docDate, allocs.map((a) => { const l = byLine.get(a.piaLineId); return { lineNo: l.griLineNo, index: l.griLineNo - 1, itemId: l.griItemId, bucket: a.piaBucket, mfgDate: a.piaMfgDate, expiryDate: a.piaExpiryDate }; }));
        if (shelf.length && settings.shelfLifeMode === 'REFUSE')
            (0, purchase_errors_1.purRefuseMany)(shelf[0].message, shelf);
        const cost = (l) => {
            const inBase = l.griReceivedQty.plus(l.griDamagedQty).plus(l.griFreeQty).times(l.griToBaseFactor);
            return inBase.isZero() ? purchase_doc_helpers_1.ZERO : l.griValue.plus(l.griOffbillShare).dividedBy(inBase).toDecimalPlaces(6, client_1.Prisma.Decimal.ROUND_HALF_UP);
        };
        const { perRow } = await (0, purchase_doc_helpers_1.postShadowStock)(tx, this.stockPosting, { companyId: g.grnCompanyId, branchId: g.grnBranchId, accYear, deviceId: g.grnDeviceId, sessionId: g.grnSessionId, docType: DOC, docId: grnId,
            refno: g.grnRefno, revision: g.grnRevisionNo, usrRefno: g.grnChallanNo, docDate, supplierId: g.grnSupplierId, remarks: `GRN ${g.grnRefno}` }, this.rules(), allocs.map((a) => {
            const l = byLine.get(a.piaLineId);
            return { itemId: l.griItemId, uomId: l.griUomId, baseUomId: l.griBaseUomId, factor: l.griToBaseFactor, godownId: a.piaGodownId, bucket: a.piaBucket,
                batchNo: a.piaBatchNo, mfgDate: a.piaMfgDate, expiryDate: a.piaExpiryDate, mrp: a.piaMrp, salePrice: a.piaSalePrice, serialNo: a.piaSerialNo,
                sizeId: a.piaSizeId, colourId: a.piaColourId, model: a.piaModel,
                supplierId: g.grnSupplierId, qty: a.piaQty, freeQty: a.piaFreeQty, costRate: cost(l) };
        }), actor, postedOn);
        for (let i = 0; i < allocs.length; i++) {
            if (perRow[i]?.sviId)
                await tx.purItemAlloc.update({ where: { piaId_piaAccYear: { piaId: allocs[i].piaId, piaAccYear: accYear } }, data: { piaLotId: perRow[i].lotId, piaSviId: perRow[i].sviId, piaSviAccYear: accYear, piaBatchNo: perRow[i].batchNo } });
        }
        const vt = await (0, purchase_doc_helpers_1.voucherTypeId)(tx, 'GRN');
        const charges = await tx.$queryRaw `
      SELECT cd_amount, cd_party_id, cd_ledger_code, cd_chg_name FROM public.txn_charge_detail WHERE cd_doc_type = ${DOC} AND cd_doc_id = ${grnId}::uuid AND cd_acc_year = ${accYear}::bpchar AND NOT cd_is_deleted`;
        const legs = [];
        const offbill = charges.reduce((s, c) => s.plus(c.cd_amount), purchase_doc_helpers_1.ZERO);
        legs.push({ role: 'INVENTORY', drCr: 'DR', amount: (0, purchase_doc_helpers_1.num2)(g.grnProvisionalValue.plus(offbill)), roleTag: 'INVENTORY', remarks: `GRN ${g.grnRefno}` });
        legs.push({ role: 'GRNI', drCr: 'CR', amount: (0, purchase_doc_helpers_1.num2)(g.grnProvisionalValue), roleTag: 'GRNI', remarks: `GRN ${g.grnRefno} — bill pending` });
        for (const c of charges)
            legs.push({ ledgerId: c.cd_party_id ?? c.cd_ledger_code, drCr: 'CR', amount: (0, purchase_doc_helpers_1.num2)(c.cd_amount), remarks: `${c.cd_chg_name} · ${g.grnRefno}` });
        const posted = await this.vouchers.postLegs(tx, {
            header: { companyId: g.grnCompanyId, branchId: g.grnBranchId, accYear, voucherTypeId: vt, voucherDate: docDate, srcModule: 'PURCHASE', srcDocType: DOC, srcDocId: grnId,
                docLabel: 'GRN', docRefno: g.grnRefno, docDate, usrRefno: g.grnChallanNo, docAmount: (0, purchase_doc_helpers_1.num2)(g.grnProvisionalValue), partyId: g.grnSupplierId,
                userId: actor, sessionId: g.grnSessionId, deviceId: g.grnDeviceId, remarks: g.grnRemarks ?? `GRN ${g.grnRefno}`, createdBy: actor,
                presetRefno: g.grnRefno, presetNo: g.grnSlno },
            legs: legs.filter((l) => l.amount >= 0.005),
        });
        let k = 0;
        for (const c of charges) {
            await (0, purchase_doc_helpers_1.raiseBillRow)(tx, { companyId: g.grnCompanyId, branchId: g.grnBranchId, accYear, partyId: c.cd_party_id ?? c.cd_ledger_code, billType: 'PURCHASE', drCr: 'CR',
                amount: c.cd_amount, docType: DOC, docId: grnId, voucherId: posted.voucherId, voucherTypeId: vt, voucherNo: g.grnSlno, voucherDate: docDate,
                refno: g.grnRefno, refSuffix: `C${++k}`, docDate: g.grnDocDate, narration: `${c.cd_chg_name} — ${g.grnRefno}`, actor });
        }
        for (const l of lines) {
            const short = l.griChallanQty.minus(l.griReceivedQty).minus(l.griDamagedQty);
            if (!short.greaterThan(0))
                continue;
            await tx.purShortage.create({ data: {
                    pshCompanyId: g.grnCompanyId, pshBranchId: g.grnBranchId, pshAccYear: accYear, pshSupplierId: g.grnSupplierId, pshItemId: l.griItemId,
                    pshSrcDocType: DOC, pshSrcDocId: grnId, pshSrcDocYear: accYear, pshSrcItemId: l.griId, pshSrcDocRefno: g.grnRefno,
                    pshReason: 'SHORT_CHALLAN', pshQtyBase: short.times(l.griToBaseFactor), pshOriginCostRate: cost(l), pshCreatedBy: actor,
                } });
        }
        if (settings.allowPriceUpdate && settings.priceUpdate === 'UPDATE_PRICES' && settings.priceSetAt === 'GRN') {
            const lv = (v) => (v ? Number(v) : 0);
            const businessTime = docDate === (0, purchase_doc_helpers_1.isoDate)(postedOn) ? postedOn : new Date(`${docDate}T23:59:59.999+05:30`);
            const result = await this.prices.applyPurchasePrices(tx, {
                companyId: g.grnCompanyId, branchId: g.grnBranchId, actor, billRef: g.grnRefno, businessTime,
                rows: lines.map((l) => ({ key: l.griId, itemId: l.griItemId, uomId: l.griUomId, mrp: l.griMrp ? Number(l.griMrp) : null,
                    levels: [{ level: 1, price: lv(l.griSellA) }, { level: 2, price: lv(l.griSellB) }, { level: 3, price: lv(l.griSellC) }, { level: 4, price: lv(l.griSellD) }] })),
            });
            for (const l of lines) {
                const r = result.get(l.griId);
                if (!r)
                    continue;
                await tx.purGrnItem.update({ where: { griId_griAccYear: { griId: l.griId, griAccYear: accYear } }, data: { griPriceUpdateResult: r.result } });
                if (r.note)
                    notes.push({ field: `lines.${l.griLineNo - 1}`, code: r.result === 'KEPT_NEWER' ? 'PUR_PRICE_KEPT_NEWER' : 'PUR_PRICE_NOT_WRITTEN', message: `Line ${l.griLineNo}: ${r.note}` });
            }
        }
        await tx.purGrn.update({ where: { grnId_grnAccYear: { grnId, grnAccYear: accYear } }, data: { grnStatus: 'POSTED', grnPostedVoucherId: posted.voucherId, grnModifiedBy: actor, grnModifiedOn: postedOn } });
        await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: g.grnCompanyId, branchId: g.grnBranchId, accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.GRN, docId: grnId, refno: g.grnRefno, event: purchase_doc_helpers_1.TxnStatusEvent.POSTED, from: 'DRAFT', to: 'POSTED', actor, deviceId: g.grnDeviceId });
        return [...shelf, ...notes];
    }
    async labels(q) {
        const rows = await this.prisma.$queryRaw `
      WITH r AS (
        SELECT a.pia_id, a.pia_row_no, a.pia_doc_type, a.pia_line_id, a.pia_company_id, a.pia_batch_no, a.pia_mrp, a.pia_sale_price,
               a.pia_size_id, a.pia_colour_id, a.pia_model, a.pia_expiry_date, a.pia_qty + a.pia_free_qty AS pieces
          FROM purchase.pur_item_alloc a
         WHERE NOT a.pia_is_deleted AND a.pia_bucket = 'SALEABLE' AND a.pia_acc_year = ${q.accYear}::bpchar
           AND ((a.pia_doc_type = ${q.docType} AND a.pia_doc_id = ${q.docId}::uuid)
             OR (${q.docType} = 'PURCHASE_BILL' AND a.pia_doc_type = 'GRN' AND a.pia_line_id IN (
                   SELECT pii_src_item_id FROM purchase.pur_invoice_item
                    WHERE pii_pi_id = ${q.docId}::uuid AND pii_src_doc_type = 'GRN' AND NOT pii_is_deleted))))
      SELECT r.pia_id AS "rowId", COALESCE(gri.gri_line_no, pii.pii_line_no) AS "lineNo", r.pia_row_no AS "rowNo",
             im.item_id AS "itemId", im.item_name_en AS "itemName", u.unit_name AS "unitName",
             COALESCE(NULLIF(r.pia_batch_no, ''), e.ean_code) AS "barcode", r.pia_batch_no AS "batchNo", e.ean_code AS "ean",
             COALESCE(r.pia_mrp, gri.gri_mrp, pii.pii_mrp) AS "mrp",
             COALESCE(r.pia_sale_price, gri.gri_sell_a, pii.pii_sell_a, p.ipm_sales_price_a) AS "price",
             sz.isz_name AS "size", cl.icl_name AS "colour", r.pia_model AS "model", r.pia_expiry_date AS "expiryDate",
             r.pieces AS "qty", c.comp_name AS "companyName"
        FROM r
        LEFT JOIN purchase.pur_grn_item gri ON r.pia_doc_type = 'GRN' AND gri.gri_id = r.pia_line_id
        LEFT JOIN purchase.pur_invoice_item pii ON r.pia_doc_type = 'PURCHASE_BILL' AND pii.pii_id = r.pia_line_id
        JOIN inventory.item_master im ON im.item_id = COALESCE(gri.gri_item_id, pii.pii_item_id)
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = COALESCE(gri.gri_uom_id, pii.pii_uom_id)
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
        LEFT JOIN inventory.item_size_master sz ON sz.isz_id = r.pia_size_id
        LEFT JOIN inventory.item_colour_master cl ON cl.icl_id = r.pia_colour_id
        LEFT JOIN public.companys c ON c.comp_id = r.pia_company_id
        LEFT JOIN LATERAL (SELECT ean_code FROM inventory.item_ean_codes
                            WHERE ean_item_id = im.item_id AND ean_uc_unit_id = iuc.iuc_id AND ean_is_active AND NOT ean_is_deleted
                            ORDER BY ean_is_default DESC, ean_sl_no LIMIT 1) e ON true
        LEFT JOIN LATERAL (SELECT ipm_sales_price_a FROM inventory.item_price_master
                            WHERE ipm_item_id = im.item_id AND ipm_uc_unit_id = iuc.iuc_id AND ipm_is_active AND NOT ipm_is_deleted
                            ORDER BY (ipm_branch_id IS NOT NULL) DESC, ipm_effective_from DESC NULLS LAST LIMIT 1) p ON true
       ORDER BY 2, 3`;
        if (!rows.length) {
            const [doc] = q.docType === 'GRN'
                ? await this.prisma.$queryRaw `SELECT grn_status AS s FROM purchase.pur_grn WHERE grn_id = ${q.docId}::uuid AND grn_acc_year = ${q.accYear}::bpchar`
                : await this.prisma.$queryRaw `SELECT pi_status AS s FROM purchase.pur_invoice WHERE pi_id = ${q.docId}::uuid AND pi_acc_year = ${q.accYear}::bpchar`;
            if (!doc)
                (0, purchase_errors_1.purNotFound)(`${q.docType} ${q.docId} not found`);
        }
        return (0, purchase_doc_helpers_1.jsonSafe)(rows.map((r) => ({ ...r, copies: Math.max(1, Math.ceil(Number(r.qty))), textile: !!(r.size || r.colour || r.model) })));
    }
    async get(grnId, accYear) {
        const header = await this.prisma.purGrn.findFirst({ where: { grnId, grnAccYear: accYear, grnIsDeleted: false } });
        if (!header)
            (0, purchase_errors_1.purNotFound)(`GRN ${grnId} not found`);
        const [lines, allocs, sup] = await Promise.all([
            this.prisma.purGrnItem.findMany({ where: { griGrnId: grnId, griAccYear: accYear, griIsDeleted: false }, orderBy: { griLineNo: 'asc' } }),
            this.prisma.purItemAlloc.findMany({ where: { piaDocType: DOC, piaDocId: grnId, piaAccYear: accYear, piaIsDeleted: false }, orderBy: { piaRowNo: 'asc' } }),
            this.prisma.$queryRaw `SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${header.grnSupplierId}::uuid`,
        ]);
        const billed = await this.prisma.$queryRaw `
      SELECT count(*) AS n FROM purchase.pur_invoice_item pii JOIN purchase.pur_invoice p ON p.pi_id = pii.pii_pi_id AND p.pi_acc_year = pii.pii_acc_year
       WHERE pii.pii_src_doc_type = 'GRN' AND pii.pii_src_doc_id = ${grnId}::uuid AND NOT pii.pii_is_deleted AND p.pi_status <> 'CANCELLED' AND NOT p.pi_is_deleted`;
        const names = await (0, purchase_doc_helpers_1.unitNames)(this.prisma, lines.map((l) => l.griUomId));
        const poRefs = await this.prisma.$queryRaw `
      SELECT po_id, po_refno FROM purchase.pur_order WHERE po_id = ANY(${[...new Set(lines.map((l) => l.griSrcDocId).filter((x) => !!x))]}::uuid[])`;
        const poRef = new Map(poRefs.map((r) => [r.po_id, r.po_refno]));
        const men = header.grnReceivedBy.length ? await this.prisma.$queryRaw `
      SELECT emp_id AS id, emp_name AS name FROM public.employee_master WHERE emp_id = ANY(${header.grnReceivedBy}::uuid[])` : [];
        const manName = new Map(men.map((m) => [m.id, m.name]));
        return (0, purchase_doc_helpers_1.jsonSafe)({
            header: { ...header, supplierName: sup[0]?.sup_name ?? null, receivedBy: header.grnReceivedBy.map((id) => ({ id, name: manName.get(id) ?? id })), billStatus: Number(billed[0]?.n ?? 0) > 0 ? 'BILLED' : 'NOT_BILLED' },
            lines: lines.map((l) => ({ ...l, ...names.get(l.griUomId), poRefno: l.griSrcDocId ? poRef.get(l.griSrcDocId) ?? null : null,
                allocs: allocs.filter((a) => a.piaLineId === l.griId) })),
        });
    }
    async cancel(dto) {
        const actor = this.actor();
        await this.prisma.$transaction(async (tx) => {
            const g = await tx.purGrn.findFirst({ where: { grnId: dto.grnId, grnAccYear: dto.accYear, grnIsDeleted: false } });
            if (!g)
                (0, purchase_errors_1.purNotFound)(`GRN ${dto.grnId} not found`);
            if (g.grnStatus !== 'POSTED')
                (0, purchase_errors_1.purConflict)(`${g.grnRefno} is ${g.grnStatus} — only a posted GRN is cancelled.`, purchase_errors_1.PUR.NOT_POSTED, 'grnId');
            const [billed] = await tx.$queryRaw `
        SELECT count(*) AS n FROM purchase.pur_invoice_item pii JOIN purchase.pur_invoice p ON p.pi_id = pii.pii_pi_id AND p.pi_acc_year = pii.pii_acc_year
         WHERE pii.pii_src_doc_type = 'GRN' AND pii.pii_src_doc_id = ${dto.grnId}::uuid AND NOT pii.pii_is_deleted AND p.pi_status <> 'CANCELLED' AND NOT p.pi_is_deleted`;
            if (Number(billed.n) > 0)
                (0, purchase_errors_1.purConflict)(`${g.grnRefno} is already billed — cancel the bill first.`, purchase_errors_1.PUR.EDIT_LOCKED_PAID, 'grnId');
            const [paid] = await tx.$queryRaw `
        SELECT count(*) AS n FROM accounts.acc_bill_balance WHERE abl_src_doc_type = ${DOC} AND abl_src_doc_id = ${dto.grnId}::uuid AND NOT abl_is_deleted
           AND (abl_alloc_amount + abl_disc_amount + abl_writeoff_amount) <> 0`;
            if (Number(paid.n) > 0)
                (0, purchase_errors_1.purConflict)(`${g.grnRefno}: the loadmen are already paid — undo that payment first.`, purchase_errors_1.PUR.EDIT_LOCKED_PAID, 'grnId');
            await (0, purchase_doc_helpers_1.assertNoLiveReturns)(tx, dto.grnId, g.grnRefno);
            await (0, purchase_doc_helpers_1.assertShortagesUntouched)(tx, dto.grnId, g.grnRefno);
            await (0, purchase_doc_helpers_1.cancelShadowStock)(tx, this.stockPosting, DOC, dto.grnId, dto.accYear, g.grnCompanyId, g.grnBranchId, this.rules(), actor, dto.reason);
            if (g.grnPostedVoucherId)
                await this.vouchers.reverseLegs(tx, g.grnPostedVoucherId, dto.accYear, `GRN ${g.grnRefno} cancelled: ${dto.reason}`, actor);
            await (0, purchase_doc_helpers_1.withdrawBillRows)(tx, DOC, dto.grnId, actor);
            await tx.purShortage.updateMany({ where: { pshSrcDocType: DOC, pshSrcDocId: dto.grnId, pshIsDeleted: false }, data: { pshIsDeleted: true, pshModifiedBy: actor, pshModifiedOn: new Date() } });
            await tx.purGrn.update({ where: { grnId_grnAccYear: { grnId: dto.grnId, grnAccYear: dto.accYear } }, data: { grnStatus: 'CANCELLED', grnModifiedBy: actor, grnModifiedOn: new Date() } });
            await (0, purchase_doc_helpers_1.statusLog)(tx, { companyId: g.grnCompanyId, branchId: g.grnBranchId, accYear: dto.accYear, docType: purchase_doc_helpers_1.TxnStatusDocType.GRN, docId: dto.grnId, refno: g.grnRefno, event: purchase_doc_helpers_1.TxnStatusEvent.CANCELLED, from: 'POSTED', to: 'CANCELLED', actor, remarks: dto.reason });
        }, { timeout: 60000, maxWait: 10000 });
        return this.get(dto.grnId, dto.accYear);
    }
};
exports.PurchaseGrnService = PurchaseGrnService;
exports.PurchaseGrnService = PurchaseGrnService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, request_context_service_1.RequestContextService,
        voucher_posting_service_1.VoucherPostingService, stock_posting_service_1.StockPostingService,
        selling_price_bulk_service_1.SellingPriceBulkService])
], PurchaseGrnService);
let PurchaseGrnController = class PurchaseGrnController {
    service;
    prisma;
    ctx;
    constructor(service, prisma, ctx) {
        this.service = service;
        this.prisma = prisma;
        this.ctx = ctx;
    }
    async right(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, { userId: this.ctx.getUserId(), menuId: exports.GRN_MENU_ID, right, codePrefix: 'GRN', action });
    }
    async save(dto) {
        await this.right(dto.header.grnId ? 'edit' : 'create', 'save a GRN');
        if (dto.header.post)
            await this.right('post', 'post a GRN');
        const data = await this.service.save(dto);
        return { success: true, message: `GRN ${data.header.grnRefno} ${dto.header.post ? 'posted' : 'saved as draft'}`, data };
    }
    async post(dto) {
        await this.right('post', 'post a GRN');
        const data = await this.service.post(dto.grnId, dto.accYear);
        return { success: true, message: `GRN ${data.header.grnRefno} posted`, data };
    }
    async get(q) {
        await this.right('view', 'open a GRN');
        return { success: true, message: 'GRN fetched', data: await this.service.get(q.grnId, q.accYear) };
    }
    async cancel(dto) {
        await this.right('cancel', 'cancel a GRN');
        const data = await this.service.cancel(dto);
        return { success: true, message: `GRN ${data.header.grnRefno} cancelled`, data };
    }
};
exports.PurchaseGrnController = PurchaseGrnController;
__decorate([
    (0, common_1.Post)('save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Save a GRN draft; header.post = true saves and posts (stock in, Dr Stock / Cr GRNI, coolie per loadman, challan short).' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SaveGrnDto]),
    __metadata("design:returntype", Promise)
], PurchaseGrnController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Post a saved GRN draft.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GrnRefDto]),
    __metadata("design:returntype", Promise)
], PurchaseGrnController.prototype, "post", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'A GRN with its lines, allocation rows and bill status.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GrnRefDto]),
    __metadata("design:returntype", Promise)
], PurchaseGrnController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a posted, un-billed GRN: stock out, voucher reversed, coolie rows withdrawn.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GrnCancelDto]),
    __metadata("design:returntype", Promise)
], PurchaseGrnController.prototype, "cancel", null);
exports.PurchaseGrnController = PurchaseGrnController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — GRN'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase/grns'),
    __metadata("design:paramtypes", [PurchaseGrnService, prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseGrnController);
let PurchaseLabelsController = class PurchaseLabelsController {
    service;
    prisma;
    ctx;
    constructor(service, prisma, ctx) {
        this.service = service;
        this.prisma = prisma;
        this.ctx = ctx;
    }
    async fromDoc(q) {
        await (0, rights_1.assertMenuRight)(this.prisma, { userId: this.ctx.getUserId(), menuId: q.docType === 'GRN' ? exports.GRN_MENU_ID : 24, right: 'view', codePrefix: 'LBL', action: 'print purchase labels' });
        return { success: true, message: 'Labels', data: await this.service.labels(q) };
    }
};
exports.PurchaseLabelsController = PurchaseLabelsController;
__decorate([
    (0, common_1.Get)('from-doc'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'ENT-21: the labels of a GRN or purchase bill — one row per saleable allocation row, copies = received + free (damaged get none).' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LabelsFromDocDto]),
    __metadata("design:returntype", Promise)
], PurchaseLabelsController.prototype, "fromDoc", null);
exports.PurchaseLabelsController = PurchaseLabelsController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — Labels'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase/labels'),
    __metadata("design:paramtypes", [PurchaseGrnService, prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseLabelsController);
//# sourceMappingURL=purchase-grn.js.map