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
exports.StockTransferDeleteSuccessDto = exports.StockTransferCancelSuccessDto = exports.StockTransferReceiveSuccessDto = exports.StockTransferPrefillSuccessDto = exports.StockTransferInboundSuccessDto = exports.StockTransferDespatchSuccessDto = exports.StockTransferValidateSuccessDto = exports.StockTransferListSuccessDto = exports.StockTransferLoadSuccessDto = exports.StockTransferDocumentSuccessDto = exports.StockTransferDeleteDataDto = exports.StockTransferCancelDataDto = exports.StockTransferReceiveDataDto = exports.StockTransferReceiveOutDto = exports.StockTransferReceiveInDto = exports.StockTransferPrefillDto = exports.StockTransferPrefillRowDto = exports.StockTransferPrefillOutDto = exports.StockTransferDespatchDataDto = exports.StockTransferLineProblemDto = exports.StockTransferInboundDto = exports.StockTransferInboundRowDto = exports.StockTransferListDto = exports.StockTransferListMetaDto = exports.StockTransferListItemDto = exports.StockTransferDocumentWithTransitDto = exports.StockTransitRowDto = exports.StockTransferDocumentDto = exports.StockTransferLineDto = exports.StockTransferHeaderDto = exports.StockTransferErrorResponseDto = exports.StockTransferErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const stock_voucher_types_1 = require("../../stock-voucher/types/stock-voucher.types");
class StockTransferErrorFieldDto {
    field;
    message;
}
exports.StockTransferErrorFieldDto = StockTransferErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'lines.0' }),
    __metadata("design:type", String)
], StockTransferErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Line 1 sends 20 but this godown holds 15 of that lot in the SALEABLE bucket. A transfer moves stock that exists; the engine will not stop this one under an ALLOW policy.',
    }),
    __metadata("design:type", String)
], StockTransferErrorFieldDto.prototype, "message", void 0);
class StockTransferErrorResponseDto {
    success;
    message;
    errors;
}
exports.StockTransferErrorResponseDto = StockTransferErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], StockTransferErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'This transfer cannot be saved' }),
    __metadata("design:type", String)
], StockTransferErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], StockTransferErrorResponseDto.prototype, "errors", void 0);
class StockTransferHeaderDto {
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
exports.StockTransferHeaderDto = StockTransferHeaderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferHeaderDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], StockTransferHeaderDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferHeaderDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The SENDING branch on a despatch, the RECEIVING branch on a receipt.',
    }),
    __metadata("design:type", String)
], StockTransferHeaderDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferHeaderDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['TRANSFER_OUT', 'TRANSFER_IN'] }),
    __metadata("design:type", String)
], StockTransferHeaderDto.prototype, "voucherType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2', description: 'bigint, serialized as a string' }),
    __metadata("design:type", String)
], StockTransferHeaderDto.prototype, "slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'TRF/2026-2027/TILL-01/2',
        description: 'TRF on a despatch, TRI on a receipt. svh_slno is unique per (company, branch, year, type, device), so the two number independently and the receiving branch numbers its own receipts offline.',
    }),
    __metadata("design:type", String)
], StockTransferHeaderDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "usrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'string', format: 'date', example: '2026-04-02' }),
    __metadata("design:type", String)
], StockTransferHeaderDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], StockTransferHeaderDto.prototype, "docDatetime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Where the stock leaves from. Mandatory on both halves — ck_svh_transfer_godowns.',
    }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "fromGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "fromGodownName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'THE DESTINATION GODOWN (svh_to_godown_id). One despatch carries ONE of these — a lorry serving three shops is three vouchers.',
    }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "godownName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'THE FIELD THAT DECIDES THE SHAPE. Null, or equal to branchId, is a godown-to-godown move that posts both halves at once and ends POSTED. Another branch is a despatch that ends IN_TRANSIT. Null on a TRANSFER_IN.',
    }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "toBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "partyRef", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'stock_reason_master.srm_name' }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "reasonName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: "'STOCK' on a receipt, stamped server-side. All four, or all null — ck_svh_link.",
    }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "linkSrcModule", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: "'STOCK_VOUCHER' on a receipt." }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "linkSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'THE DESPATCH THIS RECEIPT IS AGAINST. Mandatory on a TRANSFER_IN — ck_svh_transfer_in_link — and null on a despatch.',
    }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "linkSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: "The DESPATCH's year, which is not always the receipt's: a lorry that leaves on 29 March arrives in the next year.",
    }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "linkSrcAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Always false — only a physical count freezes stock.' }),
    __metadata("design:type", Boolean)
], StockTransferHeaderDto.prototype, "freezeStock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "freezeFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "freezeTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "syncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: stock_voucher_types_1.STOCK_VOUCHER_STATUSES,
        description: 'AN INTER-BRANCH DESPATCH IS NEVER POSTED: DRAFT → IN_TRANSIT → RECEIVED. A list filtered to POSTED loses every transfer in flight. (PARTIAL is a transit-row status, never a voucher status.)',
    }),
    __metadata("design:type", String)
], StockTransferHeaderDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Trigger-maintained.' }),
    __metadata("design:type", Number)
], StockTransferHeaderDto.prototype, "lineCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Trigger-maintained. Never written by this API.' }),
    __metadata("design:type", Number)
], StockTransferHeaderDto.prototype, "totalQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferHeaderDto.prototype, "totalValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferHeaderDto.prototype, "totalValueWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "postedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "postedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "postedByName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "cancelledOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "cancelReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.STOCK_RATE_SOURCES,
        nullable: true,
        description: 'Unused by a transfer: the cost is stamped by the engine from the item valuation policy and travels with the stock. Nobody enters a rate on either half.',
    }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "rateSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferHeaderDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], StockTransferHeaderDto.prototype, "isDeleted", void 0);
