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
exports.ItemUnitConversionSuccessDeleteDto = exports.ItemUnitConversionSuccessListDto = exports.ItemUnitConversionSuccessSaveDto = exports.ItemUnitConversionSuccessSingleDto = exports.ItemUnitConversionDeleteResultDto = exports.ItemUnitConversionPayloadDto = exports.ItemUnitConversionListMetaDto = exports.ItemUnitConversionErrorResponseDto = exports.ItemUnitConversionErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "ItemUnitConversionErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "ItemUnitConversionErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
Object.defineProperty(exports, "ItemUnitConversionListMetaDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryListMetaDto; } });
class ItemUnitConversionPayloadDto {
    iuc_id;
    iuc_item_id;
    iuc_unit_id;
    iuc_base_unit_id;
    iuc_to_base_factor;
    iuc_unit_slno;
    iuc_unit_factor;
    iuc_is_default_unit;
    iuc_is_base_unit;
    iuc_is_big_unit;
    iuc_uom_weight;
    iuc_uom_remarks;
    iuc_is_active;
    iuc_is_deleted;
    iuc_sync_date;
    iuc_created_on;
    iuc_created_by;
    iuc_updated_on;
    iuc_updated_by;
    iuc_unit_name;
    iuc_base_unit_name;
}
exports.ItemUnitConversionPayloadDto = ItemUnitConversionPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemUnitConversionPayloadDto.prototype, "iuc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemUnitConversionPayloadDto.prototype, "iuc_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemUnitConversionPayloadDto.prototype, "iuc_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemUnitConversionPayloadDto.prototype, "iuc_base_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ItemUnitConversionPayloadDto.prototype, "iuc_to_base_factor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemUnitConversionPayloadDto.prototype, "iuc_unit_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ItemUnitConversionPayloadDto.prototype, "iuc_unit_factor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemUnitConversionPayloadDto.prototype, "iuc_is_default_unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemUnitConversionPayloadDto.prototype, "iuc_is_base_unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemUnitConversionPayloadDto.prototype, "iuc_is_big_unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemUnitConversionPayloadDto.prototype, "iuc_uom_weight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemUnitConversionPayloadDto.prototype, "iuc_uom_remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemUnitConversionPayloadDto.prototype, "iuc_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemUnitConversionPayloadDto.prototype, "iuc_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemUnitConversionPayloadDto.prototype, "iuc_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemUnitConversionPayloadDto.prototype, "iuc_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemUnitConversionPayloadDto.prototype, "iuc_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemUnitConversionPayloadDto.prototype, "iuc_updated_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemUnitConversionPayloadDto.prototype, "iuc_updated_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked unit (resolved on the item composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemUnitConversionPayloadDto.prototype, "iuc_unit_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked base unit (resolved on the item composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemUnitConversionPayloadDto.prototype, "iuc_base_unit_name", void 0);
class ItemUnitConversionDeleteResultDto {
    iuc_id;
    deleted;
}
exports.ItemUnitConversionDeleteResultDto = ItemUnitConversionDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemUnitConversionDeleteResultDto.prototype, "iuc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'true when the item unit conversion was soft deleted, false when it was restored',
    }),
    __metadata("design:type", Boolean)
], ItemUnitConversionDeleteResultDto.prototype, "deleted", void 0);
class ItemUnitConversionSuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemUnitConversionSuccessSingleDto = ItemUnitConversionSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemUnitConversionSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item unit conversion fetched successfully' }),
    __metadata("design:type", String)
], ItemUnitConversionSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemUnitConversionPayloadDto }),
    __metadata("design:type", ItemUnitConversionPayloadDto)
], ItemUnitConversionSuccessSingleDto.prototype, "data", void 0);
let ItemUnitConversionSuccessSaveDto = class ItemUnitConversionSuccessSaveDto {
    success;
    message;
    data;
};
exports.ItemUnitConversionSuccessSaveDto = ItemUnitConversionSuccessSaveDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemUnitConversionSuccessSaveDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item unit conversion created successfully' }),
    __metadata("design:type", String)
], ItemUnitConversionSuccessSaveDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        oneOf: [
            { $ref: (0, swagger_1.getSchemaPath)(ItemUnitConversionPayloadDto) },
            {
                type: 'array',
                items: { $ref: (0, swagger_1.getSchemaPath)(ItemUnitConversionPayloadDto) },
            },
        ],
    }),
    __metadata("design:type", Object)
], ItemUnitConversionSuccessSaveDto.prototype, "data", void 0);
exports.ItemUnitConversionSuccessSaveDto = ItemUnitConversionSuccessSaveDto = __decorate([
    (0, swagger_1.ApiExtraModels)(ItemUnitConversionPayloadDto, ItemUnitConversionDeleteResultDto)
], ItemUnitConversionSuccessSaveDto);
let ItemUnitConversionSuccessListDto = class ItemUnitConversionSuccessListDto {
    success;
    message;
    data;
    meta;
};
exports.ItemUnitConversionSuccessListDto = ItemUnitConversionSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemUnitConversionSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item unit conversions fetched successfully' }),
    __metadata("design:type", String)
], ItemUnitConversionSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ItemUnitConversionPayloadDto] }),
    __metadata("design:type", Array)
], ItemUnitConversionSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: module_response_dto_1.InventoryListMetaDto }),
    __metadata("design:type", module_response_dto_1.InventoryListMetaDto)
], ItemUnitConversionSuccessListDto.prototype, "meta", void 0);
exports.ItemUnitConversionSuccessListDto = ItemUnitConversionSuccessListDto = __decorate([
    (0, swagger_1.ApiExtraModels)(ItemUnitConversionPayloadDto)
], ItemUnitConversionSuccessListDto);
class ItemUnitConversionSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemUnitConversionSuccessDeleteDto = ItemUnitConversionSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemUnitConversionSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item unit conversion deleted successfully' }),
    __metadata("design:type", String)
], ItemUnitConversionSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        oneOf: [
            { $ref: (0, swagger_1.getSchemaPath)(ItemUnitConversionDeleteResultDto) },
            {
                type: 'array',
                items: { $ref: (0, swagger_1.getSchemaPath)(ItemUnitConversionDeleteResultDto) },
            },
        ],
    }),
    __metadata("design:type", Object)
], ItemUnitConversionSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-unit-conversion-response.dto.js.map