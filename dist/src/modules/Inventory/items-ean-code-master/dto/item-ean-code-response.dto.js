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
exports.ItemEanCodeSuccessDeleteDto = exports.ItemEanCodeSuccessListDto = exports.ItemEanCodeSuccessSaveDto = exports.ItemEanCodeSuccessSingleDto = exports.ItemEanCodeDeleteResultDto = exports.ItemEanCodePayloadDto = exports.ItemEanCodeListMetaDto = exports.ItemEanCodeErrorResponseDto = exports.ItemEanCodeErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "ItemEanCodeErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "ItemEanCodeErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
Object.defineProperty(exports, "ItemEanCodeListMetaDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryListMetaDto; } });
class ItemEanCodePayloadDto {
    ean_id;
    ean_item_id;
    ean_unit_id;
    ean_code;
    ean_sl_no;
    ean_is_default;
    ean_is_active;
    ean_is_deleted;
    ean_created_on;
    ean_created_by;
    ean_modified_on;
    ean_modified_by;
    ean_remarks;
    ean_unit_name;
}
exports.ItemEanCodePayloadDto = ItemEanCodePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemEanCodePayloadDto.prototype, "ean_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemEanCodePayloadDto.prototype, "ean_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemEanCodePayloadDto.prototype, "ean_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 64 }),
    __metadata("design:type", String)
], ItemEanCodePayloadDto.prototype, "ean_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemEanCodePayloadDto.prototype, "ean_sl_no", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemEanCodePayloadDto.prototype, "ean_is_default", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemEanCodePayloadDto.prototype, "ean_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemEanCodePayloadDto.prototype, "ean_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemEanCodePayloadDto.prototype, "ean_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemEanCodePayloadDto.prototype, "ean_created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemEanCodePayloadDto.prototype, "ean_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemEanCodePayloadDto.prototype, "ean_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemEanCodePayloadDto.prototype, "ean_remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked unit (resolved on the item composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemEanCodePayloadDto.prototype, "ean_unit_name", void 0);
class ItemEanCodeDeleteResultDto {
    ean_id;
    deleted;
}
exports.ItemEanCodeDeleteResultDto = ItemEanCodeDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemEanCodeDeleteResultDto.prototype, "ean_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'true when the item EAN code was soft deleted, false when it was restored',
    }),
    __metadata("design:type", Boolean)
], ItemEanCodeDeleteResultDto.prototype, "deleted", void 0);
class ItemEanCodeSuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemEanCodeSuccessSingleDto = ItemEanCodeSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemEanCodeSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item EAN code fetched successfully' }),
    __metadata("design:type", String)
], ItemEanCodeSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemEanCodePayloadDto }),
    __metadata("design:type", ItemEanCodePayloadDto)
], ItemEanCodeSuccessSingleDto.prototype, "data", void 0);
let ItemEanCodeSuccessSaveDto = class ItemEanCodeSuccessSaveDto {
    success;
    message;
    data;
};
exports.ItemEanCodeSuccessSaveDto = ItemEanCodeSuccessSaveDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemEanCodeSuccessSaveDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item EAN code created successfully' }),
    __metadata("design:type", String)
], ItemEanCodeSuccessSaveDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        oneOf: [
            { $ref: (0, swagger_1.getSchemaPath)(ItemEanCodePayloadDto) },
            {
                type: 'array',
                items: { $ref: (0, swagger_1.getSchemaPath)(ItemEanCodePayloadDto) },
            },
        ],
    }),
    __metadata("design:type", Object)
], ItemEanCodeSuccessSaveDto.prototype, "data", void 0);
exports.ItemEanCodeSuccessSaveDto = ItemEanCodeSuccessSaveDto = __decorate([
    (0, swagger_1.ApiExtraModels)(ItemEanCodePayloadDto)
], ItemEanCodeSuccessSaveDto);
class ItemEanCodeSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.ItemEanCodeSuccessListDto = ItemEanCodeSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemEanCodeSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item EAN codes fetched successfully' }),
    __metadata("design:type", String)
], ItemEanCodeSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemEanCodePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemEanCodeSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: module_response_dto_1.InventoryListMetaDto }),
    __metadata("design:type", module_response_dto_1.InventoryListMetaDto)
], ItemEanCodeSuccessListDto.prototype, "meta", void 0);
class ItemEanCodeSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemEanCodeSuccessDeleteDto = ItemEanCodeSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemEanCodeSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item EAN code deleted successfully' }),
    __metadata("design:type", String)
], ItemEanCodeSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        oneOf: [
            { $ref: (0, swagger_1.getSchemaPath)(ItemEanCodeDeleteResultDto) },
            {
                type: 'array',
                items: { $ref: (0, swagger_1.getSchemaPath)(ItemEanCodeDeleteResultDto) },
            },
        ],
    }),
    __metadata("design:type", Object)
], ItemEanCodeSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-ean-code-response.dto.js.map