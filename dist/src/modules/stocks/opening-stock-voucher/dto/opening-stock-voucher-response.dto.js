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
exports.OpeningReconcileSuccessDto = exports.PendingOpeningItemsSuccessDto = exports.OpeningStockDeleteSuccessDto = exports.OpeningStockCancelSuccessDto = exports.OpeningStockPostSuccessDto = exports.OpeningStockValidateSuccessDto = exports.OpeningStockListSuccessDto = exports.OpeningStockSaveSuccessDto = exports.OpeningStockSavedDocumentDto = exports.OpeningStockDocumentSuccessDto = exports.OpeningReconcileDto = exports.OpeningReconcileRowDto = exports.PendingOpeningItemsDto = exports.PendingOpeningItemDto = exports.OpeningStockDeleteResultDto = exports.OpeningStockImportSuccessDto = exports.OpeningStockImportResultDto = exports.OpeningStockCancelResultDto = exports.OpeningStockPostResultDto = exports.OpeningStockLineProblemDto = exports.OpeningStockListDto = exports.PagedMetaDto = exports.OpeningStockListItemDto = exports.OpeningStockDocumentDto = exports.OpeningStockLineDto = exports.OpeningStockHeaderDto = exports.OpeningStockErrorResponseDto = exports.OpeningStockErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const stock_voucher_types_1 = require("../../stock-voucher/types/stock-voucher.types");
class OpeningStockErrorFieldDto {
    field;
    message;
}
exports.OpeningStockErrorFieldDto = OpeningStockErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'toGodownId' }),
    __metadata("design:type", String)
], OpeningStockErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'An opening stock must name the godown the stock arrives in.' }),
    __metadata("design:type", String)
], OpeningStockErrorFieldDto.prototype, "message", void 0);
class OpeningStockErrorResponseDto {
    success;
    message;
    errors;
}
exports.OpeningStockErrorResponseDto = OpeningStockErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], OpeningStockErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'This opening stock cannot be saved' }),
    __metadata("design:type", String)
], OpeningStockErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], OpeningStockErrorResponseDto.prototype, "errors", void 0);
class OpeningStockHeaderDto {
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
exports.OpeningStockHeaderDto = OpeningStockHeaderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockHeaderDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], OpeningStockHeaderDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockHeaderDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockHeaderDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockHeaderDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'OPENING' }),
    __metadata("design:type", String)
], OpeningStockHeaderDto.prototype, "voucherType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1', description: 'bigint, serialized as a string' }),
    __metadata("design:type", String)
], OpeningStockHeaderDto.prototype, "slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'OPN/2026-2027/TILL-01/1' }),
    __metadata("design:type", String)
], OpeningStockHeaderDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "usrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'string', format: 'date', example: '2026-04-01' }),
    __metadata("design:type", String)
], OpeningStockHeaderDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], OpeningStockHeaderDto.prototype, "docDatetime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "fromGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "fromGodownName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "godownName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'TRANSFER only — null on an opening.',
    }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "toBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: "The other side's own reference." }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "partyRef", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'stock_reason_master.srm_name' }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "reasonName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'All four, or all null — ck_svh_link.' }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "linkSrcModule", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "linkSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "linkSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "linkSrcAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'PHYSICAL only — always false on an opening.' }),
    __metadata("design:type", Boolean)
], OpeningStockHeaderDto.prototype, "freezeStock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "freezeFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "freezeTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'date-time',
        nullable: true,
        description: 'When an offline device synced this document up.',
    }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "syncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: stock_voucher_types_1.STOCK_VOUCHER_STATUSES }),
    __metadata("design:type", String)
], OpeningStockHeaderDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Trigger-maintained. The screen never sums its own grid.' }),
    __metadata("design:type", Number)
], OpeningStockHeaderDto.prototype, "lineCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Trigger-maintained. Free goods are included — they are stock.' }),
    __metadata("design:type", Number)
], OpeningStockHeaderDto.prototype, "totalQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Trigger-maintained.' }),
    __metadata("design:type", Number)
], OpeningStockHeaderDto.prototype, "totalValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Trigger-maintained.' }),
    __metadata("design:type", Number)
], OpeningStockHeaderDto.prototype, "totalValueWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "postedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "postedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "postedByName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "cancelledOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "cancelReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: stock_voucher_types_1.STOCK_RATE_SOURCES, nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "rateSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], OpeningStockHeaderDto.prototype, "isDeleted", void 0);
class OpeningStockLineDto {
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
exports.OpeningStockLineDto = OpeningStockLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockLineDto.prototype, "sviId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "splitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockLineDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockLineDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'item_unit_conversion.iuc_id' }),
    __metadata("design:type", String)
], OpeningStockLineDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'item_unit_conversion.iuc_id' }),
    __metadata("design:type", String)
], OpeningStockLineDto.prototype, "baseUomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Read from item_unit_conversion, never from the payload.' }),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "toBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockLineDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "godownName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: stock_voucher_types_1.STOCK_BUCKETS }),
    __metadata("design:type", String)
], OpeningStockLineDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'What the scanner read, verbatim. Echoed back as stored; the line is identified by itemId / batchNo / serialNo, not by this.',
    }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "barcode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "mfgDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "expiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "salePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "serialNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'qty × toBaseFactor, computed server-side' }),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "baseQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "freeQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "freeBaseQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Net weight as keyed. Carried, never derived — a 10kg bag that weighs 9.7kg opens at what the scale said.',
    }),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "weightQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "costRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Derived by the engine from taxPerc at post, then written back.' }),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "costRateWot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cost including freight, duty and handling attributed to the line.' }),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "landedRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "taxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'stock_reason_master.srm_name' }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "reasonName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "syncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'GENERATED — (baseQty + freeBaseQty) × costRate, rounded to 2.' }),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'GENERATED.' }),
    __metadata("design:type", Number)
], OpeningStockLineDto.prototype, "valueWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'NULL while DRAFT and filled by the post. Not missing data — it means this line has not reached the ledger yet, and the screen may render it as the tick that says it has.',
    }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "lotId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineDto.prototype, "remarks", void 0);
