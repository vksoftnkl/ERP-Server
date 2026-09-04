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
exports.SaveAppSettingValueDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const app_settings_api_types_1 = require("../types/app-settings-api.types");
class SaveAppSettingValueDto {
    asvId;
    asvSettingKey;
    asvScope;
    asvCompanyId;
    asvBranchId;
    asvDeviceId;
    asvUserId;
    asvValue;
    asvRemarks;
    asvSyncDate;
    asvCreatedBy;
    asvModifiedBy;
}
exports.SaveAppSettingValueDto = SaveAppSettingValueDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, updates that override in place. The key and the scope target are ' +
            'immutable — pointing an override at a different setting or a different branch is a ' +
            'delete plus a create, not an edit',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveAppSettingValueDto.prototype, "asvId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 80,
        example: 'sales.max_discount_percent',
        description: 'app_setting_def.asdKey. Required unless asvId is sent',
    }),
    (0, dtoDecorators_1.OptionalLowerMaxString)(80),
    __metadata("design:type", String)
], SaveAppSettingValueDto.prototype, "asvSettingKey", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: app_settings_api_types_1.AppSettingScope,
        enumName: 'AppSettingScope',
        description: 'Which layer this override sits in. Required unless asvId is sent, and may not be deeper ' +
            'than the setting’s asdMaxScope',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(10),
    (0, class_validator_1.IsEnum)(app_settings_api_types_1.AppSettingScope),
    __metadata("design:type", String)
], SaveAppSettingValueDto.prototype, "asvScope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Required when asvScope = COMPANY',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveAppSettingValueDto.prototype, "asvCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Required when asvScope = BRANCH',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveAppSettingValueDto.prototype, "asvBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Required when asvScope = DEVICE',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveAppSettingValueDto.prototype, "asvDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Required when asvScope = USER',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveAppSettingValueDto.prototype, "asvUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'The value, as text whatever the setting’s type — it is checked against asdDataType, ' +
            'asdAllowedValues and the min/max before it is stored. null is "explicitly nothing", ' +
            'which blanks the setting for this layer rather than inheriting the one above',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveAppSettingValueDto.prototype, "asvValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true, description: 'Why it was changed' }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveAppSettingValueDto.prototype, "asvRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.OptionalDate)(),
    __metadata("design:type", Date)
], SaveAppSettingValueDto.prototype, "asvSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, description: 'Defaults to the authenticated user' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], SaveAppSettingValueDto.prototype, "asvCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, description: 'Defaults to the authenticated user' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], SaveAppSettingValueDto.prototype, "asvModifiedBy", void 0);
//# sourceMappingURL=save-app-setting-value.dto.js.map