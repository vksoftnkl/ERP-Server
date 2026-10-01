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
exports.SaveCustomerDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveCustomerDto {
    cusId;
    cusTitle;
    cusShort;
    cusCode;
    cusName;
    cusAddr1;
    cusAddr2;
    cusAddr3;
    cusCity;
    cusDistrict;
    cusStateName;
    cusCountry;
    cusStateCode;
    cusLandmark;
    cusPin;
    cusTel;
    cusPhone1;
    cusPhone2;
    cusWhatsappNo;
    cusEmail;
    cusAadharNo;
    cusContactPerson;
    cusDistanceKm;
    cusCreditAllowed;
    cusCreditBillLimit;
    cusCreditAmtLimit;
    cusCreditDays;
    cusDebitBalance;
    cusDiscPerc;
    cusDebitGraceDays;
    cusEnableSms;
    cusOverdueSms;
    cusOverdueBilling;
    cusAllowPromotion;
    cusAllowLoyalty;
    cusAllowDiscount;
    cusSortOrder;
    cusRegionName;
    cusRegionAddr1;
    cusRegionAddr2;
    cusRegionAddr3;
    cusRegionCity;
    cusRegionDistrict;
    cusRegionStateName;
    cusRegionCountry;
    cusBirthDate;
    cusMarriageDate;
    cusTransportName;
    cusFreightCharge;
    cusLoadingCharge;
    cusUnloadingCharge;
    cusGstNo;
    cusPanNo;
    cusGstType;
    cusEcommerceGstin;
    cusTcsApplicable;
    cusItcollExempted;
    cusItcollType;
    cusGeoLocation;
    cusCollectionDays;
    cusDefaultSalesman;
    cusPriceLevelId;
    cusBilledDate;
    cusBilledCount;
    cusNotes;
    cusCompanyId;
    cusBranchId;
    cusAreaId;
    cusGroupId;
    cusIsActive;
    cusCreatedBy;
    cusModifiedBy;
}
exports.SaveCustomerDto = SaveCustomerDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing customer',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveCustomerDto.prototype, "cusId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 5, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(5),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusTitle", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(200),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusDistrict", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100 }),
    (0, dtoDecorators_1.TrimmedString)(100),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveCustomerDto.prototype, "cusStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(60),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusCountry", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 2, maxLength: 2 }),
    (0, dtoDecorators_1.UpperString)(2),
    __metadata("design:type", String)
], SaveCustomerDto.prototype, "cusStateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(200),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusLandmark", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 6, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(6),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusTel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusPhone1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusPhone2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusWhatsappNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(120),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 12, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(12),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusAadharNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(150),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusContactPerson", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(0),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusDistanceKm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerDto.prototype, "cusCreditAllowed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableInteger)(0),
    __metadata("design:type", Number)
], SaveCustomerDto.prototype, "cusCreditBillLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Number)
], SaveCustomerDto.prototype, "cusCreditAmtLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableInteger)(0),
    __metadata("design:type", Number)
], SaveCustomerDto.prototype, "cusCreditDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Number)
], SaveCustomerDto.prototype, "cusDebitBalance", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Number)
], SaveCustomerDto.prototype, "cusDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableInteger)(0),
    __metadata("design:type", Number)
], SaveCustomerDto.prototype, "cusDebitGraceDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerDto.prototype, "cusEnableSms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerDto.prototype, "cusOverdueSms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerDto.prototype, "cusOverdueBilling", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerDto.prototype, "cusAllowPromotion", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerDto.prototype, "cusAllowLoyalty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerDto.prototype, "cusAllowDiscount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableInteger)(0),
    __metadata("design:type", Number)
], SaveCustomerDto.prototype, "cusSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(200),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusRegionName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusRegionAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusRegionAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusRegionAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusRegionCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusRegionDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusRegionStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(60),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusRegionCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusBirthDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusMarriageDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(200),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusTransportName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerDto.prototype, "cusFreightCharge", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerDto.prototype, "cusLoadingCharge", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerDto.prototype, "cusUnloadingCharge", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusGstNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(10),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusPanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusGstType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusEcommerceGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerDto.prototype, "cusTcsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerDto.prototype, "cusItcollExempted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusItcollType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(200),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusGeoLocation", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [Number],
        description: 'Collection days as integer array (JSON array or comma-separated values)',
    }),
    (0, dtoDecorators_1.OptionalIntegerArray)(),
    __metadata("design:type", Array)
], SaveCustomerDto.prototype, "cusCollectionDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusDefaultSalesman", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0 }),
    (0, dtoDecorators_1.RequiredInteger)(0),
    __metadata("design:type", Number)
], SaveCustomerDto.prototype, "cusPriceLevelId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusBilledDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableInteger)(0),
    __metadata("design:type", Number)
], SaveCustomerDto.prototype, "cusBilledCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusNotes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveCustomerDto.prototype, "cusAreaId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveCustomerDto.prototype, "cusGroupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerDto.prototype, "cusIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveCustomerDto.prototype, "cusModifiedBy", void 0);
//# sourceMappingURL=save-customer.dto.js.map