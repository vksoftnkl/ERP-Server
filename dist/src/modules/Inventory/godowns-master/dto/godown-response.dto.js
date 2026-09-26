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
exports.GodownSuccessDeleteDto = exports.GodownSuccessSingleDto = exports.GodownDeleteResultDto = exports.GodownPayloadDto = exports.GodownErrorResponseDto = exports.GodownErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "GodownErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "GodownErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
class GodownPayloadDto {
    gdl_id;
    gdl_branch_id;
    gdl_branch_name;
    gdl_name;
    gdl_short;
    gdl_code;
    gdl_type;
    gdl_parent_id;
    gdl_parent_name;
    gdl_sort;
    gdl_level;
    gdl_path_ids_cache;
    gdl_del_sheet;
    gdl_split_stock;
    gdl_negative_stock;
    gdl_volume;
    gdl_is_active;
    gdl_is_deleted;
    gdl_created_on;
    gdl_created_by;
    gdl_modified_on;
    gdl_modified_by;
    gdl_remarks;
}
exports.GodownPayloadDto = GodownPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' }),
    __metadata("design:type", String)
], GodownPayloadDto.prototype, "gdl_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd07' }),
    __metadata("design:type", String)
], GodownPayloadDto.prototype, "gdl_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Head Office',
        description: 'Name of the branch (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], GodownPayloadDto.prototype, "gdl_branch_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Rack A1' }),
    __metadata("design:type", String)
], GodownPayloadDto.prototype, "gdl_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'A1' }),
    __metadata("design:type", Object)
], GodownPayloadDto.prototype, "gdl_short", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'RACK-A1' }),
    __metadata("design:type", Object)
], GodownPayloadDto.prototype, "gdl_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'BIN' }),
    __metadata("design:type", String)
], GodownPayloadDto.prototype, "gdl_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], GodownPayloadDto.prototype, "gdl_parent_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Main Warehouse',
        description: 'Name of the parent godown location (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], GodownPayloadDto.prototype, "gdl_parent_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], GodownPayloadDto.prototype, "gdl_sort", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], GodownPayloadDto.prototype, "gdl_level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], example: [] }),
    __metadata("design:type", Array)
], GodownPayloadDto.prototype, "gdl_path_ids_cache", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], GodownPayloadDto.prototype, "gdl_del_sheet", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], GodownPayloadDto.prototype, "gdl_split_stock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], GodownPayloadDto.prototype, "gdl_negative_stock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], GodownPayloadDto.prototype, "gdl_volume", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GodownPayloadDto.prototype, "gdl_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], GodownPayloadDto.prototype, "gdl_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-02-20T10:15:30.000Z' }),
    __metadata("design:type", String)
], GodownPayloadDto.prototype, "gdl_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'system' }),
    __metadata("design:type", Object)
], GodownPayloadDto.prototype, "gdl_created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-02-20T10:15:30.000Z' }),
    __metadata("design:type", String)
], GodownPayloadDto.prototype, "gdl_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'system' }),
    __metadata("design:type", Object)
], GodownPayloadDto.prototype, "gdl_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Ground floor zone' }),
    __metadata("design:type", Object)
], GodownPayloadDto.prototype, "gdl_remarks", void 0);
class GodownDeleteResultDto {
    gdl_id;
    deleted;
}
exports.GodownDeleteResultDto = GodownDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' }),
    __metadata("design:type", String)
], GodownDeleteResultDto.prototype, "gdl_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'true when the godown location was soft deleted, false when it was restored',
    }),
    __metadata("design:type", Boolean)
], GodownDeleteResultDto.prototype, "deleted", void 0);
class GodownSuccessSingleDto {
    success;
    message;
    data;
}
exports.GodownSuccessSingleDto = GodownSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GodownSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Godown location fetched successfully' }),
    __metadata("design:type", String)
], GodownSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GodownPayloadDto }),
    __metadata("design:type", GodownPayloadDto)
], GodownSuccessSingleDto.prototype, "data", void 0);
class GodownSuccessDeleteDto {
    success;
    message;
    data;
}
exports.GodownSuccessDeleteDto = GodownSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GodownSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Godown location deleted successfully' }),
    __metadata("design:type", String)
], GodownSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GodownDeleteResultDto }),
    __metadata("design:type", GodownDeleteResultDto)
], GodownSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=godown-response.dto.js.map