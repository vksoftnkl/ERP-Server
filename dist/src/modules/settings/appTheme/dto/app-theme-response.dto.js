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
exports.AppThemeSuccessDeleteDto = exports.AppThemeDeleteResultDto = exports.AppThemeSuccessEffectiveDto = exports.AppThemeSuccessSingleDto = exports.AppThemeSuccessBootstrapDto = exports.AppThemeBootstrapPayloadDto = exports.AppThemeSuccessTemplateDto = exports.AppThemeTemplatePayloadDto = exports.AppThemeEffectivePayloadDto = exports.AppThemeTemplateRefDto = exports.AppThemePayloadDto = exports.AppThemeErrorResponseDto = exports.AppThemeErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class AppThemeErrorFieldDto {
    field;
    message;
}
exports.AppThemeErrorFieldDto = AppThemeErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'tokens.primary' }),
    __metadata("design:type", String)
], AppThemeErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'not a colour: #rrggbb or #rrggbbaa' }),
    __metadata("design:type", String)
], AppThemeErrorFieldDto.prototype, "message", void 0);
class AppThemeErrorResponseDto {
    success;
    message;
    errors;
}
exports.AppThemeErrorResponseDto = AppThemeErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], AppThemeErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], AppThemeErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AppThemeErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], AppThemeErrorResponseDto.prototype, "errors", void 0);
class AppThemePayloadDto {
    thmId;
    thmName;
    thmBase;
    thmIsDefault;
    thmIsActive;
    thmIsDeleted;
    thmRemarks;
    tokens;
    usedByCount;
    thmModifiedOn;
}
exports.AppThemePayloadDto = AppThemePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], AppThemePayloadDto.prototype, "thmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MAROON' }),
    __metadata("design:type", String)
], AppThemePayloadDto.prototype, "thmName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'LIGHT' }),
    __metadata("design:type", String)
], AppThemePayloadDto.prototype, "thmBase", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AppThemePayloadDto.prototype, "thmIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AppThemePayloadDto.prototype, "thmIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], AppThemePayloadDto.prototype, "thmIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], AppThemePayloadDto.prototype, "thmRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: 'object',
        additionalProperties: { type: 'string' },
        example: { primary: '#7B1113', 'table.selected': '#0078D7' },
    }),
    __metadata("design:type", Object)
], AppThemePayloadDto.prototype, "tokens", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 3,
        description: 'Live companies whose comp_stylesheet_id is this theme.',
    }),
    __metadata("design:type", Number)
], AppThemePayloadDto.prototype, "usedByCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'Compare with a cached copy: a client re-applies only when it changed.',
    }),
    __metadata("design:type", Object)
], AppThemePayloadDto.prototype, "thmModifiedOn", void 0);
class AppThemeTemplateRefDto {
    tplId;
    tplQss;
    tplModifiedOn;
}
exports.AppThemeTemplateRefDto = AppThemeTemplateRefDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], AppThemeTemplateRefDto.prototype, "tplId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'QSS with {{key}} placeholders, to fill from the tokens.' }),
    __metadata("design:type", String)
], AppThemeTemplateRefDto.prototype, "tplQss", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-10-01T08:00:00.000Z' }),
    __metadata("design:type", String)
], AppThemeTemplateRefDto.prototype, "tplModifiedOn", void 0);
class AppThemeEffectivePayloadDto extends AppThemePayloadDto {
    resolvedFrom;
    template;
}
exports.AppThemeEffectivePayloadDto = AppThemeEffectivePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['COMPANY', 'DEFAULT'],
        description: "COMPANY = the company's own theme; DEFAULT = it has none, or it points at an inactive " +
            'or deleted one.',
    }),
    __metadata("design:type", String)
], AppThemeEffectivePayloadDto.prototype, "resolvedFrom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: AppThemeTemplateRefDto,
        nullable: true,
        description: 'The active stylesheet template; null only while there is none.',
    }),
    __metadata("design:type", Object)
], AppThemeEffectivePayloadDto.prototype, "template", void 0);
class AppThemeTemplatePayloadDto extends AppThemeTemplateRefDto {
    tplName;
    tplRemarks;
    placeholders;
}
exports.AppThemeTemplatePayloadDto = AppThemeTemplatePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'NEXERP' }),
    __metadata("design:type", String)
], AppThemeTemplatePayloadDto.prototype, "tplName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], AppThemeTemplatePayloadDto.prototype, "tplRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [String],
        example: ['primary', 'surface', 'text'],
        description: 'The distinct {{key}}s the template uses, in order of first use.',
    }),
    __metadata("design:type", Array)
], AppThemeTemplatePayloadDto.prototype, "placeholders", void 0);
class AppThemeSuccessTemplateDto {
    success;
    message;
    data;
}
exports.AppThemeSuccessTemplateDto = AppThemeSuccessTemplateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AppThemeSuccessTemplateDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'App theme template fetched successfully' }),
    __metadata("design:type", String)
], AppThemeSuccessTemplateDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AppThemeTemplatePayloadDto }),
    __metadata("design:type", AppThemeTemplatePayloadDto)
], AppThemeSuccessTemplateDto.prototype, "data", void 0);
class AppThemeBootstrapPayloadDto {
    tokens;
    thmModifiedOn;
    template;
}
exports.AppThemeBootstrapPayloadDto = AppThemeBootstrapPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: 'object',
        additionalProperties: { type: 'string' },
        description: "The default theme's colour tokens.",
    }),
    __metadata("design:type", Object)
], AppThemeBootstrapPayloadDto.prototype, "tokens", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], AppThemeBootstrapPayloadDto.prototype, "thmModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AppThemeTemplateRefDto, nullable: true }),
    __metadata("design:type", Object)
], AppThemeBootstrapPayloadDto.prototype, "template", void 0);
class AppThemeSuccessBootstrapDto {
    success;
    message;
    data;
}
exports.AppThemeSuccessBootstrapDto = AppThemeSuccessBootstrapDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AppThemeSuccessBootstrapDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'App theme bootstrap fetched successfully' }),
    __metadata("design:type", String)
], AppThemeSuccessBootstrapDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AppThemeBootstrapPayloadDto }),
    __metadata("design:type", AppThemeBootstrapPayloadDto)
], AppThemeSuccessBootstrapDto.prototype, "data", void 0);
class AppThemeSuccessSingleDto {
    success;
    message;
    data;
}
exports.AppThemeSuccessSingleDto = AppThemeSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AppThemeSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'App theme fetched successfully' }),
    __metadata("design:type", String)
], AppThemeSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AppThemePayloadDto }),
    __metadata("design:type", AppThemePayloadDto)
], AppThemeSuccessSingleDto.prototype, "data", void 0);
class AppThemeSuccessEffectiveDto {
    success;
    message;
    data;
}
exports.AppThemeSuccessEffectiveDto = AppThemeSuccessEffectiveDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AppThemeSuccessEffectiveDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Effective app theme fetched successfully' }),
    __metadata("design:type", String)
], AppThemeSuccessEffectiveDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AppThemeEffectivePayloadDto }),
    __metadata("design:type", AppThemeEffectivePayloadDto)
], AppThemeSuccessEffectiveDto.prototype, "data", void 0);
class AppThemeDeleteResultDto {
    thmId;
    deleted;
}
exports.AppThemeDeleteResultDto = AppThemeDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 4 }),
    __metadata("design:type", Number)
], AppThemeDeleteResultDto.prototype, "thmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AppThemeDeleteResultDto.prototype, "deleted", void 0);
class AppThemeSuccessDeleteDto {
    success;
    message;
    data;
}
exports.AppThemeSuccessDeleteDto = AppThemeSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AppThemeSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'App theme deleted successfully' }),
    __metadata("design:type", String)
], AppThemeSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AppThemeDeleteResultDto }),
    __metadata("design:type", AppThemeDeleteResultDto)
], AppThemeSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=app-theme-response.dto.js.map