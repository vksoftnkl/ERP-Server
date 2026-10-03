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
exports.SaveEmployeeMasterDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const toRequiredTrimmedString = (value) => {
    if (typeof value !== 'string') {
        return value;
    }
    return value.trim();
};
const toOptionalNumber = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return undefined;
        }
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};
const toNullableNumber = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === '') {
        return null;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};
class SaveEmployeeMasterDto {
    empId;
    empCompanyId;
    empBranchId;
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
    empDesignationId;
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
}
exports.SaveEmployeeMasterDto = SaveEmployeeMasterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing employee',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], SaveEmployeeMasterDto.prototype, "empId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    (0, dtoDecorators_1.NullableString)(60),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], SaveEmployeeMasterDto.prototype, "empName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empMobile1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empMobile2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableEmail)(150),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    (0, dtoDecorators_1.NullableString)(120),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    (0, dtoDecorators_1.NullableString)(120),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    (0, dtoDecorators_1.NullableString)(120),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empState", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empPincode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empGender", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empMaritalStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empBloodGroup", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empDob", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empDepartmentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empDesignationId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empEmploymentType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empJoinedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empProbationEndOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empConfirmationOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empLeftOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empShiftId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empAttConstraintId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empHolidayGroupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveEmployeeMasterDto.prototype, "empOvertimeAllowed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveEmployeeMasterDto.prototype, "empHasCommission", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empCommissionType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toNullableNumber(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsNumber)({ allowNaN: false, allowInfinity: false }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empCommissionValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 10 }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", String)
], SaveEmployeeMasterDto.prototype, "empSalaryType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalNumber(value)),
    (0, class_validator_1.IsNumber)({ allowNaN: false, allowInfinity: false }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SaveEmployeeMasterDto.prototype, "empSalaryAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalNumber(value)),
    (0, class_validator_1.IsNumber)({ allowNaN: false, allowInfinity: false }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SaveEmployeeMasterDto.prototype, "empBataAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalNumber(value)),
    (0, class_validator_1.IsNumber)({ allowNaN: false, allowInfinity: false }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SaveEmployeeMasterDto.prototype, "empKmBataAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empPanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empAadharNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empPfNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empEsiNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empLoanLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empPhotoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Base64-encoded image bytes' }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empPhoto", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], SaveEmployeeMasterDto.prototype, "empRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveEmployeeMasterDto.prototype, "empIsActive", void 0);
//# sourceMappingURL=save-employee-master.dto.js.map