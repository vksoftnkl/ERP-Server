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
exports.CustomerSuccessDeleteDto = exports.CustomerSuccessSingleDto = exports.CustomerDeleteResultDto = exports.CustomerPayloadDto = exports.CustomerErrorResponseDto = exports.CustomerErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class CustomerErrorFieldDto {
    field;
    message;
}
exports.CustomerErrorFieldDto = CustomerErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'cusStateCode' }),
    __metadata("design:type", String)
], CustomerErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'cusStateCode must be exactly 2 characters' }),
    __metadata("design:type", String)
], CustomerErrorFieldDto.prototype, "message", void 0);
class CustomerErrorResponseDto {
    success;
    message;
    errors;
}
exports.CustomerErrorResponseDto = CustomerErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], CustomerErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], CustomerErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CustomerErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], CustomerErrorResponseDto.prototype, "errors", void 0);
class CustomerPayloadDto {
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
    cusPriceLevelName;
    cusBilledDate;
    cusBilledCount;
    cusNotes;
    cusCompanyId;
    cusCompanyName;
    cusBranchId;
    cusBranchName;
    cusAreaId;
    cusAreaName;
    cusGroupId;
    cusGroupName;
    cusIsActive;
    cusIsDeleted;
    cusSyncDate;
    cusCreatedOn;
    cusCreatedBy;
    cusModifiedOn;
    cusModifiedBy;
}
exports.CustomerPayloadDto = CustomerPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CustomerPayloadDto.prototype, "cusId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 5, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusTitle", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusDistrict", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100 }),
    __metadata("design:type", String)
], CustomerPayloadDto.prototype, "cusStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusCountry", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 2, maxLength: 2 }),
    __metadata("design:type", String)
], CustomerPayloadDto.prototype, "cusStateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusLandmark", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusTel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusPhone1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusPhone2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusWhatsappNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 12, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusAadharNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusContactPerson", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusDistanceKm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusCreditAllowed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerPayloadDto.prototype, "cusCreditBillLimit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerPayloadDto.prototype, "cusCreditAmtLimit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerPayloadDto.prototype, "cusCreditDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerPayloadDto.prototype, "cusDebitBalance", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerPayloadDto.prototype, "cusDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerPayloadDto.prototype, "cusDebitGraceDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusEnableSms", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusOverdueSms", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusOverdueBilling", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusAllowPromotion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusAllowLoyalty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusAllowDiscount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerPayloadDto.prototype, "cusSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusRegionName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusRegionAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusRegionAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusRegionAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusRegionCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusRegionDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusRegionStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusRegionCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusBirthDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusMarriageDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusTransportName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusFreightCharge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusLoadingCharge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusUnloadingCharge", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusGstNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusPanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusGstType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusEcommerceGstin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusTcsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusItcollExempted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusItcollType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusGeoLocation", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [Number], example: [] }),
    __metadata("design:type", Array)
], CustomerPayloadDto.prototype, "cusCollectionDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusDefaultSalesman", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerPayloadDto.prototype, "cusPriceLevelId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Retail Price',
        description: 'Name of the linked price level (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusPriceLevelName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusBilledDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerPayloadDto.prototype, "cusBilledCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusNotes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Acme Pvt Ltd',
        description: 'Name of the linked company (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Main Branch',
        description: 'Name of the linked branch (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusBranchName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CustomerPayloadDto.prototype, "cusAreaId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Downtown',
        description: 'Name of the linked area (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusAreaName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CustomerPayloadDto.prototype, "cusGroupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Wholesale',
        description: 'Name of the linked customer group (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusGroupName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerPayloadDto.prototype, "cusIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CustomerPayloadDto.prototype, "cusCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CustomerPayloadDto.prototype, "cusModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerPayloadDto.prototype, "cusModifiedBy", void 0);
class CustomerDeleteResultDto {
    cusId;
    deleted;
}
exports.CustomerDeleteResultDto = CustomerDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CustomerDeleteResultDto.prototype, "cusId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CustomerDeleteResultDto.prototype, "deleted", void 0);
class CustomerSuccessSingleDto {
    success;
    message;
    data;
}
exports.CustomerSuccessSingleDto = CustomerSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CustomerSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Customer fetched successfully' }),
    __metadata("design:type", String)
], CustomerSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CustomerPayloadDto }),
    __metadata("design:type", CustomerPayloadDto)
], CustomerSuccessSingleDto.prototype, "data", void 0);
class CustomerSuccessDeleteDto {
    success;
    message;
    data;
}
exports.CustomerSuccessDeleteDto = CustomerSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CustomerSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Customer deleted successfully' }),
    __metadata("design:type", String)
], CustomerSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CustomerDeleteResultDto }),
    __metadata("design:type", CustomerDeleteResultDto)
], CustomerSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=customer-response.dto.js.map