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
exports.ItemSectionSuccessDeleteDto = exports.ItemSectionSuccessListDto = exports.ItemSectionSuccessSingleDto = exports.ItemSectionDeleteResultDto = exports.ItemSectionListMetaDto = exports.ItemSectionPayloadDto = exports.ItemSectionErrorResponseDto = exports.ItemSectionErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class ItemSectionErrorFieldDto {
    field;
    message;
}
exports.ItemSectionErrorFieldDto = ItemSectionErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'sec_name' }),
    __metadata("design:type", String)
], ItemSectionErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate sec_name is not allowed within sec_company_id' }),
    __metadata("design:type", String)
], ItemSectionErrorFieldDto.prototype, "message", void 0);
class ItemSectionErrorResponseDto {
    success;
    message;
    errors;
}
exports.ItemSectionErrorResponseDto = ItemSectionErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemSectionErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], ItemSectionErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemSectionErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], ItemSectionErrorResponseDto.prototype, "errors", void 0);
class ItemSectionPayloadDto {
    sec_id;
    sec_name;
    sec_alias;
    sec_short;
    sec_description;
    sec_company_id;
    sec_parent_id;
    sec_sort;
    sec_level;
    sec_path_ids;
    sec_position;
    sec_color_code;
    sec_icon;
    sec_photo;
    sec_photo_url;
    sec_sync_date;
    sec_is_active;
    sec_is_deleted;
    sec_created_on;
    sec_created_by;
    sec_modified_on;
    sec_modified_by;
}
exports.ItemSectionPayloadDto = ItemSectionPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemSectionPayloadDto.prototype, "sec_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    __metadata("design:type", String)
], ItemSectionPayloadDto.prototype, "sec_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_alias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_short", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemSectionPayloadDto.prototype, "sec_company_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_parent_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], example: [] }),
    __metadata("design:type", Array)
], ItemSectionPayloadDto.prototype, "sec_path_ids", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_position", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_color_code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_icon", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Base64 encoded image' }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_photo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_photo_url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemSectionPayloadDto.prototype, "sec_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemSectionPayloadDto.prototype, "sec_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemSectionPayloadDto.prototype, "sec_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemSectionPayloadDto.prototype, "sec_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemSectionPayloadDto.prototype, "sec_modified_by", void 0);
class ItemSectionListMetaDto {
    page;
    limit;
    total;
    total_pages;
}
exports.ItemSectionListMetaDto = ItemSectionListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ItemSectionListMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], ItemSectionListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], ItemSectionListMetaDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ItemSectionListMetaDto.prototype, "total_pages", void 0);
class ItemSectionDeleteResultDto {
    sec_id;
    deleted;
}
exports.ItemSectionDeleteResultDto = ItemSectionDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemSectionDeleteResultDto.prototype, "sec_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemSectionDeleteResultDto.prototype, "deleted", void 0);
class ItemSectionSuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemSectionSuccessSingleDto = ItemSectionSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemSectionSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item section fetched successfully' }),
    __metadata("design:type", String)
], ItemSectionSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemSectionPayloadDto }),
    __metadata("design:type", ItemSectionPayloadDto)
], ItemSectionSuccessSingleDto.prototype, "data", void 0);
class ItemSectionSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.ItemSectionSuccessListDto = ItemSectionSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemSectionSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item sections fetched successfully' }),
    __metadata("design:type", String)
], ItemSectionSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemSectionPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemSectionSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemSectionListMetaDto }),
    __metadata("design:type", ItemSectionListMetaDto)
], ItemSectionSuccessListDto.prototype, "meta", void 0);
class ItemSectionSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemSectionSuccessDeleteDto = ItemSectionSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemSectionSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item section deleted successfully' }),
    __metadata("design:type", String)
], ItemSectionSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemSectionDeleteResultDto }),
    __metadata("design:type", ItemSectionDeleteResultDto)
], ItemSectionSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-section-response.dto.js.map