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
exports.ItemPriceDetailSuccessSingleDto = exports.ItemPriceDetailPayloadDto = exports.ItemPriceDetailErrorResponseDto = exports.ItemPriceDetailErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const item_response_dto_1 = require("../../items-master/dto/item-response.dto");
const item_price_response_dto_1 = require("../../items-price-master/dto/item-price-response.dto");
const item_tax_response_dto_1 = require("../../items-tax-master/dto/item-tax-response.dto");
const item_unit_conversion_response_dto_1 = require("../../item-unit-conversion/dto/item-unit-conversion-response.dto");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "ItemPriceDetailErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "ItemPriceDetailErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
class ItemPriceDetailPayloadDto {
    item;
    item_prices;
    item_unit_conversions;
    item_tax;
}
exports.ItemPriceDetailPayloadDto = ItemPriceDetailPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: item_response_dto_1.ItemPayloadDto }),
    __metadata("design:type", item_response_dto_1.ItemPayloadDto)
], ItemPriceDetailPayloadDto.prototype, "item", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: item_price_response_dto_1.ItemPricePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemPriceDetailPayloadDto.prototype, "item_prices", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: item_unit_conversion_response_dto_1.ItemUnitConversionPayloadDto,
        isArray: true,
        description: "The item's live unit conversions; each price row points at one through ipm_uc_unit_id and carries none of its shape",
    }),
    __metadata("design:type", Array)
], ItemPriceDetailPayloadDto.prototype, "item_unit_conversions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: item_tax_response_dto_1.ItemTaxPayloadDto, nullable: true }),
    __metadata("design:type", Object)
], ItemPriceDetailPayloadDto.prototype, "item_tax", void 0);
let ItemPriceDetailSuccessSingleDto = class ItemPriceDetailSuccessSingleDto {
    success;
    message;
    data;
};
exports.ItemPriceDetailSuccessSingleDto = ItemPriceDetailSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemPriceDetailSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item price details fetched successfully' }),
    __metadata("design:type", String)
], ItemPriceDetailSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemPriceDetailPayloadDto }),
    __metadata("design:type", ItemPriceDetailPayloadDto)
], ItemPriceDetailSuccessSingleDto.prototype, "data", void 0);
exports.ItemPriceDetailSuccessSingleDto = ItemPriceDetailSuccessSingleDto = __decorate([
    (0, swagger_1.ApiExtraModels)(item_response_dto_1.ItemPayloadDto, item_price_response_dto_1.ItemPricePayloadDto, item_unit_conversion_response_dto_1.ItemUnitConversionPayloadDto, item_tax_response_dto_1.ItemTaxPayloadDto)
], ItemPriceDetailSuccessSingleDto);
//# sourceMappingURL=item-price-detail-response.dto.js.map