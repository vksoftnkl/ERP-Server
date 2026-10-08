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
exports.SR_SERVER_OWNED = exports.SR_DATE_FIELDS = exports.SR_OPTIONAL_FIELDS = exports.SaveSaleReturnDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_charge_detail_dto_1 = require("../../../master/charge-detail/dto/save-charge-detail.dto");
const save_tender_detail_dto_1 = require("../../../accountsModule/tenderDetail/dto/save-tender-detail.dto");
const bill_lifecycle_dto_1 = require("../../bill/dto/bill-lifecycle.dto");
const save_sale_return_item_dto_1 = require("./save-sale-return-item.dto");
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
class SaveSaleReturnDto {
    srId;
    srCompanyId;
    srBranchId;
    srTenantId;
    srAccYear;
    srSessionId;
    srCounterId;
    srDeviceType;
    srDeviceId;
    srDocType;
    srBillMode;
    srReturnSlno;
    srReturnRefno;
    srUsrRefno;
    srUsrRefdate;
    srReturnDate;
    srReturnDatetime;
    srIsAgainstBill;
    srBillId;
    srBillAccYear;
    srBillRefno;
    srBillDate;
    srReasonId;
    srReturnReason;
    srCustId;
    srCustName;
    srCustAddr;
    srCustPlace;
    srCustPin;
    srCustPhone;
    srCustGstin;
    srCustGstType;
    srCustStcd;
    srPosStcd;
    srStateName;
    srPriceLevel;
    srUserId;
    srSalesmanId;
    srTotItems;
    srTotWeight;
    srGrossAmt;
    srDiscAmt;
    srTaxableAmt;
    srCgstAmt;
    srSgstAmt;
    srIgstAmt;
    srCessAmt;
    srTaxAmt;
    srOtherAmt;
    srRoundOff;
    srReturnAmt;
    srTotalCost;
    srSettleMode;
    srRefundAmt;
    srAdjustedAmt;
    srCreditAmt;
    srSettleStatus;
    srLoyaltyReversePoints;
    srPromoClawbackAmt;
    srHasLoad;
    srHasUnload;
    srHasFreight;
    srHasPromo;
    srHasLoyalty;
    srAgentId;
    srAgentCommAmt;
    srDriverId;
    srSupervisorId;
    srLoadmanId;
    srVehicleId;
    srVehicleNo;
    srTotBags;
    srItemDisc;
    srSplDisc;
    srSchDisc;
    srBillSchDisc;
    srCashDisc;
    srFreightAmt;
    srLoadAmt;
    srUnloadAmt;
    srDiscAlterBase;
    srRoundOffStep;
    srRemarks;
    srStatus;
    srPostedVoucherId;
    srRevisionNo;
    srPrintCount;
    srCreatedBy;
    srModifiedBy;
    items;
    charges;
    tenders;
    transport;
}
exports.SaveSaleReturnDto = SaveSaleReturnDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, updates the existing DRAFT (uuidv7 minted by the client is accepted)',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveSaleReturnDto.prototype, "srId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleReturnDto.prototype, "srCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleReturnDto.prototype, "srBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveSaleReturnDto.prototype, "srAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srCounterId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20 }),
    (0, dtoDecorators_1.TrimmedString)(20),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveSaleReturnDto.prototype, "srDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({}),
    (0, dtoDecorators_1.TrimmedString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveSaleReturnDto.prototype, "srDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(10),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srBillMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srReturnSlno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        readOnly: true,
        description: 'Ignored — server-owned',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srReturnRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srUsrRefdate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srReturnDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srReturnDatetime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleReturnDto.prototype, "srIsAgainstBill", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srBillId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 9, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srBillAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srBillRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srBillDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srReasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srReturnReason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleReturnDto.prototype, "srCustId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveSaleReturnDto.prototype, "srCustName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srCustAddr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srCustPlace", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(10),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srCustPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srCustPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srCustGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srCustGstType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 2, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srCustStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 2, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srPosStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleReturnDto.prototype, "srUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    NullableUuidArray(),
    __metadata("design:type", Array)
], SaveSaleReturnDto.prototype, "srSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srTotItems", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srTotWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srOtherAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srReturnAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srTotalCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(10),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srSettleMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srRefundAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srAdjustedAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srCreditAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        readOnly: true,
        description: 'Ignored — server-owned',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srSettleStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srLoyaltyReversePoints", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srPromoClawbackAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleReturnDto.prototype, "srHasLoad", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleReturnDto.prototype, "srHasUnload", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleReturnDto.prototype, "srHasFreight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleReturnDto.prototype, "srHasPromo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleReturnDto.prototype, "srHasLoyalty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srAgentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srAgentCommAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srDriverId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srSupervisorId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    NullableUuidArray(),
    __metadata("design:type", Array)
], SaveSaleReturnDto.prototype, "srLoadmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srVehicleId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srVehicleNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srTotBags", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srItemDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srSplDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srBillSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srCashDisc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srFreightAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srLoadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srUnloadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleReturnDto.prototype, "srDiscAlterBase", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srRoundOffStep", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        readOnly: true,
        description: 'Ignored — server-owned',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        readOnly: true,
        description: 'Ignored — server-owned',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srPostedVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srRevisionNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srPrintCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveSaleReturnDto.prototype, "srModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: save_sale_return_item_dto_1.SaveSaleReturnItemDto, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_sale_return_item_dto_1.SaveSaleReturnItemDto),
    __metadata("design:type", Array)
], SaveSaleReturnDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: save_charge_detail_dto_1.SaveChargeDetailDto, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_charge_detail_dto_1.SaveChargeDetailDto),
    __metadata("design:type", Array)
], SaveSaleReturnDto.prototype, "charges", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: save_tender_detail_dto_1.SaveTenderDetailDto, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_tender_detail_dto_1.SaveTenderDetailDto),
    __metadata("design:type", Array)
], SaveSaleReturnDto.prototype, "tenders", void 0);
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
], SaveSaleReturnDto.prototype, "transport", void 0);
exports.SR_OPTIONAL_FIELDS = [
    'srTenantId',
    'srSessionId',
    'srCounterId',
    'srDocType',
    'srBillMode',
    'srUsrRefno',
    'srUsrRefdate',
    'srReturnDate',
    'srReturnDatetime',
    'srIsAgainstBill',
    'srBillId',
    'srBillAccYear',
    'srBillRefno',
    'srBillDate',
    'srReasonId',
    'srReturnReason',
    'srCustAddr',
    'srCustPlace',
    'srCustPin',
    'srCustPhone',
    'srCustGstin',
    'srCustGstType',
    'srCustStcd',
    'srPosStcd',
    'srStateName',
    'srPriceLevel',
    'srSalesmanId',
    'srTotItems',
    'srTotWeight',
    'srGrossAmt',
    'srDiscAmt',
    'srTaxableAmt',
    'srCgstAmt',
    'srSgstAmt',
    'srIgstAmt',
    'srCessAmt',
    'srTaxAmt',
    'srOtherAmt',
    'srRoundOff',
    'srReturnAmt',
    'srTotalCost',
    'srSettleMode',
    'srHasLoad',
    'srHasUnload',
    'srHasFreight',
    'srHasPromo',
    'srHasLoyalty',
    'srAgentId',
    'srAgentCommAmt',
    'srDriverId',
    'srSupervisorId',
    'srLoadmanId',
    'srVehicleId',
    'srVehicleNo',
    'srTotBags',
    'srItemDisc',
    'srSplDisc',
    'srSchDisc',
    'srBillSchDisc',
    'srCashDisc',
    'srFreightAmt',
    'srLoadAmt',
    'srUnloadAmt',
    'srDiscAlterBase',
    'srRoundOffStep',
    'srRemarks',
    'srCreatedBy',
    'srModifiedBy',
];
exports.SR_DATE_FIELDS = [
    'srUsrRefdate',
    'srReturnDate',
    'srReturnDatetime',
    'srBillDate',
];
exports.SR_SERVER_OWNED = [
    'srReturnSlno',
    'srReturnRefno',
    'srRefundAmt',
    'srAdjustedAmt',
    'srCreditAmt',
    'srSettleStatus',
    'srLoyaltyReversePoints',
    'srPromoClawbackAmt',
    'srStatus',
    'srPostedVoucherId',
    'srRevisionNo',
    'srPrintCount',
];
//# sourceMappingURL=save-sale-return.dto.js.map