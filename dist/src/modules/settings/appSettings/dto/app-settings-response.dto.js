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
exports.AppSettingValueSuccessDeleteDto = exports.AppSettingValueSuccessSaveDto = exports.AppSettingsEffectiveSuccessDto = exports.AppSettingEffectiveItemDto = exports.AppSettingEffectiveOverrideDto = exports.AppSettingValueDeleteResultDto = exports.AppSettingValuePayloadDto = exports.AppSettingsErrorResponseDto = exports.AppSettingsErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const app_settings_api_types_1 = require("../types/app-settings-api.types");
class AppSettingsErrorFieldDto {
    field;
    message;
}
exports.AppSettingsErrorFieldDto = AppSettingsErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'asvValue' }),
    __metadata("design:type", String)
], AppSettingsErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '"150" is above the maximum 100 for setting "sales.max_discount_percent"',
    }),
    __metadata("design:type", String)
], AppSettingsErrorFieldDto.prototype, "message", void 0);
class AppSettingsErrorResponseDto {
    success;
    message;
    errors;
}
exports.AppSettingsErrorResponseDto = AppSettingsErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], AppSettingsErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], AppSettingsErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AppSettingsErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], AppSettingsErrorResponseDto.prototype, "errors", void 0);
class AppSettingValuePayloadDto {
    asvId;
    asvSettingKey;
    asvScope;
    asvCompanyId;
    asvBranchId;
    asvDeviceId;
    asvUserId;
    asvValue;
    asvRemarks;
    asvIsDeleted;
    asvSyncDate;
    asvCreatedOn;
    asvCreatedBy;
    asvModifiedOn;
    asvModifiedBy;
}
exports.AppSettingValuePayloadDto = AppSettingValuePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AppSettingValuePayloadDto.prototype, "asvId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 80, example: 'sales.max_discount_percent' }),
    __metadata("design:type", String)
], AppSettingValuePayloadDto.prototype, "asvSettingKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: app_settings_api_types_1.AppSettingScope, enumName: 'AppSettingScope' }),
    __metadata("design:type", String)
], AppSettingValuePayloadDto.prototype, "asvScope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AppSettingValuePayloadDto.prototype, "asvCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AppSettingValuePayloadDto.prototype, "asvBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AppSettingValuePayloadDto.prototype, "asvDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AppSettingValuePayloadDto.prototype, "asvUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'null = explicitly nothing, which blanks the setting rather than inheriting it',
    }),
    __metadata("design:type", Object)
], AppSettingValuePayloadDto.prototype, "asvValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], AppSettingValuePayloadDto.prototype, "asvRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AppSettingValuePayloadDto.prototype, "asvIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], AppSettingValuePayloadDto.prototype, "asvSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], AppSettingValuePayloadDto.prototype, "asvCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50 }),
    __metadata("design:type", String)
], AppSettingValuePayloadDto.prototype, "asvCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], AppSettingValuePayloadDto.prototype, "asvModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], AppSettingValuePayloadDto.prototype, "asvModifiedBy", void 0);
class AppSettingValueDeleteResultDto {
    asvId;
    asvSettingKey;
    deleted;
}
exports.AppSettingValueDeleteResultDto = AppSettingValueDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AppSettingValueDeleteResultDto.prototype, "asvId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'sales.max_discount_percent' }),
    __metadata("design:type", String)
], AppSettingValueDeleteResultDto.prototype, "asvSettingKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AppSettingValueDeleteResultDto.prototype, "deleted", void 0);
class AppSettingEffectiveOverrideDto {
    asvId;
    asvScope;
    asvCompanyId;
    asvBranchId;
    asvDeviceId;
    asvUserId;
    asvValue;
    asvRemarks;
    asvSyncDate;
    asvCreatedOn;
    asvCreatedBy;
    asvModifiedOn;
    asvModifiedBy;
}
exports.AppSettingEffectiveOverrideDto = AppSettingEffectiveOverrideDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AppSettingEffectiveOverrideDto.prototype, "asvId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: app_settings_api_types_1.AppSettingScope, enumName: 'AppSettingScope' }),
    __metadata("design:type", String)
], AppSettingEffectiveOverrideDto.prototype, "asvScope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AppSettingEffectiveOverrideDto.prototype, "asvCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AppSettingEffectiveOverrideDto.prototype, "asvBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AppSettingEffectiveOverrideDto.prototype, "asvDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AppSettingEffectiveOverrideDto.prototype, "asvUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AppSettingEffectiveOverrideDto.prototype, "asvValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], AppSettingEffectiveOverrideDto.prototype, "asvRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], AppSettingEffectiveOverrideDto.prototype, "asvSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], AppSettingEffectiveOverrideDto.prototype, "asvCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50 }),
    __metadata("design:type", String)
], AppSettingEffectiveOverrideDto.prototype, "asvCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], AppSettingEffectiveOverrideDto.prototype, "asvModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], AppSettingEffectiveOverrideDto.prototype, "asvModifiedBy", void 0);
class AppSettingEffectiveItemDto {
    asdId;
    asdKey;
    asdModule;
    asdGroup;
    asdLabel;
    asdDescription;
    asdDataType;
    asdDefaultValue;
    asdAllowedValues;
    asdMinValue;
    asdMaxValue;
    asdMaxScope;
    asdSortOrder;
    asdNeedsRelogin;
    source;
    value;
    override;
}
exports.AppSettingEffectiveItemDto = AppSettingEffectiveItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AppSettingEffectiveItemDto.prototype, "asdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 80, example: 'sales.max_discount_percent' }),
    __metadata("design:type", String)
], AppSettingEffectiveItemDto.prototype, "asdKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30, example: 'sales' }),
    __metadata("design:type", String)
], AppSettingEffectiveItemDto.prototype, "asdModule", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 40, example: 'Billing' }),
    __metadata("design:type", String)
], AppSettingEffectiveItemDto.prototype, "asdGroup", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120, description: 'Label to draw on the settings screen' }),
    __metadata("design:type", String)
], AppSettingEffectiveItemDto.prototype, "asdLabel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AppSettingEffectiveItemDto.prototype, "asdDescription", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: app_settings_api_types_1.AppSettingDataType, enumName: 'AppSettingDataType' }),
    __metadata("design:type", String)
], AppSettingEffectiveItemDto.prototype, "asdDataType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'What applies when the override is reset' }),
    __metadata("design:type", Object)
], AppSettingEffectiveItemDto.prototype, "asdDefaultValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], nullable: true, example: ['OFF', 'WARN', 'BLOCK'] }),
    __metadata("design:type", Object)
], AppSettingEffectiveItemDto.prototype, "asdAllowedValues", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AppSettingEffectiveItemDto.prototype, "asdMinValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AppSettingEffectiveItemDto.prototype, "asdMaxValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: app_settings_api_types_1.AppSettingScope,
        enumName: 'AppSettingScope',
        description: 'Deepest layer this setting may be overridden at — what the screen may offer',
    }),
    __metadata("design:type", String)
], AppSettingEffectiveItemDto.prototype, "asdMaxScope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0 }),
    __metadata("design:type", Number)
], AppSettingEffectiveItemDto.prototype, "asdSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'true = the client must re-login before the change takes effect' }),
    __metadata("design:type", Boolean)
], AppSettingEffectiveItemDto.prototype, "asdNeedsRelogin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: app_settings_api_types_1.AppSettingSource,
        enumName: 'AppSettingSource',
        description: 'Where the value came from. Read from the override ROW’s existence, not from its value — ' +
            'an override that deliberately blanks a setting is still an OVERRIDE',
    }),
    __metadata("design:type", String)
], AppSettingEffectiveItemDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '40',
        description: 'The effective value as raw text — cast by asdDataType. null = resolves to nothing',
    }),
    __metadata("design:type", Object)
], AppSettingEffectiveItemDto.prototype, "value", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: AppSettingEffectiveOverrideDto,
        nullable: true,
        description: 'The override that won, or null when the catalog default stands',
    }),
    __metadata("design:type", Object)
], AppSettingEffectiveItemDto.prototype, "override", void 0);
class AppSettingsEffectiveSuccessDto {
    success;
    message;
    data;
}
exports.AppSettingsEffectiveSuccessDto = AppSettingsEffectiveSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AppSettingsEffectiveSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Settings fetched successfully' }),
    __metadata("design:type", String)
], AppSettingsEffectiveSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AppSettingEffectiveItemDto, isArray: true }),
    __metadata("design:type", Array)
], AppSettingsEffectiveSuccessDto.prototype, "data", void 0);
class AppSettingValueSuccessSaveDto {
    success;
    message;
    data;
}
exports.AppSettingValueSuccessSaveDto = AppSettingValueSuccessSaveDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AppSettingValueSuccessSaveDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Overrides saved successfully' }),
    __metadata("design:type", String)
], AppSettingValueSuccessSaveDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AppSettingValuePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], AppSettingValueSuccessSaveDto.prototype, "data", void 0);
class AppSettingValueSuccessDeleteDto {
    success;
    message;
    data;
}
exports.AppSettingValueSuccessDeleteDto = AppSettingValueSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AppSettingValueSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Override reset successfully' }),
    __metadata("design:type", String)
], AppSettingValueSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AppSettingValueDeleteResultDto }),
    __metadata("design:type", AppSettingValueDeleteResultDto)
], AppSettingValueSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=app-settings-response.dto.js.map