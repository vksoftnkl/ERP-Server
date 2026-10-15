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
exports.TillSlipCheckDto = exports.TillSlipWithoutRowDto = exports.TillSlipCheckQueryDto = exports.TillChangeDto = exports.TillReceiveDto = exports.TillReceiveBagDto = exports.TillAwaitingReceiptQueryDto = exports.VoidTillMovementDto = exports.TillMovementKeyDto = exports.CreateTillMovementDto = exports.TillEventBatchDto = exports.TillClientEventDto = exports.OpenTillDayDto = exports.TillDayGetQueryDto = exports.ReopenTillDayDto = exports.CloseTillDayDto = exports.TillDayCloseExceptionDto = exports.TillDayCloseCountDto = exports.TillDayKeyDto = exports.ReopenTillSessionDto = exports.ForceCloseTillSessionDto = exports.ApproveTillCashDto = exports.DecideTillVarianceDto = exports.CloseTillSessionDto = exports.CountTillSessionDto = exports.EndBillingTillSessionDto = exports.SuspendTillSessionDto = exports.OpenTillSessionDto = exports.TillOpenCheckQueryDto = exports.TillCountLineDto = exports.TillSessionKeyDto = exports.TillScopeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const till_enum_1 = require("../types/till-enum");
class TillScopeDto {
    companyId;
    branchId;
}
exports.TillScopeDto = TillScopeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillScopeDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillScopeDto.prototype, "branchId", void 0);
class TillSessionKeyDto extends TillScopeDto {
    accYear;
    tssId;
}
exports.TillSessionKeyDto = TillSessionKeyDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-2027',
        description: 'till_session is partitioned by year: the id travels with it.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], TillSessionKeyDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillSessionKeyDto.prototype, "tssId", void 0);
class TillCountLineDto {
    tenderTypeId;
    tenderId;
    denominationId;
    qty;
    enteredAmount;
    batchRef;
}
exports.TillCountLineDto = TillCountLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'accounts.acc_tender_types.ttm_type_id (1 = CASH).' }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], TillCountLineDto.prototype, "tenderTypeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'acc_tender_master — two card terminals are two lines. Cash ignores it (one drawer).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], TillCountLineDto.prototype, "tenderId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Cash by denomination: the note / coin. The amount is its face value × qty, worked out by the server.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], TillCountLineDto.prototype, "denominationId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 4,
        description: 'Denomination: pieces. SLIPS: the number of slips.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], TillCountLineDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 12340,
        description: 'A SLIPS tender’s total, or loose coin typed as one figure. Ignored on a denomination line.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], TillCountLineDto.prototype, "enteredAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'EDC batch no / cheque bundle ref.' }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], TillCountLineDto.prototype, "batchRef", void 0);
