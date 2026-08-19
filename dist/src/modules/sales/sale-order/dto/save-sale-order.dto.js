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
exports.SaveSaleOrderDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_charge_detail_dto_1 = require("../../../master/charge-detail/dto/save-charge-detail.dto");
const save_tender_detail_dto_1 = require("../../../accountsModule/tenderDetail/dto/save-tender-detail.dto");
const save_sale_order_item_dto_1 = require("./save-sale-order-item.dto");
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
class SaveSaleOrderDto {
    soId;
    soCompanyId;
    soBranchId;
    soTenantId;
    soAccYear;
    soSessionId;
    soDeviceId;
    soDocType;
    soOrderType;
    soPriceLevel;
    soOrderSlno;
    soOrderRefno;
    soUsrRefno;
    soOrderDate;
    soOrderDatetime;
    soDeliveryDate;
    soDeliverySlot;
    soPriority;
    soValidUntil;
    soSrcDocType;
    soSrcDocId;
    soSrcDocAccYear;
    soSrcDocRefno;
    soSrcDocDate;
    soDeliveryMode;
    soCustId;
    soCustName;
    soCustAddr;
    soCustPlace;
    soCustPin;
    soCustPhone;
    soCustEmail;
    soCustGstin;
    soCustGstType;
    soCustStcd;
    soPosStcd;
    soStateName;
    soContactPerson;
    soContactPhone;
    soShipName;
    soShipAddr;
    soShipPlace;
    soShipPin;
    soShipPhone;
    soShipStcd;
    soShipLandmark;
    soShipLat;
    soShipLng;
    soHasLoad;
    soHasUnload;
    soHasFreight;
    soHasPromo;
    soHasComm;
    soHasLoyalty;
    soUserId;
    soSalesmanId;
    soAgentId;
    soAgentCommPerc;
    soAgentCommAmt;
    soPackedId;
    soTotItems;
    soDeliveredItems;
    soTotWeight;
    soTotBags;
    soGrossAmt;
    soItemDisc;
    soSplDisc;
    soSchDisc;
    soBillSchDisc;
    soAddlDisc1;
    soAddlDisc2;
    soCashDiscPerc;
    soCashDisc;
    soTaxableAmt;
    soCgstAmt;
    soSgstAmt;
    soIgstAmt;
    soCessAmt;
    soTaxAmt;
    soFreightAmt;
    soLoadAmt;
    soUnloadAmt;
    soOtherAmt1;
    soOtherAmt2;
    soRoundOff;
    soOrderAmt;
    soTotalCost;
    soMarginAmt;
    soMarginAmtWot;
    soMarginPerc;
    soMarginPercWot;
    soMrpSavings;
    soMrpSavingsPerc;
    soAdvancePolicy;
    soAdvancePerc;
    soAdvanceRequired;
    soAdvanceDueDate;
    soIsAdvanceMandatory;
    soAdvanceLedgerId;
    soAdvanceRecdAmt;
    soAdvanceAdjustedAmt;
    soAdvanceRefundAmt;
    soAdvanceForfeitAmt;
    soAdvanceBalanceAmt;
    soAdvanceStatus;
    soAdvanceRecdOn;
    soPayMode;
    soSurchargeAmt;
    soTenderAmt;
    soRefundAmt;
    soPayStatus;
    soBilledAmt;
    soCancelledAmt;
    soPendingAmt;
    soFulfilStatus;
    soLastBilledOn;
    soCompletedOn;
    soPaymentTerms;
    soDeliveryTerms;
    soTermsConditions;
    soRemarks;
    soFreightCalcType;
    soLoadingCalcType;
    soDiscAlterBase;
    soRoundOffStep;
    soStatus;
    soVersionNo;
    soPrintCount;
    soCreatedBy;
    soModifiedBy;
    items;
    charges;
    tenders;
}
exports.SaveSaleOrderDto = SaveSaleOrderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing order',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveSaleOrderDto.prototype, "soId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleOrderDto.prototype, "soCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Branch that TOOK the order' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleOrderDto.prototype, "soBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    __metadata("design:type", String)
], SaveSaleOrderDto.prototype, "soAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soSessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'fixed.device_master.dev_id — the billing point that raised this order',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleOrderDto.prototype, "soDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        nullable: true,
        description: "SALES_ORDER / BOOKING / CUSTOM_ORDER — defaults to 'SALES_ORDER'",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: "CASH / CREDIT — defaults to 'CASH'",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soOrderType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, dtoDecorators_1.RequiredInteger)(),
    __metadata("design:type", Number)
], SaveSaleOrderDto.prototype, "soPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        readOnly: true,
        description: 'Ignored — assigned from the sales-order voucher sequence on create',
    }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soOrderSlno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        readOnly: true,
        maxLength: 100,
        nullable: true,
        description: 'Ignored — generated from the sales-order voucher sequence on create',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soOrderRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', description: "Defaults to today's date" }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], SaveSaleOrderDto.prototype, "soOrderDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        description: 'Defaults to the save time',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], SaveSaleOrderDto.prototype, "soOrderDatetime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date',
        nullable: true,
        description: 'The delivery date agreed with the customer; lines may carry their own',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soDeliveryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        nullable: true,
        description: "'FN' | 'AN' | '10-12' ... free text by design",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soDeliverySlot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 10,
        nullable: true,
        description: "LOW / NORMAL / HIGH / URGENT — defaults to 'NORMAL'",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(10),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soPriority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date',
        nullable: true,
        description: 'An unclaimed booking lapses after this date',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soValidUntil", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        nullable: true,
        description: 'Document this order was raised from: quotation, imported/marketplace order',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: 9,
        maxLength: 9,
        nullable: true,
        description: "The source document's OWN accounting year — a March quotation can become an April order",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soSrcDocAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soSrcDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soSrcDocDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: 'STORE_PICKUP / HOME_DELIVERY / SHIP_FROM_STORE / COURIER / TRANSPORT — ' +
            "defaults to 'STORE_PICKUP'",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soDeliveryMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleOrderDto.prototype, "soCustId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveSaleOrderDto.prototype, "soCustName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCustAddr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCustPlace", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(10),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCustPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCustPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(150),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCustEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCustGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCustGstType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 2, maxLength: 2, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCustStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: 2,
        maxLength: 2,
        nullable: true,
        description: 'Place of supply: decides CGST+SGST vs IGST',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soPosStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true, description: 'Snapshot of the state name' }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(150),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soContactPerson", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soContactPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 200,
        nullable: true,
        description: 'Ship-to, snapshotted separately from the billing address',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(200),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soShipName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soShipAddr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soShipPlace", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(10),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soShipPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soShipPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 2, maxLength: 2, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soShipStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soShipLandmark", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soShipLat", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soShipLng", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderDto.prototype, "soHasLoad", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderDto.prototype, "soHasUnload", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderDto.prototype, "soHasFreight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderDto.prototype, "soHasPromo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderDto.prototype, "soHasComm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderDto.prototype, "soHasLoyalty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleOrderDto.prototype, "soUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], format: 'uuid', nullable: true }),
    NullableUuidArray(),
    __metadata("design:type", Array)
], SaveSaleOrderDto.prototype, "soSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAgentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAgentCommPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAgentCommAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], format: 'uuid', nullable: true }),
    NullableUuidArray(),
    __metadata("design:type", Array)
], SaveSaleOrderDto.prototype, "soPackedId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Ordered LINES' }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveSaleOrderDto.prototype, "soTotItems", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Fully delivered LINES' }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveSaleOrderDto.prototype, "soDeliveredItems", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soTotWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soTotBags", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soItemDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soSplDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soBillSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAddlDisc1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAddlDisc2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCashDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCashDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'POST-charge taxable value' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Roll-up of applied freight charge lines' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soFreightAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Roll-up of applied loading charge lines' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soLoadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Roll-up of applied unloading charge lines' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soUnloadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soOtherAmt1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soOtherAmt2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The order value' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soOrderAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Never printed; drives margin reports' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soTotalCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soMarginAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Margin without tax' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soMarginAmtWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soMarginPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soMarginPercWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soMrpSavings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soMrpSavingsPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 10,
        nullable: true,
        description: "NONE / FIXED / PERC / FULL — defaults to 'NONE'. PERC needs soAdvancePerc > 0, " +
            'FIXED needs soAdvanceRequired > 0 (ck_so_advance_policy_input)',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(10),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAdvancePolicy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAdvancePerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAdvanceRequired", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAdvanceDueDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderDto.prototype, "soIsAdvanceMandatory", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Customer-advance liability ledger (accounts.acc_ledger_master)',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAdvanceLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Roll-up cache from accounts.acc_tender_detail' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAdvanceRecdAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Advance set against invoices — stated by the caller' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAdvanceAdjustedAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Advance paid back — stated by the caller' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAdvanceRefundAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Advance kept on cancellation — stated by the caller' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAdvanceForfeitAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'What the company still HOLDS = received − adjusted − refunded − forfeited ' +
            '(ck_so_advance_balance); when omitted it is derived from the other four',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAdvanceBalanceAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: 'NONE / PENDING / PARTIAL / RECEIVED / ADJUSTED / REFUNDED / FORFEITED — ' +
            "defaults to 'NONE'",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAdvanceStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'First instalment received on',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soAdvanceRecdOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: 'Dominant tender mode, for quick filters',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soPayMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soSurchargeAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soTenderAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soRefundAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: "UNPAID / PARTIAL / PAID — defaults to 'UNPAID'",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soPayStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Fulfilment cache — sale_bill is the truth' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soBilledAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Fulfilment cache' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCancelledAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Fulfilment cache' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soPendingAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: "PENDING / PARTIAL / COMPLETED / CANCELLED — defaults to 'PENDING'",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soFulfilStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soLastBilledOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Last line delivered',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCompletedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soPaymentTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soDeliveryTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Free text, no length limit' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soTermsConditions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'fixed',
        description: 'How the freight charge is computed (snapshot of the charge master method)',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(12),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soFreightCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'fixed',
        description: 'How the loading charge is computed (snapshot of the charge master method)',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(12),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soLoadingCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'true = discounts change the basis the charges are computed on',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soDiscAlterBase", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soRoundOffStep", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: 'DRAFT / CONFIRMED / PARTIAL / COMPLETED / CANCELLED / CLOSED / EXPIRED — ' +
            "defaults to 'DRAFT'. The status TRAIL lives in public.txn_status_log; this " +
            'column is the current state only.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveSaleOrderDto.prototype, "soVersionNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveSaleOrderDto.prototype, "soPrintCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveSaleOrderDto.prototype, "soModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_sale_order_item_dto_1.SaveSaleOrderItemDto,
        isArray: true,
        description: 'Order line items. On update, lines with soiId are updated, lines without are created, ' +
            'and existing lines omitted from the array are soft deleted. Omit the property entirely ' +
            'to leave lines untouched.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_sale_order_item_dto_1.SaveSaleOrderItemDto),
    __metadata("design:type", Array)
], SaveSaleOrderDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_charge_detail_dto_1.SaveChargeDetailDto,
        isArray: true,
        description: "Applied charge lines, the charge-detail module's own entry (txn_charge_detail). Reconciled " +
            'exactly like items: lines with cdId are updated, lines without are created, and existing lines ' +
            'omitted from the array are soft deleted. Omit the property entirely to leave charges untouched. ' +
            'cdChgId and cdLedgerCode are required on a new line; cdDocType / cdDocId are the parent order ' +
            '(ORDER / soId) and must be omitted or match it, and cdCompId / cdBranchId / cdAccYear / ' +
            "cdVoucherNo default to the order's own scope.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_charge_detail_dto_1.SaveChargeDetailDto),
    __metadata("design:type", Array)
], SaveSaleOrderDto.prototype, "charges", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_tender_detail_dto_1.SaveTenderDetailDto,
        isArray: true,
        description: "Tendered amounts, the tender-detail module's own entry (acc_tender_detail): the advance " +
            'money the customer actually handed over, one line per tender (cash, card, UPI, …). ' +
            'Reconciled exactly like items: lines with tdId are updated, lines without are created, and ' +
            'existing lines omitted from the array are soft deleted. Omit the property entirely to leave ' +
            'tenders untouched. tdTenderId is required on a new line; the document triple (tdSrcModule / ' +
            'tdSrcDocType / tdSrcDocId) is this order (SALES / SALES_ORDER / soId) and must be omitted or ' +
            'match it, and tdCompanyId / tdBranchId / tdTenantId / tdAccYear / tdDocDate / tdPartyLedgerId ' +
            "/ tdUserId / tdSessionId / tdDeviceId / tdDrCr all default to the order's own scope.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_tender_detail_dto_1.SaveTenderDetailDto),
    __metadata("design:type", Array)
], SaveSaleOrderDto.prototype, "tenders", void 0);
//# sourceMappingURL=save-sale-order.dto.js.map