class StockTransferLineDto {
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
    syncDate;
    value;
    valueWot;
    lotId;
    bookQty;
    countedQty;
    diffQty;
    reasonId;
    reasonName;
    remarks;
}
exports.StockTransferLineDto = StockTransferLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferLineDto.prototype, "sviId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "splitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferLineDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], StockTransferLineDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'iuc_id, not unit_id.' }),
    __metadata("design:type", String)
], StockTransferLineDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferLineDto.prototype, "baseUomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Read from item_unit_conversion, never from the payload.' }),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "toBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'THE SOURCE GODOWN ON A DESPATCH AND THE DESTINATION ON A RECEIPT. Same column, two meanings, one screen apart — do not let the two grids share a field label.',
    }),
    __metadata("design:type", String)
], StockTransferLineDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "godownName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: stock_voucher_types_1.STOCK_BUCKETS,
        description: 'On a receipt: SALEABLE for what arrived good, DAMAGED for what arrived broken. Damaged units still post IN — they exist, broken.',
    }),
    __metadata("design:type", String)
], StockTransferLineDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "barcode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "mfgDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "expiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "salePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "serialNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "baseQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "freeQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "freeBaseQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "weightQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ALWAYS 0 ON A DRAFT, and stripped if the payload sends one. fn_sml_cost_default stamps the policy cost at post and the post writes it back here. A typed rate makes that trigger bail and the ledger row lands at that rate with value 0.',
    }),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "costRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "costRateWot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "landedRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "taxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "syncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'GENERATED ALWAYS — never written.' }),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'GENERATED ALWAYS — never written.' }),
    __metadata("design:type", Number)
], StockTransferLineDto.prototype, "valueWot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'THE HOLDING BEING MOVED, and mandatory on both halves — unlike every other document type, where the engine resolves it at post. A transfer moves existing stock, so the destination receives the SAME slt_id and ageing does not reset.',
    }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "lotId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Null on a transfer — count columns.' }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "bookQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "countedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "diffQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "reasonName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineDto.prototype, "remarks", void 0);