class TillOpenCheckQueryDto extends TillScopeDto {
    accYear;
    deviceId;
    userId;
    counterId;
}
exports.TillOpenCheckQueryDto = TillOpenCheckQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-2027',
        description: 'Accepted for the client’s convenience; the business day decides the year.',
    }),
    (0, dtoDecorators_1.NullableString)(9),
    __metadata("design:type", Object)
], TillOpenCheckQueryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Must be the login’s own device when sent (400 otherwise).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], TillOpenCheckQueryDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Must be the login’s own user when sent (400 otherwise).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], TillOpenCheckQueryDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The counter the cashier picked: its carried float comes back in carriedFrom. Ignored when it is not on the free list.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], TillOpenCheckQueryDto.prototype, "counterId", void 0);
class OpenTillSessionDto extends TillScopeDto {
    tenantId;
    counterId;
    floatMode;
    floatIssued;
    prevSessionId;
    lines = [];
    reasonId;
    notes;
}
exports.OpenTillSessionDto = OpenTillSessionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], OpenTillSessionDto.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The counter (plan-till-counter-claim §2). A device linked to a counter opens on it: leave this out, or send that ' +
            'counter (any other → TILL_COUNTER_NOT_YOURS). An unlinked device names one from open-check’s free list ' +
            '(required; none free → TILL_NO_FREE_COUNTER). Nothing is written to the counter: the claim lives on the session.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], OpenTillSessionDto.prototype, "counterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: till_enum_1.TillFloatMode,
        description: 'ISSUED = counted out of the safe now (a TFlt voucher); CARRIED = what the previous close on this counter left; ' +
            'NONE = no float. Left out = till.float_mode (a cashless counter is always NONE).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(Object.values(till_enum_1.TillFloatMode)),
    __metadata("design:type", String)
], OpenTillSessionDto.prototype, "floatMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 2000,
        description: 'ISSUED: what the safe hands over. Left out = the counter’s default float.',
    }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], OpenTillSessionDto.prototype, "floatIssued", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'CARRIED: whose drawer this is. Left out = the last CLOSED session on the counter.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], OpenTillSessionDto.prototype, "prevSessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: () => TillCountLineDto,
        isArray: true,
        description: 'The opening count, cash only. A difference from the float issued is a FLOAT_MISMATCH variance.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TillCountLineDto),
    __metadata("design:type", Array)
], OpenTillSessionDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Counted ≠ issued: the reason, a till_reason of category FLOAT_MISMATCH, stored on the OPEN-stage variance. ' +
            'Left out = the shipped UNKNOWN reason, which needs `notes`. Not read when the count matches.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], OpenTillSessionDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], OpenTillSessionDto.prototype, "notes", void 0);
class SuspendTillSessionDto extends TillSessionKeyDto {
    reasonId;
}
exports.SuspendTillSessionDto = SuspendTillSessionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'till_reason, category SUSPEND (break, meal …).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SuspendTillSessionDto.prototype, "reasonId", void 0);
class EndBillingTillSessionDto extends TillSessionKeyDto {
    outboxCount;
    lastClientSeq;
}
exports.EndBillingTillSessionDto = EndBillingTillSessionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 0,
        description: 'Documents the device still holds unsent. Above 0 the end is refused (TILL_DEVICE_UNSYNCED).',
    }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], EndBillingTillSessionDto.prototype, "outboxCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 42,
        description: 'The device’s last till-event clientSeq. Refused while the server has not received up to it.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], EndBillingTillSessionDto.prototype, "lastClientSeq", void 0);
class CountTillSessionDto extends TillSessionKeyDto {
    lines = [];
    witnessBy;
    notes;
}
exports.CountTillSessionDto = CountTillSessionDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: () => TillCountLineDto,
        isArray: true,
        description: 'Cash by denomination, SLIPS tenders by amount + slips.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TillCountLineDto),
    __metadata("design:type", Array)
], CountTillSessionDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'A second person at the count (till.close_witness).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], CountTillSessionDto.prototype, "witnessBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], CountTillSessionDto.prototype, "notes", void 0);
class CloseTillSessionDto extends TillSessionKeyDto {
    floatLeft;
    notes;
}
exports.CloseTillSessionDto = CloseTillSessionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 2000,
        nullable: true,
        description: 'Cash left in the drawer for the next session. Left out = the counter’s default float under till.float_mode CARRIED, else 0. ' +
            'The rest of the cash counted is handed to the safe (a TDrp voucher).',
    }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], CloseTillSessionDto.prototype, "floatLeft", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], CloseTillSessionDto.prototype, "notes", void 0);
