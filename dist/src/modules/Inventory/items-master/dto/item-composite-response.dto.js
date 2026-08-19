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
exports.ItemCompositeSuccessDeleteDto = exports.ItemCompositeDeleteResultDto = exports.ItemCompositeSuccessSingleDto = exports.ItemCompositePayloadDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const item_response_dto_1 = require("./item-response.dto");
const item_unit_conversion_response_dto_1 = require("../../item-unit-conversion/dto/item-unit-conversion-response.dto");
const item_price_response_dto_1 = require("../../items-price-master/dto/item-price-response.dto");
const item_ean_code_response_dto_1 = require("../../items-ean-code-master/dto/item-ean-code-response.dto");
const item_reorder_response_dto_1 = require("../../items-reorder-master/dto/item-reorder-response.dto");
class ItemCompositePayloadDto {
    item;
    unit_conversions;
    prices;
    ean_codes;
    reorders;
}
exports.ItemCompositePayloadDto = ItemCompositePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: item_response_dto_1.ItemPayloadDto }),
    __metadata("design:type", item_response_dto_1.ItemPayloadDto)
], ItemCompositePayloadDto.prototype, "item", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [item_unit_conversion_response_dto_1.ItemUnitConversionPayloadDto] }),
    __metadata("design:type", Array)
], ItemCompositePayloadDto.prototype, "unit_conversions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [item_price_response_dto_1.ItemPricePayloadDto] }),
    __metadata("design:type", Array)
], ItemCompositePayloadDto.prototype, "prices", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [item_ean_code_response_dto_1.ItemEanCodePayloadDto] }),
    __metadata("design:type", Array)
], ItemCompositePayloadDto.prototype, "ean_codes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [item_reorder_response_dto_1.ItemReorderPayloadDto] }),
    __metadata("design:type", Array)
], ItemCompositePayloadDto.prototype, "reorders", void 0);
class ItemCompositeSuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemCompositeSuccessSingleDto = ItemCompositeSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemCompositeSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item created successfully' }),
    __metadata("design:type", String)
], ItemCompositeSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemCompositePayloadDto }),
    __metadata("design:type", ItemCompositePayloadDto)
], ItemCompositeSuccessSingleDto.prototype, "data", void 0);
class ItemCompositeDeleteResultDto {
    item;
    unit_conversions;
    prices;
    ean_codes;
    reorders;
}
exports.ItemCompositeDeleteResultDto = ItemCompositeDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: item_response_dto_1.ItemDeleteResultDto }),
    __metadata("design:type", item_response_dto_1.ItemDeleteResultDto)
], ItemCompositeDeleteResultDto.prototype, "item", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [item_unit_conversion_response_dto_1.ItemUnitConversionDeleteResultDto] }),
    __metadata("design:type", Array)
], ItemCompositeDeleteResultDto.prototype, "unit_conversions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [item_price_response_dto_1.ItemPriceDeleteResultDto] }),
    __metadata("design:type", Array)
], ItemCompositeDeleteResultDto.prototype, "prices", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [item_ean_code_response_dto_1.ItemEanCodeDeleteResultDto] }),
    __metadata("design:type", Array)
], ItemCompositeDeleteResultDto.prototype, "ean_codes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [item_reorder_response_dto_1.ItemReorderDeleteResultDto] }),
    __metadata("design:type", Array)
], ItemCompositeDeleteResultDto.prototype, "reorders", void 0);
class ItemCompositeSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemCompositeSuccessDeleteDto = ItemCompositeSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemCompositeSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item deleted successfully' }),
    __metadata("design:type", String)
], ItemCompositeSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemCompositeDeleteResultDto }),
    __metadata("design:type", ItemCompositeDeleteResultDto)
], ItemCompositeSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-composite-response.dto.js.map