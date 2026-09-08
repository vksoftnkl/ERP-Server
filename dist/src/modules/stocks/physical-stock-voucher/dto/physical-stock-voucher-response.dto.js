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
exports.StockVarianceSuccessDto = exports.CountSheetSuccessDto = exports.PhysicalStockDeleteSuccessDto = exports.PhysicalStockCancelSuccessDto = exports.PhysicalStockPostSuccessDto = exports.PhysicalStockValidateSuccessDto = exports.PhysicalStockListSuccessDto = exports.PhysicalStockDocumentSuccessDto = exports.StockVarianceDto = exports.StockVarianceRowDto = exports.CountSheetDto = exports.CountSheetRowDto = exports.PhysicalStockDeleteResultDto = exports.PhysicalStockCancelResultDto = exports.PhysicalStockPostResultDto = exports.PhysicalStockLineProblemDto = exports.PhysicalStockListDto = exports.PagedMetaDto = exports.PhysicalStockListItemDto = exports.PhysicalStockDocumentDto = exports.PhysicalStockLineDto = exports.PhysicalStockHeaderDto = exports.PhysicalStockErrorResponseDto = exports.PhysicalStockErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const stock_voucher_types_1 = require("../../stock-voucher/types/stock-voucher.types");
class PhysicalStockErrorFieldDto {
    field;
    message;
}
exports.PhysicalStockErrorFieldDto = PhysicalStockErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'lines.0' }),
    __metadata("design:type", String)
], PhysicalStockErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Line 1 has not been counted yet. Send countedQty: 0 to record that nothing was found — absent means the counter has not reached this line.',
    }),
    __metadata("design:type", String)
], PhysicalStockErrorFieldDto.prototype, "message", void 0);
class PhysicalStockErrorResponseDto {
    success;
    message;
    errors;
}
exports.PhysicalStockErrorResponseDto = PhysicalStockErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PhysicalStockErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'This physical stock count cannot be saved' }),
    __metadata("design:type", String)
], PhysicalStockErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], PhysicalStockErrorResponseDto.prototype, "errors", void 0);
class PhysicalStockHeaderDto {
    svhId;
    accYear;
    companyId;
    branchId;
    tenantId;
    deviceId;
    sessionId;
    voucherType;
    slno;
    refno;
    usrRefno;
    docDate;
    docDatetime;
    fromGodownId;
    fromGodownName;
    godownId;
    godownName;
    supplierId;
    toBranchId;
    partyRef;
    reasonId;
    reasonName;
    linkSrcModule;
    linkSrcDocType;
    linkSrcDocId;
    linkSrcAccYear;
    freezeStock;
    freezeFrom;
    freezeTo;
    syncDate;
    status;
    lineCount;
    totalQty;
    totalValue;
    totalValueWot;
    postedOn;
    postedBy;
    postedByName;
    cancelledOn;
    cancelReason;
    rateSource;
    remarks;
    isDeleted;
}
exports.PhysicalStockHeaderDto = PhysicalStockHeaderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PhysicalStockHeaderDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], PhysicalStockHeaderDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PhysicalStockHeaderDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PhysicalStockHeaderDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PhysicalStockHeaderDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'PHYSICAL' }),
    __metadata("design:type", String)
], PhysicalStockHeaderDto.prototype, "voucherType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1', description: 'bigint, serialized as a string' }),
    __metadata("design:type", String)
], PhysicalStockHeaderDto.prototype, "slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'PHY/2026-2027/TILL-01/1' }),
    __metadata("design:type", String)
], PhysicalStockHeaderDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "usrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'string', format: 'date', example: '2026-06-30' }),
    __metadata("design:type", String)
], PhysicalStockHeaderDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], PhysicalStockHeaderDto.prototype, "docDatetime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true, description: 'Unused by a count.' }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "fromGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "fromGodownName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'THE GODOWN BEING COUNTED (svh_to_godown_id). Every line is in it.',
    }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "godownName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'TRANSFER only — null on a count.',
    }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "toBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "partyRef", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The header reason every variance line inherits — a whole count explained as "Shrinkage" without touching a line.',
    }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'stock_reason_master.srm_name' }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "reasonName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'All four, or all null — ck_svh_link.' }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "linkSrcModule", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "linkSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "linkSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "linkSrcAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '§11 — whether movements touching this godown are refused while the count is DRAFT. Posting or cancelling the sheet lifts it without waiting for freezeTo.',
    }),
    __metadata("design:type", Boolean)
], PhysicalStockHeaderDto.prototype, "freezeStock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'date-time',
        nullable: true,
        description: 'WALL CLOCK, NOT DOCUMENT DATE — the guard compares the window to now().',
    }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "freezeFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "freezeTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "syncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: stock_voucher_types_1.STOCK_VOUCHER_STATUSES }),
    __metadata("design:type", String)
], PhysicalStockHeaderDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Trigger-maintained — lines counted, variance or not.' }),
    __metadata("design:type", Number)
], PhysicalStockHeaderDto.prototype, "lineCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'THE NET VARIANCE, not the sum of anything on the screen: read off the ledger by fn_svh_recompute. Three lines totalling 236 counted units can total +1 here. A DRAFT count truthfully totals 0, because nothing has posted. Label it "Net variance" on the screen, or do not show it.',
    }),
    __metadata("design:type", Number)
], PhysicalStockHeaderDto.prototype, "totalQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The net variance in value — see totalQty.' }),
    __metadata("design:type", Number)
], PhysicalStockHeaderDto.prototype, "totalValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The net variance excluding tax.' }),
    __metadata("design:type", Number)
], PhysicalStockHeaderDto.prototype, "totalValueWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "postedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "postedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "postedByName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "cancelledOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "cancelReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.STOCK_RATE_SOURCES,
        nullable: true,
        description: 'AVG_COST when the payload named none — found stock is worth what the rest of that item is worth. It values the OVERAGE lines only; a shortage is relieved at what the stock cost us.',
    }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "rateSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockHeaderDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], PhysicalStockHeaderDto.prototype, "isDeleted", void 0);