class DecideTillVarianceDto extends TillSessionKeyDto {
    decision;
    treatment;
    reasonId;
    note;
    approverPin;
    tcmId;
}
exports.DecideTillVarianceDto = DecideTillVarianceDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: till_enum_1.TillVarianceDecision,
        description: 'APPROVE: the PENDING variances take `treatment`, the session returns to COUNTING and /close posts them. ' +
            'RECOUNT: back to COUNTING with one more count attempt; the next final count replaces the variances.',
    }),
    (0, class_validator_1.IsIn)(Object.values(till_enum_1.TillVarianceDecision)),
    __metadata("design:type", String)
], DecideTillVarianceDto.prototype, "decision", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: till_enum_1.APPROVABLE_TREATMENTS,
        nullable: true,
        description: 'APPROVE only. EXPENSE → Cash Short & Excess · RECOVER → the cashier’s staff advance ledger (notes 95; ' +
            'none → 422 TILL_LEDGER_UNMAPPED on this field) · SUSPENSE → Tender suspense, cleared later by a journal.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...till_enum_1.APPROVABLE_TREATMENTS]),
    __metadata("design:type", Object)
], DecideTillVarianceDto.prototype, "treatment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'APPROVE only: a till_reason of category VARIANCE (a cash gap) or NONCASH (a slip gap) — 422 TILL_REASON_INVALID otherwise.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], DecideTillVarianceDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 500, description: 'The decision note. Required.' }),
    (0, dtoDecorators_1.TrimmedString)(500),
    __metadata("design:type", String)
], DecideTillVarianceDto.prototype, "note", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'The approver’s till PIN (usr_pin_hash, notes 95). Required when the rule’s channel is COUNTER; on EITHER it ' +
            'stands in for remote authority (taa_can_remote). Wrong → 403 TILL_APPROVER_PIN, journalled PIN_FAIL.',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], DecideTillVarianceDto.prototype, "approverPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Notes 113: a received bag (the hand-over / drop, of this session) whose RECEIVE-stage difference is ' +
            'PENDING. The session may be in any status. APPROVE only (400 on RECOUNT: the count stands); the TVar ' +
            'posts at once, Dr / Cr Till cash awaiting receipt. Neither the receiver nor the bag’s cashier decides it. ' +
            'Left out = the close variance of a PENDING_APPROVAL session, as before.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], DecideTillVarianceDto.prototype, "tcmId", void 0);
class ApproveTillCashDto extends TillSessionKeyDto {
    approverPin;
    receivedAmount;
    treatment;
    reasonId;
    notes;
}
exports.ApproveTillCashDto = ApproveTillCashDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'The caller’s own till PIN (usr_pin_hash, notes 95). None set → 422 TILL_RECEIVER_NO_PIN; none typed → ' +
            '403 TILL_RECEIVER_PIN_REQUIRED; wrong → 403 TILL_RECEIVER_PIN, journalled PIN_FAIL. May be left out only ' +
            'under till.single_operator by the session’s own cashier.',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], ApproveTillCashDto.prototype, "approverPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 500,
        nullable: true,
        description: 'What the supervisor received for the whole session (hand-over + drops awaiting receipt). Left out = ' +
            'exactly what was handed over. A difference beyond till.cash_tolerance needs `treatment` to be decided ' +
            'here, else it is sent for approval.',
    }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], ApproveTillCashDto.prototype, "receivedAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: till_enum_1.APPROVABLE_TREATMENTS,
        nullable: true,
        description: 'Only read for a gap beyond tolerance: decide it in this step (the caller’s Till Approval Authority grant ' +
            'for CASH_VARIANCE must cover it — 403 TILL_APPROVER_NO_GRANT / TILL_APPROVER_LIMIT otherwise, nothing ' +
            'written). Left out = SENT_FOR_APPROVAL. EXPENSE → Cash Short & Excess · RECOVER → the cashier’s staff ' +
            'advance ledger · SUSPENSE → Tender suspense.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...till_enum_1.APPROVABLE_TREATMENTS]),
    __metadata("design:type", Object)
], ApproveTillCashDto.prototype, "treatment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'With `treatment`: a till_reason of category VARIANCE (422 TILL_REASON_INVALID otherwise).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], ApproveTillCashDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], ApproveTillCashDto.prototype, "notes", void 0);
class ForceCloseTillSessionDto extends TillSessionKeyDto {
    reasonId;
    approverPin;
    lines = [];
    floatLeft;
    notes;
}
exports.ForceCloseTillSessionDto = ForceCloseTillSessionDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'A FORCE_CLOSE reason (Cashier left, Shift over time, Device failure, Day close, Other).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ForceCloseTillSessionDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'The caller’s till PIN for the FORCE_CLOSE rule (STORE_MANAGER, EITHER: a PIN, else remote authority). ' +
            'Wrong → 403 TILL_APPROVER_PIN, journalled PIN_FAIL.',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], ForceCloseTillSessionDto.prototype, "approverPin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: () => TillCountLineDto,
        isArray: true,
        description: 'The supervisor’s count of the drawer, as /count takes it.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TillCountLineDto),
    __metadata("design:type", Array)
], ForceCloseTillSessionDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'As /close: left out = the counter’s default float under CARRIED, else 0.',
    }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], ForceCloseTillSessionDto.prototype, "floatLeft", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Needed when the reason needs a note.' }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], ForceCloseTillSessionDto.prototype, "notes", void 0);
