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
exports.SaveItemCompositeDto = exports.CompositeItemReorderDto = exports.CompositeItemEanCodeDto = exports.CompositeItemPriceDto = exports.CompositeItemUnitConversionDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const save_item_dto_1 = require("./save-item.dto");
const save_item_unit_conversion_dto_1 = require("../../item-unit-conversion/dto/save-item-unit-conversion.dto");
const save_item_price_dto_1 = require("../../items-price-master/dto/save-item-price.dto");
const save_item_ean_code_dto_1 = require("../../items-ean-code-master/dto/save-item-ean-code.dto");
const save_item_reorder_dto_1 = require("../../items-reorder-master/dto/save-item-reorder.dto");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class CompositeItemUnitConversionDto extends (0, swagger_1.OmitType)(save_item_unit_conversion_dto_1.SaveItemUnitConversionDto, [
    'iuc_item_id',
]) {
    iuc_item_id;
}
exports.CompositeItemUnitConversionDto = CompositeItemUnitConversionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Ignored when provided; server injects the parent item_id',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], CompositeItemUnitConversionDto.prototype, "iuc_item_id", void 0);
class CompositeItemPriceDto extends (0, swagger_1.OmitType)(save_item_price_dto_1.SaveItemPriceDto, ['ipm_item_id']) {
    ipm_item_id;
}
exports.CompositeItemPriceDto = CompositeItemPriceDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Ignored when provided; server injects the parent item_id',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], CompositeItemPriceDto.prototype, "ipm_item_id", void 0);
class CompositeItemEanCodeDto extends (0, swagger_1.OmitType)(save_item_ean_code_dto_1.SaveItemEanCodeDto, [
    'ean_item_id',
]) {
    ean_item_id;
}
exports.CompositeItemEanCodeDto = CompositeItemEanCodeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Ignored when provided; server injects the parent item_id',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], CompositeItemEanCodeDto.prototype, "ean_item_id", void 0);
class CompositeItemReorderDto extends (0, swagger_1.OmitType)(save_item_reorder_dto_1.SaveItemReorderDto, ['ir_item_id']) {
    ir_item_id;
}
exports.CompositeItemReorderDto = CompositeItemReorderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Ignored when provided; server injects the parent item_id',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], CompositeItemReorderDto.prototype, "ir_item_id", void 0);
class SaveItemCompositeDto extends save_item_dto_1.SaveItemDto {
    unit_conversions;
    prices;
    ean_codes;
    reorders;
}
exports.SaveItemCompositeDto = SaveItemCompositeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [CompositeItemUnitConversionDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CompositeItemUnitConversionDto),
    __metadata("design:type", Array)
], SaveItemCompositeDto.prototype, "unit_conversions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [CompositeItemPriceDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CompositeItemPriceDto),
    __metadata("design:type", Array)
], SaveItemCompositeDto.prototype, "prices", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [CompositeItemEanCodeDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CompositeItemEanCodeDto),
    __metadata("design:type", Array)
], SaveItemCompositeDto.prototype, "ean_codes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [CompositeItemReorderDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CompositeItemReorderDto),
    __metadata("design:type", Array)
], SaveItemCompositeDto.prototype, "reorders", void 0);
//# sourceMappingURL=save-item-composite.dto.js.map