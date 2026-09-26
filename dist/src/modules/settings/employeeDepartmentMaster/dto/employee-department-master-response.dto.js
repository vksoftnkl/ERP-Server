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
exports.EmployeeDepartmentMasterSuccessDeleteDto = exports.EmployeeDepartmentMasterSuccessSingleDto = exports.EmployeeDepartmentMasterDeleteResultDto = exports.EmployeeDepartmentMasterPayloadDto = exports.EmployeeDepartmentMasterErrorResponseDto = exports.EmployeeDepartmentMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class EmployeeDepartmentMasterErrorFieldDto {
    field;
    message;
}
exports.EmployeeDepartmentMasterErrorFieldDto = EmployeeDepartmentMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'edptName' }),
    __metadata("design:type", String)
], EmployeeDepartmentMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate edptName is not allowed' }),
    __metadata("design:type", String)
], EmployeeDepartmentMasterErrorFieldDto.prototype, "message", void 0);
class EmployeeDepartmentMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.EmployeeDepartmentMasterErrorResponseDto = EmployeeDepartmentMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], EmployeeDepartmentMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], EmployeeDepartmentMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: EmployeeDepartmentMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], EmployeeDepartmentMasterErrorResponseDto.prototype, "errors", void 0);
class EmployeeDepartmentMasterPayloadDto {
    edptId;
    edptName;
    edptCode;
    edptAlias;
    edptRemarks;
    edptIsActive;
    edptIsDeleted;
    edptSyncDate;
    edptCreatedOn;
    edptCreatedBy;
    edptModifiedOn;
    edptModifiedBy;
}
exports.EmployeeDepartmentMasterPayloadDto = EmployeeDepartmentMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], EmployeeDepartmentMasterPayloadDto.prototype, "edptId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeDepartmentMasterPayloadDto.prototype, "edptName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeDepartmentMasterPayloadDto.prototype, "edptCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeDepartmentMasterPayloadDto.prototype, "edptAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeDepartmentMasterPayloadDto.prototype, "edptRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], EmployeeDepartmentMasterPayloadDto.prototype, "edptIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], EmployeeDepartmentMasterPayloadDto.prototype, "edptIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeDepartmentMasterPayloadDto.prototype, "edptSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeDepartmentMasterPayloadDto.prototype, "edptCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeDepartmentMasterPayloadDto.prototype, "edptCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeDepartmentMasterPayloadDto.prototype, "edptModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeDepartmentMasterPayloadDto.prototype, "edptModifiedBy", void 0);
class EmployeeDepartmentMasterDeleteResultDto {
    edptId;
    deleted;
}
exports.EmployeeDepartmentMasterDeleteResultDto = EmployeeDepartmentMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], EmployeeDepartmentMasterDeleteResultDto.prototype, "edptId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], EmployeeDepartmentMasterDeleteResultDto.prototype, "deleted", void 0);
class EmployeeDepartmentMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.EmployeeDepartmentMasterSuccessSingleDto = EmployeeDepartmentMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], EmployeeDepartmentMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Employee department fetched successfully' }),
    __metadata("design:type", String)
], EmployeeDepartmentMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: EmployeeDepartmentMasterPayloadDto }),
    __metadata("design:type", EmployeeDepartmentMasterPayloadDto)
], EmployeeDepartmentMasterSuccessSingleDto.prototype, "data", void 0);
class EmployeeDepartmentMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.EmployeeDepartmentMasterSuccessDeleteDto = EmployeeDepartmentMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], EmployeeDepartmentMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Employee department deleted successfully' }),
    __metadata("design:type", String)
], EmployeeDepartmentMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: EmployeeDepartmentMasterDeleteResultDto }),
    __metadata("design:type", EmployeeDepartmentMasterDeleteResultDto)
], EmployeeDepartmentMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=employee-department-master-response.dto.js.map