class ReopenTillSessionDto extends TillSessionKeyDto {
    reasonId;
    approverPin;
    notes;
}
exports.ReopenTillSessionDto = ReopenTillSessionDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'A REOPEN reason (Count keyed wrong, Transaction missed …).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ReopenTillSessionDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'The caller’s till PIN for the SESSION_REOPEN rule (STORE_MANAGER, EITHER).',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], ReopenTillSessionDto.prototype, "approverPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Needed when the reason needs a note.' }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], ReopenTillSessionDto.prototype, "notes", void 0);
class TillDayKeyDto extends TillScopeDto {
    accYear;
    tbdId;
}
exports.TillDayKeyDto = TillDayKeyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], TillDayKeyDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillDayKeyDto.prototype, "tbdId", void 0);
class TillDayCloseCountDto {
    tssId;
    lines = [];
    floatLeft;
}
exports.TillDayCloseCountDto = TillDayCloseCountDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillDayCloseCountDto.prototype, "tssId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => TillCountLineDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TillCountLineDto),
    __metadata("design:type", Array)
], TillDayCloseCountDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], TillDayCloseCountDto.prototype, "floatLeft", void 0);
class TillDayCloseExceptionDto {
    reasonId;
    approverId;
    approverPin;
    counts;
}
exports.TillDayCloseExceptionDto = TillDayCloseExceptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'A DAY_CLOSE reason (Cashier gone: drawer counted by the supervisor · Safe counted next morning · Other).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillDayCloseExceptionDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Who approves (DAY_CLOSE_EXCEPTION, STORE_MANAGER): someone other than the caller, who types their own ' +
            'till PIN here. Left out = the caller, refused (TILL_APPROVER_SELF) unless the rule allows self.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], TillDayCloseExceptionDto.prototype, "approverId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], TillDayCloseExceptionDto.prototype, "approverPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => TillDayCloseCountDto,
        isArray: true,
        description: 'One per live session (SESSIONS_LIVE): the supervisor’s count of its drawer. The session is force-closed ' +
            '(reason “Day close”) and its hand-over received on that count. A live session left out → 422 ' +
            'TILL_FORCE_COUNT_REQUIRED.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TillDayCloseCountDto),
    __metadata("design:type", Array)
], TillDayCloseExceptionDto.prototype, "counts", void 0);
class CloseTillDayDto extends TillDayKeyDto {
    notes;
    exception;
}
exports.CloseTillDayDto = CloseTillDayDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], CloseTillDayDto.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => TillDayCloseExceptionDto,
        nullable: true,
        description: 'Only to close over RED items an exception may cover (SESSIONS_LIVE).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => TillDayCloseExceptionDto),
    __metadata("design:type", Object)
], CloseTillDayDto.prototype, "exception", void 0);
class ReopenTillDayDto extends TillDayKeyDto {
    reasonId;
    approverPin;
    notes;
}
exports.ReopenTillDayDto = ReopenTillDayDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'A DAY_REOPEN reason (Correction, Late transaction).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ReopenTillDayDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'The caller’s till PIN for the DAY_REOPEN rule (AREA_MANAGER, EITHER).',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], ReopenTillDayDto.prototype, "approverPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Needed when the reason needs a note.' }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], ReopenTillDayDto.prototype, "notes", void 0);
class TillDayGetQueryDto extends TillScopeDto {
    accYear;
    tbdId;
}
exports.TillDayGetQueryDto = TillDayGetQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-2027',
        description: 'With tbdId; left out = today’s business date.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], TillDayGetQueryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], TillDayGetQueryDto.prototype, "tbdId", void 0);
