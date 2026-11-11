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
exports.HealthResponseDto = exports.HealthExpectedClientBuildsDto = exports.HealthExpectedClientBuildDto = exports.HealthCacheStatusDto = exports.HealthDatabaseStatusDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class HealthDatabaseStatusDto {
    status;
}
exports.HealthDatabaseStatusDto = HealthDatabaseStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['up', 'down'], example: 'up' }),
    __metadata("design:type", String)
], HealthDatabaseStatusDto.prototype, "status", void 0);
class HealthCacheStatusDto {
    status;
}
exports.HealthCacheStatusDto = HealthCacheStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['up', 'down', 'disabled'], example: 'up' }),
    __metadata("design:type", String)
], HealthCacheStatusDto.prototype, "status", void 0);
class HealthExpectedClientBuildDto {
    enforce;
    expectedBuild;
}
exports.HealthExpectedClientBuildDto = HealthExpectedClientBuildDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false, description: 'true = a login on any other build gets 426' }),
    __metadata("design:type", Boolean)
], HealthExpectedClientBuildDto.prototype, "enforce", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 12, nullable: true, type: Number }),
    __metadata("design:type", Object)
], HealthExpectedClientBuildDto.prototype, "expectedBuild", void 0);
class HealthExpectedClientBuildsDto {
    web;
    desktop;
    mobile;
}
exports.HealthExpectedClientBuildsDto = HealthExpectedClientBuildsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthExpectedClientBuildDto }),
    __metadata("design:type", HealthExpectedClientBuildDto)
], HealthExpectedClientBuildsDto.prototype, "web", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthExpectedClientBuildDto }),
    __metadata("design:type", HealthExpectedClientBuildDto)
], HealthExpectedClientBuildsDto.prototype, "desktop", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthExpectedClientBuildDto }),
    __metadata("design:type", HealthExpectedClientBuildDto)
], HealthExpectedClientBuildsDto.prototype, "mobile", void 0);
class HealthResponseDto {
    status;
    timestamp;
    version;
    build;
    commit;
    builtAt;
    dbOk;
    tokenEpoch;
    expectedClientBuilds;
    database;
    cache;
}
exports.HealthResponseDto = HealthResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['ok', 'degraded'], example: 'ok' }),
    __metadata("design:type", String)
], HealthResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-02-12T14:32:10.123Z' }),
    __metadata("design:type", String)
], HealthResponseDto.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '1.2.0',
        description: 'APP_VERSION, else build-info.json, else package.json',
    }),
    __metadata("design:type", String)
], HealthResponseDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 57, nullable: true, description: 'APP_BUILD, else build-info.json (CI)' }),
    __metadata("design:type", Object)
], HealthResponseDto.prototype, "build", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'aa10be0d',
        nullable: true,
        description: 'APP_COMMIT, else build-info.json (CI)',
    }),
    __metadata("design:type", Object)
], HealthResponseDto.prototype, "commit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-11-11T10:00:00Z',
        nullable: true,
        type: String,
        description: 'When CI built this package (build-info.json)',
    }),
    __metadata("design:type", Object)
], HealthResponseDto.prototype, "builtAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'The database answered SELECT 1' }),
    __metadata("design:type", Boolean)
], HealthResponseDto.prototype, "dbOk", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'Tokens minted under a lower epoch are refused' }),
    __metadata("design:type", Number)
], HealthResponseDto.prototype, "tokenEpoch", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthExpectedClientBuildsDto }),
    __metadata("design:type", HealthExpectedClientBuildsDto)
], HealthResponseDto.prototype, "expectedClientBuilds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthDatabaseStatusDto }),
    __metadata("design:type", HealthDatabaseStatusDto)
], HealthResponseDto.prototype, "database", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthCacheStatusDto }),
    __metadata("design:type", HealthCacheStatusDto)
], HealthResponseDto.prototype, "cache", void 0);
//# sourceMappingURL=health-response.dto.js.map