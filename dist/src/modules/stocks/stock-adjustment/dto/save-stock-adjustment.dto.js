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
exports.SaveStockAdjustmentDto = exports.SaveStockAdjustmentItemDto = exports.SaveStockAdjustmentHeaderDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_stock_voucher_dto_1 = require("../../stock-voucher/dto/save-stock-voucher.dto");
const stock_voucher_types_1 = require("../../stock-voucher/types/stock-voucher.types");
const stock_adjustment_rules_1 = require("../stock-adjustment.rules");
const MAX_LINES = 2000;
class SaveStockAdjustmentHeaderDto extends save_stock_voucher_dto_1.SaveStockVoucherHeaderDto {
    voucherType;
}
exports.SaveStockAdjustmentHeaderDto = SaveStockAdjustmentHeaderDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: stock_adjustment_rules_1.STOCK_ADJUSTMENT_KINDS,
        description: 'Which of the four documents this is. A re-lot is an ADJUSTMENT carrying a RELOT_OUT / RELOT_IN pair.',
    }),
    (0, class_validator_1.IsIn)(stock_adjustment_rules_1.STOCK_ADJUSTMENT_KINDS, {
        message: `voucherType must be one of ${stock_adjustment_rules_1.STOCK_ADJUSTMENT_KINDS.join(', ')}`,
    }),
    __metadata("design:type", String)
], SaveStockAdjustmentHeaderDto.prototype, "voucherType", void 0);
class SaveStockAdjustmentItemDto {
    lineNo;
    itemId;
    uomId;
    baseUomId;
    toBaseFactor;
    qty;
    baseQty;
    freeQty;
    freeBaseQty;
    godownId;
    lotId;
    bucket;
    batchNo;
    mfgDate;
    expiryDate;
    mrp;
    salePrice;
    serialNo;
    supplierId;
    costRate;
    costRateWot;
    taxPerc;
    reasonId;
    remarks;
    barcode;
}
exports.SaveStockAdjustmentItemDto = SaveStockAdjustmentItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SaveStockAdjustmentItemDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockAdjustmentItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'inventory.item_unit_conversion.iuc_id the line is keyed in.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockAdjustmentItemDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: "The item's BASE conversion row." }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockAdjustmentItemDto.prototype, "baseUomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Document unit → base unit.' }),
    (0, class_validator_1.IsPositive)({ message: 'toBaseFactor must be greater than 0' }),
    __metadata("design:type", Number)
], SaveStockAdjustmentItemDto.prototype, "toBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The quantity, in the document unit. SIGNED only under a reason whose direction is BOTH (+ in, − out); an IN or OUT reason fixes the sign and a quantity the wrong way round is refused. Never 0.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(),
    __metadata("design:type", Number)
], SaveStockAdjustmentItemDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'qty × toBaseFactor, in the base unit, with the same sign as qty.' }),
    (0, dtoDecorators_1.RequiredNumber)(),
    __metadata("design:type", Number)
], SaveStockAdjustmentItemDto.prototype, "baseQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, description: 'Must be 0: an adjustment has no free goods.' }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveStockAdjustmentItemDto.prototype, "freeQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, description: 'Must be 0: an adjustment has no free goods.' }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveStockAdjustmentItemDto.prototype, "freeBaseQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: "The line's godown — the header's from/to godown." }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockAdjustmentItemDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'OUTWARD: the holding, from GET /stock/adjustment/pick-stock; omit it and the engine picks lots by the item\'s issue strategy. Required on an EXPIRY_WRITEOFF (the expiry is the lot\'s). INWARD: leave empty — the identity fields resolve the lot.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockAdjustmentItemDto.prototype, "lotId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: stock_voucher_types_1.STOCK_BUCKETS, default: 'SALEABLE' }),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_BUCKETS),
    __metadata("design:type", String)
], SaveStockAdjustmentItemDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true, description: 'Inward identity, when the policy tracks it.' }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveStockAdjustmentItemDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveStockAdjustmentItemDto.prototype, "mfgDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveStockAdjustmentItemDto.prototype, "expiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveStockAdjustmentItemDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveStockAdjustmentItemDto.prototype, "salePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveStockAdjustmentItemDto.prototype, "serialNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockAdjustmentItemDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'INWARD only, and only when the header names no rate source that derives one: what the stock is worth per document unit. An OUTWARD line is always stamped by the engine at the branch average; a keyed cost is ignored.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveStockAdjustmentItemDto.prototype, "costRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveStockAdjustmentItemDto.prototype, "costRateWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveStockAdjustmentItemDto.prototype, "taxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: "stock.stock_reason_master, per line. Falls back to the header's reason.",
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockAdjustmentItemDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveStockAdjustmentItemDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'What the scanner read, echoed back.' }),
    (0, dtoDecorators_1.NullableStringStrict)(200),
    __metadata("design:type", Object)
], SaveStockAdjustmentItemDto.prototype, "barcode", void 0);
class SaveStockAdjustmentDto {
    header;
    lines;
}
exports.SaveStockAdjustmentDto = SaveStockAdjustmentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaveStockAdjustmentHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SaveStockAdjustmentHeaderDto),
    __metadata("design:type", SaveStockAdjustmentHeaderDto)
], SaveStockAdjustmentDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaveStockAdjustmentItemDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(MAX_LINES, { message: `lines may not exceed ${MAX_LINES} rows in one document` }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaveStockAdjustmentItemDto),
    __metadata("design:type", Array)
], SaveStockAdjustmentDto.prototype, "lines", void 0);
//# sourceMappingURL=save-stock-adjustment.dto.js.map