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
exports.SaveTenderDetailDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const tender_detail_api_types_1 = require("../types/tender-detail-api.types");
class SaveTenderDetailDto {
    tdId;
    tdSrcModule;
    tdSrcDocType;
    tdSrcDocId;
    tdRowNo;
    tdCompanyId;
    tdBranchId;
    tdTenantId;
    tdAccYear;
    tdDocDate;
    tdPartyLedgerId;
    tdVoucherId;
    tdTenderId;
    tdTenderTypeId;
    tdTenderLedgerId;
    tdDrCr;
    tdAmount;
    tdSurchargePerc;
    tdSurchargeAmt;
    tdSurchargeLedgerId;
    tdTotalAmt;
    tdReceivedAmt;
    tdChangeAmt;
    tdUnitsUsed;
    tdConversionRate;
    tdRefNo;
    tdAuthCode;
    tdCardLast4;
    tdBankName;
    tdPayerVpa;
    tdInstrumentDate;
    tdIsPdc;
    tdSettleStatus;
    tdSettleLedgerId;
    tdExpectedSettleOn;
    tdSettledOn;
    tdSettleAmount;
    tdMdrAmt;
    tdSettleRefNo;
    tdSettleVoucherId;
    tdSessionId;
    tdDeviceId;
    tdUserId;
    tdNotes;
    tdCreatedBy;
    tdModifiedBy;
}
exports.SaveTenderDetailDto = SaveTenderDetailDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, updates that tender line; otherwise a new line is created',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: tender_detail_api_types_1.TenderSrcModule,
        enumName: 'TenderSrcModule',
        description: 'Module that raised the parent document. Required on create, immutable afterwards; ' +
            'inherited from the parent when tendered as part of a document save',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(20),
    (0, class_validator_1.IsEnum)(tender_detail_api_types_1.TenderSrcModule),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdSrcModule", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: tender_detail_api_types_1.TenderSrcDocType,
        enumName: 'TenderSrcDocType',
        description: 'Kind of parent document. Required on create, immutable afterwards',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(30),
    (0, class_validator_1.IsEnum)(tender_detail_api_types_1.TenderSrcDocType),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Parent document id (polymorphic, no FK). Required on create, immutable afterwards',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        description: 'Line order within the document. Defaults to the 1-based position in the array',
    }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], SaveTenderDetailDto.prototype, "tdRowNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Required on create' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Required on create' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdTenantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: 9,
        maxLength: 9,
        description: 'Accounting year, e.g. 2026-2027. Required on create (the table is partitioned by it)',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date',
        description: "Snapshot of the parent document's date. Required on create",
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdDocDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Customer / supplier ledger the document is raised against. Required on create',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdPartyLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'accounts.acc_voucher_header — filled at posting, null on a draft document',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'acc_tender_master.tndId — what the operator picked. Required on create',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdTenderId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Snapshot of acc_tender_master.tndTypeId (integer, carried as a string). Defaults to the ' +
            "tender master's own type",
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdTenderTypeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "Posting ledger snapshot. Defaults to the tender master's tndLedgerId",
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdTenderLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: tender_detail_api_types_1.TenderDrCr,
        enumName: 'TenderDrCr',
        description: 'Money in (DR) or out (CR). Inherited from the parent document when omitted',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(2),
    (0, class_validator_1.IsEnum)(tender_detail_api_types_1.TenderDrCr),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdDrCr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, description: 'Tendered amount before surcharge' }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdSurchargePerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdSurchargeAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: "Surcharge income ledger snapshot — the tender master's tndSurchargeLedgerId at tender time",
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdSurchargeLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        description: 'tdAmount + tdSurchargeAmt, rounded to 2 decimals. Computed when omitted',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdTotalAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, description: 'Cash that hit the drawer' }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdReceivedAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, description: 'Change handed back' }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdChangeAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, description: 'Loyalty points / voucher units spent' }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdUnitsUsed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Units to currency; must be greater than 0' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdConversionRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        description: 'UPI txn id / card RRN / cheque no',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdRefNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdAuthCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 4, nullable: true, description: 'Exactly 4 digits' }),
    (0, dtoDecorators_1.NullableStringStrict)(4),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdCardLast4", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(150),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdBankName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true, description: 'UPI payer handle' }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdPayerVpa", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date',
        nullable: true,
        description: 'Cheque date; required when tdIsPdc is true',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdInstrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Post-dated cheque' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTenderDetailDto.prototype, "tdIsPdc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: tender_detail_api_types_1.TenderSettleStatus,
        enumName: 'TenderSettleStatus',
        default: tender_detail_api_types_1.TenderSettleStatus.NA,
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(20),
    (0, class_validator_1.IsEnum)(tender_detail_api_types_1.TenderSettleStatus),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdSettleStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true, description: 'Clearing ledger snapshot' }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdSettleLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdExpectedSettleOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date',
        nullable: true,
        description: 'Required when tdSettleStatus is SETTLED',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdSettledOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, nullable: true, description: 'Net credited by the acquirer' }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdSettleAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdMdrAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true, description: 'Bank batch / UTR' }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdSettleRefNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'JV that moved clearing to bank',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdSettleVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Who tendered. Required on create; inherited from the parent document',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTenderDetailDto.prototype, "tdUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdNotes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        nullable: true,
        description: 'Actor id or name; defaults to the caller',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        nullable: true,
        description: 'Actor id or name; defaults to the caller',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveTenderDetailDto.prototype, "tdModifiedBy", void 0);
//# sourceMappingURL=save-tender-detail.dto.js.map