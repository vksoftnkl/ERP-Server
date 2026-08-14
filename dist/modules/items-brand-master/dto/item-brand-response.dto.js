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
exports.ItemBrandSuccessDeleteDto = exports.ItemBrandSuccessListDto = exports.ItemBrandSuccessSingleDto = exports.ItemBrandDeleteResultDto = exports.ItemBrandListMetaDto = exports.ItemBrandPayloadDto = exports.ItemBrandErrorResponseDto = exports.ItemBrandErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class ItemBrandErrorFieldDto {
    field;
    message;
}
exports.ItemBrandErrorFieldDto = ItemBrandErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'brand_name' }),
    __metadata("design:type", String)
], ItemBrandErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate brand_name is not allowed' }),
    __metadata("design:type", String)
], ItemBrandErrorFieldDto.prototype, "message", void 0);
class ItemBrandErrorResponseDto {
    success;
    message;
    errors;
}
exports.ItemBrandErrorResponseDto = ItemBrandErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemBrandErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], ItemBrandErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemBrandErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], ItemBrandErrorResponseDto.prototype, "errors", void 0);
class ItemBrandPayloadDto {
    brand_id;
    brand_name;
    brand_alias;
    brand_short;
    brand_description;
    brand_photo;
    brand_photo_url;
    brand_parent_id;
    brand_sort;
    brand_level;
    brand_path_ids;
    brand_is_active;
    brand_is_deleted;
    brand_sync_date;
    brand_created_on;
    brand_created_by;
    brand_modified_on;
    brand_modified_by;
}
exports.ItemBrandPayloadDto = ItemBrandPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBrandPayloadDto.prototype, "brand_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    __metadata("design:type", String)
], ItemBrandPayloadDto.prototype, "brand_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], ItemBrandPayloadDto.prototype, "brand_alias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], ItemBrandPayloadDto.prototype, "brand_short", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], ItemBrandPayloadDto.prototype, "brand_description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Base64 encoded image' }),
    __metadata("design:type", Object)
], ItemBrandPayloadDto.prototype, "brand_photo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBrandPayloadDto.prototype, "brand_photo_url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemBrandPayloadDto.prototype, "brand_parent_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBrandPayloadDto.prototype, "brand_sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBrandPayloadDto.prototype, "brand_level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], example: [] }),
    __metadata("design:type", Array)
], ItemBrandPayloadDto.prototype, "brand_path_ids", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemBrandPayloadDto.prototype, "brand_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemBrandPayloadDto.prototype, "brand_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBrandPayloadDto.prototype, "brand_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemBrandPayloadDto.prototype, "brand_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBrandPayloadDto.prototype, "brand_created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemBrandPayloadDto.prototype, "brand_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBrandPayloadDto.prototype, "brand_modified_by", void 0);
class ItemBrandListMetaDto {
    page;
    limit;
    total;
    total_pages;
}
exports.ItemBrandListMetaDto = ItemBrandListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ItemBrandListMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], ItemBrandListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], ItemBrandListMetaDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ItemBrandListMetaDto.prototype, "total_pages", void 0);
class ItemBrandDeleteResultDto {
    brand_id;
    deleted;
}
exports.ItemBrandDeleteResultDto = ItemBrandDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBrandDeleteResultDto.prototype, "brand_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemBrandDeleteResultDto.prototype, "deleted", void 0);
class ItemBrandSuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemBrandSuccessSingleDto = ItemBrandSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemBrandSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item brand fetched successfully' }),
    __metadata("design:type", String)
], ItemBrandSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemBrandPayloadDto }),
    __metadata("design:type", ItemBrandPayloadDto)
], ItemBrandSuccessSingleDto.prototype, "data", void 0);
class ItemBrandSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.ItemBrandSuccessListDto = ItemBrandSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemBrandSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item brands fetched successfully' }),
    __metadata("design:type", String)
], ItemBrandSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemBrandPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemBrandSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemBrandListMetaDto }),
    __metadata("design:type", ItemBrandListMetaDto)
], ItemBrandSuccessListDto.prototype, "meta", void 0);
class ItemBrandSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemBrandSuccessDeleteDto = ItemBrandSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemBrandSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item brand deleted successfully' }),
    __metadata("design:type", String)
], ItemBrandSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemBrandDeleteResultDto }),
    __metadata("design:type", ItemBrandDeleteResultDto)
], ItemBrandSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-brand-response.dto.js.map