class OpeningStockDocumentDto {
    header;
    lines;
}
exports.OpeningStockDocumentDto = OpeningStockDocumentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockHeaderDto }),
    __metadata("design:type", OpeningStockHeaderDto)
], OpeningStockDocumentDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockLineDto, isArray: true }),
    __metadata("design:type", Array)
], OpeningStockDocumentDto.prototype, "lines", void 0);
class OpeningStockListItemDto {
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
exports.OpeningStockListItemDto = OpeningStockListItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockListItemDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockListItemDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockListItemDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockListItemDto.prototype, "usrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'string', format: 'date' }),
    __metadata("design:type", String)
], OpeningStockListItemDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockListItemDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockListItemDto.prototype, "godownName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: stock_voucher_types_1.STOCK_VOUCHER_STATUSES }),
    __metadata("design:type", String)
], OpeningStockListItemDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockListItemDto.prototype, "lineCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockListItemDto.prototype, "totalQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockListItemDto.prototype, "totalValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockListItemDto.prototype, "totalValueWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockListItemDto.prototype, "postedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: stock_voucher_types_1.STOCK_RATE_SOURCES, nullable: true }),
    __metadata("design:type", Object)
], OpeningStockListItemDto.prototype, "rateSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockListItemDto.prototype, "remarks", void 0);
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
class OpeningStockListDto {
    items;
    meta;
}
exports.OpeningStockListDto = OpeningStockListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockListItemDto, isArray: true }),
    __metadata("design:type", Array)
], OpeningStockListDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PagedMetaDto }),
    __metadata("design:type", PagedMetaDto)
], OpeningStockListDto.prototype, "meta", void 0);
class OpeningStockLineProblemDto {
    sviId;
    lineNo;
    splitNo;
    itemId;
    itemCode;
    itemName;
    problem;
}
exports.OpeningStockLineProblemDto = OpeningStockLineProblemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockLineProblemDto.prototype, "sviId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockLineProblemDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockLineProblemDto.prototype, "splitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockLineProblemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockLineProblemDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockLineProblemDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'this holding already has an opening in this year',
        description: 'null on a clean line. The wording comes from the preflight query and matches what the engine raises — it is not paraphrased in TypeScript.',
    }),
    __metadata("design:type", Object)
], OpeningStockLineProblemDto.prototype, "problem", void 0);
class OpeningStockPostResultDto extends OpeningStockDocumentDto {
    rowsPosted;
    status;
    postedOn;
}
exports.OpeningStockPostResultDto = OpeningStockPostResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Ledger rows written by stock.fn_svh_post.' }),
    __metadata("design:type", Number)
], OpeningStockPostResultDto.prototype, "rowsPosted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'POSTED' }),
    __metadata("design:type", String)
], OpeningStockPostResultDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockPostResultDto.prototype, "postedOn", void 0);
class OpeningStockCancelResultDto extends OpeningStockDocumentDto {
    rowsReversed;
    status;
    cancelledOn;
}
exports.OpeningStockCancelResultDto = OpeningStockCancelResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Reversal rows written by stock.fn_svh_cancel.' }),
    __metadata("design:type", Number)
], OpeningStockCancelResultDto.prototype, "rowsReversed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CANCELLED' }),
    __metadata("design:type", String)
], OpeningStockCancelResultDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], OpeningStockCancelResultDto.prototype, "cancelledOn", void 0);
class OpeningStockImportResultDto extends OpeningStockDocumentDto {
    rowsRead;
    linesImported;
    problems;
}
exports.OpeningStockImportResultDto = OpeningStockImportResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Data rows found in the file, blank rows excluded.' }),
    __metadata("design:type", Number)
], OpeningStockImportResultDto.prototype, "rowsRead", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Lines written. Equal to rowsRead — a partial import is refused outright.',
    }),
    __metadata("design:type", Number)
], OpeningStockImportResultDto.prototype, "linesImported", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: OpeningStockLineProblemDto,
        isArray: true,
        description: 'The preflight, run immediately after the write: an import that resolved cleanly can still produce lines the engine will refuse.',
    }),
    __metadata("design:type", Array)
], OpeningStockImportResultDto.prototype, "problems", void 0);
class OpeningStockImportSuccessDto {
    success;
    message;
    data;
}
exports.OpeningStockImportSuccessDto = OpeningStockImportSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningStockImportSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '40 lines imported, all clean' }),
    __metadata("design:type", String)
], OpeningStockImportSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockImportResultDto }),
    __metadata("design:type", OpeningStockImportResultDto)
], OpeningStockImportSuccessDto.prototype, "data", void 0);
class OpeningStockDeleteResultDto {
    svhId;
    accYear;
    deleted;
}
exports.OpeningStockDeleteResultDto = OpeningStockDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockDeleteResultDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockDeleteResultDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningStockDeleteResultDto.prototype, "deleted", void 0);
class PendingOpeningItemDto {
    itemId;
    itemCode;
    itemName;
    baseUomId;
    unitName;
    trackSignature;
}
exports.PendingOpeningItemDto = PendingOpeningItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PendingOpeningItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PendingOpeningItemDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PendingOpeningItemDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PendingOpeningItemDto.prototype, "baseUomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PendingOpeningItemDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'BE' }),
    __metadata("design:type", Object)
], PendingOpeningItemDto.prototype, "trackSignature", void 0);
class PendingOpeningItemsDto {
    items;
    meta;
}
exports.PendingOpeningItemsDto = PendingOpeningItemsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: PendingOpeningItemDto, isArray: true }),
    __metadata("design:type", Array)
], PendingOpeningItemsDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PagedMetaDto }),
    __metadata("design:type", PagedMetaDto)
], PendingOpeningItemsDto.prototype, "meta", void 0);
class OpeningReconcileRowDto {
    itemId;
    itemCode;
    itemName;
    unitName;
    openingQty;
    openingValue;
    currentQty;
    currentValue;
    diffQty;
    diffValue;
}
exports.OpeningReconcileRowDto = OpeningReconcileRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningReconcileRowDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningReconcileRowDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningReconcileRowDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningReconcileRowDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'From the LEDGER, not the document — so a cancelled opening correctly reads as zero.',
    }),
    __metadata("design:type", Number)
], OpeningReconcileRowDto.prototype, "openingQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningReconcileRowDto.prototype, "openingValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningReconcileRowDto.prototype, "currentQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningReconcileRowDto.prototype, "currentValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningReconcileRowDto.prototype, "diffQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningReconcileRowDto.prototype, "diffValue", void 0);
class OpeningReconcileDto {
    items;
    meta;
}
exports.OpeningReconcileDto = OpeningReconcileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningReconcileRowDto, isArray: true }),
    __metadata("design:type", Array)
], OpeningReconcileDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PagedMetaDto }),
    __metadata("design:type", PagedMetaDto)
], OpeningReconcileDto.prototype, "meta", void 0);
class OpeningStockDocumentSuccessDto {
    success;
    message;
    data;
}
exports.OpeningStockDocumentSuccessDto = OpeningStockDocumentSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningStockDocumentSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening stock fetched successfully' }),
    __metadata("design:type", String)
], OpeningStockDocumentSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockDocumentDto }),
    __metadata("design:type", OpeningStockDocumentDto)
], OpeningStockDocumentSuccessDto.prototype, "data", void 0);
class OpeningStockSavedDocumentDto extends OpeningStockDocumentDto {
    rowsPosted;
}
exports.OpeningStockSavedDocumentDto = OpeningStockSavedDocumentDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: Number,
        nullable: true,
        example: null,
        description: "null when the save left a draft; the number of stock_ledger rows written when header.status was 'POSTED'.",
    }),
    __metadata("design:type", Object)
], OpeningStockSavedDocumentDto.prototype, "rowsPosted", void 0);
class OpeningStockSaveSuccessDto {
    success;
    message;
    data;
}
exports.OpeningStockSaveSuccessDto = OpeningStockSaveSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningStockSaveSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening stock created successfully' }),
    __metadata("design:type", String)
], OpeningStockSaveSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockSavedDocumentDto }),
    __metadata("design:type", OpeningStockSavedDocumentDto)
], OpeningStockSaveSuccessDto.prototype, "data", void 0);
class OpeningStockListSuccessDto {
    success;
    message;
    data;
}
exports.OpeningStockListSuccessDto = OpeningStockListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningStockListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening stock list fetched successfully' }),
    __metadata("design:type", String)
], OpeningStockListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockListDto }),
    __metadata("design:type", OpeningStockListDto)
], OpeningStockListSuccessDto.prototype, "data", void 0);
class OpeningStockValidateSuccessDto {
    success;
    message;
    data;
}
exports.OpeningStockValidateSuccessDto = OpeningStockValidateSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningStockValidateSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2 of 40 lines have problems' }),
    __metadata("design:type", String)
], OpeningStockValidateSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockLineProblemDto, isArray: true }),
    __metadata("design:type", Array)
], OpeningStockValidateSuccessDto.prototype, "data", void 0);
class OpeningStockPostSuccessDto {
    success;
    message;
    data;
}
exports.OpeningStockPostSuccessDto = OpeningStockPostSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningStockPostSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening stock posted successfully' }),
    __metadata("design:type", String)
], OpeningStockPostSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockPostResultDto }),
    __metadata("design:type", OpeningStockPostResultDto)
], OpeningStockPostSuccessDto.prototype, "data", void 0);
class OpeningStockCancelSuccessDto {
    success;
    message;
    data;
}
exports.OpeningStockCancelSuccessDto = OpeningStockCancelSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningStockCancelSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening stock cancelled successfully' }),
    __metadata("design:type", String)
], OpeningStockCancelSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockCancelResultDto }),
    __metadata("design:type", OpeningStockCancelResultDto)
], OpeningStockCancelSuccessDto.prototype, "data", void 0);
class OpeningStockDeleteSuccessDto {
    success;
    message;
    data;
}
exports.OpeningStockDeleteSuccessDto = OpeningStockDeleteSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningStockDeleteSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening stock deleted successfully' }),
    __metadata("design:type", String)
], OpeningStockDeleteSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockDeleteResultDto }),
    __metadata("design:type", OpeningStockDeleteResultDto)
], OpeningStockDeleteSuccessDto.prototype, "data", void 0);
class PendingOpeningItemsSuccessDto {
    success;
    message;
    data;
}
exports.PendingOpeningItemsSuccessDto = PendingOpeningItemsSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PendingOpeningItemsSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Pending opening items fetched successfully' }),
    __metadata("design:type", String)
], PendingOpeningItemsSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PendingOpeningItemsDto }),
    __metadata("design:type", PendingOpeningItemsDto)
], PendingOpeningItemsSuccessDto.prototype, "data", void 0);
class OpeningReconcileSuccessDto {
    success;
    message;
    data;
}
exports.OpeningReconcileSuccessDto = OpeningReconcileSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningReconcileSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening reconciliation fetched successfully' }),
    __metadata("design:type", String)
], OpeningReconcileSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningReconcileDto }),
    __metadata("design:type", OpeningReconcileDto)
], OpeningReconcileSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=opening-stock-voucher-response.dto.js.map