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
exports.ListCostPriceBulkQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const cost_price_bulk_types_1 = require("../types/cost-price-bulk.types");
class ListCostPriceBulkQueryDto {
    companyId;
    branchId;
    groupId;
    itemCategoryId;
    brandId;
    sectionId;
    supplierId;
    profitType;
    priceListOnly;
    itemId;
    page;
    limit;
}
exports.ListCostPriceBulkQueryDto = ListCostPriceBulkQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListCostPriceBulkQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The branch whose price in force today is loaded: its own row, else the all-branches row.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListCostPriceBulkQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'item_master.item_group_id (dropdown 17)' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListCostPriceBulkQueryDto.prototype, "groupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'item_master.item_category_id (dropdown 20)',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListCostPriceBulkQueryDto.prototype, "itemCategoryId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'item_master.item_brand_id (dropdown 18)' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListCostPriceBulkQueryDto.prototype, "brandId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'item_master.item_section_id (dropdown 19)' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListCostPriceBulkQueryDto.prototype, "sectionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "item_master.item_supplier_id — the same meaning as Change Selling Price's supplierId (dropdown 35).",
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListCostPriceBulkQueryDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: cost_price_bulk_types_1.PROFIT_TYPES,
        description: "The unit's rule (ipm_profit_type of the row in force). Not applied to leftOut.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(cost_price_bulk_types_1.PROFIT_TYPES),
    __metadata("design:type", Object)
], ListCostPriceBulkQueryDto.prototype, "profitType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Only items with item_master.item_price_list on.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListCostPriceBulkQueryDto.prototype, "priceListOnly", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'ONE item — the blank-row add. Every priced unit of it, ANDed with the filters above. An item ' +
            'that may not be on the grid answers 422 with its reason: COST_BULK_INACTIVE, ' +
            'COST_BULK_NOT_PLAIN_STOCK (preset or old batch tick) or COST_BULK_NO_PRICE_ROW (no unit ' +
            'priced); not there at all, 404 LOOKUP_ITEM_NOT_FOUND.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListCostPriceBulkQueryDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, minimum: 1, description: '1-based.' }),
    (0, dtoDecorators_1.OptionalQueryInt)(1),
    __metadata("design:type", Number)
], ListCostPriceBulkQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: cost_price_bulk_types_1.DEFAULT_COST_BULK_PAGE, minimum: 1, maximum: cost_price_bulk_types_1.MAX_COST_BULK_PAGE }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, cost_price_bulk_types_1.MAX_COST_BULK_PAGE),
    __metadata("design:type", Number)
], ListCostPriceBulkQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=list-cost-price-bulk-query.dto.js.map