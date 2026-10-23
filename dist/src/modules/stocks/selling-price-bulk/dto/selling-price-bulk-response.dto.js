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
exports.SellingPriceScheduleCancelSuccessDto = exports.SellingPriceScheduleCancelDataDto = exports.SellingPriceScheduleSuccessDto = exports.SellingPriceScheduleRowDto = exports.SellingPriceSchedulePreviousDto = exports.SellingPriceSaveSuccessDto = exports.SellingPriceSaveDataDto = exports.SellingPriceSavedRowDto = exports.SellingPriceNoStockRowDto = exports.SellingPriceProblemDto = exports.SellingPriceBucketsSuccessDto = exports.SellingPriceListSuccessDto = exports.SellingPriceListDataDto = exports.SellingPriceListMetaDto = exports.SellingPriceRowDto = exports.SellingPriceLevelDto = exports.SellingPriceErrorResponseDto = exports.SellingPriceErrorFieldDto = void 0;
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
    barcode;
    itemName;
    uomId;
    unitName;
    stockQty;
    mrp;
    salePrice;
    maxPrice;
    priceSource;
    priceScope;
    bucketId;
    costRate;
    costWot;
    costBasis;
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
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '8901234567890',
        description: 'item_default_barcode — display only, never sent back on save (notes 76).',
    }),
    __metadata("design:type", Object)
], SellingPriceRowDto.prototype, "barcode", void 0);
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
    (0, swagger_1.ApiProperty)({
        example: 42,
        description: "On hand at the branch for this bucket, in this row's own unit.",
    }),
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
        example: 40,
        description: "What the MRP column shows: the answering row's ipm_max_price — the bucket's MRP on a " +
            "BUCKET row, the headline's own MRP on a MASTER row. Display only; mrp is the identity " +
            'the save echoes.',
    }),
    __metadata("design:type", Number)
], SellingPriceRowDto.prototype, "maxPrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: selling_price_bulk_types_1.PRICE_SOURCES,
        description: 'The Src chip renders from this and priceScope, never from a string the API drew. ' +
            'MASTER with mrp / salePrice set = this stock bucket has no row of its own yet; the ' +
            'headline prices it and Save creates the bucket row.',
    }),
    __metadata("design:type", String)
], SellingPriceRowDto.prototype, "priceSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: selling_price_bulk_types_1.PRICE_SCOPES,
        nullable: true,
        description: 'Null when no price row answers for this bucket yet.',
    }),
    __metadata("design:type", Object)
], SellingPriceRowDto.prototype, "priceScope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'uuid',
        nullable: true,
        description: 'The item_price_master row (ipm_id) that answered — a bucket row on BUCKET, the headline ' +
            'on MASTER. NULL when no row prices this bucket yet.',
    }),
    __metadata("design:type", Object)
], SellingPriceRowDto.prototype, "bucketId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 95,
        description: "Cost of one of this row's unit: for an MRP-tracked item's MRP bucket, the inward cost of " +
            "that MRP's stock at the branch, weighted by what is on hand (notes 75); otherwise the " +
            'branch moving average, else the price row’s stored cost.',
    }),
    __metadata("design:type", Number)
], SellingPriceRowDto.prototype, "costRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 85,
        description: 'costRate without tax, from the same source (the MRP stock, the branch average or the ' +
            'price row) — exact for an item with cess, unlike cost ÷ (1 + tax%) (notes 76).',
    }),
    __metadata("design:type", Number)
], SellingPriceRowDto.prototype, "costWot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['MRP', 'ITEM', 'PRICE_ROW'],
        nullable: true,
        description: 'Which figure costRate is: MRP = that MRP’s stock only ("Cost @ MRP 40"), ITEM = the item ' +
            'average at the branch, PRICE_ROW = the cost stored on the answering price row. Null = no cost.',
    }),
    __metadata("design:type", Object)
], SellingPriceRowDto.prototype, "costBasis", void 0);
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
        description: "The item's tax rate carries a cess or an additional cess. The four-number panel is " +
            'approximate for it — tax_cess_per_unit is a per-unit amount, not a percentage of price, ' +
            'and neither cess is in taxPerc.',
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
    (0, swagger_1.ApiProperty)({ example: '4 price rows found' }),
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
class SellingPriceSavedRowDto {
    lineNo;
    bucketId;
    scheduled;
    effectiveFrom;
    effectiveTo;
}
exports.SellingPriceSavedRowDto = SellingPriceSavedRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], SellingPriceSavedRowDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The item_price_master row written — for a split, the NEW row.',
    }),
    __metadata("design:type", String)
], SellingPriceSavedRowDto.prototype, "bucketId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'True when the row starts after today: scheduled, not yet on the shelf.',
    }),
    __metadata("design:type", Boolean)
], SellingPriceSavedRowDto.prototype, "scheduled", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date', example: '2026-10-23' }),
    __metadata("design:type", String)
], SellingPriceSavedRowDto.prototype, "effectiveFrom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date', example: '9999-12-31' }),
    __metadata("design:type", String)
], SellingPriceSavedRowDto.prototype, "effectiveTo", void 0);
class SellingPriceSaveDataDto {
    saved;
    effectiveFrom;
    rows;
    masterRowsSaved;
    noStock;
    needsConfirm;
    problems;
    belowCostPolicy;
}
exports.SellingPriceSaveDataDto = SellingPriceSaveDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 12,
        description: 'item_price_master rows written — S2 and S3 together, buckets and headlines alike.',
    }),
    __metadata("design:type", Number)
], SellingPriceSaveDataDto.prototype, "saved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'date',
        example: '2026-10-23',
        description: "Notes 140 A — the day the prices start: the body's effectiveFrom, else today.",
    }),
    __metadata("design:type", String)
], SellingPriceSaveDataDto.prototype, "effectiveFrom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: SellingPriceSavedRowDto,
        isArray: true,
        description: 'Notes 140 A — per row written, in the order sent. Empty on needsConfirm.',
    }),
    __metadata("design:type", Array)
], SellingPriceSaveDataDto.prototype, "rows", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        deprecated: true,
        description: 'ALWAYS 0. The headline fan-out is gone (one price table); kept for one release so a ' +
            'client built against the frozen DTO does not break.',
    }),
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
class SellingPriceSchedulePreviousDto {
    bucketId;
    priceScope;
    levels;
}
exports.SellingPriceSchedulePreviousDto = SellingPriceSchedulePreviousDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'uuid',
        nullable: true,
        description: 'The row of the same key ending the day before, else the row that priced the bucket ' +
            'at this branch that day.',
    }),
    __metadata("design:type", Object)
], SellingPriceSchedulePreviousDto.prototype, "bucketId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: selling_price_bulk_types_1.PRICE_SCOPES, nullable: true }),
    __metadata("design:type", Object)
], SellingPriceSchedulePreviousDto.prototype, "priceScope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SellingPriceLevelDto, isArray: true }),
    __metadata("design:type", Array)
], SellingPriceSchedulePreviousDto.prototype, "levels", void 0);
class SellingPriceScheduleRowDto extends SellingPriceRowDto {
    effectiveFrom;
    effectiveTo;
    previous;
}
exports.SellingPriceScheduleRowDto = SellingPriceScheduleRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date', example: '2026-10-23' }),
    __metadata("design:type", String)
], SellingPriceScheduleRowDto.prototype, "effectiveFrom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date', example: '9999-12-31' }),
    __metadata("design:type", String)
], SellingPriceScheduleRowDto.prototype, "effectiveTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: SellingPriceSchedulePreviousDto,
        nullable: true,
        description: 'Null when nothing priced the bucket the day before.',
    }),
    __metadata("design:type", Object)
], SellingPriceScheduleRowDto.prototype, "previous", void 0);
class SellingPriceScheduleSuccessDto {
    success;
    message;
    data;
}
exports.SellingPriceScheduleSuccessDto = SellingPriceScheduleSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SellingPriceScheduleSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2 scheduled prices found' }),
    __metadata("design:type", String)
], SellingPriceScheduleSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SellingPriceScheduleRowDto, isArray: true }),
    __metadata("design:type", Array)
], SellingPriceScheduleSuccessDto.prototype, "data", void 0);
class SellingPriceScheduleCancelDataDto {
    bucketId;
    restoredId;
    restoredTo;
}
exports.SellingPriceScheduleCancelDataDto = SellingPriceScheduleCancelDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The scheduled row, now deleted.' }),
    __metadata("design:type", String)
], SellingPriceScheduleCancelDataDto.prototype, "bucketId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'uuid',
        nullable: true,
        description: "The row before it, now running to the cancelled row's end.",
    }),
    __metadata("design:type", Object)
], SellingPriceScheduleCancelDataDto.prototype, "restoredId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true, example: '9999-12-31' }),
    __metadata("design:type", Object)
], SellingPriceScheduleCancelDataDto.prototype, "restoredTo", void 0);
class SellingPriceScheduleCancelSuccessDto {
    success;
    message;
    data;
}
exports.SellingPriceScheduleCancelSuccessDto = SellingPriceScheduleCancelSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SellingPriceScheduleCancelSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Scheduled price cancelled' }),
    __metadata("design:type", String)
], SellingPriceScheduleCancelSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SellingPriceScheduleCancelDataDto }),
    __metadata("design:type", SellingPriceScheduleCancelDataDto)
], SellingPriceScheduleCancelSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=selling-price-bulk-response.dto.js.map