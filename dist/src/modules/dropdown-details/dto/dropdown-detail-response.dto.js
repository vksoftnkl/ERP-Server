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
exports.DropdownDetailSuccessColumnUpdateDto = exports.DropdownDetailColumnUpdateResultDto = exports.DropdownDetailSuccessColumnDeleteDto = exports.DropdownColumnDeleteResultDto = exports.DropdownDetailSuccessDeleteDto = exports.DropdownDetailSuccessListDto = exports.DropdownDetailSuccessSingleDto = exports.DropdownDetailDeleteResultDto = exports.DropdownDetailPayloadDto = exports.DropdownColumnPayloadDto = exports.DropdownDetailErrorResponseDto = exports.DropdownDetailErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../common/utils/module-response.dto");
Object.defineProperty(exports, "DropdownDetailErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorFieldDto; } });
Object.defineProperty(exports, "DropdownDetailErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorResponseDto; } });
class DropdownColumnPayloadDto {
    dropdown_columns_id;
    dropdown_columns_dropdown_id;
    dropdown_columns_no;
    dropdown_columns_data_type;
    dropdown_columns_name;
    dropdown_columns_alias;
    dropdown_columns_width;
    dropdown_columns_visiblity;
    dropdown_columns_allignment;
    dropdown_columns_filter;
    dropdown_columns_sql_name;
    dropdown_columns_created_on;
    dropdown_columns_created_by;
    dropdown_columns_modified_on;
    dropdown_columns_modified_by;
    dropdown_columns_sync_on;
}
exports.DropdownColumnPayloadDto = DropdownColumnPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '018f2c9a-6cf2-7b6a-8f1c-4c9478c60001' }),
    __metadata("design:type", String)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1' }),
    __metadata("design:type", String)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_dropdown_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_no", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_data_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_alias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_width", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_visiblity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_allignment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_filter", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_sql_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-06-13T10:00:00.000Z' }),
    __metadata("design:type", String)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-06-13T10:00:00.000Z' }),
    __metadata("design:type", Object)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-06-13T10:00:00.000Z' }),
    __metadata("design:type", Object)
], DropdownColumnPayloadDto.prototype, "dropdown_columns_sync_on", void 0);
class DropdownDetailPayloadDto {
    dropdown_id;
    dropdown_name;
    dropdown_description;
    dropdown_sql;
    dropdown_sort_order;
    dropdown_sort_column;
    dropdown_completion;
    dropdown_sql_regional;
    dropdown_max_visible_items;
    dropdown_show_header;
    dropdown_width;
    dropdown_device_type;
    dropdown_created_on;
    dropdown_created_by;
    dropdown_modified_on;
    dropdown_modified_by;
    dropdown_sync_on;
    columns;
}
exports.DropdownDetailPayloadDto = DropdownDetailPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1' }),
    __metadata("design:type", String)
], DropdownDetailPayloadDto.prototype, "dropdown_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], DropdownDetailPayloadDto.prototype, "dropdown_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownDetailPayloadDto.prototype, "dropdown_description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], DropdownDetailPayloadDto.prototype, "dropdown_sql", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownDetailPayloadDto.prototype, "dropdown_sort_order", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownDetailPayloadDto.prototype, "dropdown_sort_column", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownDetailPayloadDto.prototype, "dropdown_completion", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownDetailPayloadDto.prototype, "dropdown_sql_regional", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], DropdownDetailPayloadDto.prototype, "dropdown_max_visible_items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], DropdownDetailPayloadDto.prototype, "dropdown_show_header", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownDetailPayloadDto.prototype, "dropdown_width", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownDetailPayloadDto.prototype, "dropdown_device_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-06-13T10:00:00.000Z' }),
    __metadata("design:type", String)
], DropdownDetailPayloadDto.prototype, "dropdown_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownDetailPayloadDto.prototype, "dropdown_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-06-13T10:00:00.000Z' }),
    __metadata("design:type", Object)
], DropdownDetailPayloadDto.prototype, "dropdown_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DropdownDetailPayloadDto.prototype, "dropdown_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-06-13T10:00:00.000Z' }),
    __metadata("design:type", Object)
], DropdownDetailPayloadDto.prototype, "dropdown_sync_on", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [DropdownColumnPayloadDto],
        description: 'Columns belonging to this dropdown',
    }),
    __metadata("design:type", Array)
], DropdownDetailPayloadDto.prototype, "columns", void 0);
class DropdownDetailDeleteResultDto {
    dropdown_id;
    deleted;
}
exports.DropdownDetailDeleteResultDto = DropdownDetailDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1' }),
    __metadata("design:type", String)
], DropdownDetailDeleteResultDto.prototype, "dropdown_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DropdownDetailDeleteResultDto.prototype, "deleted", void 0);
class DropdownDetailSuccessSingleDto {
    success;
    message;
    data;
}
exports.DropdownDetailSuccessSingleDto = DropdownDetailSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DropdownDetailSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Dropdown details fetched successfully' }),
    __metadata("design:type", String)
], DropdownDetailSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DropdownDetailPayloadDto }),
    __metadata("design:type", DropdownDetailPayloadDto)
], DropdownDetailSuccessSingleDto.prototype, "data", void 0);
class DropdownDetailSuccessListDto {
    success;
    message;
    data;
}
exports.DropdownDetailSuccessListDto = DropdownDetailSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DropdownDetailSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Dropdown details fetched successfully' }),
    __metadata("design:type", String)
], DropdownDetailSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DropdownDetailPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], DropdownDetailSuccessListDto.prototype, "data", void 0);
class DropdownDetailSuccessDeleteDto {
    success;
    message;
    data;
}
exports.DropdownDetailSuccessDeleteDto = DropdownDetailSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DropdownDetailSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Dropdown details deleted successfully' }),
    __metadata("design:type", String)
], DropdownDetailSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DropdownDetailDeleteResultDto }),
    __metadata("design:type", DropdownDetailDeleteResultDto)
], DropdownDetailSuccessDeleteDto.prototype, "data", void 0);
class DropdownColumnDeleteResultDto {
    dropdown_columns_id;
    deleted;
}
exports.DropdownColumnDeleteResultDto = DropdownColumnDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '018f2c9a-6cf2-7b6a-8f1c-4c9478c60001' }),
    __metadata("design:type", String)
], DropdownColumnDeleteResultDto.prototype, "dropdown_columns_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DropdownColumnDeleteResultDto.prototype, "deleted", void 0);
class DropdownDetailSuccessColumnDeleteDto {
    success;
    message;
    data;
}
exports.DropdownDetailSuccessColumnDeleteDto = DropdownDetailSuccessColumnDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DropdownDetailSuccessColumnDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Dropdown column deleted successfully' }),
    __metadata("design:type", String)
], DropdownDetailSuccessColumnDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DropdownColumnDeleteResultDto }),
    __metadata("design:type", DropdownColumnDeleteResultDto)
], DropdownDetailSuccessColumnDeleteDto.prototype, "data", void 0);
class DropdownDetailColumnUpdateResultDto {
    updated;
}
exports.DropdownDetailColumnUpdateResultDto = DropdownDetailColumnUpdateResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], DropdownDetailColumnUpdateResultDto.prototype, "updated", void 0);
class DropdownDetailSuccessColumnUpdateDto {
    success;
    message;
    data;
}
exports.DropdownDetailSuccessColumnUpdateDto = DropdownDetailSuccessColumnUpdateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DropdownDetailSuccessColumnUpdateDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], DropdownDetailSuccessColumnUpdateDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DropdownDetailColumnUpdateResultDto }),
    __metadata("design:type", DropdownDetailColumnUpdateResultDto)
], DropdownDetailSuccessColumnUpdateDto.prototype, "data", void 0);
//# sourceMappingURL=dropdown-detail-response.dto.js.map