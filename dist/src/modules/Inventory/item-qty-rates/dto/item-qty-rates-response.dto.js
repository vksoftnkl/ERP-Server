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
exports.QtyRatesSaveSuccessDto = exports.QtyRatesViewSuccessDto = exports.QtyRatesSaveResultDto = exports.QtyRatesProblemDto = exports.QtyRatesViewDto = exports.QtyRatesUnitDto = exports.QtyRatesUnitLevelDto = exports.QtyRatesLevelDto = exports.QtyRatesRightsDto = exports.QtyRatesItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const item_qty_price_response_dto_1 = require("../../items-qty-price-master/dto/item-qty-price-response.dto");
class QtyRatesItemDto {
    itemId;
    itemCode;
    itemName;
    barcode;
    taxPerc;
    inclTax;
    hasCess;
    plainStock;
    trackedAs;
    leftOutReason;
}
exports.QtyRatesItemDto = QtyRatesItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QtyRatesItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], QtyRatesItemDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], QtyRatesItemDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], QtyRatesItemDto.prototype, "barcode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesItemDto.prototype, "taxPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QtyRatesItemDto.prototype, "inclTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QtyRatesItemDto.prototype, "hasCess", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QtyRatesItemDto.prototype, "plainStock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Plain stock' }),
    __metadata("design:type", String)
], QtyRatesItemDto.prototype, "trackedAs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        enum: ['INACTIVE', 'NOT_PLAIN_STOCK', 'OLD_BATCH_TICK'],
    }),
    __metadata("design:type", Object)
], QtyRatesItemDto.prototype, "leftOutReason", void 0);
class QtyRatesRightsDto {
    view;
    createSlab;
    editSlab;
    deleteSlab;
    editCard;
    allBranchSlab;
}
exports.QtyRatesRightsDto = QtyRatesRightsDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QtyRatesRightsDto.prototype, "view", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QtyRatesRightsDto.prototype, "createSlab", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QtyRatesRightsDto.prototype, "editSlab", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QtyRatesRightsDto.prototype, "deleteSlab", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Menu 30 (Change Selling Price) EDIT.' }),
    __metadata("design:type", Boolean)
], QtyRatesRightsDto.prototype, "editCard", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'isHqUserType — a slab for all branches (Q9).' }),
    __metadata("design:type", Boolean)
], QtyRatesRightsDto.prototype, "allBranchSlab", void 0);
class QtyRatesLevelDto {
    level;
    name;
    short;
}
exports.QtyRatesLevelDto = QtyRatesLevelDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesLevelDto.prototype, "level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], QtyRatesLevelDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], QtyRatesLevelDto.prototype, "short", void 0);
class QtyRatesUnitLevelDto {
    level;
    price;
    priceWot;
    markupPerc;
}
exports.QtyRatesUnitLevelDto = QtyRatesUnitLevelDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesUnitLevelDto.prototype, "level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesUnitLevelDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesUnitLevelDto.prototype, "priceWot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Against cardCost.' }),
    __metadata("design:type", Number)
], QtyRatesUnitLevelDto.prototype, "markupPerc", void 0);
class QtyRatesUnitDto {
    lineNo;
    uomId;
    unitName;
    unitSlno;
    parentUomId;
    parentUnitName;
    unitsPerParent;
    factorsAgree;
    bucketId;
    priceScope;
    priceSource;
    mrp;
    salePrice;
    maxPrice;
    stockQty;
    costRate;
    costWot;
    costBasis;
    stockAvg;
    rowCost;
    rowCostWot;
    cardCost;
    profitType;
    roundOff;
    minPrice;
    levels;
    costEditable;
    mrpEditable;
    scheduledFrom;
}
exports.QtyRatesUnitDto = QtyRatesUnitDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesUnitDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'iuc_id' }),
    __metadata("design:type", String)
], QtyRatesUnitDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesUnitDto.prototype, "unitSlno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "parentUomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "parentUnitName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "unitsPerParent", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QtyRatesUnitDto.prototype, "factorsAgree", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "bucketId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, enum: ['BRANCH', 'CHAIN'] }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "priceScope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['BUCKET', 'MASTER'] }),
    __metadata("design:type", String)
], QtyRatesUnitDto.prototype, "priceSource", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "salePrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesUnitDto.prototype, "maxPrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesUnitDto.prototype, "stockQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesUnitDto.prototype, "costRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesUnitDto.prototype, "costWot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, enum: ['MRP', 'ITEM', 'PRICE_ROW'] }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "costBasis", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "stockAvg", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "rowCost", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "rowCostWot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesUnitDto.prototype, "cardCost", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "profitType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesUnitDto.prototype, "roundOff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QtyRatesUnitDto.prototype, "minPrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: QtyRatesUnitLevelDto, isArray: true }),
    __metadata("design:type", Array)
], QtyRatesUnitDto.prototype, "levels", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QtyRatesUnitDto.prototype, "costEditable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QtyRatesUnitDto.prototype, "mrpEditable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, format: 'date' }),
    __metadata("design:type", Object)
], QtyRatesUnitDto.prototype, "scheduledFrom", void 0);
class QtyRatesViewDto {
    item;
    rights;
    belowCostPolicy;
    today;
    levels;
    units;
    slabs;
}
exports.QtyRatesViewDto = QtyRatesViewDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: QtyRatesItemDto }),
    __metadata("design:type", QtyRatesItemDto)
], QtyRatesViewDto.prototype, "item", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: QtyRatesRightsDto }),
    __metadata("design:type", QtyRatesRightsDto)
], QtyRatesViewDto.prototype, "rights", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['restrict', 'warning', 'allow'] }),
    __metadata("design:type", String)
], QtyRatesViewDto.prototype, "belowCostPolicy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date' }),
    __metadata("design:type", String)
], QtyRatesViewDto.prototype, "today", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: QtyRatesLevelDto, isArray: true }),
    __metadata("design:type", Array)
], QtyRatesViewDto.prototype, "levels", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: QtyRatesUnitDto, isArray: true }),
    __metadata("design:type", Array)
], QtyRatesViewDto.prototype, "units", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: item_qty_price_response_dto_1.ItemQtyPricePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], QtyRatesViewDto.prototype, "slabs", void 0);
class QtyRatesProblemDto {
    source;
    code;
    severity;
    lineNo;
    slabIndex;
    iqpId;
    uomId;
    unitName;
    level;
    price;
    cost;
    field;
    message;
}
exports.QtyRatesProblemDto = QtyRatesProblemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['CARD', 'SLAB'] }),
    __metadata("design:type", String)
], QtyRatesProblemDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ITEM_QTY_PRICE_BELOW_COST' }),
    __metadata("design:type", String)
], QtyRatesProblemDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['REFUSE', 'ASK', 'INFO'] }),
    __metadata("design:type", String)
], QtyRatesProblemDto.prototype, "severity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], QtyRatesProblemDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], QtyRatesProblemDto.prototype, "slabIndex", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], QtyRatesProblemDto.prototype, "iqpId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], QtyRatesProblemDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], QtyRatesProblemDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], QtyRatesProblemDto.prototype, "level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], QtyRatesProblemDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], QtyRatesProblemDto.prototype, "cost", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], QtyRatesProblemDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], QtyRatesProblemDto.prototype, "message", void 0);
class QtyRatesSaveResultDto {
    needsConfirm;
    rates;
    slabs;
    deletedSlabIds;
    problems;
    belowCostPolicy;
}
exports.QtyRatesSaveResultDto = QtyRatesSaveResultDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QtyRatesSaveResultDto.prototype, "needsConfirm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        type: Object,
        description: 'What POST /stock/price-bulk answers for the card rows; null with none.',
    }),
    __metadata("design:type", Object)
], QtyRatesSaveResultDto.prototype, "rates", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: item_qty_price_response_dto_1.ItemQtyPricePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], QtyRatesSaveResultDto.prototype, "slabs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, isArray: true }),
    __metadata("design:type", Array)
], QtyRatesSaveResultDto.prototype, "deletedSlabIds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: QtyRatesProblemDto, isArray: true }),
    __metadata("design:type", Array)
], QtyRatesSaveResultDto.prototype, "problems", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['restrict', 'warning', 'allow'] }),
    __metadata("design:type", String)
], QtyRatesSaveResultDto.prototype, "belowCostPolicy", void 0);
class QtyRatesViewSuccessDto {
    success;
    message;
    data;
}
exports.QtyRatesViewSuccessDto = QtyRatesViewSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], QtyRatesViewSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], QtyRatesViewSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: QtyRatesViewDto }),
    __metadata("design:type", QtyRatesViewDto)
], QtyRatesViewSuccessDto.prototype, "data", void 0);
class QtyRatesSaveSuccessDto {
    success;
    message;
    data;
}
exports.QtyRatesSaveSuccessDto = QtyRatesSaveSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], QtyRatesSaveSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], QtyRatesSaveSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: QtyRatesSaveResultDto }),
    __metadata("design:type", QtyRatesSaveResultDto)
], QtyRatesSaveSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=item-qty-rates-response.dto.js.map