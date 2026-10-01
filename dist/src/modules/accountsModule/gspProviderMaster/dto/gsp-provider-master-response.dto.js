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
exports.GspProviderMasterSuccessDeleteDto = exports.GspProviderMasterSuccessSingleDto = exports.GspProviderMasterDeleteResultDto = exports.GspProviderMasterPayloadDto = exports.GspProviderMasterErrorResponseDto = exports.GspProviderMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class GspProviderMasterErrorFieldDto {
    field;
    message;
}
exports.GspProviderMasterErrorFieldDto = GspProviderMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'gspProviderName' }),
    __metadata("design:type", String)
], GspProviderMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate gspProviderName is not allowed' }),
    __metadata("design:type", String)
], GspProviderMasterErrorFieldDto.prototype, "message", void 0);
class GspProviderMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.GspProviderMasterErrorResponseDto = GspProviderMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], GspProviderMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], GspProviderMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GspProviderMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], GspProviderMasterErrorResponseDto.prototype, "errors", void 0);
class GspProviderMasterPayloadDto {
    gspProviderId;
    gspProviderCode;
    gspProviderName;
    gspBaseUrl;
    gspRoute;
    gspIpAddress;
    gspUserName;
    gspUserPassword;
    gspIsActive;
    gspIsDeleted;
    gspCreatedOn;
    gspCreatedBy;
    gspModifiedOn;
    gspModifiedBy;
}
exports.GspProviderMasterPayloadDto = GspProviderMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], GspProviderMasterPayloadDto.prototype, "gspProviderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspProviderMasterPayloadDto.prototype, "gspProviderCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspProviderMasterPayloadDto.prototype, "gspProviderName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspProviderMasterPayloadDto.prototype, "gspBaseUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspProviderMasterPayloadDto.prototype, "gspRoute", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspProviderMasterPayloadDto.prototype, "gspIpAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspProviderMasterPayloadDto.prototype, "gspUserName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspProviderMasterPayloadDto.prototype, "gspUserPassword", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GspProviderMasterPayloadDto.prototype, "gspIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GspProviderMasterPayloadDto.prototype, "gspIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspProviderMasterPayloadDto.prototype, "gspCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GspProviderMasterPayloadDto.prototype, "gspCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GspProviderMasterPayloadDto.prototype, "gspModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], GspProviderMasterPayloadDto.prototype, "gspModifiedBy", void 0);
class GspProviderMasterDeleteResultDto {
    gspProviderId;
    deleted;
}
exports.GspProviderMasterDeleteResultDto = GspProviderMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], GspProviderMasterDeleteResultDto.prototype, "gspProviderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GspProviderMasterDeleteResultDto.prototype, "deleted", void 0);
class GspProviderMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.GspProviderMasterSuccessSingleDto = GspProviderMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GspProviderMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'GSP provider fetched successfully' }),
    __metadata("design:type", String)
], GspProviderMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GspProviderMasterPayloadDto }),
    __metadata("design:type", GspProviderMasterPayloadDto)
], GspProviderMasterSuccessSingleDto.prototype, "data", void 0);
class GspProviderMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.GspProviderMasterSuccessDeleteDto = GspProviderMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GspProviderMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'GSP provider deleted successfully' }),
    __metadata("design:type", String)
], GspProviderMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GspProviderMasterDeleteResultDto }),
    __metadata("design:type", GspProviderMasterDeleteResultDto)
], GspProviderMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=gsp-provider-master-response.dto.js.map