class PhysicalStockLineDto {
    sviId;
    lineNo;
    splitNo;
    itemId;
    itemCode;
    itemName;
    unitName;
    uomId;
    baseUomId;
    toBaseFactor;
    godownId;
    godownName;
    bucket;
    barcode;
    batchNo;
    mfgDate;
    expiryDate;
    mrp;
    salePrice;
    serialNo;
    supplierId;
    bookQty;
    countedQty;
    diffQty;
    qty;
    baseQty;
    freeQty;
    freeBaseQty;
    weightQty;
    costRate;
    costRateWot;
    landedRate;
    taxPerc;
    reasonId;
    reasonName;
    syncDate;
    value;
    valueWot;
    lotId;
    remarks;
}
exports.PhysicalStockLineDto = PhysicalStockLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PhysicalStockLineDto.prototype, "sviId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "splitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PhysicalStockLineDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PhysicalStockLineDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "The holding's base unit, read from stock_balance. A count is taken in it.",
    }),
    __metadata("design:type", String)
], PhysicalStockLineDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PhysicalStockLineDto.prototype, "baseUomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Always 1 on a count — the book figure is already in the base unit.',
    }),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "toBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PhysicalStockLineDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "godownName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: stock_voucher_types_1.STOCK_BUCKETS }),
    __metadata("design:type", String)
], PhysicalStockLineDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Unused by a count.' }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "barcode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Copied from the holding, never from the payload.',
    }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "mfgDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "expiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "salePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "serialNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'What the system thought was on the shelf — a SNAPSHOT of stock_balance.sbl_on_hand_qty taken at save, read by the server and never taken from the payload. It is not refreshed at post and not recomputed on load: it is what lets a variance be defended a year later.',
    }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "bookQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'What was actually on the shelf.' }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "countedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'GENERATED ALWAYS — counted − book. SIGNED, where every other quantity in the engine is a magnitude, because it is not a quantity but a difference. abs(diffQty) is what posts; 0 posts nothing and the line is still a line that was counted.',
    }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "diffQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '0 for the whole document — a count states no quantity to move.' }),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '0 — see qty.' }),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "baseQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '0 — see qty.' }),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "freeQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '0 — see qty.' }),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "freeBaseQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '0 — see qty.' }),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "weightQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "0 while DRAFT, in both directions and on purpose. The post writes back what the engine resolved: an overage at the document rate source, a shortage at the rate fn_sml_cost_default stamped from the item's valuation policy.",
    }),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "costRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "costRateWot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "landedRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "taxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'stock_reason_master.srm_name' }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "reasonName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "syncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'GENERATED.' }),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'GENERATED.' }),
    __metadata("design:type", Number)
], PhysicalStockLineDto.prototype, "valueWot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'FILLED FROM THE MOMENT OF SAVE, unlike every other document type — it is where the book figure came from. So the screen cannot use it as the "reached the ledger" tick; use diffQty <> 0 plus status POSTED, or GET /stock/physical/variance.',
    }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "lotId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockLineDto.prototype, "remarks", void 0);
