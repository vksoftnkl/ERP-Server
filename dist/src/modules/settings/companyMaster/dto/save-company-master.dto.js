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
exports.SaveCompanyMasterDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveCompanyMasterDto {
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
    compBankId;
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
}
exports.SaveCompanyMasterDto = SaveCompanyMasterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the company',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveCompanyMasterDto.prototype, "compName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compLegalName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableUpperString)(15),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compGstinNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compGstRegType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableUpperString)(10),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compPanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableUpperString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compTanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableUpperString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compCinNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compFssaiNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compDrugLicenseNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compState", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 2 }),
    (0, dtoDecorators_1.UpperString)(2),
    __metadata("design:type", String)
], SaveCompanyMasterDto.prototype, "compStateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], SaveCompanyMasterDto.prototype, "compPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], SaveCompanyMasterDto.prototype, "compCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compRegionAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compRegionAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compRegionAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compRegionCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compRegionDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compRegionState", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    (0, dtoDecorators_1.NullableString)(60),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compRegionCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compRegionName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compTel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableEmail)(150),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compMail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableEmail)(150),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compSupportEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compSupportPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compWebsiteName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compFinYearFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compFinYearTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compBooksBeginFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compBooksLockDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCompanyMasterDto.prototype, "compGstApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCompanyMasterDto.prototype, "compTcsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCompanyMasterDto.prototype, "compSmsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCompanyMasterDto.prototype, "compEinvoiceApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCompanyMasterDto.prototype, "compEwayApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compEwayDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ allowNaN: false, allowInfinity: false }),
    __metadata("design:type", Number)
], SaveCompanyMasterDto.prototype, "compEwayInterLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCompanyMasterDto.prototype, "compEwayIntraApl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ allowNaN: false, allowInfinity: false }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SaveCompanyMasterDto.prototype, "compEwayIntraLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compEinvoiceDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compEinvoiceInclEway", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: Number, format: 'color', nullable: true }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compStylesheetId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compBankId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compPriceFixing", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compPrefixCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compBillGreeting", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCompanyMasterDto.prototype, "compNegStkApl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCompanyMasterDto.prototype, "compDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCompanyMasterDto.prototype, "compIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 3 }),
    (0, dtoDecorators_1.OptionalUpperString)(3),
    __metadata("design:type", String)
], SaveCompanyMasterDto.prototype, "compCurrencyCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compCurrencySymbol", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", String)
], SaveCompanyMasterDto.prototype, "compLocaleCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compRemarks", void 0);
//# sourceMappingURL=save-company-master.dto.js.map