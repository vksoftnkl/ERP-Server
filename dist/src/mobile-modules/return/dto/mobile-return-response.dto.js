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
exports.MobileReturnStatusSuccessDto = exports.MobileReturnStatusPayloadDto = exports.MobileReturnDeleteSuccessDto = exports.MobileReturnDeleteResultDto = exports.MobileReturnCreateSuccessDto = exports.MobileReturnCreateResultDto = exports.MobileReturnBillLinesSuccessDto = exports.MobileReturnBillLinesDto = exports.MobileReturnOptionsSuccessDto = exports.MobileReturnOptionsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class MobileReturnReasonDto {
    reasonId;
    code;
    name;
    defaultCondition;
    refundCharges;
    isClaim;
    sortOrder;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Send it as srReasonId' }),
    __metadata("design:type", String)
], MobileReturnReasonDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'SR_DAMAGED' }),
    __metadata("design:type", String)
], MobileReturnReasonDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Damaged / leaking' }),
    __metadata("design:type", String)
], MobileReturnReasonDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, enum: ['RESTOCK', 'DAMAGED', 'EXPIRED', 'SCRAP'] }),
    __metadata("design:type", Object)
], MobileReturnReasonDto.prototype, "defaultCondition", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: Boolean,
        description: "Whether the bill's charges come back by default",
    }),
    __metadata("design:type", Object)
], MobileReturnReasonDto.prototype, "refundCharges", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'A claim reason (code ends in _SHOP): the office only (D8); hide it',
    }),
    __metadata("design:type", Boolean)
], MobileReturnReasonDto.prototype, "isClaim", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 410 }),
    __metadata("design:type", Number)
], MobileReturnReasonDto.prototype, "sortOrder", void 0);
class MobileReturnGodownDto {
    godownId;
    name;
    isDefault;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Send it as godownId' }),
    __metadata("design:type", String)
], MobileReturnGodownDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Coimbatore' }),
    __metadata("design:type", String)
], MobileReturnGodownDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "The branch's default godown" }),
    __metadata("design:type", Boolean)
], MobileReturnGodownDto.prototype, "isDefault", void 0);
class MobileReturnSettingsDto {
    returnWindowDays;
    freeReturnAllowed;
    settleDefault;
    expiredLotDays;
    billDays;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'sales.return_window_days (0 = none)' }),
    __metadata("design:type", Number)
], MobileReturnSettingsDto.prototype, "returnWindowDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'sales.free_return_allowed (D1)' }),
    __metadata("design:type", Boolean)
], MobileReturnSettingsDto.prototype, "freeReturnAllowed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, enum: ['ADJUST', 'ADVANCE'] }),
    __metadata("design:type", Object)
], MobileReturnSettingsDto.prototype, "settleDefault", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: Number,
        description: 'sales.return_expired_lot_days when above 0',
    }),
    __metadata("design:type", Object)
], MobileReturnSettingsDto.prototype, "expiredLotDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 90, description: 'returnWindowDays when above 0, else 90 (D9)' }),
    __metadata("design:type", Number)
], MobileReturnSettingsDto.prototype, "billDays", void 0);
class MobileReturnRightsDto {
    create;
    post;
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileReturnRightsDto.prototype, "create", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Without it every upload is HELD (D7)' }),
    __metadata("design:type", Boolean)
], MobileReturnRightsDto.prototype, "post", void 0);
class MobileReturnOptionsDto {
    companyId;
    branchId;
    reasons;
    godowns;
    settings;
    rights;
}
exports.MobileReturnOptionsDto = MobileReturnOptionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnOptionsDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnOptionsDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReturnReasonDto] }),
    __metadata("design:type", Array)
], MobileReturnOptionsDto.prototype, "reasons", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReturnGodownDto] }),
    __metadata("design:type", Array)
], MobileReturnOptionsDto.prototype, "godowns", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReturnSettingsDto }),
    __metadata("design:type", MobileReturnSettingsDto)
], MobileReturnOptionsDto.prototype, "settings", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: MobileReturnRightsDto,
        nullable: true,
        description: 'Menu 13; null without a token',
    }),
    __metadata("design:type", Object)
], MobileReturnOptionsDto.prototype, "rights", void 0);
class MobileReturnOptionsSuccessDto {
    success;
    message;
    data;
}
exports.MobileReturnOptionsSuccessDto = MobileReturnOptionsSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileReturnOptionsSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReturnOptionsSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReturnOptionsDto }),
    __metadata("design:type", MobileReturnOptionsDto)
], MobileReturnOptionsSuccessDto.prototype, "data", void 0);
class MobileReturnBillLineDto {
    billItemId;
    accYear;
    lineNo;
    itemId;
    itemName;
    itemUnitId;
    unitName;
    toBaseFactor;
    billQty;
    billQtyBase;
    returnedQtyBase;
    qtyLeftBase;
    onOtherDraftsBase;
    ratePreTaxBase;
    rate;
    taxPerc;
    cgstPerc;
    sgstPerc;
    igstPerc;
    lotId;
    batchNo;
    expiryDate;
    godownId;
    isFree;
    allowReturn;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Send it as sriBillItemId' }),
    __metadata("design:type", String)
], MobileReturnBillLineDto.prototype, "billItemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], MobileReturnBillLineDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileReturnBillLineDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnBillLineDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReturnBillLineDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnBillLineDto.prototype, "itemUnitId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReturnBillLineDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], MobileReturnBillLineDto.prototype, "toBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], MobileReturnBillLineDto.prototype, "billQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], MobileReturnBillLineDto.prototype, "billQtyBase", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number, description: 'What POSTED returns took' }),
    __metadata("design:type", Object)
], MobileReturnBillLineDto.prototype, "returnedQtyBase", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], MobileReturnBillLineDto.prototype, "qtyLeftBase", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number, description: 'What DRAFT returns hold (INFO only)' }),
    __metadata("design:type", Object)
], MobileReturnBillLineDto.prototype, "onOtherDraftsBase", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        example: '84.7458',
        description: 'Taxable value per base unit after every discount, 4 decimals',
    }),
    __metadata("design:type", Object)
], MobileReturnBillLineDto.prototype, "ratePreTaxBase", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: '100.00' }),
    __metadata("design:type", Object)
], MobileReturnBillLineDto.prototype, "rate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '18.000' }),
    __metadata("design:type", String)
], MobileReturnBillLineDto.prototype, "taxPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '9.000' }),
    __metadata("design:type", String)
], MobileReturnBillLineDto.prototype, "cgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '9.000' }),
    __metadata("design:type", String)
], MobileReturnBillLineDto.prototype, "sgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '0.000' }),
    __metadata("design:type", String)
], MobileReturnBillLineDto.prototype, "igstPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, format: 'uuid' }),
    __metadata("design:type", Object)
], MobileReturnBillLineDto.prototype, "lotId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReturnBillLineDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, format: 'date' }),
    __metadata("design:type", Object)
], MobileReturnBillLineDto.prototype, "expiryDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnBillLineDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileReturnBillLineDto.prototype, "isFree", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'item_allow_sales_return' }),
    __metadata("design:type", Boolean)
], MobileReturnBillLineDto.prototype, "allowReturn", void 0);
class MobileReturnBillDto {
    sbId;
    accYear;
    refno;
    date;
    custId;
    branchId;
    billAmount;
    due;
    payMode;
    returnedAmt;
    returnStatus;
    lines;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Send it as srBillId' }),
    __metadata("design:type", String)
], MobileReturnBillDto.prototype, "sbId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], MobileReturnBillDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: 'bil05286' }),
    __metadata("design:type", Object)
], MobileReturnBillDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-20' }),
    __metadata("design:type", String)
], MobileReturnBillDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, format: 'uuid' }),
    __metadata("design:type", Object)
], MobileReturnBillDto.prototype, "custId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnBillDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '3011.00' }),
    __metadata("design:type", String)
], MobileReturnBillDto.prototype, "billAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '3011.00' }),
    __metadata("design:type", String)
], MobileReturnBillDto.prototype, "due", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReturnBillDto.prototype, "payMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '0.00' }),
    __metadata("design:type", String)
], MobileReturnBillDto.prototype, "returnedAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['NONE', 'PARTIAL', 'FULL'] }),
    __metadata("design:type", String)
], MobileReturnBillDto.prototype, "returnStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReturnBillLineDto] }),
    __metadata("design:type", Array)
], MobileReturnBillDto.prototype, "lines", void 0);
class MobileReturnBillLinesDto {
    asOf;
    billDays;
    since;
    page;
    pageSize;
    total;
    hasMore;
    companyId;
    branchId;
    bills;
}
exports.MobileReturnBillLinesDto = MobileReturnBillLinesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-20T11:52:10.123Z' }),
    __metadata("design:type", String)
], MobileReturnBillLinesDto.prototype, "asOf", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 90 }),
    __metadata("design:type", Number)
], MobileReturnBillLinesDto.prototype, "billDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-08-22' }),
    __metadata("design:type", String)
], MobileReturnBillLinesDto.prototype, "since", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileReturnBillLinesDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileReturnBillLinesDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Bills, not lines' }),
    __metadata("design:type", Number)
], MobileReturnBillLinesDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileReturnBillLinesDto.prototype, "hasMore", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnBillLinesDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnBillLinesDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReturnBillDto] }),
    __metadata("design:type", Array)
], MobileReturnBillLinesDto.prototype, "bills", void 0);
class MobileReturnBillLinesSuccessDto {
    success;
    message;
    data;
}
exports.MobileReturnBillLinesSuccessDto = MobileReturnBillLinesSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileReturnBillLinesSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReturnBillLinesSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReturnBillLinesDto }),
    __metadata("design:type", MobileReturnBillLinesDto)
], MobileReturnBillLinesSuccessDto.prototype, "data", void 0);
class MobileReturnUserWordingDto {
    title;
    line;
    todo;
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReturnUserWordingDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReturnUserWordingDto.prototype, "line", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReturnUserWordingDto.prototype, "todo", void 0);
class MobileReturnNoteDto {
    code;
    message;
    field;
    line;
    user;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'SALES_RETURN_OVER_QTY' }),
    __metadata("design:type", String)
], MobileReturnNoteDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReturnNoteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: 'sriReturnQty' }),
    __metadata("design:type", Object)
], MobileReturnNoteDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number, example: 1 }),
    __metadata("design:type", Object)
], MobileReturnNoteDto.prototype, "line", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: MobileReturnUserWordingDto,
        description: "The catalogue's plain words",
    }),
    __metadata("design:type", MobileReturnUserWordingDto)
], MobileReturnNoteDto.prototype, "user", void 0);
class MobileReturnTotalsDto {
    goods;
    tax;
    chargesNet;
    roundOff;
    creditNote;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2950.00' }),
    __metadata("design:type", String)
], MobileReturnTotalsDto.prototype, "goods", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '450.00' }),
    __metadata("design:type", String)
], MobileReturnTotalsDto.prototype, "tax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '0.00' }),
    __metadata("design:type", String)
], MobileReturnTotalsDto.prototype, "chargesNet", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '0.00' }),
    __metadata("design:type", String)
], MobileReturnTotalsDto.prototype, "roundOff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2950.00' }),
    __metadata("design:type", String)
], MobileReturnTotalsDto.prototype, "creditNote", void 0);
class MobileReturnAdjustedDto {
    billId;
    billAccYear;
    refno;
    amount;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'acc_bill_balance id' }),
    __metadata("design:type", String)
], MobileReturnAdjustedDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], MobileReturnAdjustedDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReturnAdjustedDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '250.00' }),
    __metadata("design:type", String)
], MobileReturnAdjustedDto.prototype, "amount", void 0);
class MobileReturnSettlementDto {
    mode;
    credited;
    settleStatus;
    adjusted;
}
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, enum: ['ADJUST', 'ADVANCE'] }),
    __metadata("design:type", Object)
], MobileReturnSettlementDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '0.00', description: 'Left on the note as credit' }),
    __metadata("design:type", String)
], MobileReturnSettlementDto.prototype, "credited", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: 'ADJUSTED' }),
    __metadata("design:type", Object)
], MobileReturnSettlementDto.prototype, "settleStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReturnAdjustedDto] }),
    __metadata("design:type", Array)
], MobileReturnSettlementDto.prototype, "adjusted", void 0);
class MobileReturnLineResultDto {
    sriLineNo;
    sriSplitNo;
    sriId;
    rateSource;
    taxableAmt;
    taxAmt;
    netAmt;
    bucket;
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileReturnLineResultDto.prototype, "sriLineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileReturnLineResultDto.prototype, "sriSplitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnLineResultDto.prototype, "sriId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, enum: ['BILL', 'LAST_SALE', 'TODAY_PRICE'] }),
    __metadata("design:type", Object)
], MobileReturnLineResultDto.prototype, "rateSource", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2500.00' }),
    __metadata("design:type", String)
], MobileReturnLineResultDto.prototype, "taxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '450.00' }),
    __metadata("design:type", String)
], MobileReturnLineResultDto.prototype, "taxAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2950.00' }),
    __metadata("design:type", String)
], MobileReturnLineResultDto.prototype, "netAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: 'SALEABLE' }),
    __metadata("design:type", Object)
], MobileReturnLineResultDto.prototype, "bucket", void 0);
class MobileReturnReplannedDto {
    billId;
    billAccYear;
    refno;
    from;
    to;
    reason;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnReplannedDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReturnReplannedDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReturnReplannedDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '500.00' }),
    __metadata("design:type", String)
], MobileReturnReplannedDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '320.00' }),
    __metadata("design:type", String)
], MobileReturnReplannedDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['BILL_SETTLED', 'BILL_REDUCED', 'NOTE_SMALLER', 'FREED_MONEY'] }),
    __metadata("design:type", String)
], MobileReturnReplannedDto.prototype, "reason", void 0);
class MobileReturnApprovalDto {
    status;
    note;
}
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['PENDING', 'APPROVED', 'REJECTED'] }),
    __metadata("design:type", String)
], MobileReturnApprovalDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReturnApprovalDto.prototype, "note", void 0);
class MobileReturnCreateResultDto {
    duplicate;
    srId;
    srClientUuid;
    srReturnRefno;
    srMobileRefno;
    srAccYear;
    srBranchId;
    srStatus;
    status;
    srReturnAmt;
    totals;
    settlement;
    lines;
    held;
    refusal;
    refusals;
    warnings;
    replanned;
    approval;
}
exports.MobileReturnCreateResultDto = MobileReturnCreateResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'true = POSTED or CANCELLED already under this uuid: nothing written',
    }),
    __metadata("design:type", Boolean)
], MobileReturnCreateResultDto.prototype, "duplicate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnCreateResultDto.prototype, "srId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnCreateResultDto.prototype, "srClientUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: 'SRT/2026-2027/D15/00001' }),
    __metadata("design:type", Object)
], MobileReturnCreateResultDto.prototype, "srReturnRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: 'R3F9A/2627/00005' }),
    __metadata("design:type", Object)
], MobileReturnCreateResultDto.prototype, "srMobileRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], MobileReturnCreateResultDto.prototype, "srAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnCreateResultDto.prototype, "srBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['DRAFT', 'POSTED', 'CANCELLED'], description: 'The row itself, now' }),
    __metadata("design:type", String)
], MobileReturnCreateResultDto.prototype, "srStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['POSTED', 'HELD', 'SENT_BACK'] }),
    __metadata("design:type", String)
], MobileReturnCreateResultDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2950.00' }),
    __metadata("design:type", String)
], MobileReturnCreateResultDto.prototype, "srReturnAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReturnTotalsDto }),
    __metadata("design:type", MobileReturnTotalsDto)
], MobileReturnCreateResultDto.prototype, "totals", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReturnSettlementDto }),
    __metadata("design:type", MobileReturnSettlementDto)
], MobileReturnCreateResultDto.prototype, "settlement", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReturnLineResultDto] }),
    __metadata("design:type", Array)
], MobileReturnCreateResultDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReturnNoteDto, nullable: true }),
    __metadata("design:type", Object)
], MobileReturnCreateResultDto.prototype, "held", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReturnNoteDto, nullable: true }),
    __metadata("design:type", Object)
], MobileReturnCreateResultDto.prototype, "refusal", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReturnNoteDto], description: 'Every refusal of the refused post' }),
    __metadata("design:type", Array)
], MobileReturnCreateResultDto.prototype, "refusals", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReturnNoteDto] }),
    __metadata("design:type", Array)
], MobileReturnCreateResultDto.prototype, "warnings", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReturnReplannedDto] }),
    __metadata("design:type", Array)
], MobileReturnCreateResultDto.prototype, "replanned", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReturnApprovalDto, nullable: true }),
    __metadata("design:type", Object)
], MobileReturnCreateResultDto.prototype, "approval", void 0);
class MobileReturnCreateSuccessDto {
    success;
    message;
    data;
}
exports.MobileReturnCreateSuccessDto = MobileReturnCreateSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileReturnCreateSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReturnCreateSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReturnCreateResultDto }),
    __metadata("design:type", MobileReturnCreateResultDto)
], MobileReturnCreateSuccessDto.prototype, "data", void 0);
class MobileReturnDeleteResultDto {
    deleted;
    srClientUuid;
    srId;
    srReturnRefno;
    duplicate;
}
exports.MobileReturnDeleteResultDto = MobileReturnDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'false = VK Nex never saw this uuid' }),
    __metadata("design:type", Boolean)
], MobileReturnDeleteResultDto.prototype, "deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnDeleteResultDto.prototype, "srClientUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, format: 'uuid' }),
    __metadata("design:type", Object)
], MobileReturnDeleteResultDto.prototype, "srId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReturnDeleteResultDto.prototype, "srReturnRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'true = it was deleted before (a resend of the delete)' }),
    __metadata("design:type", Boolean)
], MobileReturnDeleteResultDto.prototype, "duplicate", void 0);
class MobileReturnDeleteSuccessDto {
    success;
    message;
    data;
}
exports.MobileReturnDeleteSuccessDto = MobileReturnDeleteSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileReturnDeleteSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReturnDeleteSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReturnDeleteResultDto }),
    __metadata("design:type", MobileReturnDeleteResultDto)
], MobileReturnDeleteSuccessDto.prototype, "data", void 0);
class MobileReturnStatusDto {
    srClientUuid;
    srId;
    srAccYear;
    srReturnRefno;
    status;
    approval;
    revisionNo;
    srReturnAmt;
    settleStatus;
    adjusted;
    cancelledOn;
    cancelReason;
    updatedOn;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnStatusDto.prototype, "srClientUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnStatusDto.prototype, "srId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], MobileReturnStatusDto.prototype, "srAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReturnStatusDto.prototype, "srReturnRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['DRAFT', 'POSTED', 'CANCELLED', 'DELETED'] }),
    __metadata("design:type", String)
], MobileReturnStatusDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReturnApprovalDto, nullable: true }),
    __metadata("design:type", Object)
], MobileReturnStatusDto.prototype, "approval", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileReturnStatusDto.prototype, "revisionNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2950.00' }),
    __metadata("design:type", String)
], MobileReturnStatusDto.prototype, "srReturnAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReturnStatusDto.prototype, "settleStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReturnAdjustedDto] }),
    __metadata("design:type", Array)
], MobileReturnStatusDto.prototype, "adjusted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReturnStatusDto.prototype, "cancelledOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReturnStatusDto.prototype, "cancelReason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReturnStatusDto.prototype, "updatedOn", void 0);
class MobileReturnStatusPayloadDto {
    asOf;
    page;
    pageSize;
    total;
    hasMore;
    companyId;
    returns;
}
exports.MobileReturnStatusPayloadDto = MobileReturnStatusPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'This read less five minutes: send it back as since' }),
    __metadata("design:type", String)
], MobileReturnStatusPayloadDto.prototype, "asOf", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileReturnStatusPayloadDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileReturnStatusPayloadDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileReturnStatusPayloadDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileReturnStatusPayloadDto.prototype, "hasMore", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReturnStatusPayloadDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReturnStatusDto] }),
    __metadata("design:type", Array)
], MobileReturnStatusPayloadDto.prototype, "returns", void 0);
class MobileReturnStatusSuccessDto {
    success;
    message;
    data;
}
exports.MobileReturnStatusSuccessDto = MobileReturnStatusSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileReturnStatusSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReturnStatusSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReturnStatusPayloadDto }),
    __metadata("design:type", MobileReturnStatusPayloadDto)
], MobileReturnStatusSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=mobile-return-response.dto.js.map