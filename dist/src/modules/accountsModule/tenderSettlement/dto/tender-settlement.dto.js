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
exports.TestSettlementFormatDto = exports.SaveSettlementFormatDto = exports.SettlementFormatQueryDto = exports.WriteOffTenderDto = exports.ResolveSettlementLineDto = exports.IgnoreSettlementLineDto = exports.ConfirmSettlementLineDto = exports.SettlementLineKeyDto = exports.VoidSettlementDto = exports.SettlementKeyDto = exports.ImportSettlementDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const tender_settlement_enum_1 = require("../types/tender-settlement-enum");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
class ImportSettlementDto {
    companyId;
    branchId;
    tenderId;
    payoutRef;
    payoutDate;
    notes;
    file;
}
exports.ImportSettlementDto = ImportSettlementDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ImportSettlementDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The store the file is for (the one writer of its tender rows).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ImportSettlementDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The terminal / VPA tender whose statement format reads the file. A line naming another ' +
            'terminal of this company resolves to that terminal’s tender.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ImportSettlementDto.prototype, "tenderId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'UTR0000123456',
        description: 'The payout’s bank UTR, when the file carries no payout column.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(60),
    __metadata("design:type", String)
], ImportSettlementDto.prototype, "payoutRef", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-10-08',
        description: 'The payout date (the voucher’s), when the file carries no payout column.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(DATE, { message: 'payoutDate must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ImportSettlementDto.prototype, "payoutDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500 }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], ImportSettlementDto.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'binary',
        description: 'The provider’s statement, CSV, read with the tender’s column map.',
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], ImportSettlementDto.prototype, "file", void 0);
class SettlementKeyDto {
    companyId;
    branchId;
    accYear;
    asiId;
}
exports.SettlementKeyDto = SettlementKeyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SettlementKeyDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SettlementKeyDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-2027',
        description: 'The payout date’s year (both tables are partitioned by it).',
    }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], SettlementKeyDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SettlementKeyDto.prototype, "asiId", void 0);
class VoidSettlementDto extends SettlementKeyDto {
    reason;
}
exports.VoidSettlementDto = VoidSettlementDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Imported the wrong terminal’s file', maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    __metadata("design:type", String)
], VoidSettlementDto.prototype, "reason", void 0);
class SettlementLineKeyDto {
    companyId;
    branchId;
    accYear;
    aslId;
}
exports.SettlementLineKeyDto = SettlementLineKeyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SettlementLineKeyDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SettlementLineKeyDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], SettlementLineKeyDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SettlementLineKeyDto.prototype, "aslId", void 0);
class ConfirmSettlementLineDto extends SettlementLineKeyDto {
    tdId;
    tdAccYear;
}
exports.ConfirmSettlementLineDto = ConfirmSettlementLineDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Omitted: accept the SUGGESTED row. Given: link this tender row by hand (MANUAL).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ConfirmSettlementLineDto.prototype, "tdId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-2027', description: 'With tdId.' }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], ConfirmSettlementLineDto.prototype, "tdAccYear", void 0);
class IgnoreSettlementLineDto extends SettlementLineKeyDto {
    notes;
}
exports.IgnoreSettlementLineDto = IgnoreSettlementLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'The provider’s own day-total row',
        description: 'Why the line is not part of this payout. It leaves the payout’s totals.',
        maxLength: 500,
    }),
    (0, dtoDecorators_1.TrimmedString)(500),
    __metadata("design:type", String)
], IgnoreSettlementLineDto.prototype, "notes", void 0);
class ResolveSettlementLineDto extends SettlementLineKeyDto {
    resolution;
    reasonId;
    tdId;
    tdAccYear;
    incomeLedgerId;
    notes;
}
exports.ResolveSettlementLineDto = ResolveSettlementLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: tender_settlement_enum_1.SettlementResolution }),
    (0, class_validator_1.IsEnum)(tender_settlement_enum_1.SettlementResolution),
    __metadata("design:type", String)
], ResolveSettlementLineDto.prototype, "resolution", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'A NONCASH till reason (UNBILLED_PAYMENT …).' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ResolveSettlementLineDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'LINKED: the bill’s tender row on this tender.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ResolveSettlementLineDto.prototype, "tdId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-2027', description: 'LINKED: with tdId.' }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], ResolveSettlementLineDto.prototype, "tdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'INCOME: the income ledger the money is booked to.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], ResolveSettlementLineDto.prototype, "incomeLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500 }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], ResolveSettlementLineDto.prototype, "notes", void 0);
class WriteOffTenderDto {
    companyId;
    branchId;
    tdId;
    tdAccYear;
    treatment;
    reasonId;
    recoveryLedgerId;
    notes;
}
exports.WriteOffTenderDto = WriteOffTenderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], WriteOffTenderDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], WriteOffTenderDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The tender row that never got its money (or was charged back).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], WriteOffTenderDto.prototype, "tdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], WriteOffTenderDto.prototype, "tdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: tender_settlement_enum_1.WriteOffTreatment }),
    (0, class_validator_1.IsEnum)(tender_settlement_enum_1.WriteOffTreatment),
    __metadata("design:type", String)
], WriteOffTenderDto.prototype, "treatment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'A NONCASH till reason (NOT_PAID, DECLINED, FAKE_PROOF …).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], WriteOffTenderDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'RECOVER: the ledger the amount is recovered from (the cashier’s, say).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], WriteOffTenderDto.prototype, "recoveryLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500 }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], WriteOffTenderDto.prototype, "notes", void 0);
class SettlementFormatQueryDto {
    companyId;
    tenderId;
}
exports.SettlementFormatQueryDto = SettlementFormatQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SettlementFormatQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SettlementFormatQueryDto.prototype, "tenderId", void 0);
class SaveSettlementFormatDto extends SettlementFormatQueryDto {
    format;
}
exports.SaveSettlementFormatDto = SaveSettlementFormatDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'object',
        additionalProperties: true,
        nullable: true,
        description: 'The column map (settlement-format.ts): { version: 1, source, provider, columns: { gross, txnOn, ' +
            'terminalId, refNo, authCode, cardLast4, fee, tax, net, kind, payoutRef, payoutDate … }, kindMap, ' +
            'dateFormat, negativeIsRefund }. null clears it.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SaveSettlementFormatDto.prototype, "format", void 0);
class TestSettlementFormatDto extends SettlementFormatQueryDto {
    file;
}
exports.TestSettlementFormatDto = TestSettlementFormatDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'binary', description: 'A sample statement CSV.' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], TestSettlementFormatDto.prototype, "file", void 0);
//# sourceMappingURL=tender-settlement.dto.js.map