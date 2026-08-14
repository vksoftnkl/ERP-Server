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
exports.ItemGroupSuccessDeleteDto = exports.ItemGroupSuccessListDto = exports.ItemGroupSuccessSingleDto = exports.ItemGroupDeleteResultDto = exports.ItemGroupListMetaDto = exports.ItemGroupPayloadDto = exports.ItemGroupErrorResponseDto = exports.ItemGroupErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class ItemGroupErrorFieldDto {
    field;
    message;
}
exports.ItemGroupErrorFieldDto = ItemGroupErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'itg_name' }),
    __metadata("design:type", String)
], ItemGroupErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate itg_name is not allowed' }),
    __metadata("design:type", String)
], ItemGroupErrorFieldDto.prototype, "message", void 0);
class ItemGroupErrorResponseDto {
    success;
    message;
    errors;
}
exports.ItemGroupErrorResponseDto = ItemGroupErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemGroupErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], ItemGroupErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemGroupErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], ItemGroupErrorResponseDto.prototype, "errors", void 0);
class ItemGroupPayloadDto {
    itg_id;
    itg_name;
    itg_alias;
    itg_short;
    itg_description;
    itg_parent_id;
    itg_sort;
    itg_level;
    itg_path_ids_cache;
    itg_tax_claim;
    itg_default_tax_id;
    itg_default_hsn;
    itg_default_uom_id;
    itg_photo;
    itg_photo_url;
    itg_sync_date;
    itg_is_active;
    itg_is_deleted;
    itg_created_on;
    itg_created_by;
    itg_modified_on;
    itg_modified_by;
}
exports.ItemGroupPayloadDto = ItemGroupPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemGroupPayloadDto.prototype, "itg_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    __metadata("design:type", String)
], ItemGroupPayloadDto.prototype, "itg_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_alias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_short", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_parent_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], example: [] }),
    __metadata("design:type", Array)
], ItemGroupPayloadDto.prototype, "itg_path_ids_cache", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_tax_claim", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_default_tax_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_default_hsn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_default_uom_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Base64 encoded image' }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_photo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_photo_url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemGroupPayloadDto.prototype, "itg_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemGroupPayloadDto.prototype, "itg_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemGroupPayloadDto.prototype, "itg_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemGroupPayloadDto.prototype, "itg_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemGroupPayloadDto.prototype, "itg_modified_by", void 0);
class ItemGroupListMetaDto {
    page;
    limit;
    total;
    total_pages;
}
exports.ItemGroupListMetaDto = ItemGroupListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ItemGroupListMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], ItemGroupListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], ItemGroupListMetaDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ItemGroupListMetaDto.prototype, "total_pages", void 0);
class ItemGroupDeleteResultDto {
    itg_id;
    deleted;
}
exports.ItemGroupDeleteResultDto = ItemGroupDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemGroupDeleteResultDto.prototype, "itg_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemGroupDeleteResultDto.prototype, "deleted", void 0);
class ItemGroupSuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemGroupSuccessSingleDto = ItemGroupSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemGroupSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item group fetched successfully' }),
    __metadata("design:type", String)
], ItemGroupSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemGroupPayloadDto }),
    __metadata("design:type", ItemGroupPayloadDto)
], ItemGroupSuccessSingleDto.prototype, "data", void 0);
class ItemGroupSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.ItemGroupSuccessListDto = ItemGroupSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemGroupSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item groups fetched successfully' }),
    __metadata("design:type", String)
], ItemGroupSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemGroupPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemGroupSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemGroupListMetaDto }),
    __metadata("design:type", ItemGroupListMetaDto)
], ItemGroupSuccessListDto.prototype, "meta", void 0);
class ItemGroupSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemGroupSuccessDeleteDto = ItemGroupSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemGroupSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item group deleted successfully' }),
    __metadata("design:type", String)
], ItemGroupSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemGroupDeleteResultDto }),
    __metadata("design:type", ItemGroupDeleteResultDto)
], ItemGroupSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-group-response.dto.js.map