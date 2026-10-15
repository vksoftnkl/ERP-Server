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
exports.ConfirmTillRemitDto = exports.RemitTillCashDto = exports.DecideTillSafeVarianceDto = exports.CountTillSafeDto = exports.TillSafeBalanceQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const till_enum_1 = require("../types/till-enum");
const till_session_dto_1 = require("./till-session.dto");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_MESSAGE = { message: '$property must be a date, YYYY-MM-DD' };
class TillSafeBalanceQueryDto extends till_session_dto_1.TillScopeDto {
    safeId;
}
exports.TillSafeBalanceQueryDto = TillSafeBalanceQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'One safe (an inactive one too); left out = every active safe of the branch.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], TillSafeBalanceQueryDto.prototype, "safeId", void 0);
class TillSafeGapDecisionDto extends till_session_dto_1.TillScopeDto {
    treatment;
    reasonId;
    approverPin;
    witnessId;
    witnessPin;
    notes;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: till_enum_1.SAFE_GAP_TREATMENTS,
        nullable: true,
        description: 'Only read for a gap beyond till.cash_tolerance: decide it in this step under SAFE_VARIANCE — the caller’s ' +
            'Till Approval Authority grant covering it and their PIN (`approverPin`), the rule’s no-self flag not binding ' +
            '(a safe gap judges nobody else’s cash), and on a two-person rule (as shipped) the witness’s PIN as the second ' +
            'signature. Needs Cash Office (287) OVERRIDE. Left out = SENT_FOR_APPROVAL (safes/decide-variance). EXPENSE → ' +
            'Cash Short & Excess · SUSPENSE → Tender suspense (no RECOVER: no cashier).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...till_enum_1.SAFE_GAP_TREATMENTS]),
    __metadata("design:type", Object)
], TillSafeGapDecisionDto.prototype, "treatment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'With `treatment`: a till_reason of category VARIANCE (422 TILL_REASON_INVALID otherwise).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], TillSafeGapDecisionDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'With `treatment`: the caller’s till PIN, as the SAFE_VARIANCE rule’s channel asks (EITHER as shipped: a ' +
            'PIN, else remote authority). Wrong → 403 TILL_APPROVER_PIN, journalled PIN_FAIL.',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], TillSafeGapDecisionDto.prototype, "approverPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'A second person at the desk (never the caller): the witness, typing their own till PIN. A two-person ' +
            'SAFE_VARIANCE rule takes them as its second signature.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], TillSafeGapDecisionDto.prototype, "witnessId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'The witness’s till PIN. None set → 422 TILL_WITNESS_NO_PIN; none typed → 403 TILL_WITNESS_PIN_REQUIRED; ' +
            'wrong → 403 TILL_WITNESS_PIN, journalled PIN_FAIL.',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], TillSafeGapDecisionDto.prototype, "witnessPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], TillSafeGapDecisionDto.prototype, "notes", void 0);
class CountTillSafeDto extends TillSafeGapDecisionDto {
    tenantId;
    safeId;
    lines;
}
exports.CountTillSafeDto = CountTillSafeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], CountTillSafeDto.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CountTillSafeDto.prototype, "safeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: () => till_session_dto_1.TillCountLineDto,
        isArray: true,
        description: 'The safe counted, cash by denomination (tenderTypeId 1; loose coin as one enteredAmount line). An empty ' +
            'safe is one line of 0. Blind: what it should hold comes back only in the answer.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => till_session_dto_1.TillCountLineDto),
    __metadata("design:type", Array)
], CountTillSafeDto.prototype, "lines", void 0);
class DecideTillSafeVarianceDto extends till_session_dto_1.TillScopeDto {
    accYear;
    tvrId;
    treatment;
    reasonId;
    approverPin;
    secondId;
    secondPin;
    notes;
}
exports.DecideTillSafeVarianceDto = DecideTillSafeVarianceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], DecideTillSafeVarianceDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The till_variance row (stage SAFE or REMIT).' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DecideTillSafeVarianceDto.prototype, "tvrId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: till_enum_1.SAFE_GAP_TREATMENTS }),
    (0, class_validator_1.IsIn)([...till_enum_1.SAFE_GAP_TREATMENTS]),
    __metadata("design:type", String)
], DecideTillSafeVarianceDto.prototype, "treatment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'A till_reason of category VARIANCE.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DecideTillSafeVarianceDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'The caller’s till PIN (the rule’s channel).',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], DecideTillSafeVarianceDto.prototype, "approverPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'A two-person SAFE_VARIANCE rule (as shipped): the second person — not the caller, not whoever counted the ' +
            'safe / confirmed the remittance — typing `secondPin` here. Missing → 403 TILL_APPROVER_SECOND.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], DecideTillSafeVarianceDto.prototype, "secondId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], DecideTillSafeVarianceDto.prototype, "secondPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], DecideTillSafeVarianceDto.prototype, "notes", void 0);
