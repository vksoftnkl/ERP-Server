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
exports.MobileItemListSuccessDto = exports.MobileItemListDto = exports.MobileItemDto = exports.MobileItemUnitDto = exports.MobileItemOptionsSuccessDto = exports.MobileItemOptionsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class MobileCompanyOptionDto {
    id;
    name;
    place;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileCompanyOptionDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileCompanyOptionDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, description: 'comp_city' }),
    __metadata("design:type", Object)
], MobileCompanyOptionDto.prototype, "place", void 0);
class MobileSortedOptionDto {
    id;
    name;
    position;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileSortedOptionDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileSortedOptionDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: Number,
        description: 'The master sort order; null = unsorted',
    }),
    __metadata("design:type", Object)
], MobileSortedOptionDto.prototype, "position", void 0);
class MobileItemPriceLevelOptionDto {
    id;
    name;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], MobileItemPriceLevelOptionDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'WS Price' }),
    __metadata("design:type", String)
], MobileItemPriceLevelOptionDto.prototype, "name", void 0);
class MobileItemOptionsDto {
    companies;
    itemGroups;
    brands;
    priceLevels;
}
exports.MobileItemOptionsDto = MobileItemOptionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileCompanyOptionDto] }),
    __metadata("design:type", Array)
], MobileItemOptionsDto.prototype, "companies", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileSortedOptionDto] }),
    __metadata("design:type", Array)
], MobileItemOptionsDto.prototype, "itemGroups", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileSortedOptionDto] }),
    __metadata("design:type", Array)
], MobileItemOptionsDto.prototype, "brands", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [MobileItemPriceLevelOptionDto],
        description: 'Active levels without Cost (7). 1-4 price from priceA-priceD, 5 (MRP) from mrp, 6 (minimum) from minPrice.',
    }),
    __metadata("design:type", Array)
], MobileItemOptionsDto.prototype, "priceLevels", void 0);
class MobileItemOptionsSuccessDto {
    success;
    message;
    data;
}
exports.MobileItemOptionsSuccessDto = MobileItemOptionsSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileItemOptionsSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileItemOptionsSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileItemOptionsDto }),
    __metadata("design:type", MobileItemOptionsDto)
], MobileItemOptionsSuccessDto.prototype, "data", void 0);
const MONEY = { nullable: true, type: String, example: '125.00' };
class MobileItemUnitDto {
    iucId;
    unitId;
    unitName;
    factor;
    isDefaultUnit;
    isBaseUnit;
    weight;
    priced;
    priceA;
    priceB;
    priceC;
    priceD;
    mrp;
    minPrice;
    loadingCharge;
    freightCharge;
    priceSource;
    priceScope;
    availableQty;
}
exports.MobileItemUnitDto = MobileItemUnitDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'item_unit_conversion id: send it as soiItemUnitId' }),
    __metadata("design:type", String)
], MobileItemUnitDto.prototype, "iucId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileItemUnitDto.prototype, "unitId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: 'BOX' }),
    __metadata("design:type", Object)
], MobileItemUnitDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 12, description: 'qty in this unit × factor = qty in the base unit' }),
    __metadata("design:type", Number)
], MobileItemUnitDto.prototype, "factor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileItemUnitDto.prototype, "isDefaultUnit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileItemUnitDto.prototype, "isBaseUnit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'UOM weight per unit (0 = not set)' }),
    __metadata("design:type", Number)
], MobileItemUnitDto.prototype, "weight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'false = no live price row prices this unit today; every price is null',
    }),
    __metadata("design:type", Boolean)
], MobileItemUnitDto.prototype, "priced", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...MONEY, description: 'Price level 1 (A)' }),
    __metadata("design:type", Object)
], MobileItemUnitDto.prototype, "priceA", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...MONEY, description: 'Price level 2 (B)' }),
    __metadata("design:type", Object)
], MobileItemUnitDto.prototype, "priceB", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...MONEY, description: 'Price level 3 (C)' }),
    __metadata("design:type", Object)
], MobileItemUnitDto.prototype, "priceC", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...MONEY, description: 'Price level 4 (D)' }),
    __metadata("design:type", Object)
], MobileItemUnitDto.prototype, "priceD", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...MONEY, description: 'MRP (ipm_max_price, level 5)' }),
    __metadata("design:type", Object)
], MobileItemUnitDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...MONEY, description: 'Minimum price (level 6)' }),
    __metadata("design:type", Object)
], MobileItemUnitDto.prototype, "minPrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...MONEY, description: 'Loading charge per unit' }),
    __metadata("design:type", Object)
], MobileItemUnitDto.prototype, "loadingCharge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...MONEY, description: 'Freight charge per unit' }),
    __metadata("design:type", Object)
], MobileItemUnitDto.prototype, "freightCharge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['MASTER', 'BUCKET'], nullable: true }),
    __metadata("design:type", Object)
], MobileItemUnitDto.prototype, "priceSource", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['BRANCH', 'CHAIN'], nullable: true }),
    __metadata("design:type", Object)
], MobileItemUnitDto.prototype, "priceScope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 2.083,
        description: 'Saleable stock free to sell in the company, in this unit (3 decimals)',
    }),
    __metadata("design:type", Number)
], MobileItemUnitDto.prototype, "availableQty", void 0);
class MobileItemDto {
    itemId;
    itemCode;
    itemNameEn;
    itemNameTa;
    itemGroupId;
    itemGroupName;
    itemBrandId;
    itemBrandName;
    allowLoading;
    allowFreight;
    allowPromo;
    inclTax;
    hsnCode;
    taxId;
    taxPerc;
    availableBaseQty;
    units;
}
exports.MobileItemDto = MobileItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileItemDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileItemDto.prototype, "itemNameEn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileItemDto.prototype, "itemNameTa", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileItemDto.prototype, "itemGroupId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileItemDto.prototype, "itemGroupName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, format: 'uuid' }),
    __metadata("design:type", Object)
], MobileItemDto.prototype, "itemBrandId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileItemDto.prototype, "itemBrandName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileItemDto.prototype, "allowLoading", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileItemDto.prototype, "allowFreight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileItemDto.prototype, "allowPromo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The stored prices include tax' }),
    __metadata("design:type", Boolean)
], MobileItemDto.prototype, "inclTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileItemDto.prototype, "hsnCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, format: 'uuid' }),
    __metadata("design:type", Object)
], MobileItemDto.prototype, "taxId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '18.000',
        description: 'GST rate; 0 when the company is not GST applicable',
    }),
    __metadata("design:type", String)
], MobileItemDto.prototype, "taxPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 25, description: 'Free saleable stock in the base unit' }),
    __metadata("design:type", Number)
], MobileItemDto.prototype, "availableBaseQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileItemUnitDto] }),
    __metadata("design:type", Array)
], MobileItemDto.prototype, "units", void 0);
class MobileItemListDto {
    items;
    total;
    page;
    pageSize;
    hasMore;
    companyId;
    branchId;
    priceDate;
}
exports.MobileItemListDto = MobileItemListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileItemDto] }),
    __metadata("design:type", Array)
], MobileItemListDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileItemListDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileItemListDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileItemListDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileItemListDto.prototype, "hasMore", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileItemListDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        format: 'uuid',
        description: "The branch the prices are for (the phone's, else the company default)",
    }),
    __metadata("design:type", Object)
], MobileItemListDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-16', description: 'The day prices were read for' }),
    __metadata("design:type", String)
], MobileItemListDto.prototype, "priceDate", void 0);
class MobileItemListSuccessDto {
    success;
    message;
    data;
}
exports.MobileItemListSuccessDto = MobileItemListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileItemListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileItemListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileItemListDto }),
    __metadata("design:type", MobileItemListDto)
], MobileItemListSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=mobile-item-response.dto.js.map