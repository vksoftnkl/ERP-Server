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
exports.UiTableColumnPayloadDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class UiTableColumnPayloadDto {
    uiTblClmId;
    uiTblClmNo;
    uiTblClmName;
    uiTblClmTableId;
    uiTblClmColumnWidth;
    uiTblClmColumnVisibility;
    uiTblClmColumnFocus;
    uiTblClmColumnPosition;
    uiTblClmColumnNecessity;
    uiTblClmNextColumn;
    uiTblClmPreviousColumn;
    uiTblClmPx;
    uiTblClmIsActive;
    uiTblClmIsDeleted;
    uiTblClmSyncDate;
    uiTblClmCreatedOn;
    uiTblClmCreatedBy;
    uiTblClmModifiedOn;
    uiTblClmModifiedBy;
}
exports.UiTableColumnPayloadDto = UiTableColumnPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1', description: 'BigInt id serialized as string' }),
    __metadata("design:type", String)
], UiTableColumnPayloadDto.prototype, "uiTblClmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '10', description: 'BigInt column number serialized as string' }),
    __metadata("design:type", String)
], UiTableColumnPayloadDto.prototype, "uiTblClmNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Item Name', nullable: true }),
    __metadata("design:type", Object)
], UiTableColumnPayloadDto.prototype, "uiTblClmName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '1', nullable: true, description: 'Related UI table id serialized as string' }),
    __metadata("design:type", Object)
], UiTableColumnPayloadDto.prototype, "uiTblClmTableId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 100, nullable: true }),
    __metadata("design:type", Object)
], UiTableColumnPayloadDto.prototype, "uiTblClmColumnWidth", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, nullable: true }),
    __metadata("design:type", Object)
], UiTableColumnPayloadDto.prototype, "uiTblClmColumnVisibility", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false, nullable: true }),
    __metadata("design:type", Object)
], UiTableColumnPayloadDto.prototype, "uiTblClmColumnFocus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], UiTableColumnPayloadDto.prototype, "uiTblClmColumnPosition", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], UiTableColumnPayloadDto.prototype, "uiTblClmColumnNecessity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2, nullable: true }),
    __metadata("design:type", Object)
], UiTableColumnPayloadDto.prototype, "uiTblClmNextColumn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: null, nullable: true }),
    __metadata("design:type", Object)
], UiTableColumnPayloadDto.prototype, "uiTblClmPreviousColumn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '120px', nullable: true }),
    __metadata("design:type", Object)
], UiTableColumnPayloadDto.prototype, "uiTblClmPx", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UiTableColumnPayloadDto.prototype, "uiTblClmIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], UiTableColumnPayloadDto.prototype, "uiTblClmIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-03-12T06:34:47.000Z', nullable: true, type: String, format: 'date-time' }),
    __metadata("design:type", Object)
], UiTableColumnPayloadDto.prototype, "uiTblClmSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-03-12T06:34:47.000Z', type: String, format: 'date-time' }),
    __metadata("design:type", String)
], UiTableColumnPayloadDto.prototype, "uiTblClmCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'system', nullable: true }),
    __metadata("design:type", Object)
], UiTableColumnPayloadDto.prototype, "uiTblClmCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-03-12T06:34:47.000Z', type: String, format: 'date-time' }),
    __metadata("design:type", String)
], UiTableColumnPayloadDto.prototype, "uiTblClmModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'system', nullable: true }),
    __metadata("design:type", Object)
], UiTableColumnPayloadDto.prototype, "uiTblClmModifiedBy", void 0);
//# sourceMappingURL=ui-table-column-response.dto.js.map