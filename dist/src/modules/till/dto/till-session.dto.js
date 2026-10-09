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
exports.TillSlipCheckDto = exports.TillSlipWithoutRowDto = exports.TillSlipCheckQueryDto = exports.TillChangeDto = exports.VoidTillMovementDto = exports.TillMovementKeyDto = exports.CreateTillMovementDto = exports.TillEventBatchDto = exports.TillClientEventDto = exports.OpenTillDayDto = exports.TillDayGetQueryDto = exports.CloseTillSessionDto = exports.CountTillSessionDto = exports.EndBillingTillSessionDto = exports.SuspendTillSessionDto = exports.OpenTillSessionDto = exports.TillOpenCheckQueryDto = exports.TillCountLineDto = exports.TillSessionKeyDto = exports.TillScopeDto = void 0;
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
    notes;
}
exports.CreateTillMovementDto = CreateTillMovementDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['DROP', 'PAID_IN', 'EXCHANGE', 'PICKUP', 'TOP_UP'],
        description: 'DROP / PAID_IN / EXCHANGE: the session’s cashier. PICKUP / TOP_UP: a supervisor (Till Sessions OVERRIDE); ' +
            'a pickup’s witness is the cashier.',
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
        description: 'A second person. PICKUP: defaults to the session’s cashier, and is never the supervisor.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], CreateTillMovementDto.prototype, "witnessBy", void 0);
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
class TillChangeDto extends TillScopeDto {
    accYear;
    fromTssId;
    toTssId;
    lines;
    reasonId;
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