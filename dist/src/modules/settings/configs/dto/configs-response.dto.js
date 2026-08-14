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
exports.ConfigsSuccessDeleteDto = exports.ConfigsSuccessListDto = exports.ConfigsSuccessSingleDto = exports.ConfigsDeleteResultDto = exports.ConfigsPayloadDto = exports.ConfigsErrorResponseDto = exports.ConfigsErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class ConfigsErrorFieldDto {
    field;
    message;
}
exports.ConfigsErrorFieldDto = ConfigsErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'configName' }),
    __metadata("design:type", String)
], ConfigsErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'configName must not be empty' }),
    __metadata("design:type", String)
], ConfigsErrorFieldDto.prototype, "message", void 0);
class ConfigsErrorResponseDto {
    success;
    message;
    errors;
}
exports.ConfigsErrorResponseDto = ConfigsErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ConfigsErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], ConfigsErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigsErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], ConfigsErrorResponseDto.prototype, "errors", void 0);
class ConfigsPayloadDto {
    configId;
    configName;
    configValue;
    configSyncDate;
    configCreatedOn;
    configCreatedBy;
    configModifiedOn;
    configModifiedBy;
}
exports.ConfigsPayloadDto = ConfigsPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ConfigsPayloadDto.prototype, "configId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ConfigsPayloadDto.prototype, "configName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ConfigsPayloadDto.prototype, "configValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ConfigsPayloadDto.prototype, "configSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ConfigsPayloadDto.prototype, "configCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ConfigsPayloadDto.prototype, "configCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ConfigsPayloadDto.prototype, "configModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ConfigsPayloadDto.prototype, "configModifiedBy", void 0);
class ConfigsDeleteResultDto {
    configId;
    deleted;
}
exports.ConfigsDeleteResultDto = ConfigsDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ConfigsDeleteResultDto.prototype, "configId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ConfigsDeleteResultDto.prototype, "deleted", void 0);
class ConfigsSuccessSingleDto {
    success;
    message;
    data;
}
exports.ConfigsSuccessSingleDto = ConfigsSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ConfigsSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Config fetched successfully' }),
    __metadata("design:type", String)
], ConfigsSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigsPayloadDto }),
    __metadata("design:type", ConfigsPayloadDto)
], ConfigsSuccessSingleDto.prototype, "data", void 0);
class ConfigsSuccessListDto {
    success;
    message;
    data;
}
exports.ConfigsSuccessListDto = ConfigsSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ConfigsSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Configs fetched successfully' }),
    __metadata("design:type", String)
], ConfigsSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigsPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ConfigsSuccessListDto.prototype, "data", void 0);
class ConfigsSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ConfigsSuccessDeleteDto = ConfigsSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ConfigsSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Config deleted successfully' }),
    __metadata("design:type", String)
], ConfigsSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigsDeleteResultDto }),
    __metadata("design:type", ConfigsDeleteResultDto)
], ConfigsSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=configs-response.dto.js.map