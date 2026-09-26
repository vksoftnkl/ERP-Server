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
exports.GspCompanyServiceSuccessDeleteDto = exports.GspCompanyServiceSuccessSingleDto = exports.GspCompanyServiceDeleteResultDto = exports.GspCompanyServicePayloadDto = exports.GspCompanyServiceErrorResponseDto = exports.GspCompanyServiceErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class GspCompanyServiceErrorFieldDto {
    field;
    message;
}
exports.GspCompanyServiceErrorFieldDto = GspCompanyServiceErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'csgServiceType' }),
    __metadata("design:type", String)
], GspCompanyServiceErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate csgServiceType is not allowed' }),
    __metadata("design:type", String)
], GspCompanyServiceErrorFieldDto.prototype, "message", void 0);
class GspCompanyServiceErrorResponseDto {
    success;
    message;
    errors;
}
exports.GspCompanyServiceErrorResponseDto = GspCompanyServiceErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], GspCompanyServiceErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], GspCompanyServiceErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GspCompanyServiceErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], GspCompanyServiceErrorResponseDto.prototype, "errors", void 0);
class GspCompanyServicePayloadDto {
    csgCompanyServiceId;
    csgCompanyId;
    companyName;
    companyDisplay;
    csgGspProviderId;
    providerName;
    providerDisplay;
    csgServiceType;
    csgEuserName;
    csgEuserPassword;
    csgAuthToken;
    csgAuthTokenValidTill;
    csgIsActive;
    csgIsDeleted;
    csgSyncDate;
    csgCreatedOn;
    csgCreatedBy;
    csgModifiedOn;
    csgModifiedBy;
}
exports.GspCompanyServicePayloadDto = GspCompanyServicePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], GspCompanyServicePayloadDto.prototype, "csgCompanyServiceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], GspCompanyServicePayloadDto.prototype, "csgCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GspCompanyServicePayloadDto.prototype, "companyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GspCompanyServicePayloadDto.prototype, "companyDisplay", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], GspCompanyServicePayloadDto.prototype, "csgGspProviderId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GspCompanyServicePayloadDto.prototype, "providerName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GspCompanyServicePayloadDto.prototype, "providerDisplay", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspCompanyServicePayloadDto.prototype, "csgServiceType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspCompanyServicePayloadDto.prototype, "csgEuserName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspCompanyServicePayloadDto.prototype, "csgEuserPassword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GspCompanyServicePayloadDto.prototype, "csgAuthToken", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GspCompanyServicePayloadDto.prototype, "csgAuthTokenValidTill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GspCompanyServicePayloadDto.prototype, "csgIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GspCompanyServicePayloadDto.prototype, "csgIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GspCompanyServicePayloadDto.prototype, "csgSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspCompanyServicePayloadDto.prototype, "csgCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GspCompanyServicePayloadDto.prototype, "csgCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspCompanyServicePayloadDto.prototype, "csgModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GspCompanyServicePayloadDto.prototype, "csgModifiedBy", void 0);
class GspCompanyServiceDeleteResultDto {
    csgCompanyServiceId;
    deleted;
}
exports.GspCompanyServiceDeleteResultDto = GspCompanyServiceDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], GspCompanyServiceDeleteResultDto.prototype, "csgCompanyServiceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GspCompanyServiceDeleteResultDto.prototype, "deleted", void 0);
class GspCompanyServiceSuccessSingleDto {
    success;
    message;
    data;
}
exports.GspCompanyServiceSuccessSingleDto = GspCompanyServiceSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GspCompanyServiceSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'GSP company service fetched successfully' }),
    __metadata("design:type", String)
], GspCompanyServiceSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GspCompanyServicePayloadDto }),
    __metadata("design:type", GspCompanyServicePayloadDto)
], GspCompanyServiceSuccessSingleDto.prototype, "data", void 0);
class GspCompanyServiceSuccessDeleteDto {
    success;
    message;
    data;
}
exports.GspCompanyServiceSuccessDeleteDto = GspCompanyServiceSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GspCompanyServiceSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'GSP company service deleted successfully' }),
    __metadata("design:type", String)
], GspCompanyServiceSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GspCompanyServiceDeleteResultDto }),
    __metadata("design:type", GspCompanyServiceDeleteResultDto)
], GspCompanyServiceSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=gsp-company-service-response.dto.js.map