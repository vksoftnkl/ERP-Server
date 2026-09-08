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
exports.SaveOpeningStockVoucherDto = exports.SaveOpeningStockVoucherItemDto = exports.SaveOpeningStockVoucherHeaderDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const stock_voucher_types_1 = require("../../stock-voucher/types/stock-voucher.types");
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const MAX_LINES = 2000;
class SaveOpeningStockVoucherHeaderDto {
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
    toGodownId;
    lineCount;
    totalQty;
    totalValue;
    totalValueWot;
    rateSource;
    remarks;
    userId;
    voucherType;
}
exports.SaveOpeningStockVoucherHeaderDto = SaveOpeningStockVoucherHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Present = update the existing DRAFT; absent = create.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveOpeningStockVoucherHeaderDto.prototype, "svhId", void 0);
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
], SaveOpeningStockVoucherHeaderDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveOpeningStockVoucherHeaderDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveOpeningStockVoucherHeaderDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherHeaderDto.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'fixed.device_master.dev_id. NOT NULL, and the number series — see stock-voucher-numbering.helper.ts.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveOpeningStockVoucherHeaderDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherHeaderDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'The serial this device already assigned offline. Generated when absent; honoured verbatim when present, because the device has already printed it.',
    }),
    (0, dtoDecorators_1.OptionalNumberString)(),
    __metadata("design:type", String)
], SaveOpeningStockVoucherHeaderDto.prototype, "slno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        description: 'The printed number. Generated as {typeCode}/{accYear}/{deviceCode}/{slno} when absent.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], SaveOpeningStockVoucherHeaderDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true, description: "The user's own reference" }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherHeaderDto.prototype, "usrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'string', format: 'date', example: '2026-04-01' }),
    (0, dtoDecorators_1.TrimmedString)(10),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'docDate must be yyyy-MM-dd' }),
    __metadata("design:type", String)
], SaveOpeningStockVoucherHeaderDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'When the document was actually raised. Defaults to now() at the server. A device that numbered its own document offline should send the moment it was keyed, not the moment it synced — otherwise a week of backlog all lands at the same instant and the order the documents were raised in is lost.',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherHeaderDto.prototype, "docDatetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'Where the stock arrives. REQUIRED — an opening is inward, and this is the godown it opens in.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveOpeningStockVoucherHeaderDto.prototype, "toGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'How many lines the document has, as the screen counted them. svh_line_count is NOT NULL DEFAULT 0; omit to take the default.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveOpeningStockVoucherHeaderDto.prototype, "lineCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'The document total quantity, as the screen summed it. numeric(18,6), NOT NULL DEFAULT 0 — omit to take the default.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveOpeningStockVoucherHeaderDto.prototype, "totalQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'The document total value, inclusive of tax, as the screen summed it. numeric(18,2), NOT NULL DEFAULT 0 — omit to take the default.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveOpeningStockVoucherHeaderDto.prototype, "totalValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'The document total value excluding tax, as the screen summed it. numeric(18,2), NOT NULL DEFAULT 0 — omit to take the default.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveOpeningStockVoucherHeaderDto.prototype, "totalValueWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.STOCK_RATE_SOURCES,
        nullable: true,
        description: 'Which rate the lines are valued at. On a go-live day stock_item_cost is empty, so AVG_COST and LAST_PURCHASE have nothing to read — MANUAL is the honest default for an opening. A source that derives nothing is also what makes costRate required on every line.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_RATE_SOURCES, {
        message: `rateSource must be one of ${stock_voucher_types_1.STOCK_RATE_SOURCES.join(', ')}`,
    }),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherHeaderDto.prototype, "rateSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherHeaderDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Falls back to the authenticated user from the request context.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveOpeningStockVoucherHeaderDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['OPENING'],
        description: 'Optional, and only ever "OPENING". The route decides the type.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['OPENING'], {
        message: 'voucherType must be OPENING on this route. Other document types have their own routes because they write tables this one does not.',
    }),
    __metadata("design:type", String)
], SaveOpeningStockVoucherHeaderDto.prototype, "voucherType", void 0);
class SaveOpeningStockVoucherItemDto {
    lineNo;
    splitNo;
    itemId;
    uomId;
    baseUomId;
    toBaseFactor;
    godownId;
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
    remarks;
}
exports.SaveOpeningStockVoucherItemDto = SaveOpeningStockVoucherItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, description: 'Position in the grid, 1-based (ck_svi_line_no)' }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], SaveOpeningStockVoucherItemDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        default: 1,
        description: 'A second allocation of the same line — one line drawn from three batches is three rows. Only meaningful with a batchNo (ck_svi_batch_split).',
    }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], SaveOpeningStockVoucherItemDto.prototype, "splitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'inventory.item_master.item_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveOpeningStockVoucherItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'inventory.item_unit_conversion.iuc_id — NOT item_unit_master.unit_id. The unit must belong to this item (iuc_item_id).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveOpeningStockVoucherItemDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "The item's base unit, also an iuc_id. REQUIRED: svi_base_uom_id is NOT NULL and is not resolved server-side — send the base unit the grid converted through.",
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveOpeningStockVoucherItemDto.prototype, "baseUomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        minimum: 0,
        exclusiveMinimum: true,
        example: 12,
        description: 'How many base units one uomId is worth — item_unit_conversion.iuc_to_base_factor as the grid used it. REQUIRED, and must be > 0 (ck_svi_to_base_factor). numeric(18,6).',
    }),
    (0, dtoDecorators_1.RequiredNumber)(),
    (0, class_validator_1.IsPositive)({ message: 'toBaseFactor must be greater than 0 (ck_svi_to_base_factor)' }),
    __metadata("design:type", Number)
], SaveOpeningStockVoucherItemDto.prototype, "toBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'inventory.godown_locations.gdl_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveOpeningStockVoucherItemDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.STOCK_BUCKETS,
        default: 'SALEABLE',
        description: 'ck_svi_bucket. An opening can bring stock in DAMAGED or QUARANTINE.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_BUCKETS, {
        message: `bucket must be one of ${stock_voucher_types_1.STOCK_BUCKETS.join(', ')}`,
    }),
    __metadata("design:type", String)
], SaveOpeningStockVoucherItemDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'What the scanner read, verbatim. Never resolved server-side — itemId, batchNo and serialNo are what identify the line, and a barcode that disagrees with them does not override them. Stored so a reprint can show the symbol actually scanned.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "barcode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "mfgDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "expiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "salePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "serialNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        description: 'In uomId, not in the base unit. A line needs a qty OR a freeQty — a free-goods line legitimately has qty 0 — so that pair is checked in the service, not here.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        minimum: 0,
        example: 120,
        description: 'The same quantity IN THE BASE UNIT — qty x toBaseFactor as the grid computed it. REQUIRED: svi_base_qty is NOT NULL and is not multiplied server-side. It is what svi_value is GENERATED from, so it is the number the document is actually valued on. numeric(18,6).',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], SaveOpeningStockVoucherItemDto.prototype, "baseQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'Free goods, in uomId. They are stock, and they count toward the totals.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "freeQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'The free quantity IN THE BASE UNIT — freeQty x toBaseFactor as the grid computed it. Omit to take the column default of 0; svi_free_base_qty is NOT NULL DEFAULT 0. Counts toward svi_value alongside baseQty. numeric(18,6).',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveOpeningStockVoucherItemDto.prototype, "freeBaseQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'Net weight, for goods sold or held by weight. Carried alongside the quantity rather than derived from it: a 10kg bag that actually weighs 9.7kg opens at the weight on the scale, and the conversion factor cannot know that.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "weightQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        description: 'Cost per unit of uomId, inclusive of tax. Required in practice on an opening — it is inward, and a rateSource of MANUAL derives nothing — but that depends on the header, so it is checked in the service.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "costRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'Cost excluding tax. Leave 0 — the engine derives it from taxPerc at post and writes it back (20 ÷ 1.05 = 19.047619).',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "costRateWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'Cost including the freight, duty and handling attributed to the line. Kept beside costRate rather than folded into it, so a valuation can answer both "what did it cost" and "what did it cost to get here".',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "landedRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "taxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveOpeningStockVoucherItemDto.prototype, "remarks", void 0);
class SaveOpeningStockVoucherDto {
    header;
    lines;
}
exports.SaveOpeningStockVoucherDto = SaveOpeningStockVoucherDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaveOpeningStockVoucherHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SaveOpeningStockVoucherHeaderDto),
    __metadata("design:type", SaveOpeningStockVoucherHeaderDto)
], SaveOpeningStockVoucherDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: SaveOpeningStockVoucherItemDto,
        isArray: true,
        description: 'A full replace on update. Merging by row number over a grid the user can insert into is where line numbers drift, and a DRAFT has no history worth preserving.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(MAX_LINES, { message: `lines may not exceed ${MAX_LINES} rows in one document` }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaveOpeningStockVoucherItemDto),
    __metadata("design:type", Array)
], SaveOpeningStockVoucherDto.prototype, "lines", void 0);
//# sourceMappingURL=save-opening-stock-voucher.dto.js.map