class OpenTillDayDto extends TillScopeDto {
    tenantId;
}
exports.OpenTillDayDto = OpenTillDayDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], OpenTillDayDto.prototype, "tenantId", void 0);
class TillClientEventDto {
    code;
    eventOn;
    clientSeq;
    sessionId;
    srcDocType;
    srcDocId;
    srcRefno;
    amount;
    reasonId;
    payload;
}
exports.TillClientEventDto = TillClientEventDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'NO_SALE',
        description: 'DRAWER_OPEN_SALE · NO_SALE · DRAWER_LEFT_OPEN · X_REPORT · REPRINT · SESSION_IDLE_LOCK · CASH_ALERT · ' +
            'OFFLINE_START · OFFLINE_END · LOGIN · LOGOUT · SYNC_PENDING_AT_CLOSE',
    }),
    (0, dtoDecorators_1.UpperMaxString)(30),
    __metadata("design:type", String)
], TillClientEventDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-10-08T10:15:00+05:30',
        description: 'When it happened, by the DEVICE clock.',
    }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], TillClientEventDto.prototype, "eventOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 42,
        description: 'The device’s own running number: a batch sent twice is stored once.',
    }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], TillClientEventDto.prototype, "clientSeq", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], TillClientEventDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'SALE_BILL' }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], TillClientEventDto.prototype, "srcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], TillClientEventDto.prototype, "srcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], TillClientEventDto.prototype, "srcRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], TillClientEventDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'till_reason (a no-sale’s reason).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], TillClientEventDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'object', additionalProperties: true, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], TillClientEventDto.prototype, "payload", void 0);
