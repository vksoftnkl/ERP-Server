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
exports.TillApprovalNeedDto = exports.TillListSuccessDto = exports.TillSuccessDto = exports.TillErrorResponseDto = exports.TillErrorDetailDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class TillErrorDetailDto {
    field;
    message;
    code;
    event;
    amount;
    requiredRole;
}
exports.TillErrorDetailDto = TillErrorDetailDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'tssId' }),
    __metadata("design:type", String)
], TillErrorDetailDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Session C01-261008-01 is COUNTING; this needs OPEN' }),
    __metadata("design:type", String)
], TillErrorDetailDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'TILL_SESSION_NOT_OPEN' }),
    __metadata("design:type", String)
], TillErrorDetailDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'CASH_VARIANCE',
        description: 'TILL_APPROVAL_REQUIRED: the event.',
    }),
    __metadata("design:type", String)
], TillErrorDetailDto.prototype, "event", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 80,
        description: 'TILL_APPROVAL_REQUIRED: the amount it is for.',
    }),
    __metadata("design:type", Number)
], TillErrorDetailDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'SUPERVISOR',
        description: 'TILL_APPROVAL_REQUIRED: the lowest level that may approve.',
    }),
    __metadata("design:type", String)
], TillErrorDetailDto.prototype, "requiredRole", void 0);
class TillErrorResponseDto {
    success;
    message;
    errors;
}
exports.TillErrorResponseDto = TillErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], TillErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TillErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => TillErrorDetailDto, isArray: true }),
    __metadata("design:type", Array)
], TillErrorResponseDto.prototype, "errors", void 0);
class TillSuccessDto {
    success;
    message;
    data;
}
exports.TillSuccessDto = TillSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TillSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TillSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'object', additionalProperties: true }),
    __metadata("design:type", Object)
], TillSuccessDto.prototype, "data", void 0);
class TillListSuccessDto {
    success;
    message;
    data;
}
exports.TillListSuccessDto = TillListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TillListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TillListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'array', items: { type: 'object', additionalProperties: true } }),
    __metadata("design:type", Array)
], TillListSuccessDto.prototype, "data", void 0);
class TillApprovalNeedDto {
    event;
    ruleId;
    mode;
    threshold;
    amount;
    minRole;
    channel;
    twoPerson;
    blocksTill;
    enforced;
}
exports.TillApprovalNeedDto = TillApprovalNeedDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CASH_PAYMENT' }),
    __metadata("design:type", String)
], TillApprovalNeedDto.prototype, "event", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TillApprovalNeedDto.prototype, "ruleId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'OVER_AMOUNT', description: 'ALWAYS | OVER_AMOUNT' }),
    __metadata("design:type", String)
], TillApprovalNeedDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1000 }),
    __metadata("design:type", Number)
], TillApprovalNeedDto.prototype, "threshold", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 1500,
        description: 'What was judged: a payment’s cash part, an expense’s total.',
    }),
    __metadata("design:type", Number)
], TillApprovalNeedDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'SUPERVISOR' }),
    __metadata("design:type", String)
], TillApprovalNeedDto.prototype, "minRole", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'COUNTER', description: 'COUNTER | REMOTE | EITHER' }),
    __metadata("design:type", String)
], TillApprovalNeedDto.prototype, "channel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], TillApprovalNeedDto.prototype, "twoPerson", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TillApprovalNeedDto.prototype, "blocksTill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'false until phase 3 builds the gate: the document posts, the need is recorded.',
    }),
    __metadata("design:type", Boolean)
], TillApprovalNeedDto.prototype, "enforced", void 0);
//# sourceMappingURL=till-response.dto.js.map