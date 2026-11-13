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
exports.BuildPolicyResponseDto = exports.UpdateBuildPolicyDto = exports.PolicyPlatformParamsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_info_1 = require("../../../common/client-info/client-info");
const check_update_dto_1 = require("./check-update.dto");
const trimToNull = ({ value }) => typeof value === 'string' ? value.trim() || null : value;
const URL_OPTIONS = { require_tld: false, require_protocol: true, protocols: ['http', 'https'] };
class PolicyPlatformParamsDto {
    platform;
}
exports.PolicyPlatformParamsDto = PolicyPlatformParamsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_info_1.CLIENT_PLATFORMS, example: 'desktop' }),
    (0, class_transformer_1.Transform)(check_update_dto_1.lowerTrim),
    (0, class_validator_1.IsIn)(client_info_1.CLIENT_PLATFORMS),
    __metadata("design:type", String)
], PolicyPlatformParamsDto.prototype, "platform", void 0);
class UpdateBuildPolicyDto {
    enforce;
    expectedBuild;
    message;
    downloadUrl;
}
exports.UpdateBuildPolicyDto = UpdateBuildPolicyDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'false = no build check for this platform' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateBuildPolicyDto.prototype, "enforce", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        nullable: true,
        example: 12,
        description: 'The one build a client must send while enforce is true',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(client_info_1.MAX_CLIENT_BUILD),
    __metadata("design:type", Object)
], UpdateBuildPolicyDto.prototype, "expectedBuild", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 500,
        nullable: true,
        example: 'Please update VK Nex Desktop to continue.',
        description: 'Shown to the user on 426; null = the default wording',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trimToNull),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", Object)
], UpdateBuildPolicyDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true, example: 'https://…/setup.exe' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trimToNull),
    (0, class_validator_1.IsUrl)(URL_OPTIONS),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", Object)
], UpdateBuildPolicyDto.prototype, "downloadUrl", void 0);
class BuildPolicyResponseDto {
    platform;
    enforce;
    expectedBuild;
    message;
    downloadUrl;
    source;
    changedOn;
    changedBy;
}
exports.BuildPolicyResponseDto = BuildPolicyResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_info_1.CLIENT_PLATFORMS }),
    __metadata("design:type", String)
], BuildPolicyResponseDto.prototype, "platform", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BuildPolicyResponseDto.prototype, "enforce", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], BuildPolicyResponseDto.prototype, "expectedBuild", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], BuildPolicyResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], BuildPolicyResponseDto.prototype, "downloadUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['manifest', 'manual'] }),
    __metadata("design:type", String)
], BuildPolicyResponseDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'date-time', type: String }),
    __metadata("design:type", Object)
], BuildPolicyResponseDto.prototype, "changedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, description: 'user id, system-update or migration' }),
    __metadata("design:type", Object)
], BuildPolicyResponseDto.prototype, "changedBy", void 0);
//# sourceMappingURL=build-policy.dto.js.map