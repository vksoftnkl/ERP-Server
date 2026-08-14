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
exports.SaveTenderMasterDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const class_transformer_2 = require("class-transformer");
const DtoTransforms_1 = require("../../../../common/dto/DtoTransforms");
const dtoDecorators_2 = require("../../../../common/dto/dtoDecorators");
const TENDER_COLOUR_PATTERN = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
class SaveTenderMasterDto {
    tndId;
    tndCompanyId;
    tndBranchId;
    tndTypeId;
    tndName;
    tndShortName;
    tndLedgerId;
    tndSettlementLedgerId;
    tndSettlementDays;
    tndBankAccountId;
    tndMinAmount;
    tndMaxAmount;
    tndDailyLimit;
    tndSurchargePerc;
    tndSurchargeAmount;
    tndSurchargeLedgerId;
    tndEditSurcharge;
    tndEditLedger;
    tndUpiVpa;
    tndUpiQrPayload;
    tndMerchantId;
    tndTerminalId;
    tndConversionRate;
    tndNeedsRef;
    tndAllowChange;
    tndAllowInReturn;
    tndOpenCashDrawer;
    tndIsDefault;
    tndDisplayPosition;
    tndHotkey;
    tndColour;
    tndEffectiveFrom;
    tndEffectiveTo;
    tndRemarks;
    tndIsActive;
}
exports.SaveTenderMasterDto = SaveTenderMasterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing tender',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTenderMasterDto.prototype, "tndId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveTenderMasterDto.prototype, "tndCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Owning branch. Omit or send null to make the tender company-wide.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1', description: 'acc_tender_types.ttm_type_id' }),
    (0, class_transformer_2.Transform)(({ value }) => (0, DtoTransforms_1.toOptionalIdString)(value)),
    (0, class_validator_1.Matches)(/^\d+$/),
    __metadata("design:type", String)
], SaveTenderMasterDto.prototype, "tndTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100 }),
    (0, dtoDecorators_1.TrimmedString)(100),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveTenderMasterDto.prototype, "tndName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        description: 'Short label for POS keys. Defaults to the first 30 chars of tndName.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(30),
    __metadata("design:type", String)
], SaveTenderMasterDto.prototype, "tndShortName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Final posting ledger' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveTenderMasterDto.prototype, "tndLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Clearing/suspense ledger money sits in until settlement (card, UPI).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndSettlementLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        maximum: 90,
        description: 'T+n days before the settlement ledger is expected to clear.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(0, 90),
    __metadata("design:type", Number)
], SaveTenderMasterDto.prototype, "tndSettlementDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'acc_ledger_bank_accounts row credited for cheque/bank tenders.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndBankAccountId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0 }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ allowNaN: false, allowInfinity: false }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SaveTenderMasterDto.prototype, "tndMinAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, minimum: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_2.Transform)(({ value }) => (0, DtoTransforms_1.toNullableNumberStrict)(value)),
    (0, dtoDecorators_2.SkipOnNullish)(),
    (0, class_validator_1.IsNumber)({ allowNaN: false, allowInfinity: false }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndMaxAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, minimum: 0, description: 'Per-day cap; null = no cap.' }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndDailyLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, maximum: 100 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], SaveTenderMasterDto.prototype, "tndSurchargePerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        description: 'Flat surcharge added on top of the percentage.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTenderMasterDto.prototype, "tndSurchargeAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Income ledger the surcharge/MDR is booked to.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndSurchargeLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTenderMasterDto.prototype, "tndEditSurcharge", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTenderMasterDto.prototype, "tndEditLedger", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndUpiVpa", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Static QR string shown on the device.' }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndUpiQrPayload", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 50, description: 'MID' }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndMerchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 50, description: 'TID' }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndTerminalId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        exclusiveMinimum: true,
        minimum: 0,
        description: 'Loyalty points / voucher units to INR. Must be greater than 0.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], SaveTenderMasterDto.prototype, "tndConversionRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Override for the tender type flag. null = inherit from the tender type.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndNeedsRef", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Override for the tender type flag. null = inherit from the tender type.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndAllowChange", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Override for the tender type flag. null = inherit from the tender type.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndAllowInReturn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTenderMasterDto.prototype, "tndOpenCashDrawer", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Only one default tender per company/branch.' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTenderMasterDto.prototype, "tndIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveTenderMasterDto.prototype, "tndDisplayPosition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 10,
        description: 'POS shortcut key; unique per company/branch.',
    }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndHotkey", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 9, example: '#00A3FF' }),
    (0, dtoDecorators_1.NullableString)(9),
    (0, class_validator_1.Matches)(TENDER_COLOUR_PATTERN, {
        message: 'tndColour must be a hex colour (#RRGGBB or #RRGGBBAA)',
    }),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndColour", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndEffectiveFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndEffectiveTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 250 }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveTenderMasterDto.prototype, "tndRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTenderMasterDto.prototype, "tndIsActive", void 0);
//# sourceMappingURL=save-tender-master.dto.js.map