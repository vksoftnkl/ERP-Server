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
exports.BranchMasterSuccessDeleteDto = exports.BranchMasterSuccessSingleDto = exports.BranchMasterDeleteResultDto = exports.BranchMasterPayloadDto = exports.BranchMasterErrorResponseDto = exports.BranchMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class BranchMasterErrorFieldDto {
    field;
    message;
}
exports.BranchMasterErrorFieldDto = BranchMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'brName' }),
    __metadata("design:type", String)
], BranchMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate brName is not allowed for this company' }),
    __metadata("design:type", String)
], BranchMasterErrorFieldDto.prototype, "message", void 0);
class BranchMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.BranchMasterErrorResponseDto = BranchMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], BranchMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], BranchMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BranchMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], BranchMasterErrorResponseDto.prototype, "errors", void 0);
class BranchMasterPayloadDto {
    brId;
    brCompId;
    brCompName;
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
    brDefaultGodownName;
    brPosType;
    brAllowNegativeStock;
    brSmsApplicable;
    brBankId;
    brBankName;
    brFssaiNo;
    brFssaiLicenseType;
    brFssaiValidUpto;
    brGstinNo;
    brGstRegType;
    brPanNo;
    brIsDeleted;
    brSyncDate;
    brCreatedOn;
    brCreatedBy;
    brModifiedOn;
    brModifiedBy;
}
exports.BranchMasterPayloadDto = BranchMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' }),
    __metadata("design:type", String)
], BranchMasterPayloadDto.prototype, "brId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1' }),
    __metadata("design:type", String)
], BranchMasterPayloadDto.prototype, "brCompId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Acme Pvt Ltd',
        description: 'Name of the linked company (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brCompName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BranchMasterPayloadDto.prototype, "brName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brMailingName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BranchMasterPayloadDto.prototype, "brIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BranchMasterPayloadDto.prototype, "brIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brState", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BranchMasterPayloadDto.prototype, "brStateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brPin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BranchMasterPayloadDto.prototype, "brCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brLandmark", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brRegionAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brRegionAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brRegionAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brRegionCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brRegionDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brRegionState", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brRegionCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brRegionName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brContactPerson", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brTel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brMail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brBillPrefix", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brInvoiceSeriesPrefix", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brBillGreeting", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brRoundingMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brRoundingValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brDefaultGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Main Warehouse',
        description: 'Name of the default godown (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brDefaultGodownName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brPosType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BranchMasterPayloadDto.prototype, "brAllowNegativeStock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BranchMasterPayloadDto.prototype, "brSmsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brBankId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'HDFC Bank',
        description: 'Name of the linked bank (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brBankName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brFssaiNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brFssaiLicenseType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brFssaiValidUpto", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brGstinNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brGstRegType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brPanNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BranchMasterPayloadDto.prototype, "brIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BranchMasterPayloadDto.prototype, "brCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BranchMasterPayloadDto.prototype, "brModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BranchMasterPayloadDto.prototype, "brModifiedBy", void 0);
class BranchMasterDeleteResultDto {
    brId;
    deleted;
}
exports.BranchMasterDeleteResultDto = BranchMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' }),
    __metadata("design:type", String)
], BranchMasterDeleteResultDto.prototype, "brId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BranchMasterDeleteResultDto.prototype, "deleted", void 0);
class BranchMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.BranchMasterSuccessSingleDto = BranchMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BranchMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Branch fetched successfully' }),
    __metadata("design:type", String)
], BranchMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BranchMasterPayloadDto }),
    __metadata("design:type", BranchMasterPayloadDto)
], BranchMasterSuccessSingleDto.prototype, "data", void 0);
class BranchMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.BranchMasterSuccessDeleteDto = BranchMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BranchMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Branch deleted successfully' }),
    __metadata("design:type", String)
], BranchMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BranchMasterDeleteResultDto }),
    __metadata("design:type", BranchMasterDeleteResultDto)
], BranchMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=branch-master-response.dto.js.map