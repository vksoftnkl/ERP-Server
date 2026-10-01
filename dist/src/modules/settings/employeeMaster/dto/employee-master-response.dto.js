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
exports.EmployeeMasterSuccessDeleteDto = exports.EmployeeMasterSuccessSingleDto = exports.EmployeeMasterDeleteResultDto = exports.EmployeeMasterPayloadDto = exports.EmployeeMasterErrorResponseDto = exports.EmployeeMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class EmployeeMasterErrorFieldDto {
    field;
    message;
}
exports.EmployeeMasterErrorFieldDto = EmployeeMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'empName' }),
    __metadata("design:type", String)
], EmployeeMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate empName is not allowed' }),
    __metadata("design:type", String)
], EmployeeMasterErrorFieldDto.prototype, "message", void 0);
class EmployeeMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.EmployeeMasterErrorResponseDto = EmployeeMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], EmployeeMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], EmployeeMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: EmployeeMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], EmployeeMasterErrorResponseDto.prototype, "errors", void 0);
class EmployeeMasterPayloadDto {
    empId;
    empCompanyId;
    empCompanyName;
    empBranchId;
    empBranchName;
    empCode;
    empName;
    empAlias;
    empMobile1;
    empMobile2;
    empEmail;
    empAddr1;
    empAddr2;
    empAddr3;
    empCity;
    empDistrict;
    empState;
    empPincode;
    empGender;
    empMaritalStatus;
    empBloodGroup;
    empDob;
    empDepartmentId;
    empDepartmentName;
    empDesignationId;
    empDesignationName;
    empEmploymentType;
    empStatus;
    empJoinedOn;
    empProbationEndOn;
    empConfirmationOn;
    empLeftOn;
    empShiftId;
    empAttConstraintId;
    empHolidayGroupId;
    empOvertimeAllowed;
    empHasCommission;
    empCommissionType;
    empCommissionValue;
    empSalaryType;
    empSalaryAmount;
    empBataAmount;
    empKmBataAmount;
    empPanNo;
    empAadharNo;
    empPfNo;
    empEsiNo;
    empLoanLedgerId;
    empPhotoUrl;
    empPhoto;
    empRemarks;
    empIsActive;
    empIsDeleted;
    empSyncDate;
    empCreatedOn;
    empCreatedBy;
    empModifiedOn;
    empModifiedBy;
}
exports.EmployeeMasterPayloadDto = EmployeeMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], EmployeeMasterPayloadDto.prototype, "empId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], EmployeeMasterPayloadDto.prototype, "empCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Acme Pvt Ltd',
        description: 'Name of the linked company (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Main Branch',
        description: 'Name of the linked branch (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empBranchName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeMasterPayloadDto.prototype, "empName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empMobile1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empMobile2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empState", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empPincode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empGender", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empMaritalStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empBloodGroup", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empDob", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empDepartmentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Accounts',
        description: 'Name of the linked department (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empDepartmentName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empDesignationId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Senior Accountant',
        description: 'Name of the linked designation (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empDesignationName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empEmploymentType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empJoinedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empProbationEndOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empConfirmationOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empLeftOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empShiftId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empAttConstraintId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empHolidayGroupId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], EmployeeMasterPayloadDto.prototype, "empOvertimeAllowed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], EmployeeMasterPayloadDto.prototype, "empHasCommission", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empCommissionType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empCommissionValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeMasterPayloadDto.prototype, "empSalaryType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], EmployeeMasterPayloadDto.prototype, "empSalaryAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], EmployeeMasterPayloadDto.prototype, "empBataAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], EmployeeMasterPayloadDto.prototype, "empKmBataAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empPanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empAadharNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empPfNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empEsiNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empLoanLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empPhotoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Base64-encoded image bytes' }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empPhoto", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], EmployeeMasterPayloadDto.prototype, "empIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], EmployeeMasterPayloadDto.prototype, "empIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeMasterPayloadDto.prototype, "empCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeMasterPayloadDto.prototype, "empModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], EmployeeMasterPayloadDto.prototype, "empModifiedBy", void 0);
class EmployeeMasterDeleteResultDto {
    empId;
    deleted;
}
exports.EmployeeMasterDeleteResultDto = EmployeeMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], EmployeeMasterDeleteResultDto.prototype, "empId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], EmployeeMasterDeleteResultDto.prototype, "deleted", void 0);
class EmployeeMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.EmployeeMasterSuccessSingleDto = EmployeeMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], EmployeeMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Employee fetched successfully' }),
    __metadata("design:type", String)
], EmployeeMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: EmployeeMasterPayloadDto }),
    __metadata("design:type", EmployeeMasterPayloadDto)
], EmployeeMasterSuccessSingleDto.prototype, "data", void 0);
class EmployeeMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.EmployeeMasterSuccessDeleteDto = EmployeeMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], EmployeeMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Employee deleted successfully' }),
    __metadata("design:type", String)
], EmployeeMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: EmployeeMasterDeleteResultDto }),
    __metadata("design:type", EmployeeMasterDeleteResultDto)
], EmployeeMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=employee-master-response.dto.js.map