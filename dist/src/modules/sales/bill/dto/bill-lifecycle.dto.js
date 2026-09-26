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
exports.RetenderBillDto = exports.RetenderVoidDto = exports.VOID_REASONS = exports.BillTransportDto = exports.TransportBandDto = exports.TRANSPORT_DIRECTIONS = exports.TransportEndDto = exports.UpdateRemarksDto = exports.DeliveryStatusDto = exports.DELIVERY_EVENTS = exports.DeleteBillDto = exports.AmendBillDto = exports.CancelBillDto = exports.PostBillDto = exports.ValidateBillDto = exports.BillKeysDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_tender_detail_dto_1 = require("../../../accountsModule/tenderDetail/dto/save-tender-detail.dto");
const save_bill_adjustment_dto_1 = require("./save-bill-adjustment.dto");
const save_bill_dto_1 = require("./save-bill.dto");
class BillKeysDto {
    sbId;
    sbCompanyId;
    sbBranchId;
    sbAccYear;
}
exports.BillKeysDto = BillKeysDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], BillKeysDto.prototype, "sbId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], BillKeysDto.prototype, "sbCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], BillKeysDto.prototype, "sbBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9, example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BillKeysDto.prototype, "sbAccYear", void 0);
const OverridesList = () => [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.ArrayMaxSize)(50), (0, class_validator_1.IsString)({ each: true })];
class ValidateBillDto extends save_bill_dto_1.SaveBillDto {
    overrides;
}
exports.ValidateBillDto = ValidateBillDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        description: 'WARN codes the operator overrides (needs um_can_override)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ValidateBillDto.prototype, "overrides", void 0);
class PostBillDto extends BillKeysDto {
    overrides;
    printAfter;
    adjustments;
}
exports.PostBillDto = PostBillDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PostBillDto.prototype, "overrides", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], PostBillDto.prototype, "printAfter", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_bill_adjustment_dto_1.SaveBillAdjustmentDto,
        isArray: true,
        description: 'The credits to set off against this bill. Omitted → the server applies the party’s open ' +
            'advances (the bill’s own order first) and credit notes FIFO up to sbAdvanceAmt.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_bill_adjustment_dto_1.SaveBillAdjustmentDto),
    __metadata("design:type", Array)
], PostBillDto.prototype, "adjustments", void 0);
class CancelBillDto extends BillKeysDto {
    reason;
}
exports.CancelBillDto = CancelBillDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CancelBillDto.prototype, "reason", void 0);
class AmendBillDto extends ValidateBillDto {
    baseRevision;
    editRemark;
    printAfter;
}
exports.AmendBillDto = AmendBillDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Required on amend — the POSTED bill' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], AmendBillDto.prototype, "sbId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The sbRevisionNo the client loaded — the optimistic lock' }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], AmendBillDto.prototype, "baseRevision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AmendBillDto.prototype, "editRemark", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], AmendBillDto.prototype, "printAfter", void 0);
class DeleteBillDto extends BillKeysDto {
}
exports.DeleteBillDto = DeleteBillDto;
exports.DELIVERY_EVENTS = ['VERIFIED', 'PACKED', 'DISPATCHED', 'DELIVERED'];
class DeliveryStatusDto extends BillKeysDto {
    event;
    remarks;
    vehicleNo;
    lrNo;
}
exports.DeliveryStatusDto = DeliveryStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.DELIVERY_EVENTS }),
    (0, class_validator_1.IsIn)(exports.DELIVERY_EVENTS),
    __metadata("design:type", String)
], DeliveryStatusDto.prototype, "event", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], DeliveryStatusDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], DeliveryStatusDto.prototype, "vehicleNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], DeliveryStatusDto.prototype, "lrNo", void 0);
class UpdateRemarksDto extends BillKeysDto {
    sbRemarks;
    editRemark;
}
exports.UpdateRemarksDto = UpdateRemarksDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], UpdateRemarksDto.prototype, "sbRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateRemarksDto.prototype, "editRemark", void 0);
class TransportEndDto {
    godownId;
    branchId;
    addrId;
    name;
    addr;
    place;
    pin;
    phone;
    stcd;
    gstin;
}
exports.TransportEndDto = TransportEndDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], TransportEndDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], TransportEndDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'accounts.acc_ship_addrs.saa_id',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], TransportEndDto.prototype, "addrId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(200),
    __metadata("design:type", Object)
], TransportEndDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], TransportEndDto.prototype, "addr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], TransportEndDto.prototype, "place", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(10),
    __metadata("design:type", Object)
], TransportEndDto.prototype, "pin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], TransportEndDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 2, maxLength: 2, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(2),
    __metadata("design:type", Object)
], TransportEndDto.prototype, "stcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], TransportEndDto.prototype, "gstin", void 0);
exports.TRANSPORT_DIRECTIONS = ['OUTWARD', 'INWARD'];
class TransportBandDto {
    direction;
    from;
    to;
    mode;
    transporterId;
    transporterName;
    transporterGstin;
    lrNo;
    lrDate;
    distanceKm;
    remarks;
}
exports.TransportBandDto = TransportBandDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.TRANSPORT_DIRECTIONS }),
    (0, class_validator_1.IsIn)(exports.TRANSPORT_DIRECTIONS),
    __metadata("design:type", String)
], TransportBandDto.prototype, "direction", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: TransportEndDto, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => TransportEndDto),
    __metadata("design:type", Object)
], TransportBandDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: TransportEndDto, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => TransportEndDto),
    __metadata("design:type", Object)
], TransportBandDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true, description: 'ROAD | RAIL | AIR | SHIP' }),
    (0, dtoDecorators_1.NullableStringStrict)(10),
    __metadata("design:type", Object)
], TransportBandDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], TransportBandDto.prototype, "transporterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(200),
    __metadata("design:type", Object)
], TransportBandDto.prototype, "transporterName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], TransportBandDto.prototype, "transporterGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], TransportBandDto.prototype, "lrNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], TransportBandDto.prototype, "lrDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(0),
    __metadata("design:type", Object)
], TransportBandDto.prototype, "distanceKm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], TransportBandDto.prototype, "remarks", void 0);
class BillTransportDto extends BillKeysDto {
    transport;
}
exports.BillTransportDto = BillTransportDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: TransportBandDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => TransportBandDto),
    __metadata("design:type", TransportBandDto)
], BillTransportDto.prototype, "transport", void 0);
exports.VOID_REASONS = [
    'UPI_FAILED',
    'CARD_DECLINED',
    'CHEQUE_REFUSED',
    'KEYED_WRONG',
    'CUSTOMER_CHANGED',
    'OTHER',
];
class RetenderVoidDto {
    tdId;
    reason;
}
exports.RetenderVoidDto = RetenderVoidDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The acc_tender_detail row that did not happen' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], RetenderVoidDto.prototype, "tdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.VOID_REASONS }),
    (0, class_validator_1.IsIn)(exports.VOID_REASONS),
    __metadata("design:type", Object)
], RetenderVoidDto.prototype, "reason", void 0);
class RetenderBillDto extends BillKeysDto {
    voids;
    tenders;
    remark;
}
exports.RetenderBillDto = RetenderBillDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: RetenderVoidDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => RetenderVoidDto),
    __metadata("design:type", Array)
], RetenderBillDto.prototype, "voids", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: save_tender_detail_dto_1.SaveTenderDetailDto, isArray: true, description: 'What really happened' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_tender_detail_dto_1.SaveTenderDetailDto),
    __metadata("design:type", Array)
], RetenderBillDto.prototype, "tenders", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RetenderBillDto.prototype, "remark", void 0);
void OverridesList;
//# sourceMappingURL=bill-lifecycle.dto.js.map