class TillEventBatchDto extends TillScopeDto {
    accYear;
    events;
}
exports.TillEventBatchDto = TillEventBatchDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], TillEventBatchDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => TillClientEventDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TillClientEventDto),
    __metadata("design:type", Array)
], TillEventBatchDto.prototype, "events", void 0);
class CreateTillMovementDto extends TillSessionKeyDto {
    kind;
    amount;
    lines = [];
    outLines = [];
    reasonId;
    ledgerId;
    refNo;
    refDate;
    partyName;
    bagNo;
    sealNo;
    witnessBy;
    witnessPin;
    supervisorId;
    supervisorPin;
    notes;
}
exports.CreateTillMovementDto = CreateTillMovementDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['DROP', 'PAID_IN', 'EXCHANGE', 'PICKUP', 'TOP_UP'],
        description: 'Every kind is entered at the counter by the session’s cashier, on its device (Open Till 272 EDIT). ' +
            'PICKUP / TOP_UP are two signatures (notes 110): the cashier calling, and the supervisor standing there ' +
            '(supervisorId + supervisorPin). On a PICKUP the cashier gives and the supervisor receives; on a TOP_UP ' +
            'the supervisor gives and the cashier receives. Recorded as tcmDoneBy = the cashier, tcmWitnessBy = the ' +
            'supervisor, tcmWitnessVerifiedOn = when the supervisor’s PIN was checked. A DROP goes into the counter’s ' +
            'own drop safe (422 TILL_NO_DROP_SAFE when it has none).',
    }),
    (0, class_validator_1.IsIn)(['DROP', 'PAID_IN', 'EXCHANGE', 'PICKUP', 'TOP_UP']),
    __metadata("design:type", String)
], CreateTillMovementDto.prototype, "kind", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 5000,
        description: 'The amount. With denomination lines it is worked out from them (and must agree if both are sent).',
    }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => TillCountLineDto,
        isArray: true,
        description: 'Cash by denomination: what moved (PICKUP, TOP_UP) or what came IN (EXCHANGE). Not on a DROP (sealed bag).',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TillCountLineDto),
    __metadata("design:type", Array)
], CreateTillMovementDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => TillCountLineDto,
        isArray: true,
        description: 'EXCHANGE only: what went OUT.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TillCountLineDto),
    __metadata("design:type", Array)
], CreateTillMovementDto.prototype, "outLines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'till_reason — PAID_IN and PICKUP must name one.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'PAID_IN: the ledger the money comes from (default: the reason’s).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "ledgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Bill / slip / voucher no (a reason may demand it).',
    }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "refNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-10-08' }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "refDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Who gave the cash (free text).' }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "partyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'DROP: the tamper-evident bag.' }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "bagNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "sealNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'DROP / PAID_IN / EXCHANGE: a second person, named only (never the caller). Not read on PICKUP / ' +
            'TOP_UP, whose second person is supervisorId (notes 110).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "witnessBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        deprecated: true,
        description: 'Notes 108, retired by notes 110: no longer read. A PICKUP / TOP_UP is signed by supervisorPin. Still ' +
            'accepted so a client built for notes 108 is not refused on an unknown field.',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "witnessPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Notes 110 — PICKUP / TOP_UP, required: the supervisor signing at the counter (GET ' +
            '/till/movements/supervisors lists who can). On a PICKUP they receive the cash from the cashier; on a ' +
            'TOP_UP they give it. An active user (422 TILL_MOVEMENT_INVALID), not the session’s cashier (422 ' +
            'TILL_SUPERVISOR_SELF), holding Till Sessions (273) OVERRIDE themselves (403 TILL_SUPERVISOR_RIGHT). ' +
            'Ignored on DROP / PAID_IN / EXCHANGE.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "supervisorId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '4321',
        description: 'Notes 110 — PICKUP / TOP_UP, required: the supervisor’s till PIN (usr_pin_hash, notes 95), typed by the ' +
            'supervisor on the cashier’s screen after the count, so it signs the counted amount. Checked before ' +
            'anything is written: none set → 422 TILL_SUPERVISOR_NO_PIN, none typed → 403 ' +
            'TILL_SUPERVISOR_PIN_REQUIRED, wrong → 403 TILL_SUPERVISOR_PIN (journalled PIN_FAIL). Ignored on DROP / ' +
            'PAID_IN / EXCHANGE.',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "supervisorPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "notes", void 0);
