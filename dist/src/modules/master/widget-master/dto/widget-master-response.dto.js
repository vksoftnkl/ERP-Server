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
exports.WidgetMasterSuccessDeleteDto = exports.WidgetMasterSuccessListDto = exports.WidgetMasterSuccessSingleDto = exports.WidgetMasterDeleteResultDto = exports.WidgetMasterPayloadDto = exports.WidgetFieldPayloadDto = exports.WidgetMasterErrorResponseDto = exports.WidgetMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const widget_master_api_types_1 = require("../types/widget-master-api.types");
class WidgetMasterErrorFieldDto {
    field;
    message;
}
exports.WidgetMasterErrorFieldDto = WidgetMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'sectionId' }),
    __metadata("design:type", String)
], WidgetMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'sectionId must be a positive integer' }),
    __metadata("design:type", String)
], WidgetMasterErrorFieldDto.prototype, "message", void 0);
class WidgetMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.WidgetMasterErrorResponseDto = WidgetMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], WidgetMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], WidgetMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: WidgetMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], WidgetMasterErrorResponseDto.prototype, "errors", void 0);
class WidgetFieldPayloadDto {
    fieldId;
    fieldSectionId;
    fieldName;
    fieldGuiName;
    fieldSecondaryText;
    fieldPosition;
    fieldVisibility;
}
exports.WidgetFieldPayloadDto = WidgetFieldPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], WidgetFieldPayloadDto.prototype, "fieldId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 10 }),
    __metadata("design:type", Number)
], WidgetFieldPayloadDto.prototype, "fieldSectionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'item_name' }),
    __metadata("design:type", String)
], WidgetFieldPayloadDto.prototype, "fieldName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'English Name' }),
    __metadata("design:type", Object)
], WidgetFieldPayloadDto.prototype, "fieldGuiName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Secondary text' }),
    __metadata("design:type", Object)
], WidgetFieldPayloadDto.prototype, "fieldSecondaryText", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], WidgetFieldPayloadDto.prototype, "fieldPosition", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], WidgetFieldPayloadDto.prototype, "fieldVisibility", void 0);
class WidgetMasterPayloadDto {
    sectionId;
    sectionMenuId;
    sectionName;
    sectionGuiName;
    sectionPosition;
    sectionVisibility;
    sectionPlatform;
    fields;
}
exports.WidgetMasterPayloadDto = WidgetMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], WidgetMasterPayloadDto.prototype, "sectionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 10, description: 'Menu/screen this section belongs to' }),
    __metadata("design:type", Number)
], WidgetMasterPayloadDto.prototype, "sectionMenuId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Primary Information' }),
    __metadata("design:type", String)
], WidgetMasterPayloadDto.prototype, "sectionName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Primary Information' }),
    __metadata("design:type", String)
], WidgetMasterPayloadDto.prototype, "sectionGuiName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], WidgetMasterPayloadDto.prototype, "sectionPosition", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], WidgetMasterPayloadDto.prototype, "sectionVisibility", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: widget_master_api_types_1.WidgetPlatform, enumName: 'WidgetPlatform' }),
    __metadata("design:type", String)
], WidgetMasterPayloadDto.prototype, "sectionPlatform", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: WidgetFieldPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], WidgetMasterPayloadDto.prototype, "fields", void 0);
class WidgetMasterDeleteResultDto {
    sectionId;
    deleted;
}
exports.WidgetMasterDeleteResultDto = WidgetMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], WidgetMasterDeleteResultDto.prototype, "sectionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], WidgetMasterDeleteResultDto.prototype, "deleted", void 0);
class WidgetMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.WidgetMasterSuccessSingleDto = WidgetMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], WidgetMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Widget section fetched successfully' }),
    __metadata("design:type", String)
], WidgetMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: WidgetMasterPayloadDto }),
    __metadata("design:type", WidgetMasterPayloadDto)
], WidgetMasterSuccessSingleDto.prototype, "data", void 0);
class WidgetMasterSuccessListDto {
    success;
    message;
    data;
}
exports.WidgetMasterSuccessListDto = WidgetMasterSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], WidgetMasterSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Widgets fetched successfully' }),
    __metadata("design:type", String)
], WidgetMasterSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: WidgetMasterPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], WidgetMasterSuccessListDto.prototype, "data", void 0);
class WidgetMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.WidgetMasterSuccessDeleteDto = WidgetMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], WidgetMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Widget section deleted successfully' }),
    __metadata("design:type", String)
], WidgetMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: WidgetMasterDeleteResultDto }),
    __metadata("design:type", WidgetMasterDeleteResultDto)
], WidgetMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=widget-master-response.dto.js.map