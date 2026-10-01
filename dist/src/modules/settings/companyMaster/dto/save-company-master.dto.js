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
exports.SaveCompanyMasterDto = exports.COMPANY_DC_PURPOSES = exports.COMPANY_AATO_CLASSES = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const gst_registration_1 = require("../../shared/gst-registration");
exports.COMPANY_AATO_CLASSES = ['LE_1_5CR', 'LE_5CR', 'LE_10CR', 'GT_10CR'];
exports.COMPANY_DC_PURPOSES = [
    'SUPPLY',
    'JOB_WORK',
    'APPROVAL',
    'EXHIBITION',
    'OWN_USE',
    'LINE_SALES',
    'OTHER',
];
const INFORMATIONAL = 'Informational: stored and returned, but no posting, numbering or print reads it yet.';
const upperEach = ({ value }) => Array.isArray(value)
    ? value.map((entry) => (typeof entry === 'string' ? entry.trim().toUpperCase() : entry))
    : value;
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
    compTdsApplicable;
    compAatoClass;
    compDcPurposes;
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
    compAuthorizeSignature;
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
    (0, swagger_1.ApiPropertyOptional)({
        enum: gst_registration_1.GST_REG_TYPES,
        nullable: true,
        description: 'Upper-cased on the way in; anything else is a 400 (notes 72 C3).',
    }),
    (0, dtoDecorators_1.NullableUpperMaxString)(30),
    (0, class_validator_1.IsIn)(gst_registration_1.GST_REG_TYPES),
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
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'date',
        nullable: true,
        description: "CREATE ONLY: the first fiscal year's begin date (default: the 1 April of the Indian " +
            'financial year containing today). Ignored on update — the year belongs to fiscal_years. ' +
            "GET returns the current fiscal year's begin date.",
    }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compFinYearFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'date',
        nullable: true,
        description: "CREATE ONLY: the first fiscal year's end date (default: one year after compFinYearFrom, " +
            "less a day; at most that). Ignored on update. GET returns the current year's end date.",
    }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compFinYearTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'date',
        nullable: true,
        description: 'CREATE ONLY: when the books begin, inside the first year (default: its begin date). ' +
            "Ignored on update. GET returns the current year's books-begin date.",
    }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compBooksBeginFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'date',
        nullable: true,
        description: "Accepted and IGNORED: the lock date belongs to the fiscal year. GET returns the current year's fy_lock_date.",
    }),
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
    (0, swagger_1.ApiPropertyOptional)({ description: 'Whether the company deducts TDS (notes 72 C1).' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCompanyMasterDto.prototype, "compTdsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: exports.COMPANY_AATO_CLASSES,
        description: 'Annual aggregate turnover band; decides e-invoice applicability and HSN digits. Not nullable.',
    }),
    (0, class_validator_1.ValidateIf)((dto) => dto.compAatoClass !== undefined),
    (0, class_validator_1.IsIn)(exports.COMPANY_AATO_CLASSES),
    __metadata("design:type", String)
], SaveCompanyMasterDto.prototype, "compAatoClass", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        enum: exports.COMPANY_DC_PURPOSES,
        description: 'The delivery-challan purposes this company issues. At least one; not nullable.',
    }),
    (0, class_validator_1.ValidateIf)((dto) => dto.compDcPurposes !== undefined),
    (0, class_transformer_1.Transform)(upperEach),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsIn)(exports.COMPANY_DC_PURPOSES, { each: true }),
    __metadata("design:type", Array)
], SaveCompanyMasterDto.prototype, "compDcPurposes", void 0);
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
    (0, swagger_1.ApiPropertyOptional)({ type: Number, format: 'color', nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compStylesheetId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compBankId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true, description: INFORMATIONAL }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compPriceFixing", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true, description: INFORMATIONAL }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compPrefixCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: INFORMATIONAL }),
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
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Authorised signature image: a data URL (data:image/png;base64,...) or bare base64 of a ' +
            'PNG, JPEG, GIF or WebP, at most 512 KB. GET returns it as a data URL. null or "" clears it.',
    }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compAuthorizeSignature", void 0);
//# sourceMappingURL=save-company-master.dto.js.map