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
exports.DELIVERY_QTY_PATTERN = exports.DeliveryExceptionsQueryDto = exports.DeliveryModeDto = exports.DeliveryLotsQueryDto = exports.OpenLinesDto = exports.OpenLinesBillDto = exports.DeliveryScanQueryDto = exports.DeliveryNoteGetQueryDto = exports.GoodsBackDto = exports.GoodsBackLineDto = exports.CancelDeliveryNoteDto = exports.DeliveryNoteKeysDto = exports.PostDeliveryNoteDto = exports.ValidateDeliveryNoteDto = exports.SaveDeliveryNoteDto = exports.DeliveryNoteTransportDto = exports.DeliveryNoteLineDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const delivery_constants_1 = require("../core/delivery.constants");
const QTY_PATTERN = /^-?\d{1,11}(\.\d{1,3})?$/;
const QtyValue = () => (0, class_transformer_1.Transform)(({ value }) => typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : value);
const UpperTrim = () => (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value);
class DeliveryNoteLineDto {
    sdniId;
    billId;
    billAccYear;
    billItemId;
    godownId;
    lotId;
    qty;
    scannedQty;
    otherGodownOk;
    remarks;
}
exports.DeliveryNoteLineDto = DeliveryNoteLineDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The line id. Send your own uuidv7 on a new line so a re-sent save finds it; omit = new line.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], DeliveryNoteLineDto.prototype, "sdniId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The bill (sb_id)' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryNoteLineDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DeliveryNoteLineDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The bill line (sbi_id)' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryNoteLineDto.prototype, "billItemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "The giving godown — must be the note's (one note = one godown). Omitted = the note's. " +
            "A line billed from another godown needs the Override right (DN_GODOWN_RIGHT / DN_OTHER_GODOWN).",
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], DeliveryNoteLineDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: "The lot given. Omitted / null = the bill line's lot. Another lot → a lot swap at post (DN_LOT_SWAP).",
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], DeliveryNoteLineDto.prototype, "lotId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: 'string',
        example: '20',
        description: 'Give now, in the bill line\'s unit (≥ 0; 0 keeps the line on a draft). Decimal string or number.',
    }),
    QtyValue(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DeliveryNoteLineDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', description: 'How many of qty came by scanner' }),
    (0, class_validator_1.IsOptional)(),
    QtyValue(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DeliveryNoteLineDto.prototype, "scannedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'The keeper ticked the other-godown confirmation for this line (logged in sdn_overrides).',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], DeliveryNoteLineDto.prototype, "otherGodownOk", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(200),
    __metadata("design:type", Object)
], DeliveryNoteLineDto.prototype, "remarks", void 0);
class DeliveryNoteTransportDto {
    transporterId;
    transporterName;
    lrNo;
    lrDate;
}
exports.DeliveryNoteTransportDto = DeliveryNoteTransportDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], DeliveryNoteTransportDto.prototype, "transporterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], DeliveryNoteTransportDto.prototype, "transporterName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], DeliveryNoteTransportDto.prototype, "lrNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], DeliveryNoteTransportDto.prototype, "lrDate", void 0);
class SaveDeliveryNoteDto {
    companyId;
    branchId;
    accYear;
    deviceId;
    sdnId;
    baseRevision;
    sdnGodownId;
    sdnMode;
    sdnVehicleId;
    sdnVehicleNo;
    sdnDriverId;
    sdnLoadmanIds;
    sdnSupervisorId;
    sdnCollectedBy;
    sdnCollectorPhone;
    transport;
    sdnRemarks;
    lines;
}
exports.SaveDeliveryNoteDto = SaveDeliveryNoteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDeliveryNoteDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDeliveryNoteDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveDeliveryNoteDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'A registered device (fixed.device_master): the note is numbered per device, DN/<year>/<device>/00001.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDeliveryNoteDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Omit on a new note, or send your own uuidv7 so a re-sent first save finds the same note.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveDeliveryNoteDto.prototype, "sdnId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'The sdnRevisionNo you loaded. A newer draft → 409 DN_REVISION_STALE. Omit on a new note.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], SaveDeliveryNoteDto.prototype, "baseRevision", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The godown the goods leave from (422 DN_GODOWN_REQUIRED when missing).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveDeliveryNoteDto.prototype, "sdnGodownId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: delivery_constants_1.DELIVERY_NOTE_MODES, default: 'SELF' }),
    UpperTrim(),
    (0, class_validator_1.IsIn)(delivery_constants_1.DELIVERY_NOTE_MODES),
    __metadata("design:type", String)
], SaveDeliveryNoteDto.prototype, "sdnMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryNoteDto.prototype, "sdnVehicleId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDeliveryNoteDto.prototype, "sdnVehicleNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryNoteDto.prototype, "sdnDriverId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], description: 'Loadmen (employee ids)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], SaveDeliveryNoteDto.prototype, "sdnLoadmanIds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryNoteDto.prototype, "sdnSupervisorId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true, description: 'Self pickup: who took the goods' }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDeliveryNoteDto.prototype, "sdnCollectedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDeliveryNoteDto.prototype, "sdnCollectorPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: DeliveryNoteTransportDto, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DeliveryNoteTransportDto),
    __metadata("design:type", Object)
], SaveDeliveryNoteDto.prototype, "transport", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveDeliveryNoteDto.prototype, "sdnRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [DeliveryNoteLineDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DeliveryNoteLineDto),
    __metadata("design:type", Array)
], SaveDeliveryNoteDto.prototype, "lines", void 0);
class ValidateDeliveryNoteDto extends SaveDeliveryNoteDto {
    overrideWarnings;
}
exports.ValidateDeliveryNoteDto = ValidateDeliveryNoteDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], description: 'WARN codes already ticked (affects nothing on validate)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ValidateDeliveryNoteDto.prototype, "overrideWarnings", void 0);
class PostDeliveryNoteDto extends SaveDeliveryNoteDto {
    overrideWarnings;
}
exports.PostDeliveryNoteDto = PostDeliveryNoteDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        description: 'WARN codes ticked: DN_OTHER_GODOWN, DN_OVER_SHELF, DN_VEHICLE_OVERLOAD. A raised WARN missing here → 409 DN_WARN_NOT_CONFIRMED.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PostDeliveryNoteDto.prototype, "overrideWarnings", void 0);
class DeliveryNoteKeysDto {
    companyId;
    branchId;
    accYear;
    sdnId;
}
exports.DeliveryNoteKeysDto = DeliveryNoteKeysDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryNoteKeysDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryNoteKeysDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DeliveryNoteKeysDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryNoteKeysDto.prototype, "sdnId", void 0);
class CancelDeliveryNoteDto extends DeliveryNoteKeysDto {
    reason;
}
exports.CancelDeliveryNoteDto = CancelDeliveryNoteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, description: 'Why (422 DN_CANCEL_REASON_REQUIRED when blank)' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CancelDeliveryNoteDto.prototype, "reason", void 0);
class GoodsBackLineDto {
    sdniId;
    qty;
    sdeId;
}
exports.GoodsBackLineDto = GoodsBackLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The note line (sdniId)' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GoodsBackLineDto.prototype, "sdniId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'string', example: '5', description: 'Came back, in the line unit (> 0)' }),
    QtyValue(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], GoodsBackLineDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Your uuidv7 for this event (decision 69): a re-sent request whose id exists writes nothing.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GoodsBackLineDto.prototype, "sdeId", void 0);