class PhysicalStockDocumentDto {
    header;
    lines;
}
exports.PhysicalStockDocumentDto = PhysicalStockDocumentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockHeaderDto }),
    __metadata("design:type", PhysicalStockHeaderDto)
], PhysicalStockDocumentDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockLineDto, isArray: true }),
    __metadata("design:type", Array)
], PhysicalStockDocumentDto.prototype, "lines", void 0);
class PhysicalStockListItemDto {
    svhId;
    accYear;
    refno;
    usrRefno;
    docDate;
    godownId;
    godownName;
    status;
    lineCount;
    totalQty;
    totalValue;
    totalValueWot;
    postedOn;
    rateSource;
    remarks;
}
exports.PhysicalStockListItemDto = PhysicalStockListItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PhysicalStockListItemDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PhysicalStockListItemDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PhysicalStockListItemDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockListItemDto.prototype, "usrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'string', format: 'date' }),
    __metadata("design:type", String)
], PhysicalStockListItemDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockListItemDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockListItemDto.prototype, "godownName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: stock_voucher_types_1.STOCK_VOUCHER_STATUSES }),
    __metadata("design:type", String)
], PhysicalStockListItemDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PhysicalStockListItemDto.prototype, "lineCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The net variance — see PhysicalStockHeaderDto.totalQty.' }),
    __metadata("design:type", Number)
], PhysicalStockListItemDto.prototype, "totalQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The net variance in value.' }),
    __metadata("design:type", Number)
], PhysicalStockListItemDto.prototype, "totalValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PhysicalStockListItemDto.prototype, "totalValueWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockListItemDto.prototype, "postedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: stock_voucher_types_1.STOCK_RATE_SOURCES, nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockListItemDto.prototype, "rateSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockListItemDto.prototype, "remarks", void 0);
class PagedMetaDto {
    limit;
    offset;
    count;
}
exports.PagedMetaDto = PagedMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PagedMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PagedMetaDto.prototype, "offset", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PagedMetaDto.prototype, "count", void 0);
class PhysicalStockListDto {
    items;
    meta;
}
exports.PhysicalStockListDto = PhysicalStockListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockListItemDto, isArray: true }),
    __metadata("design:type", Array)
], PhysicalStockListDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PagedMetaDto }),
    __metadata("design:type", PagedMetaDto)
], PhysicalStockListDto.prototype, "meta", void 0);
class PhysicalStockLineProblemDto {
    sviId;
    lineNo;
    splitNo;
    itemId;
    itemCode;
    itemName;
    problem;
}
exports.PhysicalStockLineProblemDto = PhysicalStockLineProblemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PhysicalStockLineProblemDto.prototype, "sviId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PhysicalStockLineProblemDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PhysicalStockLineProblemDto.prototype, "splitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PhysicalStockLineProblemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockLineProblemDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PhysicalStockLineProblemDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'the book quantity has changed since this sheet was generated',
        description: 'null on a clean line — INCLUDING a line that agrees, which is still a line that was counted and which the screen ticks. The wording comes from the preflight query and matches what the engine raises; it is not paraphrased in TypeScript.',
    }),
    __metadata("design:type", Object)
], PhysicalStockLineProblemDto.prototype, "problem", void 0);
class PhysicalStockPostResultDto extends PhysicalStockDocumentDto {
    rowsPosted;
    status;
    postedOn;
}
exports.PhysicalStockPostResultDto = PhysicalStockPostResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Ledger rows written by stock.fn_svh_post — ONE PER VARYING LINE, and legitimately fewer than lineCount. A count where every line agrees returns 0 and still closes POSTED: that is a success, not an empty document.',
    }),
    __metadata("design:type", Number)
], PhysicalStockPostResultDto.prototype, "rowsPosted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'POSTED' }),
    __metadata("design:type", String)
], PhysicalStockPostResultDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockPostResultDto.prototype, "postedOn", void 0);
class PhysicalStockCancelResultDto extends PhysicalStockDocumentDto {
    rowsReversed;
    status;
    cancelledOn;
}
exports.PhysicalStockCancelResultDto = PhysicalStockCancelResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Reversal rows written by stock.fn_svh_cancel.' }),
    __metadata("design:type", Number)
], PhysicalStockCancelResultDto.prototype, "rowsReversed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CANCELLED' }),
    __metadata("design:type", String)
], PhysicalStockCancelResultDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], PhysicalStockCancelResultDto.prototype, "cancelledOn", void 0);
class PhysicalStockDeleteResultDto {
    svhId;
    accYear;
    deleted;
}
exports.PhysicalStockDeleteResultDto = PhysicalStockDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PhysicalStockDeleteResultDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PhysicalStockDeleteResultDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PhysicalStockDeleteResultDto.prototype, "deleted", void 0);
class CountSheetRowDto {
    lineNo;
    splitNo;
    itemId;
    itemCode;
    itemName;
    lotId;
    godownId;
    godownName;
    bucket;
    baseUomId;
    unitName;
    batchNo;
    mfgDate;
    expiryDate;
    mrp;
    salePrice;
    serialNo;
    supplierId;
    bookQty;
    avgCostRate;
    stockValue;
    countedQty;
}
exports.CountSheetRowDto = CountSheetRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Assigned server-side, and continuing across pages.' }),
    __metadata("design:type", Number)
], CountSheetRowDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'Always 1: one row already means one holding.' }),
    __metadata("design:type", Number)
], CountSheetRowDto.prototype, "splitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CountSheetRowDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CountSheetRowDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CountSheetRowDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'stock.stock_lot.slt_id — send it back verbatim on save.',
    }),
    __metadata("design:type", String)
], CountSheetRowDto.prototype, "lotId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CountSheetRowDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CountSheetRowDto.prototype, "godownName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: stock_voucher_types_1.STOCK_BUCKETS }),
    __metadata("design:type", String)
], CountSheetRowDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CountSheetRowDto.prototype, "baseUomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CountSheetRowDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CountSheetRowDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    __metadata("design:type", Object)
], CountSheetRowDto.prototype, "mfgDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    __metadata("design:type", Object)
], CountSheetRowDto.prototype, "expiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CountSheetRowDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CountSheetRowDto.prototype, "salePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CountSheetRowDto.prototype, "serialNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CountSheetRowDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'sbl_on_hand_qty. Withhold it from the counter on a blind count — the whole point of a count is that the shelf is measured, not confirmed.',
    }),
    __metadata("design:type", Number)
], CountSheetRowDto.prototype, "bookQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CountSheetRowDto.prototype, "avgCostRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CountSheetRowDto.prototype, "stockValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'number',
        nullable: true,
        description: 'Always null — this is the one column the screen fills.',
    }),
    __metadata("design:type", void 0)
], CountSheetRowDto.prototype, "countedQty", void 0);
class CountSheetDto {
    items;
    meta;
}
exports.CountSheetDto = CountSheetDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: CountSheetRowDto, isArray: true }),
    __metadata("design:type", Array)
], CountSheetDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PagedMetaDto }),
    __metadata("design:type", PagedMetaDto)
], CountSheetDto.prototype, "meta", void 0);
class StockVarianceRowDto {
    lineNo;
    splitNo;
    itemId;
    itemCode;
    itemName;
    batchNo;
    txnType;
    direction;
    qty;
    signedBaseQty;
    costRate;
    costValue;
    reasonId;
    reasonName;
}
exports.StockVarianceRowDto = StockVarianceRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "The COUNT SHEET's own line number, kept by the engine." }),
    __metadata("design:type", Number)
], StockVarianceRowDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockVarianceRowDto.prototype, "splitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockVarianceRowDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockVarianceRowDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], StockVarianceRowDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockVarianceRowDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'PHYSICAL_MINUS',
        description: 'PHYSICAL_PLUS or PHYSICAL_MINUS — one document writes both.',
    }),
    __metadata("design:type", String)
], StockVarianceRowDto.prototype, "txnType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: -1, description: '+1 inward, −1 outward.' }),
    __metadata("design:type", Number)
], StockVarianceRowDto.prototype, "direction", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'A MAGNITUDE — the sign lives in direction alone.' }),
    __metadata("design:type", Number)
], StockVarianceRowDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: -2 }),
    __metadata("design:type", Number)
], StockVarianceRowDto.prototype, "signedBaseQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 20,
        description: "The shortage rate the engine stamped from the item's valuation policy, or the overage rate it derived from the document's rate source. This report is the only place the two sit side by side.",
    }),
    __metadata("design:type", Number)
], StockVarianceRowDto.prototype, "costRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 40 }),
    __metadata("design:type", Number)
], StockVarianceRowDto.prototype, "costValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockVarianceRowDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockVarianceRowDto.prototype, "reasonName", void 0);
class StockVarianceDto {
    items;
    meta;
}
exports.StockVarianceDto = StockVarianceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockVarianceRowDto, isArray: true }),
    __metadata("design:type", Array)
], StockVarianceDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PagedMetaDto }),
    __metadata("design:type", PagedMetaDto)
], StockVarianceDto.prototype, "meta", void 0);
class PhysicalStockDocumentSuccessDto {
    success;
    message;
    data;
}
exports.PhysicalStockDocumentSuccessDto = PhysicalStockDocumentSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PhysicalStockDocumentSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Physical stock count created successfully' }),
    __metadata("design:type", String)
], PhysicalStockDocumentSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockDocumentDto }),
    __metadata("design:type", PhysicalStockDocumentDto)
], PhysicalStockDocumentSuccessDto.prototype, "data", void 0);
class PhysicalStockListSuccessDto {
    success;
    message;
    data;
}
exports.PhysicalStockListSuccessDto = PhysicalStockListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PhysicalStockListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Physical stock count list fetched successfully' }),
    __metadata("design:type", String)
], PhysicalStockListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockListDto }),
    __metadata("design:type", PhysicalStockListDto)
], PhysicalStockListSuccessDto.prototype, "data", void 0);
class PhysicalStockValidateSuccessDto {
    success;
    message;
    data;
}
exports.PhysicalStockValidateSuccessDto = PhysicalStockValidateSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PhysicalStockValidateSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'All 3 lines are clean' }),
    __metadata("design:type", String)
], PhysicalStockValidateSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockLineProblemDto, isArray: true }),
    __metadata("design:type", Array)
], PhysicalStockValidateSuccessDto.prototype, "data", void 0);
class PhysicalStockPostSuccessDto {
    success;
    message;
    data;
}
exports.PhysicalStockPostSuccessDto = PhysicalStockPostSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PhysicalStockPostSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Physical stock count posted — 2 of 3 lines had a variance' }),
    __metadata("design:type", String)
], PhysicalStockPostSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockPostResultDto }),
    __metadata("design:type", PhysicalStockPostResultDto)
], PhysicalStockPostSuccessDto.prototype, "data", void 0);
class PhysicalStockCancelSuccessDto {
    success;
    message;
    data;
}
exports.PhysicalStockCancelSuccessDto = PhysicalStockCancelSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PhysicalStockCancelSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Physical stock count cancelled successfully — 2 reversal rows' }),
    __metadata("design:type", String)
], PhysicalStockCancelSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockCancelResultDto }),
    __metadata("design:type", PhysicalStockCancelResultDto)
], PhysicalStockCancelSuccessDto.prototype, "data", void 0);
class PhysicalStockDeleteSuccessDto {
    success;
    message;
    data;
}
exports.PhysicalStockDeleteSuccessDto = PhysicalStockDeleteSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PhysicalStockDeleteSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Physical stock count deleted successfully' }),
    __metadata("design:type", String)
], PhysicalStockDeleteSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockDeleteResultDto }),
    __metadata("design:type", PhysicalStockDeleteResultDto)
], PhysicalStockDeleteSuccessDto.prototype, "data", void 0);
class CountSheetSuccessDto {
    success;
    message;
    data;
}
exports.CountSheetSuccessDto = CountSheetSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CountSheetSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '3 holdings to count' }),
    __metadata("design:type", String)
], CountSheetSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CountSheetDto }),
    __metadata("design:type", CountSheetDto)
], CountSheetSuccessDto.prototype, "data", void 0);
class StockVarianceSuccessDto {
    success;
    message;
    data;
}
exports.StockVarianceSuccessDto = StockVarianceSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockVarianceSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2 variance rows' }),
    __metadata("design:type", String)
], StockVarianceSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockVarianceDto }),
    __metadata("design:type", StockVarianceDto)
], StockVarianceSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=physical-stock-voucher-response.dto.js.map