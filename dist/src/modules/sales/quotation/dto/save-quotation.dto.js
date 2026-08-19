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
exports.SaveQuotationDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_quotation_charge_dto_1 = require("./save-quotation-charge.dto");
const save_quotation_item_dto_1 = require("./save-quotation-item.dto");
class SaveQuotationDto {
    sqId;
    sqCompanyId;
    sqBranchId;
    sqTenantId;
    sqAccYear;
    sqSessionId;
    sqCategoryId;
    sqPriceLevel;
    sqDocType;
    sqQuoteSlno;
    sqQuoteRefno;
    sqUsrRefno;
    sqQuoteDate;
    sqQuoteDatetime;
    sqValidUntil;
    sqValidityDays;
    sqRevisionNo;
    sqParentQuoteId;
    sqParentAccYear;
    sqSrcDocType;
    sqSrcDocId;
    sqSrcDocRefno;
    sqSrcDocDate;
    sqCustId;
    sqCustAreaId;
    sqCustName;
    sqCustAddr;
    sqCustPlace;
    sqCustPhone;
    sqCustEmail;
    sqCustGstin;
    sqCustGstType;
    sqCustStcd;
    sqPosStcd;
    sqStateName;
    sqContactPerson;
    sqContactPhone;
    sqHasLoad;
    sqHasUnload;
    sqHasFreight;
    sqHasPromo;
    sqHasComm;
    sqUserId;
    sqSalesmanId;
    sqAgentId;
    sqTotItems;
    sqTotWeight;
    sqTotBags;
    sqGrossAmt;
    sqItemDisc;
    sqSplDisc;
    sqSchDisc;
    sqBillSchDisc;
    sqAddlDisc1;
    sqAddlDisc2;
    sqTaxableAmt;
    sqCgstAmt;
    sqSgstAmt;
    sqIgstAmt;
    sqCessAmt;
    sqTaxAmt;
    sqFreightAmt;
    sqLoadAmt;
    sqUnloadAmt;
    sqOtherAmt1;
    sqOtherAmt2;
    sqRoundOff;
    sqQuoteAmt;
    sqTotalCost;
    sqMarginAmt;
    sqMarginPerc;
    sqPaymentTerms;
    sqDeliveryTerms;
    sqTermsConditions;
    sqStatus;
    sqSentOn;
    sqAcceptedOn;
    sqRejectedOn;
    sqRejectReason;
    sqConvertedDocType;
    sqConvertedDocId;
    sqConvertedOn;
    sqApprovedOn;
    sqApprovedBy;
    sqCancelledOn;
    sqCancelledBy;
    sqCancelReason;
    sqMrpSavings;
    sqMrpSavingsPerc;
    sqPrintCount;
    sqDeviceType;
    sqDeviceId;
    sqRemarks;
    sqCreatedBy;
    sqModifiedBy;
    sqFreightCalcType;
    sqLoadingCalcType;
    sqDiscAlterBase;
    items;
    charges;
}
exports.SaveQuotationDto = SaveQuotationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing quotation',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveQuotationDto.prototype, "sqId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveQuotationDto.prototype, "sqCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveQuotationDto.prototype, "sqBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    __metadata("design:type", String)
], SaveQuotationDto.prototype, "sqAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCategoryId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, dtoDecorators_1.RequiredInteger)(),
    __metadata("design:type", Number)
], SaveQuotationDto.prototype, "sqPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        readOnly: true,
        description: 'Ignored — assigned from the quotation voucher sequence on create',
    }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveQuotationDto.prototype, "sqQuoteSlno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        readOnly: true,
        maxLength: 100,
        nullable: true,
        description: 'Ignored — generated from the quotation voucher sequence on create',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqQuoteRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', description: "Defaults to today's date" }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], SaveQuotationDto.prototype, "sqQuoteDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        description: 'Defaults to the save time',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], SaveQuotationDto.prototype, "sqQuoteDatetime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqValidUntil", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqValidityDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveQuotationDto.prototype, "sqRevisionNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqParentQuoteId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: 9,
        maxLength: 9,
        nullable: true,
        description: 'Accounting year of sqParentQuoteId. sale_quotation is partitioned by accounting year, so the parent revision is addressed by (id, year). Only needed when the parent lives in a different year; it otherwise defaults to the sqAccYear of this quotation. Ignored unless sqParentQuoteId is sent.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqParentAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqSrcDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqSrcDocDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCustId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCustAreaId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveQuotationDto.prototype, "sqCustName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCustAddr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCustPlace", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCustPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(150),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCustEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCustGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCustGstType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 2, maxLength: 2, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCustStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 2, maxLength: 2, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqPosStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        description: 'Snapshot of the state name',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(150),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqContactPerson", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqContactPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationDto.prototype, "sqHasLoad", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationDto.prototype, "sqHasUnload", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationDto.prototype, "sqHasFreight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationDto.prototype, "sqHasPromo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationDto.prototype, "sqHasComm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveQuotationDto.prototype, "sqUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqAgentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveQuotationDto.prototype, "sqTotItems", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqTotWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqTotBags", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqItemDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqSplDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqBillSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqAddlDisc1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqAddlDisc2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqFreightAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqLoadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqUnloadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqOtherAmt1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqOtherAmt2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqQuoteAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqTotalCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqMarginAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqMarginPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqPaymentTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqDeliveryTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Free text, no length limit' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqTermsConditions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: 'DRAFT / SENT / ACCEPTED / REJECTED / EXPIRED / CONVERTED / CANCELLED',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqSentOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqAcceptedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqRejectedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqRejectReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        nullable: true,
        description: 'Document the quotation was converted into',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqConvertedDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqConvertedDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqConvertedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqApprovedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqApprovedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCancelledOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCancelledBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCancelReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqMrpSavings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqMrpSavingsPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveQuotationDto.prototype, "sqPrintCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Originating device identifier' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'fixed',
        description: 'How the freight charge is computed (snapshot of the charge master method), stored lower case',
    }),
    (0, dtoDecorators_1.NullableLowerMaxString)(12),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqFreightCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'fixed',
        description: 'How the loading charge is computed (snapshot of the charge master method), stored lower case',
    }),
    (0, dtoDecorators_1.NullableLowerMaxString)(12),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqLoadingCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'true = discounts change the basis the charges are computed on',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Object)
], SaveQuotationDto.prototype, "sqDiscAlterBase", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_quotation_item_dto_1.SaveQuotationItemDto,
        isArray: true,
        description: 'Quotation line items. On update, lines with sqiId are updated, lines without are created, ' +
            'and existing lines omitted from the array are soft deleted. Omit the property entirely to leave lines untouched.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_quotation_item_dto_1.SaveQuotationItemDto),
    __metadata("design:type", Array)
], SaveQuotationDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_quotation_charge_dto_1.SaveQuotationChargeDto,
        isArray: true,
        description: 'Applied charge lines (txn_charge_detail). Reconciled exactly like items: lines with cdId are ' +
            'updated, lines without are created, and existing lines omitted from the array are soft deleted. ' +
            'Omit the property entirely to leave charges untouched.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_quotation_charge_dto_1.SaveQuotationChargeDto),
    __metadata("design:type", Array)
], SaveQuotationDto.prototype, "charges", void 0);
//# sourceMappingURL=save-quotation.dto.js.map