class GoodsBackDto extends DeliveryNoteKeysDto {
    reason;
    lines;
}
exports.GoodsBackDto = GoodsBackDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, description: 'Why the goods came back (422 DN_GOODS_BACK_REASON_REQUIRED)' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GoodsBackDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [GoodsBackLineDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => GoodsBackLineDto),
    __metadata("design:type", Array)
], GoodsBackDto.prototype, "lines", void 0);
class DeliveryNoteGetQueryDto extends DeliveryNoteKeysDto {
}
exports.DeliveryNoteGetQueryDto = DeliveryNoteGetQueryDto;
class DeliveryScanQueryDto {
    companyId;
    branchId;
    godownId;
    code;
}
exports.DeliveryScanQueryDto = DeliveryScanQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryScanQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryScanQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: "The note's godown (whose open lines come in)" }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryScanQueryDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'A bill QR (NXB1-…), a gate-pass QR (NXD1-…), or a typed bill no' }),
    (0, dtoDecorators_1.TrimmedString)(60),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DeliveryScanQueryDto.prototype, "code", void 0);
class OpenLinesBillDto {
    billId;
    billAccYear;
}
exports.OpenLinesBillDto = OpenLinesBillDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OpenLinesBillDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], OpenLinesBillDto.prototype, "billAccYear", void 0);
class OpenLinesDto {
    companyId;
    branchId;
    godownId;
    bills;
}
exports.OpenLinesDto = OpenLinesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OpenLinesDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OpenLinesDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OpenLinesDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [OpenLinesBillDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => OpenLinesBillDto),
    __metadata("design:type", Array)
], OpenLinesDto.prototype, "bills", void 0);
class DeliveryLotsQueryDto {
    companyId;
    branchId;
    godownId;
    itemId;
    bucket;
}
exports.DeliveryLotsQueryDto = DeliveryLotsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryLotsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryLotsQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryLotsQueryDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryLotsQueryDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'SALEABLE' }),
    (0, class_validator_1.IsOptional)(),
    UpperTrim(),
    (0, class_validator_1.IsIn)(['SALEABLE', 'DAMAGED', 'QUARANTINE', 'EXPIRED', 'SAMPLE']),
    __metadata("design:type", String)
], DeliveryLotsQueryDto.prototype, "bucket", void 0);
class DeliveryModeDto {
    companyId;
    branchId;
    accYear;
    sbId;
    sbDeliveryMode;
    reason;
}
exports.DeliveryModeDto = DeliveryModeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryModeDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryModeDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DeliveryModeDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryModeDto.prototype, "sbId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['PICKUP', 'DISPATCH'], description: '422 DELIVERY_MODE_INVALID for anything else' }),
    UpperTrim(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DeliveryModeDto.prototype, "sbDeliveryMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, description: '422 DELIVERY_MODE_REASON_REQUIRED when blank' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DeliveryModeDto.prototype, "reason", void 0);
class DeliveryExceptionsQueryDto {
    companyId;
    branchId;
}
exports.DeliveryExceptionsQueryDto = DeliveryExceptionsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryExceptionsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryExceptionsQueryDto.prototype, "branchId", void 0);
exports.DELIVERY_QTY_PATTERN = QTY_PATTERN;
//# sourceMappingURL=delivery-note.dto.js.map