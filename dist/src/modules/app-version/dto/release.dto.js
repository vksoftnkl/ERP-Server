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
exports.ReleaseResponseDto = exports.ListReleasesQueryDto = exports.ReleaseKeyParamsDto = exports.UpdateReleaseDto = exports.CreateReleaseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_info_1 = require("../../../common/client-info/client-info");
const app_version_constants_1 = require("../app-version.constants");
const check_update_dto_1 = require("./check-update.dto");
const trim = ({ value }) => typeof value === 'string' ? value.trim() : value;
const URL_OPTIONS = { require_tld: false, require_protocol: true, protocols: ['http', 'https'] };
class CreateReleaseDto {
    platform;
    build;
    version;
    commit;
    severity;
    notes;
    downloadUrl;
    releasedAt;
}
exports.CreateReleaseDto = CreateReleaseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_info_1.CLIENT_PLATFORMS, example: 'desktop' }),
    (0, class_transformer_1.Transform)(check_update_dto_1.lowerTrim),
    (0, class_validator_1.IsIn)(client_info_1.CLIENT_PLATFORMS),
    __metadata("design:type", String)
], CreateReleaseDto.prototype, "platform", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, example: 12, description: 'The CI build number; unique per platform' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(client_info_1.MAX_CLIENT_BUILD),
    __metadata("design:type", Number)
], CreateReleaseDto.prototype, "build", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 32, example: '1.2.0', description: 'Display label only' }),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], CreateReleaseDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 40, example: 'aa10be0d' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", Object)
], CreateReleaseDto.prototype, "commit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: app_version_constants_1.RELEASE_SEVERITIES, default: 'normal' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(check_update_dto_1.lowerTrim),
    (0, class_validator_1.IsIn)(app_version_constants_1.RELEASE_SEVERITIES),
    __metadata("design:type", String)
], CreateReleaseDto.prototype, "severity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10000, description: 'Release notes' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", Object)
], CreateReleaseDto.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, example: 'https://downloads.example.com/nexerp-12.exe' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsUrl)(URL_OPTIONS),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", Object)
], CreateReleaseDto.prototype, "downloadUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', description: 'Defaults to now' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)({ strict: true }),
    __metadata("design:type", String)
], CreateReleaseDto.prototype, "releasedAt", void 0);
class UpdateReleaseDto {
    version;
    commit;
    severity;
    notes;
    downloadUrl;
    releasedAt;
    isActive;
    isDeleted;
}
exports.UpdateReleaseDto = UpdateReleaseDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 32 }),
    (0, class_validator_1.ValidateIf)((_, value) => value !== undefined),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], UpdateReleaseDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 40, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", Object)
], UpdateReleaseDto.prototype, "commit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: app_version_constants_1.RELEASE_SEVERITIES }),
    (0, class_validator_1.ValidateIf)((_, value) => value !== undefined),
    (0, class_transformer_1.Transform)(check_update_dto_1.lowerTrim),
    (0, class_validator_1.IsIn)(app_version_constants_1.RELEASE_SEVERITIES),
    __metadata("design:type", String)
], UpdateReleaseDto.prototype, "severity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10000, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", Object)
], UpdateReleaseDto.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsUrl)(URL_OPTIONS),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", Object)
], UpdateReleaseDto.prototype, "downloadUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time' }),
    (0, class_validator_1.ValidateIf)((_, value) => value !== undefined),
    (0, class_validator_1.IsISO8601)({ strict: true }),
    __metadata("design:type", String)
], UpdateReleaseDto.prototype, "releasedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'false = keep the row but stop offering it' }),
    (0, class_validator_1.ValidateIf)((_, value) => value !== undefined),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateReleaseDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'true = yank (never offered), false = restore' }),
    (0, class_validator_1.ValidateIf)((_, value) => value !== undefined),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateReleaseDto.prototype, "isDeleted", void 0);
class ReleaseKeyParamsDto {
    platform;
    build;
}
exports.ReleaseKeyParamsDto = ReleaseKeyParamsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_info_1.CLIENT_PLATFORMS }),
    (0, class_transformer_1.Transform)(check_update_dto_1.lowerTrim),
    (0, class_validator_1.IsIn)(client_info_1.CLIENT_PLATFORMS),
    __metadata("design:type", String)
], ReleaseKeyParamsDto.prototype, "platform", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1 }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(client_info_1.MAX_CLIENT_BUILD),
    __metadata("design:type", Number)
], ReleaseKeyParamsDto.prototype, "build", void 0);
class ListReleasesQueryDto {
    platform;
}
exports.ListReleasesQueryDto = ListReleasesQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_info_1.CLIENT_PLATFORMS }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(check_update_dto_1.lowerTrim),
    (0, class_validator_1.IsIn)(client_info_1.CLIENT_PLATFORMS),
    __metadata("design:type", String)
], ListReleasesQueryDto.prototype, "platform", void 0);
class ReleaseResponseDto {
    id;
    platform;
    build;
    version;
    commit;
    severity;
    notes;
    downloadUrl;
    releasedAt;
    isActive;
    isDeleted;
    createdOn;
    createdBy;
    modifiedOn;
    modifiedBy;
}
exports.ReleaseResponseDto = ReleaseResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReleaseResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_info_1.CLIENT_PLATFORMS }),
    __metadata("design:type", String)
], ReleaseResponseDto.prototype, "platform", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ReleaseResponseDto.prototype, "build", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ReleaseResponseDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReleaseResponseDto.prototype, "commit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: app_version_constants_1.RELEASE_SEVERITIES }),
    __metadata("design:type", String)
], ReleaseResponseDto.prototype, "severity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReleaseResponseDto.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReleaseResponseDto.prototype, "downloadUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], ReleaseResponseDto.prototype, "releasedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ReleaseResponseDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ReleaseResponseDto.prototype, "isDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], ReleaseResponseDto.prototype, "createdOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReleaseResponseDto.prototype, "createdBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], ReleaseResponseDto.prototype, "modifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReleaseResponseDto.prototype, "modifiedBy", void 0);
//# sourceMappingURL=release.dto.js.map