class RemitTillCashDto extends till_session_dto_1.TillScopeDto {
    tenantId;
    safeId;
    amount;
    bankLedgerId;
    mode;
    bagNo;
    sealNo;
    citAgency;
    slipNo;
    slipDate;
    lines;
    notes;
    approverId;
    approverPin;
}
exports.RemitTillCashDto = RemitTillCashDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], RemitTillCashDto.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The safe the cash leaves.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], RemitTillCashDto.prototype, "safeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 50000,
        description: 'Never above what the safe should hold (422 TILL_REMIT_OVER_BALANCE).',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0.01),
    __metadata("design:type", Number)
], RemitTillCashDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The bank it is paid into: an active ledger under Bank Accounts / Bank OD A/c.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], RemitTillCashDto.prototype, "bankLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: till_enum_1.TillRemitMode,
        description: 'BANK_DEPOSIT: staff paid it in — CRem Dr Bank / Cr Safe, DEPOSITED. CIT: an agency took it — CRem Dr Cash in ' +
            'transit / Cr Safe, IN_TRANSIT until movements/remit-confirm.',
    }),
    (0, class_validator_1.IsIn)(Object.values(till_enum_1.TillRemitMode)),
    __metadata("design:type", String)
], RemitTillCashDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], RemitTillCashDto.prototype, "bagNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], RemitTillCashDto.prototype, "sealNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'CIT: the agency.' }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], RemitTillCashDto.prototype, "citAgency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'The deposit slip / pickup receipt no (tcm_ref_no).',
    }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], RemitTillCashDto.prototype, "slipNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-10-15' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(ISO_DATE, ISO_DATE_MESSAGE),
    __metadata("design:type", Object)
], RemitTillCashDto.prototype, "slipDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => till_session_dto_1.TillCountLineDto,
        isArray: true,
        nullable: true,
        description: 'The notes sent, by denomination (cash): their total must be `amount`. A REMIT till_count.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => till_session_dto_1.TillCountLineDto),
    __metadata("design:type", Object)
], RemitTillCashDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], RemitTillCashDto.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Only when the REMITTANCE rule asks (shipped NEVER): who approves it at this desk — left out = the caller, ' +
            'refused as self unless the rule allows it. Someone else always types their PIN here (channel COUNTER).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], RemitTillCashDto.prototype, "approverId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], RemitTillCashDto.prototype, "approverPin", void 0);
class ConfirmTillRemitDto extends TillSafeGapDecisionDto {
    accYear;
    tcmId;
    bankDate;
    bankRef;
    bankAmount;
}
exports.ConfirmTillRemitDto = ConfirmTillRemitDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], ConfirmTillRemitDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The REMIT, a CIT one IN_TRANSIT.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ConfirmTillRemitDto.prototype, "tcmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-10-16',
        description: 'The date the bank statement shows it: from the day it was sent to today. The Contra’s date.',
    }),
    (0, class_validator_1.Matches)(ISO_DATE, ISO_DATE_MESSAGE),
    __metadata("design:type", String)
], ConfirmTillRemitDto.prototype, "bankDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'UTR 1234', description: 'The statement’s reference.' }),
    (0, dtoDecorators_1.TrimmedString)(50),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ConfirmTillRemitDto.prototype, "bankRef", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 49900,
        nullable: true,
        description: 'What the bank credited; left out = what was sent. A difference is a REMIT-stage gap against Cash in transit.',
    }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], ConfirmTillRemitDto.prototype, "bankAmount", void 0);
//# sourceMappingURL=till-safe.dto.js.map