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
exports.ListSellingPriceQueryDto = exports.MAX_PRICE_GRID_LIMIT = exports.DEFAULT_PRICE_GRID_LIMIT = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
exports.DEFAULT_PRICE_GRID_LIMIT = 200;
exports.MAX_PRICE_GRID_LIMIT = 1000;
class ListSellingPriceQueryDto {
    companyId;
    branchId;
    itemGroupId;
    itemBrandId;
    itemSectionId;
    supplierId;
    limit;
    offset;
}
exports.ListSellingPriceQueryDto = ListSellingPriceQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListSellingPriceQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The branch whose effective prices are resolved. Required even at CHAIN scope: ' +
            'fn_smp_effective answers "what does this branch see", and the Src chip is the answer.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListSellingPriceQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'item_master.item_group_id' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListSellingPriceQueryDto.prototype, "itemGroupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'item_master.item_brand_id' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListSellingPriceQueryDto.prototype, "itemBrandId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'item_master.item_section_id' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListSellingPriceQueryDto.prototype, "itemSectionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'item_master.item_supplier_id' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListSellingPriceQueryDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: exports.DEFAULT_PRICE_GRID_LIMIT, maximum: exports.MAX_PRICE_GRID_LIMIT }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, exports.MAX_PRICE_GRID_LIMIT),
    __metadata("design:type", Number)
], ListSellingPriceQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalQueryInt)(0),
    __metadata("design:type", Number)
], ListSellingPriceQueryDto.prototype, "offset", void 0);
//# sourceMappingURL=list-selling-price-query.dto.js.map