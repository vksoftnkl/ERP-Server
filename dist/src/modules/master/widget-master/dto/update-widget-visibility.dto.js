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
exports.UpdateWidgetVisibilityDto = exports.UpdateWidgetVisibilitySectionDto = exports.UpdateWidgetVisibilityFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dto_transforms_1 = require("../../../../common/dto/dto-transforms");
class UpdateWidgetVisibilityFieldDto {
    fieldId;
    fieldSecondaryText;
    fieldVisibility;
}
exports.UpdateWidgetVisibilityFieldDto = UpdateWidgetVisibilityFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, minimum: 1, description: 'Field to update' }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalInteger)(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateWidgetVisibilityFieldDto.prototype, "fieldId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 255, example: 'Secondary text' }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toTrimmedString)(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateWidgetVisibilityFieldDto.prototype, "fieldSecondaryText", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateWidgetVisibilityFieldDto.prototype, "fieldVisibility", void 0);
class UpdateWidgetVisibilitySectionDto {
    sectionId;
    sectionGuiName;
    sectionVisibility;
    fields;
}
exports.UpdateWidgetVisibilitySectionDto = UpdateWidgetVisibilitySectionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, minimum: 1, description: 'Section to update' }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalInteger)(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateWidgetVisibilitySectionDto.prototype, "sectionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 255, example: 'Primary Information' }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toTrimmedString)(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateWidgetVisibilitySectionDto.prototype, "sectionGuiName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateWidgetVisibilitySectionDto.prototype, "sectionVisibility", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UpdateWidgetVisibilityFieldDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpdateWidgetVisibilityFieldDto),
    __metadata("design:type", Array)
], UpdateWidgetVisibilitySectionDto.prototype, "fields", void 0);
class UpdateWidgetVisibilityDto {
    data;
}
exports.UpdateWidgetVisibilityDto = UpdateWidgetVisibilityDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: UpdateWidgetVisibilitySectionDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpdateWidgetVisibilitySectionDto),
    __metadata("design:type", Array)
], UpdateWidgetVisibilityDto.prototype, "data", void 0);
//# sourceMappingURL=update-widget-visibility.dto.js.map