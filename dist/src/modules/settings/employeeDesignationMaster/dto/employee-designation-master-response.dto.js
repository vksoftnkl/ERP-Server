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
exports.EmployeeDesignationMasterSuccessDeleteDto = exports.EmployeeDesignationMasterSuccessSingleDto = exports.EmployeeDesignationMasterDeleteResultDto = exports.EmployeeDesignationMasterPayloadDto = exports.EmployeeDesignationMasterErrorResponseDto = exports.EmployeeDesignationMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class EmployeeDesignationMasterErrorFieldDto {
    field;
    message;
}
exports.EmployeeDesignationMasterErrorFieldDto = EmployeeDesignationMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'edName' }),
    __metadata("design:type", String)
], EmployeeDesignationMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate edName is not allowed' }),
    __metadata("design:type", String)
], EmployeeDesignationMasterErrorFieldDto.prototype, "message", void 0);
class EmployeeDesignationMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.EmployeeDesignationMasterErrorResponseDto = EmployeeDesignationMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], EmployeeDesignationMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], EmployeeDesignationMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: EmployeeDesignationMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], EmployeeDesignationMasterErrorResponseDto.prototype, "errors", void 0);
class EmployeeDesignationMasterPayloadDto {
    edId;
    edName;
    edCode;
    edIsDefault;
    edRemarks;
    edIsActive;
    edIsDeleted;
    edSyncDate;
    edCreatedOn;
    edCreatedBy;
    edModifiedOn;
    edModifiedBy;
}
exports.EmployeeDesignationMasterPayloadDto = EmployeeDesignationMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], EmployeeDesignationMasterPayloadDto.prototype, "edId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeDesignationMasterPayloadDto.prototype, "edName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeDesignationMasterPayloadDto.prototype, "edCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], EmployeeDesignationMasterPayloadDto.prototype, "edIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeDesignationMasterPayloadDto.prototype, "edRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], EmployeeDesignationMasterPayloadDto.prototype, "edIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], EmployeeDesignationMasterPayloadDto.prototype, "edIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeDesignationMasterPayloadDto.prototype, "edSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeDesignationMasterPayloadDto.prototype, "edCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeDesignationMasterPayloadDto.prototype, "edCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeDesignationMasterPayloadDto.prototype, "edModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeDesignationMasterPayloadDto.prototype, "edModifiedBy", void 0);
class EmployeeDesignationMasterDeleteResultDto {
    edId;
    deleted;
}
exports.EmployeeDesignationMasterDeleteResultDto = EmployeeDesignationMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], EmployeeDesignationMasterDeleteResultDto.prototype, "edId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], EmployeeDesignationMasterDeleteResultDto.prototype, "deleted", void 0);
class EmployeeDesignationMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.EmployeeDesignationMasterSuccessSingleDto = EmployeeDesignationMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], EmployeeDesignationMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Employee designation fetched successfully' }),
    __metadata("design:type", String)
], EmployeeDesignationMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: EmployeeDesignationMasterPayloadDto }),
    __metadata("design:type", EmployeeDesignationMasterPayloadDto)
], EmployeeDesignationMasterSuccessSingleDto.prototype, "data", void 0);
class EmployeeDesignationMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.EmployeeDesignationMasterSuccessDeleteDto = EmployeeDesignationMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], EmployeeDesignationMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Employee designation deleted successfully' }),
    __metadata("design:type", String)
], EmployeeDesignationMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: EmployeeDesignationMasterDeleteResultDto }),
    __metadata("design:type", EmployeeDesignationMasterDeleteResultDto)
], EmployeeDesignationMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=employee-designation-master-response.dto.js.map