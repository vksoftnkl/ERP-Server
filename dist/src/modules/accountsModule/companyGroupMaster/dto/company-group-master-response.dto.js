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
exports.CompanyGroupMasterSuccessDeleteDto = exports.CompanyGroupMasterSuccessSingleDto = exports.CompanyGroupMasterDeleteResultDto = exports.CompanyGroupMasterPayloadDto = exports.CompanyGroupMasterErrorResponseDto = exports.CompanyGroupMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class CompanyGroupMasterErrorFieldDto {
    field;
    message;
}
exports.CompanyGroupMasterErrorFieldDto = CompanyGroupMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'cogGroupName' }),
    __metadata("design:type", String)
], CompanyGroupMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate cogGroupName is not allowed' }),
    __metadata("design:type", String)
], CompanyGroupMasterErrorFieldDto.prototype, "message", void 0);
class CompanyGroupMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.CompanyGroupMasterErrorResponseDto = CompanyGroupMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], CompanyGroupMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], CompanyGroupMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CompanyGroupMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], CompanyGroupMasterErrorResponseDto.prototype, "errors", void 0);
class CompanyGroupMasterPayloadDto {
    cogGroupId;
    cogGroupName;
    cogCompanyIds;
    cogIsActive;
    cogIsDeleted;
    cogSyncDate;
    cogCreatedOn;
    cogCreatedBy;
    cogModifiedOn;
    cogModifiedBy;
}
exports.CompanyGroupMasterPayloadDto = CompanyGroupMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CompanyGroupMasterPayloadDto.prototype, "cogGroupId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CompanyGroupMasterPayloadDto.prototype, "cogGroupName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    __metadata("design:type", Array)
], CompanyGroupMasterPayloadDto.prototype, "cogCompanyIds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CompanyGroupMasterPayloadDto.prototype, "cogIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CompanyGroupMasterPayloadDto.prototype, "cogIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyGroupMasterPayloadDto.prototype, "cogSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CompanyGroupMasterPayloadDto.prototype, "cogCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyGroupMasterPayloadDto.prototype, "cogCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CompanyGroupMasterPayloadDto.prototype, "cogModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyGroupMasterPayloadDto.prototype, "cogModifiedBy", void 0);
class CompanyGroupMasterDeleteResultDto {
    cogGroupId;
    deleted;
}
exports.CompanyGroupMasterDeleteResultDto = CompanyGroupMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CompanyGroupMasterDeleteResultDto.prototype, "cogGroupId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CompanyGroupMasterDeleteResultDto.prototype, "deleted", void 0);
class CompanyGroupMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.CompanyGroupMasterSuccessSingleDto = CompanyGroupMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CompanyGroupMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Company group fetched successfully' }),
    __metadata("design:type", String)
], CompanyGroupMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CompanyGroupMasterPayloadDto }),
    __metadata("design:type", CompanyGroupMasterPayloadDto)
], CompanyGroupMasterSuccessSingleDto.prototype, "data", void 0);
class CompanyGroupMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.CompanyGroupMasterSuccessDeleteDto = CompanyGroupMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CompanyGroupMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Company group deleted successfully' }),
    __metadata("design:type", String)
], CompanyGroupMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CompanyGroupMasterDeleteResultDto }),
    __metadata("design:type", CompanyGroupMasterDeleteResultDto)
], CompanyGroupMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=company-group-master-response.dto.js.map