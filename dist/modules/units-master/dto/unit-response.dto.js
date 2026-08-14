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
exports.UnitSuccessDeleteDto = exports.UnitSuccessListDto = exports.UnitSuccessSingleDto = exports.UnitDeleteResultDto = exports.UnitListMetaDto = exports.UnitPayloadDto = exports.UnitErrorResponseDto = exports.UnitErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class UnitErrorFieldDto {
    field;
    message;
}
exports.UnitErrorFieldDto = UnitErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'unit_name' }),
    __metadata("design:type", String)
], UnitErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate unit_name is not allowed' }),
    __metadata("design:type", String)
], UnitErrorFieldDto.prototype, "message", void 0);
class UnitErrorResponseDto {
    success;
    message;
    errors;
}
exports.UnitErrorResponseDto = UnitErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], UnitErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], UnitErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UnitErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], UnitErrorResponseDto.prototype, "errors", void 0);
class UnitPayloadDto {
    unit_id;
    unit_name;
    unit_alias;
    unit_code;
    unit_description;
    unit_decimal_count;
    unit_weight;
    unit_loading;
    unit_unloading;
    unit_attach_charge;
    unit_is_pack_unit;
    unit_base_unit_id;
    unit_conversion;
    unit_is_active;
    unit_is_deleted;
    unit_sync_date;
    unit_created_on;
    unit_created_by;
    unit_modified_on;
    unit_modified_by;
}
exports.UnitPayloadDto = UnitPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], UnitPayloadDto.prototype, "unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50 }),
    __metadata("design:type", String)
], UnitPayloadDto.prototype, "unit_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_alias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], UnitPayloadDto.prototype, "unit_decimal_count", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 0.5 }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_weight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 5 }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_loading", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 5 }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_unloading", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 2 }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_attach_charge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], UnitPayloadDto.prototype, "unit_is_pack_unit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 1 }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_base_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 10 }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_conversion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UnitPayloadDto.prototype, "unit_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], UnitPayloadDto.prototype, "unit_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UnitPayloadDto.prototype, "unit_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UnitPayloadDto.prototype, "unit_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_modified_by", void 0);
class UnitListMetaDto {
    page;
    limit;
    total;
    total_pages;
}
exports.UnitListMetaDto = UnitListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], UnitListMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], UnitListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], UnitListMetaDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], UnitListMetaDto.prototype, "total_pages", void 0);
class UnitDeleteResultDto {
    unit_id;
    deleted;
}
exports.UnitDeleteResultDto = UnitDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], UnitDeleteResultDto.prototype, "unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UnitDeleteResultDto.prototype, "deleted", void 0);
class UnitSuccessSingleDto {
    success;
    message;
    data;
}
exports.UnitSuccessSingleDto = UnitSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UnitSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Unit fetched successfully' }),
    __metadata("design:type", String)
], UnitSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UnitPayloadDto }),
    __metadata("design:type", UnitPayloadDto)
], UnitSuccessSingleDto.prototype, "data", void 0);
class UnitSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.UnitSuccessListDto = UnitSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UnitSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Units fetched successfully' }),
    __metadata("design:type", String)
], UnitSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UnitPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], UnitSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UnitListMetaDto }),
    __metadata("design:type", UnitListMetaDto)
], UnitSuccessListDto.prototype, "meta", void 0);
class UnitSuccessDeleteDto {
    success;
    message;
    data;
}
exports.UnitSuccessDeleteDto = UnitSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UnitSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Unit deleted successfully' }),
    __metadata("design:type", String)
], UnitSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UnitDeleteResultDto }),
    __metadata("design:type", UnitDeleteResultDto)
], UnitSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=unit-response.dto.js.map