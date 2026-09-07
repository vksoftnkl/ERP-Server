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
exports.SaveStockVoucherItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const stock_voucher_types_1 = require("../types/stock-voucher.types");
class SaveStockVoucherItemDto {
    lineNo;
    splitNo;
    itemId;
    uomId;
    baseUomId;
    godownId;
    bucket;
    batchNo;
    mfgDate;
    expiryDate;
    mrp;
    salePrice;
    serialNo;
    supplierId;
    qty;
    freeQty;
    costRate;
    costRateWot;
    taxPerc;
    remarks;
}
exports.SaveStockVoucherItemDto = SaveStockVoucherItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, description: 'Position in the grid, 1-based (ck_svi_line_no)' }),
    (0, dtoDecorators_1.RequiredInteger)(),
    __metadata("design:type", Number)
], SaveStockVoucherItemDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        default: 1,
        description: 'A second allocation of the same line — one line drawn from three batches is three rows. Only meaningful with a batchNo (ck_svi_batch_split).',
    }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveStockVoucherItemDto.prototype, "splitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'inventory.item_master.item_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockVoucherItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'inventory.item_unit_conversion.iuc_id — NOT item_unit_master.unit_id. The unit must belong to this item (iuc_item_id).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockVoucherItemDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "The item's base unit, also an iuc_id. Resolved server-side from item_unit_conversion when omitted.",
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "baseUomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'inventory.godown_locations.gdl_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockVoucherItemDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.STOCK_BUCKETS,
        default: 'SALEABLE',
        description: 'ck_svi_bucket',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_BUCKETS, {
        message: `bucket must be one of ${stock_voucher_types_1.STOCK_BUCKETS.join(', ')}`,
    }),
    __metadata("design:type", String)
], SaveStockVoucherItemDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "mfgDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "expiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "salePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "serialNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'In uomId, not in the base unit. Must not be negative.' }),
    (0, dtoDecorators_1.RequiredNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 0,
        description: 'Free goods, in uomId. They are stock, and they count toward the totals.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "freeQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cost per unit of uomId, inclusive of tax.' }),
    (0, dtoDecorators_1.RequiredNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "costRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 0,
        description: 'Cost excluding tax. Leave 0 — the engine derives it from taxPerc at post and writes it back (20 ÷ 1.05 = 19.047619).',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "costRateWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "taxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "remarks", void 0);
//# sourceMappingURL=save-stock-voucher-item.dto.js.map