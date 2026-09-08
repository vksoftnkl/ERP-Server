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
exports.SellingPriceSaveSuccessDto = exports.SellingPriceSaveDataDto = exports.SellingPriceNoStockRowDto = exports.SellingPriceProblemDto = exports.SellingPriceBucketsSuccessDto = exports.SellingPriceListSuccessDto = exports.SellingPriceListDataDto = exports.SellingPriceListMetaDto = exports.SellingPriceRowDto = exports.SellingPriceLevelDto = exports.SellingPriceErrorResponseDto = exports.SellingPriceErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const selling_price_bulk_types_1 = require("../types/selling-price-bulk.types");
class SellingPriceErrorFieldDto {
    field;
    message;
}
exports.SellingPriceErrorFieldDto = SellingPriceErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'scope' }),
    __metadata("design:type", String)
], SellingPriceErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Only an HQ user may save prices for all branches.' }),
    __metadata("design:type", String)
], SellingPriceErrorFieldDto.prototype, "message", void 0);
class SellingPriceErrorResponseDto {
    success;
    message;
    errors;
}
exports.SellingPriceErrorResponseDto = SellingPriceErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], SellingPriceErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'These prices cannot be saved' }),
    __metadata("design:type", String)
], SellingPriceErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SellingPriceErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], SellingPriceErrorResponseDto.prototype, "errors", void 0);
class SellingPriceLevelDto {
    level;
    markupPerc;
    priceWot;
    price;
    marginPerc;
}
exports.SellingPriceLevelDto = SellingPriceLevelDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: selling_price_bulk_types_1.PRICE_LEVELS, example: 1 }),
    __metadata("design:type", Number)
], SellingPriceLevelDto.prototype, "level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18.5 }),
    __metadata("design:type", Number)
], SellingPriceLevelDto.prototype, "markupPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100 }),
    __metadata("design:type", Number)
], SellingPriceLevelDto.prototype, "priceWot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 118 }),
    __metadata("design:type", Number)
], SellingPriceLevelDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 15.25 }),
    __metadata("design:type", Number)
], SellingPriceLevelDto.prototype, "marginPerc", void 0);
class SellingPriceRowDto {
    lineNo;
    itemId;
    itemCode;
    itemName;
    uomId;
    unitName;
    stockQty;
    mrp;
    salePrice;
    priceSource;
    priceScope;
    bucketId;
    costRate;
    minPrice;
    roundOff;
    taxPerc;
    inclTax;
    hasCess;
    levels;
}
exports.SellingPriceRowDto = SellingPriceRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], SellingPriceRowDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SellingPriceRowDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'SALT-1KG' }),
    __metadata("design:type", Object)
], SellingPriceRowDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Salt 1 Kg' }),
    __metadata("design:type", String)
], SellingPriceRowDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'item_unit_conversion.iuc_id' }),
    __metadata("design:type", String)
], SellingPriceRowDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'BOX' }),
    __metadata("design:type", Object)
], SellingPriceRowDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 42 }),
    __metadata("design:type", Number)
], SellingPriceRowDto.prototype, "stockQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true, example: 120 }),
    __metadata("design:type", Object)
], SellingPriceRowDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true, example: 118 }),
    __metadata("design:type", Object)
], SellingPriceRowDto.prototype, "salePrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: selling_price_bulk_types_1.PRICE_SOURCES,
        description: 'The Src chip renders from this and priceScope, never from a string the API drew.',
    }),
    __metadata("design:type", String)
], SellingPriceRowDto.prototype, "priceSource", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: selling_price_bulk_types_1.PRICE_SCOPES }),
    __metadata("design:type", String)
], SellingPriceRowDto.prototype, "priceScope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'uuid',
        nullable: true,
        description: 'NULL when priceSource = MASTER.',
    }),
    __metadata("design:type", Object)
], SellingPriceRowDto.prototype, "bucketId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 95 }),
    __metadata("design:type", Number)
], SellingPriceRowDto.prototype, "costRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100 }),
    __metadata("design:type", Number)
], SellingPriceRowDto.prototype, "minPrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], SellingPriceRowDto.prototype, "roundOff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 18,
        description: 'Resolved server-side as of today through item_tax_history, not by the client.',
    }),
    __metadata("design:type", Number)
], SellingPriceRowDto.prototype, "taxPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SellingPriceRowDto.prototype, "inclTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'The item carries a cess. The four-number panel is approximate for it — tax_cess_unit is ' +
            'a per-unit amount, not a percentage of price.',
    }),
    __metadata("design:type", Boolean)
], SellingPriceRowDto.prototype, "hasCess", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SellingPriceLevelDto, isArray: true }),
    __metadata("design:type", Array)
], SellingPriceRowDto.prototype, "levels", void 0);
class SellingPriceListMetaDto {
    limit;
    offset;
    count;
}
exports.SellingPriceListMetaDto = SellingPriceListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 200 }),
    __metadata("design:type", Number)
], SellingPriceListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], SellingPriceListMetaDto.prototype, "offset", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 200 }),
    __metadata("design:type", Number)
], SellingPriceListMetaDto.prototype, "count", void 0);
class SellingPriceListDataDto {
    items;
    meta;
}
exports.SellingPriceListDataDto = SellingPriceListDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: SellingPriceRowDto, isArray: true }),
    __metadata("design:type", Array)
], SellingPriceListDataDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SellingPriceListMetaDto }),
    __metadata("design:type", SellingPriceListMetaDto)
], SellingPriceListDataDto.prototype, "meta", void 0);
class SellingPriceListSuccessDto {
    success;
    message;
    data;
}
exports.SellingPriceListSuccessDto = SellingPriceListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SellingPriceListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '200 rows loaded' }),
    __metadata("design:type", String)
], SellingPriceListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SellingPriceListDataDto }),
    __metadata("design:type", SellingPriceListDataDto)
], SellingPriceListSuccessDto.prototype, "data", void 0);
class SellingPriceBucketsSuccessDto {
    success;
    message;
    data;
}
exports.SellingPriceBucketsSuccessDto = SellingPriceBucketsSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SellingPriceBucketsSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2 buckets found' }),
    __metadata("design:type", String)
], SellingPriceBucketsSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SellingPriceRowDto, isArray: true }),
    __metadata("design:type", Array)
], SellingPriceBucketsSuccessDto.prototype, "data", void 0);
class SellingPriceProblemDto {
    lineNo;
    itemId;
    itemCode;
    itemName;
    uomId;
    bucketId;
    level;
    verdict;
    message;
}
exports.SellingPriceProblemDto = SellingPriceProblemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], SellingPriceProblemDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SellingPriceProblemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SellingPriceProblemDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SellingPriceProblemDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SellingPriceProblemDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SellingPriceProblemDto.prototype, "bucketId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, enum: selling_price_bulk_types_1.PRICE_LEVELS, nullable: true }),
    __metadata("design:type", Object)
], SellingPriceProblemDto.prototype, "level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: selling_price_bulk_types_1.PRICE_VERDICTS }),
    __metadata("design:type", String)
], SellingPriceProblemDto.prototype, "verdict", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Retail Price 92.00 is below the cost of 95.00.' }),
    __metadata("design:type", String)
], SellingPriceProblemDto.prototype, "message", void 0);
class SellingPriceNoStockRowDto {
    bucketId;
    itemId;
    itemCode;
    itemName;
    uomId;
    unitName;
    mrp;
    salePrice;
}
exports.SellingPriceNoStockRowDto = SellingPriceNoStockRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SellingPriceNoStockRowDto.prototype, "bucketId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SellingPriceNoStockRowDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SellingPriceNoStockRowDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SellingPriceNoStockRowDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SellingPriceNoStockRowDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SellingPriceNoStockRowDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    __metadata("design:type", Object)
], SellingPriceNoStockRowDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    __metadata("design:type", Object)
], SellingPriceNoStockRowDto.prototype, "salePrice", void 0);
class SellingPriceSaveDataDto {
    saved;
    masterRowsSaved;
    noStock;
    needsConfirm;
    problems;
    belowCostPolicy;
}
exports.SellingPriceSaveDataDto = SellingPriceSaveDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 12, description: 'stock_mrp_price rows written — S2 and S3 together.' }),
    __metadata("design:type", Number)
], SellingPriceSaveDataDto.prototype, "saved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'item_price_master rows written by the §6 fan-out.' }),
    __metadata("design:type", Number)
], SellingPriceSaveDataDto.prototype, "masterRowsSaved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SellingPriceNoStockRowDto, isArray: true }),
    __metadata("design:type", Array)
], SellingPriceSaveDataDto.prototype, "noStock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'True means NOTHING was written and the client must re-post with confirmed: true.',
    }),
    __metadata("design:type", Boolean)
], SellingPriceSaveDataDto.prototype, "needsConfirm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SellingPriceProblemDto, isArray: true }),
    __metadata("design:type", Array)
], SellingPriceSaveDataDto.prototype, "problems", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: selling_price_bulk_types_1.BELOW_COST_POLICIES, example: 'warning' }),
    __metadata("design:type", String)
], SellingPriceSaveDataDto.prototype, "belowCostPolicy", void 0);
class SellingPriceSaveSuccessDto {
    success;
    message;
    data;
}
exports.SellingPriceSaveSuccessDto = SellingPriceSaveSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SellingPriceSaveSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '12 buckets saved · 2 have no stock on hand — the price applies when stock arrives.',
        description: 'NEVER a plain "Saved" when noStock is non-empty. That was legacy fault #2, and the ' +
            'message is built from the same numbers the client can see in data.',
    }),
    __metadata("design:type", String)
], SellingPriceSaveSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SellingPriceSaveDataDto }),
    __metadata("design:type", SellingPriceSaveDataDto)
], SellingPriceSaveSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=selling-price-bulk-response.dto.js.map