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
exports.SDR_SERVER_OWNED = exports.SDR_DATE_FIELDS = exports.SDR_OPTIONAL_FIELDS = exports.SaveDcReturnDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_charge_detail_dto_1 = require("../../../master/charge-detail/dto/save-charge-detail.dto");
const save_tender_detail_dto_1 = require("../../../accountsModule/tenderDetail/dto/save-tender-detail.dto");
const bill_lifecycle_dto_1 = require("../../bill/dto/bill-lifecycle.dto");
const save_dc_return_item_dto_1 = require("./save-dc-return-item.dto");
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
class SaveDcReturnDto {
    sdrId;
    sdrCompanyId;
    sdrBranchId;
    sdrTenantId;
    sdrAccYear;
    sdrSessionId;
    sdrCounterId;
    sdrDeviceType;
    sdrDeviceId;
    sdrDocType;
    sdrReturnSlno;
    sdrReturnRefno;
    sdrUsrRefno;
    sdrUsrRefdate;
    sdrReturnDate;
    sdrReturnDatetime;
    sdrDcId;
    sdrDcAccYear;
    sdrDcRefno;
    sdrDcDate;
    sdrReasonId;
    sdrReturnReason;
    sdrCustId;
    sdrCustName;
    sdrCustGstin;
    sdrCustStcd;
    sdrPosStcd;
    sdrDriverId;
    sdrSupervisorId;
    sdrLoadmanId;
    sdrVehicleId;
    sdrVehicleNo;
    sdrUserId;
    sdrSalesmanId;
    sdrTotItems;
    sdrTotWeight;
    sdrGrossAmt;
    sdrTaxableAmt;
    sdrTaxAmt;
    sdrReturnAmt;
    sdrTotalCost;
    sdrRemarks;
    sdrStatus;
    sdrPostedVoucherId;
    sdrPrintCount;
    sdrCreatedBy;
    sdrModifiedBy;
    items;
    charges;
    tenders;
    transport;
}
exports.SaveDcReturnDto = SaveDcReturnDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, updates the existing DRAFT (uuidv7 minted by the client is accepted)',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveDcReturnDto.prototype, "sdrId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDcReturnDto.prototype, "sdrCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDcReturnDto.prototype, "sdrBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveDcReturnDto.prototype, "sdrAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrCounterId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20 }),
    (0, dtoDecorators_1.TrimmedString)(20),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveDcReturnDto.prototype, "sdrDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({}),
    (0, dtoDecorators_1.TrimmedString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveDcReturnDto.prototype, "sdrDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrReturnSlno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        readOnly: true,
        description: 'Ignored — server-owned',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrReturnRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrUsrRefdate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrReturnDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrReturnDatetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDcReturnDto.prototype, "sdrDcId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveDcReturnDto.prototype, "sdrDcAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrDcRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrDcDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrReasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrReturnReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrCustId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(200),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrCustName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrCustGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 2, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrCustStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 2, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrPosStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrDriverId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrSupervisorId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    NullableUuidArray(),
    __metadata("design:type", Array)
], SaveDcReturnDto.prototype, "sdrLoadmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrVehicleId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrVehicleNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDcReturnDto.prototype, "sdrUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    NullableUuidArray(),
    __metadata("design:type", Array)
], SaveDcReturnDto.prototype, "sdrSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrTotItems", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrTotWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrReturnAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrTotalCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        readOnly: true,
        description: 'Ignored — server-owned',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        readOnly: true,
        description: 'Ignored — server-owned',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrPostedVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrPrintCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveDcReturnDto.prototype, "sdrModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: save_dc_return_item_dto_1.SaveDcReturnItemDto, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_dc_return_item_dto_1.SaveDcReturnItemDto),
    __metadata("design:type", Array)
], SaveDcReturnDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: save_charge_detail_dto_1.SaveChargeDetailDto, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_charge_detail_dto_1.SaveChargeDetailDto),
    __metadata("design:type", Array)
], SaveDcReturnDto.prototype, "charges", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: save_tender_detail_dto_1.SaveTenderDetailDto, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_tender_detail_dto_1.SaveTenderDetailDto),
    __metadata("design:type", Array)
], SaveDcReturnDto.prototype, "tenders", void 0);
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
], SaveDcReturnDto.prototype, "transport", void 0);
exports.SDR_OPTIONAL_FIELDS = [
    'sdrTenantId',
    'sdrSessionId',
    'sdrCounterId',
    'sdrDocType',
    'sdrUsrRefno',
    'sdrUsrRefdate',
    'sdrReturnDate',
    'sdrReturnDatetime',
    'sdrDcRefno',
    'sdrDcDate',
    'sdrReasonId',
    'sdrReturnReason',
    'sdrCustId',
    'sdrCustName',
    'sdrCustGstin',
    'sdrCustStcd',
    'sdrPosStcd',
    'sdrDriverId',
    'sdrSupervisorId',
    'sdrLoadmanId',
    'sdrVehicleId',
    'sdrVehicleNo',
    'sdrSalesmanId',
    'sdrTotItems',
    'sdrTotWeight',
    'sdrGrossAmt',
    'sdrTaxableAmt',
    'sdrTaxAmt',
    'sdrReturnAmt',
    'sdrTotalCost',
    'sdrRemarks',
    'sdrCreatedBy',
    'sdrModifiedBy',
];
exports.SDR_DATE_FIELDS = [
    'sdrUsrRefdate',
    'sdrReturnDate',
    'sdrReturnDatetime',
    'sdrDcDate',
];
exports.SDR_SERVER_OWNED = [
    'sdrReturnSlno',
    'sdrReturnRefno',
    'sdrStatus',
    'sdrPostedVoucherId',
    'sdrPrintCount',
];
//# sourceMappingURL=save-dc-return.dto.js.map