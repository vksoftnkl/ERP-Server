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
exports.ItemCategorySuccessDeleteDto = exports.ItemCategorySuccessSingleDto = exports.ItemCategoryDeleteResultDto = exports.ItemCategoryPayloadDto = exports.ItemCategoryErrorResponseDto = exports.ItemCategoryErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "ItemCategoryErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "ItemCategoryErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
class ItemCategoryPayloadDto {
    category_id;
    category_name;
    category_alias;
    category_short;
    category_description;
    category_parent_id;
    category_parent_name;
    category_sort;
    category_level;
    category_path_ids_cache;
    category_tax_claim;
    category_default_tax_id;
    category_default_hsn;
    category_default_uom_id;
    category_photo;
    category_photo_url;
    category_sync_date;
    category_is_active;
    category_is_deleted;
    category_created_on;
    category_created_by;
    category_modified_on;
    category_modified_by;
}
exports.ItemCategoryPayloadDto = ItemCategoryPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemCategoryPayloadDto.prototype, "category_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    __metadata("design:type", String)
], ItemCategoryPayloadDto.prototype, "category_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_alias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_short", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_parent_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 150,
        nullable: true,
        description: 'Name of the parent category',
    }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_parent_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], example: [] }),
    __metadata("design:type", Array)
], ItemCategoryPayloadDto.prototype, "category_path_ids_cache", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_tax_claim", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_default_tax_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_default_hsn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_default_uom_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Base64 encoded image' }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_photo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_photo_url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemCategoryPayloadDto.prototype, "category_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemCategoryPayloadDto.prototype, "category_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemCategoryPayloadDto.prototype, "category_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemCategoryPayloadDto.prototype, "category_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCategoryPayloadDto.prototype, "category_modified_by", void 0);
class ItemCategoryDeleteResultDto {
    category_id;
    deleted;
}
exports.ItemCategoryDeleteResultDto = ItemCategoryDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemCategoryDeleteResultDto.prototype, "category_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'true when the item category was soft deleted, false when it was restored',
    }),
    __metadata("design:type", Boolean)
], ItemCategoryDeleteResultDto.prototype, "deleted", void 0);
class ItemCategorySuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemCategorySuccessSingleDto = ItemCategorySuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemCategorySuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item category fetched successfully' }),
    __metadata("design:type", String)
], ItemCategorySuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemCategoryPayloadDto }),
    __metadata("design:type", ItemCategoryPayloadDto)
], ItemCategorySuccessSingleDto.prototype, "data", void 0);
class ItemCategorySuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemCategorySuccessDeleteDto = ItemCategorySuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemCategorySuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item category deleted successfully' }),
    __metadata("design:type", String)
], ItemCategorySuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemCategoryDeleteResultDto }),
    __metadata("design:type", ItemCategoryDeleteResultDto)
], ItemCategorySuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-category-response.dto.js.map