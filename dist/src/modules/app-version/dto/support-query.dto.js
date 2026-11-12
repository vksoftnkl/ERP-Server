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
exports.LegacyUsageQueryDto = exports.InstallationSummaryQueryDto = exports.ListInstallationsQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_info_1 = require("../../../common/client-info/client-info");
const app_version_constants_1 = require("../app-version.constants");
const check_update_dto_1 = require("./check-update.dto");
class ListInstallationsQueryDto {
    platform;
    build;
    companyId;
    userId;
    deviceId;
    limit;
    offset;
}
exports.ListInstallationsQueryDto = ListInstallationsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_info_1.CLIENT_PLATFORMS }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(check_update_dto_1.lowerTrim),
    (0, class_validator_1.IsIn)(client_info_1.CLIENT_PLATFORMS),
    __metadata("design:type", String)
], ListInstallationsQueryDto.prototype, "platform", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(client_info_1.MAX_CLIENT_BUILD),
    __metadata("design:type", Number)
], ListInstallationsQueryDto.prototype, "build", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ListInstallationsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ListInstallationsQueryDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ListInstallationsQueryDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 500, default: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(500),
    __metadata("design:type", Number)
], ListInstallationsQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ListInstallationsQueryDto.prototype, "offset", void 0);
class InstallationSummaryQueryDto {
    platform;
    activeDays;
}
exports.InstallationSummaryQueryDto = InstallationSummaryQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_info_1.CLIENT_PLATFORMS }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(check_update_dto_1.lowerTrim),
    (0, class_validator_1.IsIn)(client_info_1.CLIENT_PLATFORMS),
    __metadata("design:type", String)
], InstallationSummaryQueryDto.prototype, "platform", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: 3650,
        default: 30,
        description: 'An installation is active when it was last seen within this many days',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(3650),
    __metadata("design:type", Number)
], InstallationSummaryQueryDto.prototype, "activeDays", void 0);
class LegacyUsageQueryDto {
    name;
    platform;
    build;
}
exports.LegacyUsageQueryDto = LegacyUsageQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, description: 'Part of the field name, any case' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], LegacyUsageQueryDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: app_version_constants_1.LEGACY_USAGE_PLATFORMS }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(check_update_dto_1.lowerTrim),
    (0, class_validator_1.IsIn)(app_version_constants_1.LEGACY_USAGE_PLATFORMS),
    __metadata("design:type", String)
], LegacyUsageQueryDto.prototype, "platform", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '-1 = the client sent no build' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(-1),
    (0, class_validator_1.Max)(client_info_1.MAX_CLIENT_BUILD),
    __metadata("design:type", Number)
], LegacyUsageQueryDto.prototype, "build", void 0);
//# sourceMappingURL=support-query.dto.js.map