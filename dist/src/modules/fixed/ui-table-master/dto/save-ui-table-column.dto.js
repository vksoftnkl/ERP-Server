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
exports.SaveUiTableColumnDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const toNullableNumber = (value) => {
    if (value === undefined)
        return undefined;
    if (value === null || value === '')
        return null;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return null;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : value;
    }
    return value;
};
const toNullableInteger = (value) => {
    if (value === undefined)
        return undefined;
    if (value === null || value === '')
        return null;
    if (typeof value === 'number')
        return Number.isInteger(value) ? value : value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return null;
        const parsed = Number(trimmed);
        return Number.isInteger(parsed) ? parsed : value;
    }
    return value;
};
class SaveUiTableColumnDto {
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
}
exports.SaveUiTableColumnDto = SaveUiTableColumnDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When provided, request updates the existing UI table column row',
        example: '1',
    }),
    (0, dtoDecorators_1.OptionalNumberString)(),
    __metadata("design:type", String)
], SaveUiTableColumnDto.prototype, "uiTblClmId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'UI table column sequence number', example: '10' }),
    (0, dtoDecorators_1.OptionalNumberString)(),
    __metadata("design:type", String)
], SaveUiTableColumnDto.prototype, "uiTblClmNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'UI table column name', example: 'Item Name' }),
    (0, dtoDecorators_1.TrimmedString)(500),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveUiTableColumnDto.prototype, "uiTblClmName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Related UI table id', example: '1', nullable: true }),
    (0, dtoDecorators_1.NullableNumberString)(),
    __metadata("design:type", Object)
], SaveUiTableColumnDto.prototype, "uiTblClmTableId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 100, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toNullableNumber(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], SaveUiTableColumnDto.prototype, "uiTblClmColumnWidth", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUiTableColumnDto.prototype, "uiTblClmColumnVisibility", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUiTableColumnDto.prototype, "uiTblClmColumnFocus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toNullableInteger(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== undefined),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], SaveUiTableColumnDto.prototype, "uiTblClmColumnPosition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUiTableColumnDto.prototype, "uiTblClmColumnNecessity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toNullableInteger(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Object)
], SaveUiTableColumnDto.prototype, "uiTblClmNextColumn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: null, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toNullableInteger(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Object)
], SaveUiTableColumnDto.prototype, "uiTblClmPreviousColumn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '120px', nullable: true, maxLength: 100, type: String }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveUiTableColumnDto.prototype, "uiTblClmPx", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUiTableColumnDto.prototype, "uiTblClmIsActive", void 0);
//# sourceMappingURL=save-ui-table-column.dto.js.map