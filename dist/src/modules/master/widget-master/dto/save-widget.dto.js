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
exports.SaveWidgetDto = exports.SaveWidgetFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dto_transforms_1 = require("../../../../common/dto/dto-transforms");
const widget_master_api_types_1 = require("../types/widget-master-api.types");
const toRequiredTrimmedString = (value) => {
    if (typeof value !== 'string') {
        return value;
    }
    return value.trim();
};
class SaveWidgetFieldDto {
    fieldId;
    fieldName;
    fieldGuiName;
    fieldSecondaryText;
    fieldPosition;
    fieldVisibility;
}
exports.SaveWidgetFieldDto = SaveWidgetFieldDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When provided, updates the existing field; otherwise a new field is created',
        example: 1,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalInteger)(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SaveWidgetFieldDto.prototype, "fieldId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 255, description: 'Internal binding key / SQL field name' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], SaveWidgetFieldDto.prototype, "fieldName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 255, nullable: true, description: 'Label rendered in the tree' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", Object)
], SaveWidgetFieldDto.prototype, "fieldGuiName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 255, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", Object)
], SaveWidgetFieldDto.prototype, "fieldSecondaryText", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, minimum: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalInteger)(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SaveWidgetFieldDto.prototype, "fieldPosition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SaveWidgetFieldDto.prototype, "fieldVisibility", void 0);
class SaveWidgetDto {
    sectionId;
    sectionMenuId;
    sectionName;
    sectionGuiName;
    sectionPosition;
    sectionVisibility;
    sectionPlatform;
    fields;
}
exports.SaveWidgetDto = SaveWidgetDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When provided, request updates the existing section',
        example: 1,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalInteger)(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SaveWidgetDto.prototype, "sectionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, minimum: 1, description: 'Menu/screen this section belongs to' }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalInteger)(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SaveWidgetDto.prototype, "sectionMenuId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 255, description: 'Shown in the "Widget" column' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], SaveWidgetDto.prototype, "sectionName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 255, description: 'Display name shown in the "Widget" column' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], SaveWidgetDto.prototype, "sectionGuiName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, minimum: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalInteger)(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SaveWidgetDto.prototype, "sectionPosition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SaveWidgetDto.prototype, "sectionVisibility", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: widget_master_api_types_1.WidgetPlatform, enumName: 'WidgetPlatform' }),
    (0, class_validator_1.IsEnum)(widget_master_api_types_1.WidgetPlatform),
    __metadata("design:type", String)
], SaveWidgetDto.prototype, "sectionPlatform", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: SaveWidgetFieldDto, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaveWidgetFieldDto),
    __metadata("design:type", Array)
], SaveWidgetDto.prototype, "fields", void 0);
//# sourceMappingURL=save-widget.dto.js.map