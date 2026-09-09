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
exports.SavePhysicalStockVoucherDto = exports.SavePhysicalStockVoucherHeaderDto = exports.SavePhysicalStockVoucherItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const stock_voucher_types_1 = require("../../stock-voucher/types/stock-voucher.types");
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const MAX_LINES = 2000;
class SavePhysicalStockVoucherItemDto {
    lineNo;
    splitNo;
    itemId;
    godownId;
    bucket;
    lotId;
    countedQty;
    reasonId;
    remarks;
}
exports.SavePhysicalStockVoucherItemDto = SavePhysicalStockVoucherItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        minimum: 1,
        description: 'Position on the sheet, 1-based. Assigned by GET /stock/physical/count-sheet.',
    }),
    (0, dtoDecorators_1.RequiredInteger)(),
    __metadata("design:type", Number)
], SavePhysicalStockVoucherItemDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        default: 1,
        description: 'Always 1 on a generated sheet: one line already means one holding.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SavePhysicalStockVoucherItemDto.prototype, "splitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'inventory.item_master.item_id, from the count sheet.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePhysicalStockVoucherItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'inventory.godown_locations.gdl_id. Must equal the godown the header names — a count is per godown.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePhysicalStockVoucherItemDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.STOCK_BUCKETS,
        default: 'SALEABLE',
        description: 'Part of the holding key, from the count sheet.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_BUCKETS, {
        message: `bucket must be one of ${stock_voucher_types_1.STOCK_BUCKETS.join(', ')}`,
    }),
    __metadata("design:type", String)
], SavePhysicalStockVoucherItemDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'stock.stock_lot.slt_id — THE HOLDING THIS LINE IS ABOUT, taken verbatim from the count sheet.\n\n' +
            'Required, and the one place a count breaks the rule that the engine owns lot identity: the lot is WHERE THE BOOK FIGURE CAME FROM. A count line is generated from a stock_balance row, which is keyed by sbl_lot_id, and fn_svh_post uses it as given rather than resolving a new one. A lot with no live balance row in this godown is a 422 telling you to regenerate the sheet — which is also what happens when someone sells the last of a lot mid-count.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePhysicalStockVoucherItemDto.prototype, "lotId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        minimum: 0,
        description: 'WHAT WAS FOUND ON THE SHELF — the one number the operator types.\n\n' +
            'A magnitude: only the derived svi_diff_qty (counted − book, GENERATED) is signed. Send 0 to record that nothing was found.\n\n' +
            'ABSENT IS NOT "0 FOUND", IT IS NOT COUNTED YET, and it is refused with a 422 naming the line. Declared optional here rather than required so that refusal carries that sentence instead of a bare field error: posting an uncounted line as a total shortage is the single most expensive mistake this screen can make.',
    }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherItemDto.prototype, "countedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'stock.stock_reason_master — overrides the header reason for the one pallet that was damaged rather than shrunk. Must be scoped to PHYSICAL, or to nothing at all.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherItemDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherItemDto.prototype, "remarks", void 0);
