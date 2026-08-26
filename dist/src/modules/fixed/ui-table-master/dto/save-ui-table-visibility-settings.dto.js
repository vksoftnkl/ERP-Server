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
exports.SaveUiTableVisibilitySettingsDto = exports.UiTableVisibilitySettingItemDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class UiTableVisibilitySettingItemDto {
    uiTblClmId;
    uiTblClmColumnWidth;
    uiTblClmColumnVisibility;
    uiTblClmColumnFocus;
    uiTblClmColumnPosition;
    uiTblClmColumnNecessity;
    uiTblClmNextColumn;
    uiTblClmPreviousColumn;
}
exports.UiTableVisibilitySettingItemDto = UiTableVisibilitySettingItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, description: 'UI table column id to update' }),
    (0, class_transformer_1.Transform)(({ value }) => (value != null ? String(value).trim() : value)),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumberString)({ no_symbols: true }),
    __metadata("design:type", String)
], UiTableVisibilitySettingItemDto.prototype, "uiTblClmId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true, example: 100 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], UiTableVisibilitySettingItemDto.prototype, "uiTblClmColumnWidth", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Boolean, example: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UiTableVisibilitySettingItemDto.prototype, "uiTblClmColumnVisibility", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Boolean, example: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], UiTableVisibilitySettingItemDto.prototype, "uiTblClmColumnFocus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, example: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], UiTableVisibilitySettingItemDto.prototype, "uiTblClmColumnPosition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Boolean, example: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], UiTableVisibilitySettingItemDto.prototype, "uiTblClmColumnNecessity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true, example: 2 }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], UiTableVisibilitySettingItemDto.prototype, "uiTblClmNextColumn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true, example: null }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], UiTableVisibilitySettingItemDto.prototype, "uiTblClmPreviousColumn", void 0);
class SaveUiTableVisibilitySettingsDto {
    columns;
}
exports.SaveUiTableVisibilitySettingsDto = SaveUiTableVisibilitySettingsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [UiTableVisibilitySettingItemDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UiTableVisibilitySettingItemDto),
    __metadata("design:type", Array)
], SaveUiTableVisibilitySettingsDto.prototype, "columns", void 0);
//# sourceMappingURL=save-ui-table-visibility-settings.dto.js.map