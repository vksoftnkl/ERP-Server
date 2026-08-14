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
exports.SaveBranchMasterDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveBranchMasterDto {
    brId;
    brCompId;
    brCode;
    brName;
    brMailingName;
    brAlias;
    brShort;
    brType;
    brIsDefault;
    brIsActive;
    brAddr1;
    brAddr2;
    brAddr3;
    brCity;
    brDistrict;
    brState;
    brStateCode;
    brPin;
    brCountry;
    brLandmark;
    brRegionAddr1;
    brRegionAddr2;
    brRegionAddr3;
    brRegionCity;
    brRegionDistrict;
    brRegionState;
    brRegionCountry;
    brRegionName;
    brContactPerson;
    brTel;
    brPhone;
    brMail;
    brBillPrefix;
    brInvoiceSeriesPrefix;
    brBillGreeting;
    brTerms;
    brRoundingMode;
    brRoundingValue;
    brDefaultGodownId;
    brPosType;
    brAllowNegativeStock;
    brSmsApplicable;
    brBankId;
    brFssaiNo;
    brFssaiLicenseType;
    brFssaiValidUpto;
    brGstinNo;
    brGstRegType;
    brPanNo;
}
exports.SaveBranchMasterDto = SaveBranchMasterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'uuid',
        description: 'When provided, request updates the existing branch',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], SaveBranchMasterDto.prototype, "brId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, format: 'uuid' }),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], SaveBranchMasterDto.prototype, "brCompId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", String)
], SaveBranchMasterDto.prototype, "brName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brMailingName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveBranchMasterDto.prototype, "brIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveBranchMasterDto.prototype, "brIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brState", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 2 }),
    (0, dtoDecorators_1.UpperString)(2),
    __metadata("design:type", String)
], SaveBranchMasterDto.prototype, "brStateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], SaveBranchMasterDto.prototype, "brPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], SaveBranchMasterDto.prototype, "brCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brLandmark", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brRegionAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brRegionAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brRegionAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brRegionCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brRegionDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brRegionState", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    (0, dtoDecorators_1.NullableString)(60),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brRegionCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brRegionName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brContactPerson", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brTel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableEmail)(150),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brMail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brBillPrefix", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brInvoiceSeriesPrefix", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 300, nullable: true }),
    (0, dtoDecorators_1.NullableString)(300),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brBillGreeting", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brRoundingMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Number)
], SaveBranchMasterDto.prototype, "brRoundingValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brDefaultGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brPosType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveBranchMasterDto.prototype, "brAllowNegativeStock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveBranchMasterDto.prototype, "brSmsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brBankId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brFssaiNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brFssaiLicenseType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brFssaiValidUpto", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableUpperString)(15),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brGstinNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brGstRegType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableUpperString)(10),
    __metadata("design:type", Object)
], SaveBranchMasterDto.prototype, "brPanNo", void 0);
//# sourceMappingURL=save-branch-master.dto.js.map