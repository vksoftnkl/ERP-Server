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
exports.SDC_SERVER_OWNED = exports.SDC_DATE_FIELDS = exports.SDC_OPTIONAL_FIELDS = exports.SaveDeliveryChallanDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_charge_detail_dto_1 = require("../../../master/charge-detail/dto/save-charge-detail.dto");
const save_tender_detail_dto_1 = require("../../../accountsModule/tenderDetail/dto/save-tender-detail.dto");
const bill_lifecycle_dto_1 = require("../../bill/dto/bill-lifecycle.dto");
const save_delivery_challan_item_dto_1 = require("./save-delivery-challan-item.dto");
const toUuidArray = (value) => {
    if (value === undefined)
        return undefined;
    if (value === null || value === '')
        return [];
    if (Array.isArray(value))
        return value.map((e) => (typeof e === 'string' ? e.trim() : String(e)));
    if (typeof value === 'string')
        return value
            .split(',')
            .map((e) => e.trim())
            .filter((e) => e.length > 0);
    return value;
};
const NullableUuidArray = () => (0, common_1.applyDecorators)((0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(({ value }) => toUuidArray(value)), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsUUID)('all', { each: true }));
class SaveDeliveryChallanDto {
    sdcId;
    sdcCompanyId;
    sdcBranchId;
    sdcTenantId;
    sdcAccYear;
    sdcSessionId;
    sdcCounterId;
    sdcDeviceType;
    sdcDeviceId;
    sdcDocType;
    sdcPurpose;
    sdcDcSlno;
    sdcDcRefno;
    sdcUsrRefno;
    sdcUsrRefdate;
    sdcDcDate;
    sdcDcDatetime;
    sdcPriceLevel;
    sdcSrcDocType;
    sdcSrcDocId;
    sdcSrcDocAccYear;
    sdcSrcDocRefno;
    sdcSrcDocDate;
    sdcCustId;
    sdcCustName;
    sdcCustAddr;
    sdcCustPlace;
    sdcCustPin;
    sdcCustPhone;
    sdcCustGstin;
    sdcCustGstType;
    sdcCustStcd;
    sdcPosStcd;
    sdcStateName;
    sdcDriverId;
    sdcSupervisorId;
    sdcLoadmanId;
    sdcVehicleId;
    sdcVehicleNo;
    sdcUserId;
    sdcSalesmanId;
    sdcAgentId;
    sdcTotItems;
    sdcTotWeight;
    sdcTotBags;
    sdcGrossAmt;
    sdcDiscAmt;
    sdcTaxableAmt;
    sdcCgstAmt;
    sdcSgstAmt;
    sdcIgstAmt;
    sdcCessAmt;
    sdcTaxAmt;
    sdcOtherAmt;
    sdcRoundOff;
    sdcDcAmt;
    sdcTotalCost;
    sdcBilledAmt;
    sdcReturnedAmt;
    sdcFulfilStatus;
    sdcHasLoad;
    sdcHasUnload;
    sdcHasFreight;
    sdcHasPromo;
    sdcPackedId;
    sdcItemDisc;
    sdcSplDisc;
    sdcSchDisc;
    sdcFreightAmt;
    sdcLoadAmt;
    sdcUnloadAmt;
    sdcFreightCalcType;
    sdcLoadingCalcType;
    sdcDiscAlterBase;
    sdcRoundOffStep;
    sdcPaymentTerms;
    sdcDeliveryTerms;
    sdcRemarks;
    sdcStatus;
    sdcPostedVoucherId;
    sdcRevisionNo;
    sdcPrintCount;
    sdcCreatedBy;
    sdcModifiedBy;
    items;
    charges;
    tenders;
    transport;
}
exports.SaveDeliveryChallanDto = SaveDeliveryChallanDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, updates the existing DRAFT (uuidv7 minted by the client is accepted)',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveDeliveryChallanDto.prototype, "sdcId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDeliveryChallanDto.prototype, "sdcCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDeliveryChallanDto.prototype, "sdcBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveDeliveryChallanDto.prototype, "sdcAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcCounterId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20 }),
    (0, dtoDecorators_1.TrimmedString)(20),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveDeliveryChallanDto.prototype, "sdcDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({}),
    (0, dtoDecorators_1.TrimmedString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveDeliveryChallanDto.prototype, "sdcDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcPurpose", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcDcSlno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        readOnly: true,
        description: 'Ignored — server-owned',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcDcRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcUsrRefdate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcDcDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcDcDatetime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 9, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcSrcDocAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcSrcDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcSrcDocDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDeliveryChallanDto.prototype, "sdcCustId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveDeliveryChallanDto.prototype, "sdcCustName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcCustAddr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcCustPlace", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(10),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcCustPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcCustPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcCustGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcCustGstType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 2, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcCustStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 2, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcPosStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcDriverId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcSupervisorId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    NullableUuidArray(),
    __metadata("design:type", Array)
], SaveDeliveryChallanDto.prototype, "sdcLoadmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcVehicleId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcVehicleNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDeliveryChallanDto.prototype, "sdcUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    NullableUuidArray(),
    __metadata("design:type", Array)
], SaveDeliveryChallanDto.prototype, "sdcSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcAgentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcTotItems", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcTotWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcTotBags", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcOtherAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcDcAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcTotalCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcBilledAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcReturnedAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        readOnly: true,
        description: 'Ignored — server-owned',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcFulfilStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDeliveryChallanDto.prototype, "sdcHasLoad", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDeliveryChallanDto.prototype, "sdcHasUnload", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDeliveryChallanDto.prototype, "sdcHasFreight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDeliveryChallanDto.prototype, "sdcHasPromo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    NullableUuidArray(),
    __metadata("design:type", Array)
], SaveDeliveryChallanDto.prototype, "sdcPackedId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcItemDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcSplDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcFreightAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcLoadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcUnloadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 12, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(12),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcFreightCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 12, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(12),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcLoadingCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDeliveryChallanDto.prototype, "sdcDiscAlterBase", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcRoundOffStep", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcPaymentTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcDeliveryTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        readOnly: true,
        description: 'Ignored — server-owned',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        readOnly: true,
        description: 'Ignored — server-owned',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcPostedVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcRevisionNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcPrintCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "sdcModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: save_delivery_challan_item_dto_1.SaveDeliveryChallanItemDto, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_delivery_challan_item_dto_1.SaveDeliveryChallanItemDto),
    __metadata("design:type", Array)
], SaveDeliveryChallanDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: save_charge_detail_dto_1.SaveChargeDetailDto, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_charge_detail_dto_1.SaveChargeDetailDto),
    __metadata("design:type", Array)
], SaveDeliveryChallanDto.prototype, "charges", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: save_tender_detail_dto_1.SaveTenderDetailDto, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_tender_detail_dto_1.SaveTenderDetailDto),
    __metadata("design:type", Array)
], SaveDeliveryChallanDto.prototype, "tenders", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: bill_lifecycle_dto_1.TransportBandDto,
        nullable: true,
        description: 'The transport band, written to public.txn_transport_detail',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => bill_lifecycle_dto_1.TransportBandDto),
    __metadata("design:type", Object)
], SaveDeliveryChallanDto.prototype, "transport", void 0);
exports.SDC_OPTIONAL_FIELDS = [
    'sdcTenantId',
    'sdcSessionId',
    'sdcCounterId',
    'sdcDocType',
    'sdcPurpose',
    'sdcUsrRefno',
    'sdcUsrRefdate',
    'sdcDcDate',
    'sdcDcDatetime',
    'sdcPriceLevel',
    'sdcSrcDocType',
    'sdcSrcDocId',
    'sdcSrcDocAccYear',
    'sdcSrcDocRefno',
    'sdcSrcDocDate',
    'sdcCustAddr',
    'sdcCustPlace',
    'sdcCustPin',
    'sdcCustPhone',
    'sdcCustGstin',
    'sdcCustGstType',
    'sdcCustStcd',
    'sdcPosStcd',
    'sdcStateName',
    'sdcDriverId',
    'sdcSupervisorId',
    'sdcLoadmanId',
    'sdcVehicleId',
    'sdcVehicleNo',
    'sdcSalesmanId',
    'sdcAgentId',
    'sdcTotItems',
    'sdcTotWeight',
    'sdcTotBags',
    'sdcGrossAmt',
    'sdcDiscAmt',
    'sdcTaxableAmt',
    'sdcCgstAmt',
    'sdcSgstAmt',
    'sdcIgstAmt',
    'sdcCessAmt',
    'sdcTaxAmt',
    'sdcOtherAmt',
    'sdcRoundOff',
    'sdcDcAmt',
    'sdcTotalCost',
    'sdcHasLoad',
    'sdcHasUnload',
    'sdcHasFreight',
    'sdcHasPromo',
    'sdcPackedId',
    'sdcItemDisc',
    'sdcSplDisc',
    'sdcSchDisc',
    'sdcFreightAmt',
    'sdcLoadAmt',
    'sdcUnloadAmt',
    'sdcFreightCalcType',
    'sdcLoadingCalcType',
    'sdcDiscAlterBase',
    'sdcRoundOffStep',
    'sdcPaymentTerms',
    'sdcDeliveryTerms',
    'sdcRemarks',
    'sdcCreatedBy',
    'sdcModifiedBy',
];
exports.SDC_DATE_FIELDS = [
    'sdcUsrRefdate',
    'sdcDcDate',
    'sdcDcDatetime',
    'sdcSrcDocDate',
];
exports.SDC_SERVER_OWNED = [
    'sdcDcSlno',
    'sdcDcRefno',
    'sdcBilledAmt',
    'sdcReturnedAmt',
    'sdcFulfilStatus',
    'sdcStatus',
    'sdcPostedVoucherId',
    'sdcRevisionNo',
    'sdcPrintCount',
];
//# sourceMappingURL=save-delivery-challan.dto.js.map