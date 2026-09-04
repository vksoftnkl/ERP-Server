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
exports.UiTableMasterSuccessColumnUpdateDto = exports.UiTableColumnUpdateResultDto = exports.UiTableMasterSuccessColumnDeleteDto = exports.UiTableColumnDeleteResultDto = exports.UiTableMasterSuccessDeleteDto = exports.UiTableMasterSuccessListDto = exports.UiTableMasterSuccessSingleDto = exports.UiTableMasterDeleteResultDto = exports.UiTableMasterPayloadDto = exports.UiTableMasterErrorResponseDto = exports.UiTableMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "UiTableMasterErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorFieldDto; } });
Object.defineProperty(exports, "UiTableMasterErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorResponseDto; } });
const ui_table_column_response_dto_1 = require("./ui-table-column-response.dto");
class UiTableMasterPayloadDto {
    uiTblId;
    uiTblName;
    uiTblEditable;
    uiTblIsActive;
    uiTblIsDeleted;
    uiTblSyncDate;
    uiTblSyncOn;
    uiTblCreatedOn;
    uiTblCreatedBy;
    uiTblModifiedOn;
    uiTblModifiedBy;
    uiTblDeviceType;
    columns;
}
exports.UiTableMasterPayloadDto = UiTableMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1', description: 'BigInt id serialized as string' }),
    __metadata("design:type", String)
], UiTableMasterPayloadDto.prototype, "uiTblId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Item Master Grid', nullable: true }),
    __metadata("design:type", Object)
], UiTableMasterPayloadDto.prototype, "uiTblName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], UiTableMasterPayloadDto.prototype, "uiTblEditable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UiTableMasterPayloadDto.prototype, "uiTblIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], UiTableMasterPayloadDto.prototype, "uiTblIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-03-12T06:34:47.000Z',
        nullable: true,
        type: String,
        format: 'date-time',
    }),
    __metadata("design:type", Object)
], UiTableMasterPayloadDto.prototype, "uiTblSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-03-12T06:34:47.000Z',
        nullable: true,
        type: String,
        format: 'date-time',
    }),
    __metadata("design:type", Object)
], UiTableMasterPayloadDto.prototype, "uiTblSyncOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-03-12T06:34:47.000Z', type: String, format: 'date-time' }),
    __metadata("design:type", String)
], UiTableMasterPayloadDto.prototype, "uiTblCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'system', nullable: true }),
    __metadata("design:type", Object)
], UiTableMasterPayloadDto.prototype, "uiTblCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-03-12T06:34:47.000Z', type: String, format: 'date-time' }),
    __metadata("design:type", String)
], UiTableMasterPayloadDto.prototype, "uiTblModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'system', nullable: true }),
    __metadata("design:type", Object)
], UiTableMasterPayloadDto.prototype, "uiTblModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'mobile', nullable: true }),
    __metadata("design:type", Object)
], UiTableMasterPayloadDto.prototype, "uiTblDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ui_table_column_response_dto_1.UiTableColumnPayloadDto], description: 'Columns belonging to this UI table' }),
    __metadata("design:type", Array)
], UiTableMasterPayloadDto.prototype, "columns", void 0);
class UiTableMasterDeleteResultDto {
    uiTblId;
    deleted;
}
exports.UiTableMasterDeleteResultDto = UiTableMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1', description: 'BigInt id serialized as string' }),
    __metadata("design:type", String)
], UiTableMasterDeleteResultDto.prototype, "uiTblId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UiTableMasterDeleteResultDto.prototype, "deleted", void 0);
class UiTableMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.UiTableMasterSuccessSingleDto = UiTableMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UiTableMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'UI table fetched successfully' }),
    __metadata("design:type", String)
], UiTableMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UiTableMasterPayloadDto }),
    __metadata("design:type", UiTableMasterPayloadDto)
], UiTableMasterSuccessSingleDto.prototype, "data", void 0);
class UiTableMasterSuccessListDto {
    success;
    message;
    data;
}
exports.UiTableMasterSuccessListDto = UiTableMasterSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UiTableMasterSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'UI tables fetched successfully' }),
    __metadata("design:type", String)
], UiTableMasterSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UiTableMasterPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], UiTableMasterSuccessListDto.prototype, "data", void 0);
class UiTableMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.UiTableMasterSuccessDeleteDto = UiTableMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UiTableMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'UI table deleted successfully' }),
    __metadata("design:type", String)
], UiTableMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UiTableMasterDeleteResultDto }),
    __metadata("design:type", UiTableMasterDeleteResultDto)
], UiTableMasterSuccessDeleteDto.prototype, "data", void 0);
class UiTableColumnDeleteResultDto {
    uiTblClmId;
    deleted;
}
exports.UiTableColumnDeleteResultDto = UiTableColumnDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1', description: 'BigInt id serialized as string' }),
    __metadata("design:type", String)
], UiTableColumnDeleteResultDto.prototype, "uiTblClmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UiTableColumnDeleteResultDto.prototype, "deleted", void 0);
class UiTableMasterSuccessColumnDeleteDto {
    success;
    message;
    data;
}
exports.UiTableMasterSuccessColumnDeleteDto = UiTableMasterSuccessColumnDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UiTableMasterSuccessColumnDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'UI table column deleted successfully' }),
    __metadata("design:type", String)
], UiTableMasterSuccessColumnDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UiTableColumnDeleteResultDto }),
    __metadata("design:type", UiTableColumnDeleteResultDto)
], UiTableMasterSuccessColumnDeleteDto.prototype, "data", void 0);
class UiTableColumnUpdateResultDto {
    updated;
}
exports.UiTableColumnUpdateResultDto = UiTableColumnUpdateResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], UiTableColumnUpdateResultDto.prototype, "updated", void 0);
class UiTableMasterSuccessColumnUpdateDto {
    success;
    message;
    data;
}
exports.UiTableMasterSuccessColumnUpdateDto = UiTableMasterSuccessColumnUpdateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UiTableMasterSuccessColumnUpdateDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Column widths updated successfully' }),
    __metadata("design:type", String)
], UiTableMasterSuccessColumnUpdateDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UiTableColumnUpdateResultDto }),
    __metadata("design:type", UiTableColumnUpdateResultDto)
], UiTableMasterSuccessColumnUpdateDto.prototype, "data", void 0);
//# sourceMappingURL=ui-table-master-response.dto.js.map