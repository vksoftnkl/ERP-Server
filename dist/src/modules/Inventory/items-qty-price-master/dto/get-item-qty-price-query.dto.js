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
exports.GetItemQtyPriceQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const module_list_query_base_dto_1 = require("../../../../common/utils/module-list-query.base.dto");
class GetItemQtyPriceQueryDto extends module_list_query_base_dto_1.InventoryListQueryBaseDto {
    iqp_id;
    iqp_item_id;
    iqp_item_unit_id;
    iqp_company_id;
    iqp_branch_id;
    iqp_party_id;
    iqp_price_level;
    iqp_is_active;
}
exports.GetItemQtyPriceQueryDto = GetItemQtyPriceQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetItemQtyPriceQueryDto.prototype, "iqp_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetItemQtyPriceQueryDto.prototype, "iqp_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetItemQtyPriceQueryDto.prototype, "iqp_item_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetItemQtyPriceQueryDto.prototype, "iqp_company_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetItemQtyPriceQueryDto.prototype, "iqp_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetItemQtyPriceQueryDto.prototype, "iqp_party_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Price level filter' }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], GetItemQtyPriceQueryDto.prototype, "iqp_price_level", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], GetItemQtyPriceQueryDto.prototype, "iqp_is_active", void 0);
//# sourceMappingURL=get-item-qty-price-query.dto.js.map