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
exports.SaveSellingPriceBulkDto = exports.SaveSellingPriceRowDto = exports.SaveSellingPriceLevelDto = exports.MAX_SAVE_ROWS = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const selling_price_bulk_types_1 = require("../types/selling-price-bulk.types");
exports.MAX_SAVE_ROWS = 1000;
class SaveSellingPriceLevelDto {
    level;
    price;
    priceWot;
    markupPerc;
}
exports.SaveSellingPriceLevelDto = SaveSellingPriceLevelDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: selling_price_bulk_types_1.PRICE_LEVELS,
        description: 'Price level ordinal 1-4, mapping onto item_price_master ipm_sales_price_a..d. ' +
            'The NAMES come from inventory.item_price_levels; no user-facing text says "A".',
    }),
    (0, dtoDecorators_1.RequiredInteger)(1, 4),
    __metadata("design:type", Number)
], SaveSellingPriceLevelDto.prototype, "level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 118,
        description: 'The shelf price, inclusive of tax. AUTHORITATIVE — the server recomputes priceWot ' +
            'and markupPerc from it and ignores whatever those two arrive as.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], SaveSellingPriceLevelDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 100,
        description: 'Accepted and DISCARDED. Recomputed from price and the resolved tax %. See §5.1.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveSellingPriceLevelDto.prototype, "priceWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 18,
        description: 'Accepted and DISCARDED. Recomputed from price and the row cost. See §5.1.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveSellingPriceLevelDto.prototype, "markupPerc", void 0);
class SaveSellingPriceRowDto {
    lineNo;
    itemId;
    uomId;
    bucketId;
    priceScope;
    mrp;
    salePrice;
    levels;
    minPrice;
    roundOff;
}
exports.SaveSellingPriceRowDto = SaveSellingPriceRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 0,
        description: 'The grid line this row came from. Echoed back on every problem so the client can highlight it.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveSellingPriceRowDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSellingPriceRowDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'inventory.item_unit_conversion.iuc_id — NOT item_unit_master.unit_id. Same convention ' +
            'as the stock voucher lines, and the same trap: the foreign key catches a unit_id only ' +
            'after forty rows have been typed.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSellingPriceRowDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'uuid',
        nullable: true,
        description: 'The bucket loaded into this row, when it had one. Absent means the row is either a new ' +
            'bucket (S3) or a headline row (§6) — which of the two is decided by mrp/salePrice, ' +
            'never by this field.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSellingPriceRowDto.prototype, "bucketId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: selling_price_bulk_types_1.PRICE_SCOPES,
        nullable: true,
        description: 'The priceScope this row was LOADED with, echoed back unchanged. Together with the ' +
            'header scope it is the whole of §5.5 — a CHAIN-sourced row saved at This branch ' +
            'creates an override, the same row saved at All branches moves the chain. Absent means ' +
            'the row carries no price yet, and the header scope decides alone.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(selling_price_bulk_types_1.PRICE_SCOPES),
    __metadata("design:type", Object)
], SaveSellingPriceRowDto.prototype, "priceScope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Number,
        nullable: true,
        description: 'Identity dimension, echoed back from the load. Never edited here — see §12.',
    }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], SaveSellingPriceRowDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Number,
        nullable: true,
        description: 'Identity dimension, echoed back from the load.',
    }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], SaveSellingPriceRowDto.prototype, "salePrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaveSellingPriceLevelDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaveSellingPriceLevelDto),
    __metadata("design:type", Array)
], SaveSellingPriceRowDto.prototype, "levels", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], SaveSellingPriceRowDto.prototype, "minPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSellingPriceRowDto.prototype, "roundOff", void 0);
class SaveSellingPriceBulkDto {
    companyId;
    branchId;
    scope;
    confirmed;
    rows;
    userId;
}
exports.SaveSellingPriceBulkDto = SaveSellingPriceBulkDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSellingPriceBulkDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSellingPriceBulkDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: selling_price_bulk_types_1.PRICE_SCOPES,
        description: 'The header radio. BRANCH = This branch, CHAIN = All branches. It is not a filter on ' +
            'what was displayed: it decides which row S1 looks for, and therefore whether the save ' +
            'updates a row or creates one. CHAIN from a non-HQ caller is a 403, never a silent ' +
            'downgrade to BRANCH.',
    }),
    (0, class_validator_1.IsIn)(selling_price_bulk_types_1.PRICE_SCOPES),
    __metadata("design:type", Object)
], SaveSellingPriceBulkDto.prototype, "scope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'The below-cost round trip (§5.3). Suppresses the BELOW_COST verdict ONLY, and only when ' +
            'inventory.below_cost_price resolves to "warning". Above-MRP and below-min still abort, ' +
            'and Q26 is re-run on the confirmed post because cost moves when a purchase posts.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSellingPriceBulkDto.prototype, "confirmed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: SaveSellingPriceRowDto,
        isArray: true,
        description: 'CHANGED rows only. The client knows which are dirty; the API must not have to diff four hundred rows to find twelve.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ArrayMaxSize)(exports.MAX_SAVE_ROWS),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaveSellingPriceRowDto),
    __metadata("design:type", Array)
], SaveSellingPriceBulkDto.prototype, "rows", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveSellingPriceBulkDto.prototype, "userId", void 0);
//# sourceMappingURL=save-selling-price-bulk.dto.js.map