class SavePhysicalStockVoucherHeaderDto {
    svhId;
    voucherType;
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
    toGodownId;
    reasonId;
    freezeStock;
    freezeFrom;
    freezeTo;
    syncDate;
    rateSource;
    status;
    remarks;
    userId;
    createdBy;
    modifiedBy;
}
exports.SavePhysicalStockVoucherHeaderDto = SavePhysicalStockVoucherHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Present = update the existing DRAFT; absent = create.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SavePhysicalStockVoucherHeaderDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['PHYSICAL'],
        description: 'Optional, and only ever "PHYSICAL". The route decides the type.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['PHYSICAL'], {
        message: 'voucherType must be PHYSICAL on this route. Other document types have their own routes because they state a quantity to move rather than what was found.',
    }),
    __metadata("design:type", String)
], SavePhysicalStockVoucherHeaderDto.prototype, "voucherType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        minLength: 9,
        maxLength: 9,
        example: '2026-2027',
        description: 'character(9). Send all nine characters — bpchar pads, and ck_svh_acc_year rejects the padding.',
    }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' }),
    __metadata("design:type", String)
], SavePhysicalStockVoucherHeaderDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePhysicalStockVoucherHeaderDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePhysicalStockVoucherHeaderDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherHeaderDto.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'fixed.device_master.dev_id. NOT NULL, and the number series — see stock-voucher-numbering.helper.ts.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePhysicalStockVoucherHeaderDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherHeaderDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'The serial this device already assigned offline. Generated when absent; honoured verbatim when present, because the device has already printed it.',
    }),
    (0, dtoDecorators_1.OptionalNumberString)(),
    __metadata("design:type", String)
], SavePhysicalStockVoucherHeaderDto.prototype, "slno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        description: 'The printed number. Generated as PHY/{accYear}/{deviceCode}/{slno} when absent.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], SavePhysicalStockVoucherHeaderDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true, description: "The user's own reference" }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherHeaderDto.prototype, "usrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'string', format: 'date', example: '2026-06-30' }),
    (0, dtoDecorators_1.TrimmedString)(10),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'docDate must be yyyy-MM-dd' }),
    __metadata("design:type", String)
], SavePhysicalStockVoucherHeaderDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'When the count was actually taken. Defaults to now() at the server. A handheld that numbered its own sheet offline should send the moment it was keyed, not the moment it synced.',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherHeaderDto.prototype, "docDatetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'inventory.godown_locations.gdl_id — THE GODOWN BEING COUNTED. Every line must be in it. ck_svh_godowns will not catch its absence, because an ISSUE satisfies that check with a from-godown alone.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePhysicalStockVoucherHeaderDto.prototype, "toGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'stock.stock_reason_master — why the variance is being accepted, for the whole sheet. A line may override it. Must be scoped to PHYSICAL, or to nothing at all.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherHeaderDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Freeze the stock being counted for the window below. Requires both freezeFrom and freezeTo — ck_svh_freeze refuses a freeze with no window.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SavePhysicalStockVoucherHeaderDto.prototype, "freezeStock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherHeaderDto.prototype, "freezeFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherHeaderDto.prototype, "freezeTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'When an offline handheld synced this sheet up. Set by the device, not the server — a count is the one document routinely keyed away from the counter.',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherHeaderDto.prototype, "syncDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.STOCK_RATE_SOURCES,
        nullable: true,
        description: 'Which rate the OVERAGE side is valued at; defaults to AVG_COST. A shortage is never valued from the document — fn_sml_cost_default relieves it at what the stock cost us, stamped from the item valuation policy, never by the counter.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_RATE_SOURCES, {
        message: `rateSource must be one of ${stock_voucher_types_1.STOCK_RATE_SOURCES.join(', ')}`,
    }),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherHeaderDto.prototype, "rateSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.SAVEABLE_STOCK_VOUCHER_STATUSES,
        default: 'DRAFT',
        description: "What to leave the sheet as. Omitted or 'DRAFT' saves a draft. 'POSTED' saves and then posts it in one transaction — preflight, lots, ledger, balance and the status trail — so a line the preflight refuses fails the save as well.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.SAVEABLE_STOCK_VOUCHER_STATUSES, {
        message: `status must be one of ${stock_voucher_types_1.SAVEABLE_STOCK_VOUCHER_STATUSES.join(', ')} — a document is cancelled by cancelling it, never by saving`,
    }),
    __metadata("design:type", String)
], SavePhysicalStockVoucherHeaderDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherHeaderDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Falls back to the authenticated user from the request context.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SavePhysicalStockVoucherHeaderDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        description: 'Who created the sheet — written on a CREATE only. Falls back to userId, then to the authenticated user.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherHeaderDto.prototype, "createdBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        description: 'Who last changed it — written on an UPDATE only, and never overwrites created_by. Falls back to userId, then to the authenticated user.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherHeaderDto.prototype, "modifiedBy", void 0);
class SavePhysicalStockVoucherDto {
    header;
    lines;
}
exports.SavePhysicalStockVoucherDto = SavePhysicalStockVoucherDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: SavePhysicalStockVoucherHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SavePhysicalStockVoucherHeaderDto),
    __metadata("design:type", SavePhysicalStockVoucherHeaderDto)
], SavePhysicalStockVoucherDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: SavePhysicalStockVoucherItemDto,
        isArray: true,
        description: 'A full replace on update. NOTE that a re-save also refreshes every svi_book_qty from the current balance — right for a sheet still being filled in, and worth a confirmation on one being re-counted.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(MAX_LINES, { message: `lines may not exceed ${MAX_LINES} rows in one document` }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SavePhysicalStockVoucherItemDto),
    __metadata("design:type", Array)
], SavePhysicalStockVoucherDto.prototype, "lines", void 0);
//# sourceMappingURL=save-physical-stock-voucher.dto.js.map