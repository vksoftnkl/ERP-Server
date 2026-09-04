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
exports.CompanyMasterSuccessDeleteDto = exports.CompanyMasterSuccessSingleDto = exports.CompanyMasterDeleteResultDto = exports.CompanyMasterPayloadDto = exports.CompanyMasterErrorResponseDto = exports.CompanyMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class CompanyMasterErrorFieldDto {
    field;
    message;
}
exports.CompanyMasterErrorFieldDto = CompanyMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'compName' }),
    __metadata("design:type", String)
], CompanyMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate compName is not allowed' }),
    __metadata("design:type", String)
], CompanyMasterErrorFieldDto.prototype, "message", void 0);
class CompanyMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.CompanyMasterErrorResponseDto = CompanyMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], CompanyMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], CompanyMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CompanyMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], CompanyMasterErrorResponseDto.prototype, "errors", void 0);
class CompanyMasterPayloadDto {
    compId;
    compCode;
    compName;
    compShort;
    compLegalName;
    compGstinNo;
    compGstRegType;
    compPanNo;
    compTanNo;
    compCinNo;
    compFssaiNo;
    compDrugLicenseNo;
    compAddr1;
    compAddr2;
    compAddr3;
    compCity;
    compDistrict;
    compState;
    compStateCode;
    compPin;
    compCountry;
    compRegionAddr1;
    compRegionAddr2;
    compRegionAddr3;
    compRegionCity;
    compRegionDistrict;
    compRegionState;
    compRegionCountry;
    compRegionName;
    compTel;
    compPhone;
    compMail;
    compSupportEmail;
    compSupportPhone;
    compWebsiteName;
    compFinYearFrom;
    compFinYearTo;
    compBooksBeginFrom;
    compBooksLockDate;
    compGstApplicable;
    compTcsApplicable;
    compSmsApplicable;
    compEinvoiceApplicable;
    compEwayApplicable;
    compEwayDate;
    compEwayInterLimit;
    compEwayIntraApl;
    compEwayIntraLimit;
    compEinvoiceDate;
    compEinvoiceInclEway;
    compStylesheetId;
    compStylesheetName;
    compBankId;
    compBankName;
    compPriceFixing;
    compPrefixCode;
    compBillGreeting;
    compNegStkApl;
    compDefault;
    compIsActive;
    compCurrencyCode;
    compCurrencySymbol;
    compLocaleCode;
    compRemarks;
    compAuthorizeSignature;
    compIsDeleted;
    compSyncDate;
    compCreatedOn;
    compCreatedBy;
    compModifiedOn;
    compModifiedBy;
}
exports.CompanyMasterPayloadDto = CompanyMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1' }),
    __metadata("design:type", String)
], CompanyMasterPayloadDto.prototype, "compId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CompanyMasterPayloadDto.prototype, "compName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compLegalName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compGstinNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compGstRegType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compPanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compTanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compCinNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compFssaiNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compDrugLicenseNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compState", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CompanyMasterPayloadDto.prototype, "compStateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compPin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CompanyMasterPayloadDto.prototype, "compCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compRegionAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compRegionAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compRegionAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compRegionCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compRegionDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compRegionState", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compRegionCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compRegionName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compTel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compMail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compSupportEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compSupportPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compWebsiteName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compFinYearFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compFinYearTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compBooksBeginFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compBooksLockDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CompanyMasterPayloadDto.prototype, "compGstApplicable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CompanyMasterPayloadDto.prototype, "compTcsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CompanyMasterPayloadDto.prototype, "compSmsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CompanyMasterPayloadDto.prototype, "compEinvoiceApplicable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CompanyMasterPayloadDto.prototype, "compEwayApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compEwayDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compEwayInterLimit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CompanyMasterPayloadDto.prototype, "compEwayIntraApl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CompanyMasterPayloadDto.prototype, "compEwayIntraLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compEinvoiceDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compEinvoiceInclEway", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CompanyMasterPayloadDto.prototype, "compStylesheetId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compStylesheetName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compBankId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compBankName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compPriceFixing", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compPrefixCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compBillGreeting", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CompanyMasterPayloadDto.prototype, "compNegStkApl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CompanyMasterPayloadDto.prototype, "compDefault", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CompanyMasterPayloadDto.prototype, "compIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CompanyMasterPayloadDto.prototype, "compCurrencyCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compCurrencySymbol", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CompanyMasterPayloadDto.prototype, "compLocaleCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compAuthorizeSignature", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CompanyMasterPayloadDto.prototype, "compIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CompanyMasterPayloadDto.prototype, "compCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CompanyMasterPayloadDto.prototype, "compModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CompanyMasterPayloadDto.prototype, "compModifiedBy", void 0);
class CompanyMasterDeleteResultDto {
    compId;
    deleted;
}
exports.CompanyMasterDeleteResultDto = CompanyMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1' }),
    __metadata("design:type", String)
], CompanyMasterDeleteResultDto.prototype, "compId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CompanyMasterDeleteResultDto.prototype, "deleted", void 0);
class CompanyMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.CompanyMasterSuccessSingleDto = CompanyMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CompanyMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Company fetched successfully' }),
    __metadata("design:type", String)
], CompanyMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CompanyMasterPayloadDto }),
    __metadata("design:type", CompanyMasterPayloadDto)
], CompanyMasterSuccessSingleDto.prototype, "data", void 0);
class CompanyMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.CompanyMasterSuccessDeleteDto = CompanyMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CompanyMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Company deleted successfully' }),
    __metadata("design:type", String)
], CompanyMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CompanyMasterDeleteResultDto }),
    __metadata("design:type", CompanyMasterDeleteResultDto)
], CompanyMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=company-master-response.dto.js.map