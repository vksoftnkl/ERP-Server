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
exports.SaveStockVoucherDto = exports.SaveStockVoucherHeaderDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const stock_voucher_types_1 = require("../types/stock-voucher.types");
const save_stock_voucher_item_dto_1 = require("./save-stock-voucher-item.dto");
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const MAX_LINES = 2000;
class SaveStockVoucherHeaderDto {
    svhId;
    accYear;
    companyId;
    branchId;
    tenantId;
    deviceId;
    sessionId;
    slno;
    refno;
    usrRefno;
    docDate;
    docDatetime;
    fromGodownId;
    toGodownId;
    supplierId;
    toBranchId;
    partyRef;
    reasonId;
    linkSrcModule;
    linkSrcDocType;
    linkSrcDocId;
    linkSrcAccYear;
    freezeStock;
    freezeFrom;
    freezeTo;
    syncDate;
    lineCount;
    totalQty;
    totalValue;
    totalValueWot;
    rateSource;
    status;
    remarks;
    lrNo;
    vehicleNo;
    expectedOn;
    userId;
    createdBy;
    modifiedBy;
}
exports.SaveStockVoucherHeaderDto = SaveStockVoucherHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Present = update the existing DRAFT; absent = create.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveStockVoucherHeaderDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        minLength: 9,
        maxLength: 9,
        example: '2026-2027',
        description: 'character(9). Send all nine characters — bpchar pads, and ck_svh_acc_year rejects the padding.',
    }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, {
        message: 'accYear must be YYYY-YYYY, e.g. 2026-2027',
    }),
    __metadata("design:type", String)
], SaveStockVoucherHeaderDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockVoucherHeaderDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockVoucherHeaderDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'fixed.device_master.dev_id. NOT NULL, and the number series — see stock-voucher-numbering.helper.ts.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockVoucherHeaderDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'The serial this device already assigned offline. Generated when absent; honoured verbatim when present, because the device has already printed it.',
    }),
    (0, dtoDecorators_1.OptionalNumberString)(),
    __metadata("design:type", String)
], SaveStockVoucherHeaderDto.prototype, "slno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        description: 'The printed number. Generated as {typeCode}/{accYear}/{deviceCode}/{slno} when absent.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], SaveStockVoucherHeaderDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true, description: "The user's own reference" }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "usrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'string', format: 'date', example: '2026-04-01' }),
    (0, dtoDecorators_1.TrimmedString)(10),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'docDate must be yyyy-MM-dd' }),
    __metadata("design:type", String)
], SaveStockVoucherHeaderDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'When the document was actually raised. Defaults to now() at the server. A device that numbered its own document offline should send the moment it was keyed, not the moment it synced — otherwise a week of backlog all lands at the same instant and the order the documents were raised in is lost.',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "docDatetime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Where stock leaves from. Required by ISSUE-shaped documents, unused by OPENING.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "fromGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Where stock arrives. REQUIRED for OPENING — ck_svh_godowns will not catch its absence, because an ISSUE satisfies that check with fromGodown alone.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "toGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The branch the stock is going to. TRANSFER_OUT only — see StockVoucherTypeRules.allowsToBranch.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "toBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        description: "The other side's own reference — a supplier's docket number, a branch's despatch note.",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "partyRef", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'stock.stock_reason_master. Unused by OPENING but required by ADJUSTMENT, which is the fix path when an opening turns out to be wrong.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "linkSrcModule", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "linkSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "linkSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 9, maxLength: 9, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "linkSrcAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Freeze the stock being counted. ck_svh_freeze refuses a freeze with no window: without one the difference posted is between a count taken at 6pm and a book figure read at 8pm.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveStockVoucherHeaderDto.prototype, "freezeStock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "freezeFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "freezeTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'When an offline device synced this document up. Set by the device, not the server.',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "syncDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'How many lines the document has, as the screen counted them. svh_line_count is NOT NULL DEFAULT 0; omit to take the default.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveStockVoucherHeaderDto.prototype, "lineCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'The document total quantity, as the screen summed it. numeric(18,6), NOT NULL DEFAULT 0 — omit to take the default.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveStockVoucherHeaderDto.prototype, "totalQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'The document total value, inclusive of tax, as the screen summed it. numeric(18,2), NOT NULL DEFAULT 0 — omit to take the default.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveStockVoucherHeaderDto.prototype, "totalValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'The document total value excluding tax, as the screen summed it. numeric(18,2), NOT NULL DEFAULT 0 — omit to take the default.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveStockVoucherHeaderDto.prototype, "totalValueWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.STOCK_RATE_SOURCES,
        nullable: true,
        description: 'Which rate the lines are valued at. On a go-live day stock_item_cost is empty, so AVG_COST and LAST_PURCHASE have nothing to read — MANUAL is the honest default for an opening.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_RATE_SOURCES, {
        message: `rateSource must be one of ${stock_voucher_types_1.STOCK_RATE_SOURCES.join(', ')}`,
    }),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "rateSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.SAVEABLE_STOCK_VOUCHER_STATUSES,
        default: 'DRAFT',
        description: "What to leave the document as. Omitted or 'DRAFT' saves a draft. 'POSTED' saves and then posts it in one transaction — preflight, lots, ledger, balance and the status trail — so a line the preflight refuses fails the save as well.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.SAVEABLE_STOCK_VOUCHER_STATUSES, {
        message: `status must be one of ${stock_voucher_types_1.SAVEABLE_STOCK_VOUCHER_STATUSES.join(', ')} — a document is cancelled by cancelling it, never by saving`,
    }),
    __metadata("design:type", String)
], SaveStockVoucherHeaderDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        nullable: true,
        description: 'Lorry receipt number. Goes to stock_transit, not to the voucher. Inter-branch despatch only.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "lrNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        nullable: true,
        description: 'Vehicle number. Goes to stock_transit. Inter-branch despatch only.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "vehicleNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date',
        nullable: true,
        example: '2026-09-12',
        description: 'When the goods are expected. stt_expected_on is a DATE, not an instant — a lorry arrives on a day.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'expectedOn must be yyyy-MM-dd' }),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "expectedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Falls back to the authenticated user from the request context.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveStockVoucherHeaderDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        description: 'Who created the document — written on a CREATE only. Falls back to userId, then to the authenticated user.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "createdBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        description: 'Who last changed it — written on an UPDATE only, and never overwrites created_by. Falls back to userId, then to the authenticated user.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveStockVoucherHeaderDto.prototype, "modifiedBy", void 0);
class SaveStockVoucherDto {
    header;
    lines;
}
exports.SaveStockVoucherDto = SaveStockVoucherDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaveStockVoucherHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SaveStockVoucherHeaderDto),
    __metadata("design:type", SaveStockVoucherHeaderDto)
], SaveStockVoucherDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: save_stock_voucher_item_dto_1.SaveStockVoucherItemDto,
        isArray: true,
        description: 'A full replace on update. Merging by row number over a grid the user can insert into is where line numbers drift, and a DRAFT has no history worth preserving.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(MAX_LINES, {
        message: `lines may not exceed ${MAX_LINES} rows in one document`,
    }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_stock_voucher_item_dto_1.SaveStockVoucherItemDto),
    __metadata("design:type", Array)
], SaveStockVoucherDto.prototype, "lines", void 0);
//# sourceMappingURL=save-stock-voucher.dto.js.map