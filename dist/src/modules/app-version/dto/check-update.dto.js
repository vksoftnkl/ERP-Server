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
exports.AppUpdateInfoDto = exports.CheckUpdateQueryDto = exports.lowerTrim = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_info_1 = require("../../../common/client-info/client-info");
const app_version_constants_1 = require("../app-version.constants");
const lowerTrim = ({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value;
exports.lowerTrim = lowerTrim;
class CheckUpdateQueryDto {
    platform;
    build;
}
exports.CheckUpdateQueryDto = CheckUpdateQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_info_1.CLIENT_PLATFORMS, description: 'Defaults to X-App-Platform' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(exports.lowerTrim),
    (0, class_validator_1.IsIn)(client_info_1.CLIENT_PLATFORMS),
    __metadata("design:type", String)
], CheckUpdateQueryDto.prototype, "platform", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, example: 10, description: 'Defaults to X-App-Build' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(client_info_1.MAX_CLIENT_BUILD),
    __metadata("design:type", Number)
], CheckUpdateQueryDto.prototype, "build", void 0);
class AppUpdateInfoDto {
    platform;
    currentBuild;
    updateAvailable;
    severity;
    latestBuild;
    latestVersion;
    downloadUrl;
    notes;
    releasedAt;
    missedBuilds;
}
exports.AppUpdateInfoDto = AppUpdateInfoDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_info_1.CLIENT_PLATFORMS, example: 'desktop' }),
    __metadata("design:type", String)
], AppUpdateInfoDto.prototype, "platform", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 10, description: 'The build the client said it runs' }),
    __metadata("design:type", Number)
], AppUpdateInfoDto.prototype, "currentBuild", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'A live release newer than currentBuild exists' }),
    __metadata("design:type", Boolean)
], AppUpdateInfoDto.prototype, "updateAvailable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: app_version_constants_1.RELEASE_SEVERITIES,
        nullable: true,
        description: 'The most urgent severity among ALL the builds the client missed, not just the latest ' +
            '(a critical 11 under a normal 12 reads critical). null when up to date.',
    }),
    __metadata("design:type", Object)
], AppUpdateInfoDto.prototype, "severity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 12,
        description: 'Highest live build; null = none released',
    }),
    __metadata("design:type", Object)
], AppUpdateInfoDto.prototype, "latestBuild", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '1.2.0' }),
    __metadata("design:type", Object)
], AppUpdateInfoDto.prototype, "latestVersion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, description: 'Installer / store / updater link of latestBuild' }),
    __metadata("design:type", Object)
], AppUpdateInfoDto.prototype, "downloadUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, description: 'Release notes of latestBuild' }),
    __metadata("design:type", Object)
], AppUpdateInfoDto.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '2026-11-10T10:00:00.000Z' }),
    __metadata("design:type", Object)
], AppUpdateInfoDto.prototype, "releasedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'How many live builds are newer than currentBuild' }),
    __metadata("design:type", Number)
], AppUpdateInfoDto.prototype, "missedBuilds", void 0);
//# sourceMappingURL=check-update.dto.js.map