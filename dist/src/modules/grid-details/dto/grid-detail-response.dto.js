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
exports.GridDetailSuccessColumnUpdateDto = exports.GridDetailColumnUpdateResultDto = exports.GridDetailSuccessColumnDeleteDto = exports.GridColumnDeleteResultDto = exports.GridDetailSuccessDeleteDto = exports.GridDetailSuccessListDto = exports.GridDetailSuccessSingleDto = exports.GridDetailDeleteResultDto = exports.GridDetailPayloadDto = exports.GridColumnPayloadDto = exports.GridDetailErrorResponseDto = exports.GridDetailErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../common/utils/module-response.dto");
Object.defineProperty(exports, "GridDetailErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorFieldDto; } });
Object.defineProperty(exports, "GridDetailErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorResponseDto; } });
class GridColumnPayloadDto {
    grid_column_id;
    grid_id;
    grid_column_number;
    grid_column_name;
    grid_column_width;
    grid_column_position;
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
    grid_column_px;
    grid_column_sql_field_name;
    grid_column_is_deleted;
    grid_column_created_on;
    grid_column_created_by;
    grid_column_modified_on;
    grid_column_modified_by;
    grid_column_sync_on;
}
exports.GridColumnPayloadDto = GridColumnPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '018f2c9a-6cf2-7b6a-8f1c-4c9478c60001' }),
    __metadata("design:type", String)
], GridColumnPayloadDto.prototype, "grid_column_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1' }),
    __metadata("design:type", String)
], GridColumnPayloadDto.prototype, "grid_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GridColumnPayloadDto.prototype, "grid_column_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GridColumnPayloadDto.prototype, "grid_column_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_width", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_position", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_alignment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GridColumnPayloadDto.prototype, "grid_column_visibility", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GridColumnPayloadDto.prototype, "grid_column_filter", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_condition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_condition_color", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GridColumnPayloadDto.prototype, "grid_column_group", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GridColumnPayloadDto.prototype, "grid_column_total", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_data_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_color", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '120px' }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_px", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_sql_field_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GridColumnPayloadDto.prototype, "grid_column_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-06-13T10:00:00.000Z' }),
    __metadata("design:type", String)
], GridColumnPayloadDto.prototype, "grid_column_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-06-13T10:00:00.000Z' }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-06-13T10:00:00.000Z' }),
    __metadata("design:type", Object)
], GridColumnPayloadDto.prototype, "grid_column_sync_on", void 0);
class GridDetailPayloadDto {
    grid_id;
    grid_name;
    grid_description;
    grid_sort_column;
    grid_sort_order;
    grid_device_type;
    grid_sql;
    grid_status;
    grid_is_deleted;
    grid_created_on;
    grid_created_by;
    grid_modified_on;
    grid_modified_by;
    grid_sync_on;
    columns;
}
exports.GridDetailPayloadDto = GridDetailPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1' }),
    __metadata("design:type", String)
], GridDetailPayloadDto.prototype, "grid_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GridDetailPayloadDto.prototype, "grid_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridDetailPayloadDto.prototype, "grid_description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridDetailPayloadDto.prototype, "grid_sort_column", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridDetailPayloadDto.prototype, "grid_sort_order", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridDetailPayloadDto.prototype, "grid_device_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridDetailPayloadDto.prototype, "grid_sql", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GridDetailPayloadDto.prototype, "grid_status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GridDetailPayloadDto.prototype, "grid_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-06-13T10:00:00.000Z' }),
    __metadata("design:type", String)
], GridDetailPayloadDto.prototype, "grid_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridDetailPayloadDto.prototype, "grid_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-06-13T10:00:00.000Z' }),
    __metadata("design:type", Object)
], GridDetailPayloadDto.prototype, "grid_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GridDetailPayloadDto.prototype, "grid_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-06-13T10:00:00.000Z' }),
    __metadata("design:type", Object)
], GridDetailPayloadDto.prototype, "grid_sync_on", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [GridColumnPayloadDto], description: 'Columns belonging to this grid' }),
    __metadata("design:type", Array)
], GridDetailPayloadDto.prototype, "columns", void 0);
class GridDetailDeleteResultDto {
    grid_id;
    deleted;
}
exports.GridDetailDeleteResultDto = GridDetailDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1' }),
    __metadata("design:type", String)
], GridDetailDeleteResultDto.prototype, "grid_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GridDetailDeleteResultDto.prototype, "deleted", void 0);
class GridDetailSuccessSingleDto {
    success;
    message;
    data;
}
exports.GridDetailSuccessSingleDto = GridDetailSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GridDetailSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Grid details fetched successfully' }),
    __metadata("design:type", String)
], GridDetailSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GridDetailPayloadDto }),
    __metadata("design:type", GridDetailPayloadDto)
], GridDetailSuccessSingleDto.prototype, "data", void 0);
class GridDetailSuccessListDto {
    success;
    message;
    data;
}
exports.GridDetailSuccessListDto = GridDetailSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GridDetailSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Grid details fetched successfully' }),
    __metadata("design:type", String)
], GridDetailSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GridDetailPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], GridDetailSuccessListDto.prototype, "data", void 0);
class GridDetailSuccessDeleteDto {
    success;
    message;
    data;
}
exports.GridDetailSuccessDeleteDto = GridDetailSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GridDetailSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Grid details deleted successfully' }),
    __metadata("design:type", String)
], GridDetailSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GridDetailDeleteResultDto }),
    __metadata("design:type", GridDetailDeleteResultDto)
], GridDetailSuccessDeleteDto.prototype, "data", void 0);
class GridColumnDeleteResultDto {
    grid_column_id;
    deleted;
}
exports.GridColumnDeleteResultDto = GridColumnDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '018f2c9a-6cf2-7b6a-8f1c-4c9478c60001' }),
    __metadata("design:type", String)
], GridColumnDeleteResultDto.prototype, "grid_column_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GridColumnDeleteResultDto.prototype, "deleted", void 0);
class GridDetailSuccessColumnDeleteDto {
    success;
    message;
    data;
}
exports.GridDetailSuccessColumnDeleteDto = GridDetailSuccessColumnDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GridDetailSuccessColumnDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Grid column deleted successfully' }),
    __metadata("design:type", String)
], GridDetailSuccessColumnDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GridColumnDeleteResultDto }),
    __metadata("design:type", GridColumnDeleteResultDto)
], GridDetailSuccessColumnDeleteDto.prototype, "data", void 0);
class GridDetailColumnUpdateResultDto {
    updated;
}
exports.GridDetailColumnUpdateResultDto = GridDetailColumnUpdateResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], GridDetailColumnUpdateResultDto.prototype, "updated", void 0);
class GridDetailSuccessColumnUpdateDto {
    success;
    message;
    data;
}
exports.GridDetailSuccessColumnUpdateDto = GridDetailSuccessColumnUpdateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GridDetailSuccessColumnUpdateDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GridDetailSuccessColumnUpdateDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GridDetailColumnUpdateResultDto }),
    __metadata("design:type", GridDetailColumnUpdateResultDto)
], GridDetailSuccessColumnUpdateDto.prototype, "data", void 0);
//# sourceMappingURL=grid-detail-response.dto.js.map