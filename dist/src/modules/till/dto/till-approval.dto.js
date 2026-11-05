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
exports.DecideTillApprovalDto = exports.CancelTillApprovalDto = exports.TillApprovalKeyDto = exports.RequestTillApprovalDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const till_enum_1 = require("../types/till-enum");
const till_session_dto_1 = require("./till-session.dto");
class RequestTillApprovalDto extends till_session_dto_1.TillScopeDto {
    tenantId;
    event;
    amount;
    sessionId;
    accYear;
    srcDocType;
    srcDocId;
    srcRefno;
    reasonId;
    note;
    approverId;
    approverPin;
    secondId;
    secondPin;
}
exports.RequestTillApprovalDto = RequestTillApprovalDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], RequestTillApprovalDto.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: till_enum_1.TILL_APPROVAL_EVENTS,
        description: 'What needs the approval (ck_tap_event): EXPENSE, CASH_PAYMENT, FLOAT_MISMATCH, VOID_BILL, VOID_LINE … A rule ' +
            'that asks nothing for this amount answers 422 TILL_APPROVAL_INVALID (`needed: false`): go ahead.',
    }),
    (0, class_validator_1.IsIn)([...till_enum_1.TILL_APPROVAL_EVENTS]),
    __metadata("design:type", String)
], RequestTillApprovalDto.prototype, "event", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1200, description: 'The amount judged against the rule and the grant ceiling.' }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], RequestTillApprovalDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The till session it is about. Left out: the caller’s counter (device) if any.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], RequestTillApprovalDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-2027',
        nullable: true,
        description: 'The year of `sessionId` / of the document; left out = today’s.',
    }),
    (0, dtoDecorators_1.NullableString)(9),
    __metadata("design:type", Object)
], RequestTillApprovalDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'EXPENSE',
        description: 'The document an approved request unlocks, as the 428 TILL_APPROVAL_REQUIRED named it: EXPENSE / PAYMENT ' +
            '(the voucher id), TILL_COUNTER (an open’s float difference: the counter id), SALE_BILL … With `srcDocId`.',
    }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], RequestTillApprovalDto.prototype, "srcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], RequestTillApprovalDto.prototype, "srcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Its number, for the inbox.' }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], RequestTillApprovalDto.prototype, "srcRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true, description: 'A till_reason, when one applies.' }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], RequestTillApprovalDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true, description: 'Why — the approver reads it.' }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], RequestTillApprovalDto.prototype, "note", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Decided here, at the counter: the approver standing there (their grant judged, `approverPin` typed). Left ' +
            'out = PENDING, for an approver to decide on approvals/decide from their own login.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], RequestTillApprovalDto.prototype, "approverId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], RequestTillApprovalDto.prototype, "approverPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'A two-person rule: the second person, typing `secondPin`.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], RequestTillApprovalDto.prototype, "secondId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], RequestTillApprovalDto.prototype, "secondPin", void 0);
class TillApprovalKeyDto extends till_session_dto_1.TillScopeDto {
    accYear;
    tapId;
}
exports.TillApprovalKeyDto = TillApprovalKeyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', description: 'till_approval is partitioned by year.' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], TillApprovalKeyDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillApprovalKeyDto.prototype, "tapId", void 0);
class CancelTillApprovalDto extends TillApprovalKeyDto {
    note;
}
exports.CancelTillApprovalDto = CancelTillApprovalDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 400, nullable: true }),
    (0, dtoDecorators_1.NullableString)(400),
    __metadata("design:type", Object)
], CancelTillApprovalDto.prototype, "note", void 0);
class DecideTillApprovalDto extends TillApprovalKeyDto {
    decision;
    note;
    approverPin;
    secondId;
    secondPin;
}
exports.DecideTillApprovalDto = DecideTillApprovalDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['APPROVE', 'REJECT'] }),
    (0, class_validator_1.IsIn)(['APPROVE', 'REJECT']),
    __metadata("design:type", String)
], DecideTillApprovalDto.prototype, "decision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 500, example: 'Checked the bill with the customer' }),
    (0, dtoDecorators_1.TrimmedString)(500),
    __metadata("design:type", String)
], DecideTillApprovalDto.prototype, "note", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'The caller’s till PIN (the rule’s channel: COUNTER wants it, EITHER takes it).',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], DecideTillApprovalDto.prototype, "approverPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'APPROVE under a two-person rule: the second person — not the caller, not whoever asked — typing `secondPin`.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], DecideTillApprovalDto.prototype, "secondId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], DecideTillApprovalDto.prototype, "secondPin", void 0);
//# sourceMappingURL=till-approval.dto.js.map