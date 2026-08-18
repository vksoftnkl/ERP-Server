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
exports.UnitSuccessDeleteDto = exports.UnitSuccessSingleDto = exports.UnitDeleteResultDto = exports.UnitGridStyleDto = exports.UnitPayloadDto = exports.UnitErrorResponseDto = exports.UnitErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "UnitErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "UnitErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
class UnitPayloadDto {
    unit_id;
    unit_name;
    unit_alias;
    unit_code;
    unit_code_name;
    unit_description;
    unit_decimal_count;
    unit_weight;
    unit_loading;
    unit_unloading;
    unit_attach_charge;
    unit_is_pack_unit;
    unit_base_unit_id;
    unit_base_unit_name;
    unit_conversion;
    unit_is_active;
}
exports.UnitPayloadDto = UnitPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' }),
    __metadata("design:type", String)
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
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Kilograms', description: 'GST unit name resolved from unit_code' }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_code_name", void 0);
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
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        example: '019c6f6c-be87-7a11-8905-36092c46fd06',
    }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_base_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true, example: 'Box' }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_base_unit_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 10 }),
    __metadata("design:type", Object)
], UnitPayloadDto.prototype, "unit_conversion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UnitPayloadDto.prototype, "unit_is_active", void 0);
class UnitGridStyleDto {
    grid_column_number;
    grid_column_name;
    grid_column_width;
    grid_column_alignment;
    grid_column_visibility;
    grid_column_filter;
    grid_column_condition;
    grid_column_condition_color;
    grid_column_group;
    grid_column_total;
    grid_column_data_type;
    grid_column_color;
    grid_column_notes;
}
exports.UnitGridStyleDto = UnitGridStyleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], UnitGridStyleDto.prototype, "grid_column_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'unit_name' }),
    __metadata("design:type", String)
], UnitGridStyleDto.prototype, "grid_column_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 180 }),
    __metadata("design:type", Object)
], UnitGridStyleDto.prototype, "grid_column_width", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'left' }),
    __metadata("design:type", Object)
], UnitGridStyleDto.prototype, "grid_column_alignment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UnitGridStyleDto.prototype, "grid_column_visibility", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UnitGridStyleDto.prototype, "grid_column_filter", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], UnitGridStyleDto.prototype, "grid_column_condition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], UnitGridStyleDto.prototype, "grid_column_condition_color", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], UnitGridStyleDto.prototype, "grid_column_group", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], UnitGridStyleDto.prototype, "grid_column_total", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'text' }),
    __metadata("design:type", Object)
], UnitGridStyleDto.prototype, "grid_column_data_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], UnitGridStyleDto.prototype, "grid_column_color", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], UnitGridStyleDto.prototype, "grid_column_notes", void 0);
class UnitDeleteResultDto {
    unit_id;
    deleted;
}
exports.UnitDeleteResultDto = UnitDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' }),
    __metadata("design:type", String)
], UnitDeleteResultDto.prototype, "unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'true when the unit was soft deleted, false when it was restored',
    }),
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