class TillMovementKeyDto extends TillScopeDto {
    accYear;
    tcmId;
}
exports.TillMovementKeyDto = TillMovementKeyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], TillMovementKeyDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillMovementKeyDto.prototype, "tcmId", void 0);
class VoidTillMovementDto extends TillMovementKeyDto {
    reasonId;
    notes;
}
exports.VoidTillMovementDto = VoidTillMovementDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'till_reason, category MOVEMENT_VOID.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoidTillMovementDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], VoidTillMovementDto.prototype, "notes", void 0);
class TillAwaitingReceiptQueryDto extends TillScopeDto {
    dayId;
    accYear;
}
exports.TillAwaitingReceiptQueryDto = TillAwaitingReceiptQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'One business day’s bags (with accYear); left out = every unreceived bag of the branch.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], TillAwaitingReceiptQueryDto.prototype, "dayId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-2027', description: 'With dayId.' }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], TillAwaitingReceiptQueryDto.prototype, "accYear", void 0);
class TillReceiveBagDto {
    accYear;
    tcmId;
    lines = [];
    notes;
}
exports.TillReceiveBagDto = TillReceiveBagDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], TillReceiveBagDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The CLOSE_HANDOVER / DROP awaiting receipt.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillReceiveBagDto.prototype, "tcmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: () => TillCountLineDto,
        isArray: true,
        description: 'The receiver’s blind count of the bag, cash by denomination (loose coin as enteredAmount). Empty = an ' +
            'empty bag: received 0.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TillCountLineDto),
    __metadata("design:type", Array)
], TillReceiveBagDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 500 }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], TillReceiveBagDto.prototype, "notes", void 0);
class TillReceiveDto extends TillScopeDto {
    receiverPin;
    bags;
}
exports.TillReceiveDto = TillReceiveDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'The receiver’s own till PIN (usr_pin_hash, notes 95), once for the sitting. None set → 422 ' +
            'TILL_RECEIVER_NO_PIN; none typed → 403 TILL_RECEIVER_PIN_REQUIRED; wrong → 403 TILL_RECEIVER_PIN, ' +
            'journalled PIN_FAIL.',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], TillReceiveDto.prototype, "receiverPin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: () => TillReceiveBagDto,
        isArray: true,
        description: 'One or more bags, each with its own count. All are received, or none.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TillReceiveBagDto),
    __metadata("design:type", Array)
], TillReceiveDto.prototype, "bags", void 0);
class TillChangeDto extends TillScopeDto {
    accYear;
    fromTssId;
    toTssId;
    lines;
    reasonId;
    fromWitnessPin;
    toWitnessPin;
    notes;
}
exports.TillChangeDto = TillChangeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], TillChangeDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The session GIVING the change (its cashier witnesses).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillChangeDto.prototype, "fromTssId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The session receiving it.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillChangeDto.prototype, "toTssId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: () => TillCountLineDto,
        isArray: true,
        description: 'The change, by denomination.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TillCountLineDto),
    __metadata("design:type", Array)
], TillChangeDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'A PICKUP reason, as every pickup names one.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillChangeDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '4321',
        description: 'Notes 108 — the GIVING cashier’s till PIN (they witness the pickup). Required. Refusals on this field: ' +
            '422 TILL_WITNESS_NO_PIN, 403 TILL_WITNESS_PIN_REQUIRED, 403 TILL_WITNESS_PIN (journalled PIN_FAIL).',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], TillChangeDto.prototype, "fromWitnessPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '8642',
        description: 'Notes 108 — the RECEIVING cashier’s till PIN (they witness the top-up). Required unless the caller is that ' +
            'cashier; the same refusals, on this field.',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], TillChangeDto.prototype, "toWitnessPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], TillChangeDto.prototype, "notes", void 0);
class TillSlipCheckQueryDto extends TillSessionKeyDto {
    tenderId;
}
exports.TillSlipCheckQueryDto = TillSlipCheckQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The terminal / VPA tender whose rows are checked.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillSlipCheckQueryDto.prototype, "tenderId", void 0);
class TillSlipWithoutRowDto {
    amount;
    authCode;
    cardLast4;
}
exports.TillSlipWithoutRowDto = TillSlipWithoutRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 160 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], TillSlipWithoutRowDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'A81K2Z', nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], TillSlipWithoutRowDto.prototype, "authCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '4432', nullable: true }),
    (0, dtoDecorators_1.NullableString)(4),
    __metadata("design:type", Object)
], TillSlipWithoutRowDto.prototype, "cardLast4", void 0);
class TillSlipCheckDto extends TillSlipCheckQueryDto {
    ticked;
    noSlip;
    amountDiffers;
    slipsWithoutRow;
    notes;
}
exports.TillSlipCheckDto = TillSlipCheckDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 13, description: 'Rows ticked against a slip.' }),
    (0, dtoDecorators_1.RequiredInteger)(0),
    __metadata("design:type", Number)
], TillSlipCheckDto.prototype, "ticked", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], description: 'Rows with no slip (tdId): payment never taken?' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    __metadata("design:type", Array)
], TillSlipCheckDto.prototype, "noSlip", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], description: 'Rows whose slip shows another amount (tdId).' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    __metadata("design:type", Array)
], TillSlipCheckDto.prototype, "amountDiffers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [TillSlipWithoutRowDto],
        description: 'Slips with no row: paid on the machine, billed as another tender?',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TillSlipWithoutRowDto),
    __metadata("design:type", Array)
], TillSlipCheckDto.prototype, "slipsWithoutRow", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], TillSlipCheckDto.prototype, "notes", void 0);
//# sourceMappingURL=till-session.dto.js.map