class StockTransferDocumentDto {
    header;
    lines;
}
exports.StockTransferDocumentDto = StockTransferDocumentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferHeaderDto }),
    __metadata("design:type", StockTransferHeaderDto)
], StockTransferDocumentDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferLineDto, isArray: true }),
    __metadata("design:type", Array)
], StockTransferDocumentDto.prototype, "lines", void 0);
class StockTransitRowDto {
    sttId;
    status;
    itemId;
    itemCode;
    itemName;
    lotId;
    batchNo;
    expiryDate;
    toGodownId;
    toGodownName;
    bucket;
    baseUomId;
    unitName;
    sentQty;
    receivedQty;
    damageQty;
    remainingQty;
    costRate;
    transitValue;
    lrNo;
    vehicleNo;
    expectedOn;
    sentOn;
    receivedOn;
}
exports.StockTransitRowDto = StockTransitRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransitRowDto.prototype, "sttId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['IN_TRANSIT', 'PARTIAL', 'RECEIVED', 'CANCELLED'],
        description: 'PARTIAL is a TRANSIT status and never a voucher status.',
    }),
    __metadata("design:type", String)
], StockTransitRowDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransitRowDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransitRowDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], StockTransitRowDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransitRowDto.prototype, "lotId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'B-2604' }),
    __metadata("design:type", Object)
], StockTransitRowDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    __metadata("design:type", Object)
], StockTransitRowDto.prototype, "expiryDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "The receipt line's godownId comes from HERE, never from a picker.",
    }),
    __metadata("design:type", String)
], StockTransitRowDto.prototype, "toGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransitRowDto.prototype, "toGodownName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: stock_voucher_types_1.STOCK_BUCKETS }),
    __metadata("design:type", String)
], StockTransitRowDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransitRowDto.prototype, "baseUomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransitRowDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 30 }),
    __metadata("design:type", Number)
], StockTransitRowDto.prototype, "sentQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 25 }),
    __metadata("design:type", Number)
], StockTransitRowDto.prototype, "receivedQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 3,
        description: 'Tracked separately from short — a different failure with different people to talk to.',
    }),
    __metadata("design:type", Number)
], StockTransitRowDto.prototype, "damageQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 2,
        description: 'sent − received − damage, and the same figure the GENERATED stt_short_qty holds. While the transfer is open it is what is still owed; once it closes it is what was lost. A second receipt opens with THIS, not with the original quantity.',
    }),
    __metadata("design:type", Number)
], StockTransitRowDto.prototype, "remainingQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 28,
        description: 'What the stock LEFT with. The receiving branch cannot revalue by receiving.',
    }),
    __metadata("design:type", Number)
], StockTransitRowDto.prototype, "costRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 840 }),
    __metadata("design:type", Number)
], StockTransitRowDto.prototype, "transitValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Written by this API after the post — the engine never sets it.',
    }),
    __metadata("design:type", Object)
], StockTransitRowDto.prototype, "lrNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransitRowDto.prototype, "vehicleNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    __metadata("design:type", Object)
], StockTransitRowDto.prototype, "expectedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], StockTransitRowDto.prototype, "sentOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], StockTransitRowDto.prototype, "receivedOn", void 0);
class StockTransferDocumentWithTransitDto extends StockTransferDocumentDto {
    transit;
}
exports.StockTransferDocumentWithTransitDto = StockTransferDocumentWithTransitDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: StockTransitRowDto,
        isArray: true,
        description: "The despatch's transit rows, so the sender can see what has been received against each line. Empty on a same-branch transfer and on a DRAFT.",
    }),
    __metadata("design:type", Array)
], StockTransferDocumentWithTransitDto.prototype, "transit", void 0);
class StockTransferListItemDto {
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
exports.StockTransferListItemDto = StockTransferListItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferListItemDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], StockTransferListItemDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'TRF/2026-2027/TILL-01/2' }),
    __metadata("design:type", String)
], StockTransferListItemDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferListItemDto.prototype, "usrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'string', format: 'date' }),
    __metadata("design:type", String)
], StockTransferListItemDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockTransferListItemDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferListItemDto.prototype, "godownName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: stock_voucher_types_1.STOCK_VOUCHER_STATUSES }),
    __metadata("design:type", String)
], StockTransferListItemDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferListItemDto.prototype, "lineCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferListItemDto.prototype, "totalQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferListItemDto.prototype, "totalValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferListItemDto.prototype, "totalValueWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], StockTransferListItemDto.prototype, "postedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: stock_voucher_types_1.STOCK_RATE_SOURCES, nullable: true }),
    __metadata("design:type", Object)
], StockTransferListItemDto.prototype, "rateSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferListItemDto.prototype, "remarks", void 0);
class StockTransferListMetaDto {
    limit;
    offset;
    count;
}
exports.StockTransferListMetaDto = StockTransferListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50 }),
    __metadata("design:type", Number)
], StockTransferListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], StockTransferListMetaDto.prototype, "offset", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 12 }),
    __metadata("design:type", Number)
], StockTransferListMetaDto.prototype, "count", void 0);
class StockTransferListDto {
    items;
    meta;
}
exports.StockTransferListDto = StockTransferListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferListItemDto, isArray: true }),
    __metadata("design:type", Array)
], StockTransferListDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferListMetaDto }),
    __metadata("design:type", StockTransferListMetaDto)
], StockTransferListDto.prototype, "meta", void 0);
class StockTransferInboundRowDto extends StockTransitRowDto {
    outRefno;
    fromBranchId;
    daysInFlight;
}
exports.StockTransferInboundRowDto = StockTransferInboundRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'TRF/2026-2027/TILL-01/2' }),
    __metadata("design:type", Object)
], StockTransferInboundRowDto.prototype, "outRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferInboundRowDto.prototype, "fromBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 8,
        description: 'Whole days since despatch — the ageing of transit itself, where losses show up.',
    }),
    __metadata("design:type", Number)
], StockTransferInboundRowDto.prototype, "daysInFlight", void 0);
class StockTransferInboundDto {
    items;
    meta;
}
exports.StockTransferInboundDto = StockTransferInboundDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferInboundRowDto, isArray: true }),
    __metadata("design:type", Array)
], StockTransferInboundDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferListMetaDto }),
    __metadata("design:type", StockTransferListMetaDto)
], StockTransferInboundDto.prototype, "meta", void 0);
class StockTransferLineProblemDto {
    sviId;
    lineNo;
    splitNo;
    itemId;
    itemCode;
    itemName;
    problem;
}
exports.StockTransferLineProblemDto = StockTransferLineProblemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferLineProblemDto.prototype, "sviId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferLineProblemDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], StockTransferLineProblemDto.prototype, "splitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferLineProblemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTransferLineProblemDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], StockTransferLineProblemDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'null means the line is clean.' }),
    __metadata("design:type", Object)
], StockTransferLineProblemDto.prototype, "problem", void 0);
class StockTransferDespatchDataDto extends StockTransferDocumentDto {
    sameBranch;
    status;
    ledgerRows;
    transitRows;
    transit;
}
exports.StockTransferDespatchDataDto = StockTransferDespatchDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'WHICH SHAPE HAPPENED, read off the posted row and never from the request. true = godown to godown: both ledger rows written as a pair, status POSTED, no transit. false = a lorry left: one ledger row per line plus a transit row, status IN_TRANSIT.',
    }),
    __metadata("design:type", Boolean)
], StockTransferDespatchDataDto.prototype, "sameBranch", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: stock_voucher_types_1.STOCK_VOUCHER_STATUSES, example: 'IN_TRANSIT' }),
    __metadata("design:type", String)
], StockTransferDespatchDataDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 1,
        description: 'What the engine returned: 2 per line same-branch, 1 per line on a despatch.',
    }),
    __metadata("design:type", Number)
], StockTransferDespatchDataDto.prototype, "ledgerRows", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '0 on a same-branch transfer.' }),
    __metadata("design:type", Number)
], StockTransferDespatchDataDto.prototype, "transitRows", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransitRowDto, isArray: true }),
    __metadata("design:type", Array)
], StockTransferDespatchDataDto.prototype, "transit", void 0);
class StockTransferPrefillOutDto {
    svhId;
    accYear;
    refno;
    docDate;
    status;
    fromBranchId;
    fromGodownId;
    toBranchId;
    toGodownId;
}
exports.StockTransferPrefillOutDto = StockTransferPrefillOutDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferPrefillOutDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], StockTransferPrefillOutDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'TRF/2026-2027/TILL-01/2' }),
    __metadata("design:type", String)
], StockTransferPrefillOutDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'string', format: 'date' }),
    __metadata("design:type", String)
], StockTransferPrefillOutDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: stock_voucher_types_1.STOCK_VOUCHER_STATUSES, example: 'IN_TRANSIT' }),
    __metadata("design:type", String)
], StockTransferPrefillOutDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferPrefillOutDto.prototype, "fromBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockTransferPrefillOutDto.prototype, "fromGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockTransferPrefillOutDto.prototype, "toBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockTransferPrefillOutDto.prototype, "toGodownId", void 0);
class StockTransferPrefillRowDto extends StockTransitRowDto {
    lineNo;
}
exports.StockTransferPrefillRowDto = StockTransferPrefillRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Assigned server-side so the grid and the transit rows agree from the first render.',
    }),
    __metadata("design:type", Number)
], StockTransferPrefillRowDto.prototype, "lineNo", void 0);
class StockTransferPrefillDto {
    outVoucher;
    rows;
}
exports.StockTransferPrefillDto = StockTransferPrefillDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferPrefillOutDto }),
    __metadata("design:type", StockTransferPrefillOutDto)
], StockTransferPrefillDto.prototype, "outVoucher", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: StockTransferPrefillRowDto,
        isArray: true,
        description: "Only rows with something still owed. Read from stock_transit, NOT from the despatch's lines — a posted document does not change, so prefilling from the lines is what lets a clerk receive the same 30 twice.",
    }),
    __metadata("design:type", Array)
], StockTransferPrefillDto.prototype, "rows", void 0);
class StockTransferReceiveInDto extends StockTransferDocumentDto {
    ledgerRows;
    status;
}
exports.StockTransferReceiveInDto = StockTransferReceiveInDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], StockTransferReceiveInDto.prototype, "ledgerRows", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: stock_voucher_types_1.STOCK_VOUCHER_STATUSES, example: 'POSTED' }),
    __metadata("design:type", String)
], StockTransferReceiveInDto.prototype, "status", void 0);
class StockTransferReceiveOutDto {
    svhId;
    accYear;
    refno;
    status;
    closed;
}
exports.StockTransferReceiveOutDto = StockTransferReceiveOutDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferReceiveOutDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], StockTransferReceiveOutDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'TRF/2026-2027/TILL-01/2' }),
    __metadata("design:type", String)
], StockTransferReceiveOutDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: stock_voucher_types_1.STOCK_VOUCHER_STATUSES,
        example: 'IN_TRANSIT',
        description: 'RECEIVED only when no transit row of it has anything left. A short keeps it IN_TRANSIT on purpose.',
    }),
    __metadata("design:type", String)
], StockTransferReceiveOutDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'THE RECEIPT CLOSING DOES NOT MEAN THE TRANSFER CLOSED. false with a posted receipt means stock is still outstanding — that is the loss report, and the write-off is a separate DAMAGE or ADJUSTMENT voucher the engine deliberately will not raise for you.',
    }),
    __metadata("design:type", Boolean)
], StockTransferReceiveOutDto.prototype, "closed", void 0);
class StockTransferReceiveDataDto {
    inVoucher;
    outVoucher;
    transit;
}
exports.StockTransferReceiveDataDto = StockTransferReceiveDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferReceiveInDto }),
    __metadata("design:type", StockTransferReceiveInDto)
], StockTransferReceiveDataDto.prototype, "inVoucher", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferReceiveOutDto }),
    __metadata("design:type", StockTransferReceiveOutDto)
], StockTransferReceiveDataDto.prototype, "outVoucher", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransitRowDto, isArray: true }),
    __metadata("design:type", Array)
], StockTransferReceiveDataDto.prototype, "transit", void 0);
class StockTransferCancelDataDto extends StockTransferDocumentDto {
    rowsReversed;
    status;
    cancelledOn;
}
exports.StockTransferCancelDataDto = StockTransferCancelDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], StockTransferCancelDataDto.prototype, "rowsReversed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: stock_voucher_types_1.STOCK_VOUCHER_STATUSES, example: 'CANCELLED' }),
    __metadata("design:type", String)
], StockTransferCancelDataDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], StockTransferCancelDataDto.prototype, "cancelledOn", void 0);
class StockTransferDeleteDataDto {
    svhId;
    accYear;
    deleted;
}
exports.StockTransferDeleteDataDto = StockTransferDeleteDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StockTransferDeleteDataDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], StockTransferDeleteDataDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTransferDeleteDataDto.prototype, "deleted", void 0);
class StockTransferDocumentSuccessDto {
    success;
    message;
    data;
}
exports.StockTransferDocumentSuccessDto = StockTransferDocumentSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTransferDocumentSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Stock transfer created successfully' }),
    __metadata("design:type", String)
], StockTransferDocumentSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferDocumentDto }),
    __metadata("design:type", StockTransferDocumentDto)
], StockTransferDocumentSuccessDto.prototype, "data", void 0);
class StockTransferLoadSuccessDto {
    success;
    message;
    data;
}
exports.StockTransferLoadSuccessDto = StockTransferLoadSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTransferLoadSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Stock transfer fetched successfully' }),
    __metadata("design:type", String)
], StockTransferLoadSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferDocumentWithTransitDto }),
    __metadata("design:type", StockTransferDocumentWithTransitDto)
], StockTransferLoadSuccessDto.prototype, "data", void 0);
class StockTransferListSuccessDto {
    success;
    message;
    data;
}
exports.StockTransferListSuccessDto = StockTransferListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTransferListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Stock transfer list fetched successfully' }),
    __metadata("design:type", String)
], StockTransferListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferListDto }),
    __metadata("design:type", StockTransferListDto)
], StockTransferListSuccessDto.prototype, "data", void 0);
class StockTransferValidateSuccessDto {
    success;
    message;
    data;
}
exports.StockTransferValidateSuccessDto = StockTransferValidateSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTransferValidateSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'All 3 lines are clean' }),
    __metadata("design:type", String)
], StockTransferValidateSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferLineProblemDto, isArray: true }),
    __metadata("design:type", Array)
], StockTransferValidateSuccessDto.prototype, "data", void 0);
class StockTransferDespatchSuccessDto {
    success;
    message;
    data;
}
exports.StockTransferDespatchSuccessDto = StockTransferDespatchSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTransferDespatchSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Transfer despatched — 1 lines in transit' }),
    __metadata("design:type", String)
], StockTransferDespatchSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferDespatchDataDto }),
    __metadata("design:type", StockTransferDespatchDataDto)
], StockTransferDespatchSuccessDto.prototype, "data", void 0);
class StockTransferInboundSuccessDto {
    success;
    message;
    data;
}
exports.StockTransferInboundSuccessDto = StockTransferInboundSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTransferInboundSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '3 consignments in transit to this branch' }),
    __metadata("design:type", String)
], StockTransferInboundSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferInboundDto }),
    __metadata("design:type", StockTransferInboundDto)
], StockTransferInboundSuccessDto.prototype, "data", void 0);
class StockTransferPrefillSuccessDto {
    success;
    message;
    data;
}
exports.StockTransferPrefillSuccessDto = StockTransferPrefillSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTransferPrefillSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1 lines still to receive against TRF/2026-2027/TILL-01/2' }),
    __metadata("design:type", String)
], StockTransferPrefillSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferPrefillDto }),
    __metadata("design:type", StockTransferPrefillDto)
], StockTransferPrefillSuccessDto.prototype, "data", void 0);
class StockTransferReceiveSuccessDto {
    success;
    message;
    data;
}
exports.StockTransferReceiveSuccessDto = StockTransferReceiveSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTransferReceiveSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Receipt posted — 2 ledger rows, transfer TRF/2026-2027/TILL-01/2 still open with stock outstanding',
    }),
    __metadata("design:type", String)
], StockTransferReceiveSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferReceiveDataDto }),
    __metadata("design:type", StockTransferReceiveDataDto)
], StockTransferReceiveSuccessDto.prototype, "data", void 0);
class StockTransferCancelSuccessDto {
    success;
    message;
    data;
}
exports.StockTransferCancelSuccessDto = StockTransferCancelSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTransferCancelSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Stock transfer cancelled — 2 reversal rows' }),
    __metadata("design:type", String)
], StockTransferCancelSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferCancelDataDto }),
    __metadata("design:type", StockTransferCancelDataDto)
], StockTransferCancelSuccessDto.prototype, "data", void 0);
class StockTransferDeleteSuccessDto {
    success;
    message;
    data;
}
exports.StockTransferDeleteSuccessDto = StockTransferDeleteSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTransferDeleteSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Stock transfer deleted successfully' }),
    __metadata("design:type", String)
], StockTransferDeleteSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTransferDeleteDataDto }),
    __metadata("design:type", StockTransferDeleteDataDto)
], StockTransferDeleteSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=stock-transfer-response.dto.js.map