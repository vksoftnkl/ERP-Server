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
exports.SaveBillDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_charge_detail_dto_1 = require("../../../master/charge-detail/dto/save-charge-detail.dto");
const save_tender_detail_dto_1 = require("../../../accountsModule/tenderDetail/dto/save-tender-detail.dto");
const save_bill_adjustment_dto_1 = require("./save-bill-adjustment.dto");
const save_bill_item_dto_1 = require("./save-bill-item.dto");
const toUuidArray = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === '') {
        return [];
    }
    if (Array.isArray(value)) {
        return value.map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry)));
    }
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);
    }
    return value;
};
const NullableUuidArray = () => (0, common_1.applyDecorators)((0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(({ value }) => toUuidArray(value)), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsUUID)('all', { each: true }));
class SaveBillDto {
    sbId;
    sbCompanyId;
    sbBranchId;
    sbTenantId;
    sbAccYear;
    sbSessionId;
    sbCounterId;
    sbDeviceType;
    sbDeviceId;
    sbDocType;
    sbBillType;
    sbCategoryId;
    sbPriceLevel;
    sbBillSlno;
    sbBillRefno;
    sbUsrRefno;
    sbBillDate;
    sbBillDatetime;
    sbDueDays;
    sbDueDate;
    sbSrcDocType;
    sbSrcDocId;
    sbSrcDocRefno;
    sbSrcDocDate;
    sbSrcDocYear;
    sbCustId;
    sbCustName;
    sbCustAddr;
    sbCustPlace;
    sbCustPin;
    sbCustPhone;
    sbCustGstin;
    sbCustGstType;
    sbCustStcd;
    sbPosStcd;
    sbStateName;
    sbHasLoad;
    sbHasUnload;
    sbHasFreight;
    sbHasPromo;
    sbHasComm;
    sbHasLoyalty;
    sbUserId;
    sbSalesmanId;
    sbAgentId;
    sbAgentCommPerc;
    sbAgentCommAmt;
    sbDriverId;
    sbLoadmanId;
    sbPackedId;
    sbSupervisorId;
    sbVehicleId;
    sbVehicleNo;
    sbTotItems;
    sbTotWeight;
    sbTotBags;
    sbGrossAmt;
    sbItemDisc;
    sbSplDisc;
    sbSchDisc;
    sbBillSchDisc;
    sbAddlDisc1;
    sbAddlDisc2;
    sbCashDisc;
    sbTaxableAmt;
    sbCgstAmt;
    sbSgstAmt;
    sbIgstAmt;
    sbCessAmt;
    sbTaxAmt;
    sbFreightAmt;
    sbLoadAmt;
    sbUnloadAmt;
    sbOtherAmt1;
    sbOtherAmt2;
    sbRoundOff;
    sbBillAmt;
    sbTotalCost;
    sbMarginAmt;
    sbMarginAmtWot;
    sbMarginPerc;
    sbMrpSavings;
    sbMrpSavingsPerc;
    sbPayMode;
    sbCreditAmt;
    sbSurchargeAmt;
    sbTenderAmt;
    sbRefundAmt;
    sbAdvanceAmt;
    sbPaidAmt;
    sbBalanceAmt;
    sbPayStatus;
    sbReturnedAmt;
    sbReturnStatus;
    sbPaymentTerms;
    sbDeliveryTerms;
    sbTermsConditions;
    sbRemarks;
    sbFreightCalcType;
    sbLoadingCalcType;
    sbDiscAlterBase;
    sbRoundOffStep;
    sbStatus;
    sbPostedOn;
    sbPostedVoucherId;
    sbApprovedOn;
    sbApprovedBy;
    sbCancelledOn;
    sbCancelledBy;
    sbCancelReason;
    sbVersionNo;
    sbPrintCount;
    sbCreatedBy;
    sbModifiedBy;
    items;
    charges;
    tenders;
    adjustments;
}
exports.SaveBillDto = SaveBillDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing bill',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveBillDto.prototype, "sbId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveBillDto.prototype, "sbCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveBillDto.prototype, "sbBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    __metadata("design:type", String)
], SaveBillDto.prototype, "sbAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The counter/device that raised this document',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCounterId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20 }),
    (0, dtoDecorators_1.TrimmedString)(20),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveBillDto.prototype, "sbDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Originating device identifier (fingerprint / hostname, not a uuid)',
    }),
    (0, dtoDecorators_1.TrimmedString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveBillDto.prototype, "sbDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        nullable: true,
        description: "TAX_INVOICE / BILL_OF_SUPPLY — defaults to 'TAX_INVOICE'",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: "CASH / CREDIT — defaults to 'CASH'",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbBillType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCategoryId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, dtoDecorators_1.RequiredInteger)(),
    __metadata("design:type", Number)
], SaveBillDto.prototype, "sbPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        readOnly: true,
        description: 'Ignored — assigned from the bill voucher sequence on create',
    }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbBillSlno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        readOnly: true,
        maxLength: 100,
        nullable: true,
        description: 'Ignored — generated from the bill voucher sequence on create',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbBillRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', description: "Defaults to today's date" }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], SaveBillDto.prototype, "sbBillDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        description: 'Defaults to the save time',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], SaveBillDto.prototype, "sbBillDatetime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbDueDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbDueDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        nullable: true,
        description: 'Document this bill was raised from: quotation, sales order, delivery challan',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbSrcDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbSrcDocDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 9,
        nullable: true,
        example: '2026-2027',
        description: "The source document's OWN accounting year — with sbSrcDocId, that document's primary key",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbSrcDocYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveBillDto.prototype, "sbCustId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveBillDto.prototype, "sbCustName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCustAddr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCustPlace", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(10),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCustPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCustPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCustGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCustGstType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 2, maxLength: 2, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCustStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: 2,
        maxLength: 2,
        nullable: true,
        description: 'Place of supply: decides CGST+SGST vs IGST',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbPosStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        description: 'Snapshot of the state name',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveBillDto.prototype, "sbHasLoad", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveBillDto.prototype, "sbHasUnload", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveBillDto.prototype, "sbHasFreight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveBillDto.prototype, "sbHasPromo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveBillDto.prototype, "sbHasComm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveBillDto.prototype, "sbHasLoyalty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveBillDto.prototype, "sbUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], format: 'uuid', nullable: true }),
    NullableUuidArray(),
    __metadata("design:type", Array)
], SaveBillDto.prototype, "sbSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbAgentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbAgentCommPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbAgentCommAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbDriverId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], format: 'uuid', nullable: true }),
    NullableUuidArray(),
    __metadata("design:type", Array)
], SaveBillDto.prototype, "sbLoadmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], format: 'uuid', nullable: true }),
    NullableUuidArray(),
    __metadata("design:type", Array)
], SaveBillDto.prototype, "sbPackedId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbSupervisorId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbVehicleId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbVehicleNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Printed LINES, not split rows' }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveBillDto.prototype, "sbTotItems", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbTotWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbTotBags", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbItemDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbSplDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbBillSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbAddlDisc1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbAddlDisc2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCashDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'POST-charge taxable value' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Roll-up of applied freight charge lines' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbFreightAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Roll-up of applied loading charge lines' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbLoadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Roll-up of applied unloading charge lines' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbUnloadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbOtherAmt1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbOtherAmt2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbBillAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Never printed; drives margin reports' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbTotalCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbMarginAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Margin without tax' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbMarginAmtWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbMarginPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbMrpSavings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbMrpSavingsPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: 'Dominant tender mode, for quick filters',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbPayMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCreditAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbSurchargeAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbTenderAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbRefundAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbAdvanceAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbPaidAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbBalanceAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: "UNPAID / PARTIAL / PAID — defaults to 'UNPAID'",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbPayStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Cache mirrored from sale_return' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbReturnedAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true, description: 'NULL / PARTIAL / FULL' }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbReturnStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbPaymentTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbDeliveryTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Free text, no length limit' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbTermsConditions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'fixed',
        description: 'How the freight charge is computed (snapshot of the charge master method), stored lower case',
    }),
    (0, dtoDecorators_1.NullableLowerMaxString)(12),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbFreightCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'fixed',
        description: 'How the loading charge is computed (snapshot of the charge master method), stored lower case',
    }),
    (0, dtoDecorators_1.NullableLowerMaxString)(12),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbLoadingCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'true = discounts change the basis the charges are computed on',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbDiscAlterBase", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbRoundOffStep", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: "DRAFT / POSTED / CANCELLED — defaults to 'DRAFT'",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbPostedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'accounts.acc_voucher_header',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbPostedVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbApprovedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbApprovedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCancelledOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCancelledBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCancelReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveBillDto.prototype, "sbVersionNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveBillDto.prototype, "sbPrintCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveBillDto.prototype, "sbModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_bill_item_dto_1.SaveBillItemDto,
        isArray: true,
        description: 'Bill line items. On update, lines with sbiId are updated, lines without are created, ' +
            'and existing lines omitted from the array are soft deleted. Omit the property entirely to leave lines untouched.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_bill_item_dto_1.SaveBillItemDto),
    __metadata("design:type", Array)
], SaveBillDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_charge_detail_dto_1.SaveChargeDetailDto,
        isArray: true,
        description: "Applied charge lines, the charge-detail module's own entry (txn_charge_detail). Reconciled " +
            'exactly like items: lines with cdId are updated, lines without are created, and existing lines ' +
            'omitted from the array are soft deleted. Omit the property entirely to leave charges untouched. ' +
            'cdChgId and cdLedgerCode are required on a new line; cdDocType / cdDocId are the parent bill and ' +
            'must be omitted or match it, and cdCompId / cdBranchId / cdAccYear / cdVoucherNo default to the ' +
            "bill's own scope.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_charge_detail_dto_1.SaveChargeDetailDto),
    __metadata("design:type", Array)
], SaveBillDto.prototype, "charges", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_tender_detail_dto_1.SaveTenderDetailDto,
        isArray: true,
        description: "Tendered amounts, the tender-detail module's own entry (acc_tender_detail): what the " +
            'customer actually paid with, one line per tender (cash, card, UPI, loyalty, …). Reconciled ' +
            'exactly like items: lines with tdId are updated, lines without are created, and existing ' +
            'lines omitted from the array are soft deleted. Omit the property entirely to leave tenders ' +
            'untouched. tdTenderId is required on a new line; the document triple (tdSrcModule / ' +
            'tdSrcDocType / tdSrcDocId) is this bill and must be omitted or match it, and tdCompanyId / ' +
            'tdBranchId / tdTenantId / tdAccYear / tdDocDate / tdPartyLedgerId / tdUserId / tdSessionId / ' +
            "tdDeviceId / tdDrCr all default to the bill's own scope.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_tender_detail_dto_1.SaveTenderDetailDto),
    __metadata("design:type", Array)
], SaveBillDto.prototype, "tenders", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_bill_adjustment_dto_1.SaveBillAdjustmentDto,
        isArray: true,
        description: 'Credits the customer already holds — order advances and sale-return credit notes — set off ' +
            'against this bill (accounts.acc_bill_adjustment). NOT tenders: the settle screen’s ADJUST row ' +
            'is a read-only mirror of this array and must not also appear in `tenders`, or the same money ' +
            'posts twice. ' +
            'Reconciled differently from the other arrays, because absent is not empty: omit the property ' +
            'entirely to leave the existing settlement alone (which is what a bill loaded for edit does ' +
            'when its GET returned no array), and send [] to clear it. A changed set is reversed and ' +
            're-posted as new rows — nothing here is ever edited in place. ' +
            'Only againstBillId, againstBillAccYear and amount are used: billType / adjType / ' +
            'settlementMode are accepted as audit echoes and ignored, since the server derives all three ' +
            'from the credit’s own row.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_bill_adjustment_dto_1.SaveBillAdjustmentDto),
    __metadata("design:type", Array)
], SaveBillDto.prototype, "adjustments", void 0);
//# sourceMappingURL=save-bill.dto.js.map