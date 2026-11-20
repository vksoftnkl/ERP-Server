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
const registered_address_1 = require("../../shared/registered-address");
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
    compUdyamNo;
    compLogo;
    compSignatoryName;
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
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: 'Blank on CREATE: the server makes one from compName (plan C1) — the initials of its ' +
            'words, skipping PRIVATE, PVT, LIMITED, LTD, THE, AND and &, padded from the first word ' +
            'to 3, at most 6, A-Z 0-9; 2, 3, … added when taken ("MT Demo Traders" → MDT, MDT2). ' +
            'A typed code is kept as typed (409 COMPANY_CODE_DUPLICATE when taken).',
    }),
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
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Required when compGstRegType is REGULAR, COMPOSITION or SEZ (400 COMPANY_LEGAL_NAME_REQUIRED).',
    }),
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
    (0, swagger_1.ApiProperty)({
        maxLength: 2,
        description: 'Two characters, upper-cased. Blank or null: 400 COMPANY_ADDRESS_REQUIRED (field ' +
            'compStateCode) for a REGULAR / COMPOSITION / SEZ company, else COMPANY_STATE_CODE_INVALID.',
    }),
    (0, class_transformer_1.Transform)(registered_address_1.upperStateCode),
    (0, class_validator_1.ValidateIf)((dto) => dto.compStateCode !== ''),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 2),
    __metadata("design:type", String)
], SaveCompanyMasterDto.prototype, "compStateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: '100000 – 999999 when given (400 COMPANY_PIN_INVALID). Required for a REGULAR / ' +
            'COMPOSITION / SEZ company, as are compAddr1, compCity and compStateCode: one ' +
            'COMPANY_ADDRESS_REQUIRED error per missing key, its field the key (plan I1). District is optional.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Object)
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
        description: "CREATE ONLY: the first fiscal year's begin date — a 1 April, else 400 (a year is always " +
            '1 April – 31 March). Default: the year containing compBooksBeginFrom, else today. ' +
            "Ignored on update — the year belongs to fiscal_years. GET returns the current year's begin date.",
    }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compFinYearFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'date',
        nullable: true,
        description: "CREATE ONLY: the first fiscal year's end date — the 31 March after compFinYearFrom, " +
            "else 400. Ignored on update. GET returns the current year's end date.",
    }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compFinYearTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'date',
        nullable: true,
        description: 'CREATE ONLY: when the books begin, inside the first year (default: its 1 April; 400 ' +
            "outside it). Without From/To it picks the year. Ignored on update. GET returns the current year's books-begin date.",
    }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compBooksBeginFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'date',
        nullable: true,
        description: 'Books lock date (companys.comp_books_lock_date), saved and returned as sent; null clears ' +
            'it. Nothing enforces it yet (plan Q1: the next job). It is not the fiscal year’s ' +
            'fy_lock_date, which locks a whole year and is set elsewhere.',
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
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        nullable: true,
        description: `${INFORMATIONAL} Off the Qt screen since 18/11; optional, kept when not sent.`,
    }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compPriceFixing", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: `${INFORMATIONAL} Off the Qt screen since 18/11; optional, kept when not sent.`,
    }),
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
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 10,
        nullable: true,
        description: 'Blank or absent on CREATE: "Rs." (plan C5). On update it is saved as sent.',
    }),
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
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 19,
        nullable: true,
        example: 'UDYAM-TN-01-0012345',
        description: 'Udyam (MSME) registration no: trimmed and upper-cased, then UDYAM-XX-00-0000000 ' +
            '(2 letters, 2 digits, 7 digits), else 400 COMPANY_UDYAM_INVALID. null or "" clears it.',
    }),
    (0, dtoDecorators_1.NullableUpperMaxString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compUdyamNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Company logo, the same rules as compAuthorizeSignature: a data URL or bare base64 of a ' +
            'PNG, JPEG, GIF or WebP, at most 512 KB, the kind read from the bytes (400 ' +
            'COMPANY_LOGO_NOT_BASE64 / _TOO_LARGE / _NOT_IMAGE). GET returns a data URL. null or "" clears it.',
    }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compLogo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        example: 'R. Kumar, Proprietor',
        description: 'Authorised signatory name and designation as printed. Trimmed; "" clears it.',
    }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveCompanyMasterDto.prototype, "compSignatoryName", void 0);
//# sourceMappingURL=save-company-master.dto.js.map