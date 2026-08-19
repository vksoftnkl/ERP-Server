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
exports.SaleAgentSuccessDeleteDto = exports.SaleAgentSuccessSingleDto = exports.SaleAgentDeleteResultDto = exports.SaleAgentPayloadDto = exports.SaleAgentErrorResponseDto = exports.SaleAgentErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "SaleAgentErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorFieldDto; } });
Object.defineProperty(exports, "SaleAgentErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorResponseDto; } });
class SaleAgentPayloadDto {
    saId;
    saCompanyId;
    saCompanyName;
    saBranchId;
    saBranchName;
    saGroupId;
    saGroupName;
    saCode;
    saName;
    saAlias;
    saMobile1;
    saMobile2;
    saAddr1;
    saAddr2;
    saCity;
    saDistrict;
    saState;
    saPincode;
    saPanNo;
    saGstin;
    saRemarks;
    saIsActive;
    saIsDeleted;
    saSyncDate;
    saCreatedOn;
    saCreatedBy;
    saModifiedOn;
    saModifiedBy;
}
exports.SaleAgentPayloadDto = SaleAgentPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleAgentPayloadDto.prototype, "saId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleAgentPayloadDto.prototype, "saCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saBranchName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleAgentPayloadDto.prototype, "saGroupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saGroupName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    __metadata("design:type", String)
], SaleAgentPayloadDto.prototype, "saName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saMobile1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saMobile2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saState", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saPincode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saPanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleAgentPayloadDto.prototype, "saIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleAgentPayloadDto.prototype, "saIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SaleAgentPayloadDto.prototype, "saCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SaleAgentPayloadDto.prototype, "saModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], SaleAgentPayloadDto.prototype, "saModifiedBy", void 0);
class SaleAgentDeleteResultDto {
    saId;
    deleted;
}
exports.SaleAgentDeleteResultDto = SaleAgentDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleAgentDeleteResultDto.prototype, "saId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleAgentDeleteResultDto.prototype, "deleted", void 0);
class SaleAgentSuccessSingleDto {
    success;
    message;
    data;
}
exports.SaleAgentSuccessSingleDto = SaleAgentSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleAgentSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sale agent fetched successfully' }),
    __metadata("design:type", String)
], SaleAgentSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleAgentPayloadDto }),
    __metadata("design:type", SaleAgentPayloadDto)
], SaleAgentSuccessSingleDto.prototype, "data", void 0);
class SaleAgentSuccessDeleteDto {
    success;
    message;
    data;
}
exports.SaleAgentSuccessDeleteDto = SaleAgentSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleAgentSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sale agent deleted successfully' }),
    __metadata("design:type", String)
], SaleAgentSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleAgentDeleteResultDto }),
    __metadata("design:type", SaleAgentDeleteResultDto)
], SaleAgentSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=sale-agent-response.dto.js.map