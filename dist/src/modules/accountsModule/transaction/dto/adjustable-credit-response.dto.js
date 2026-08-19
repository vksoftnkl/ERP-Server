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
exports.AdjustableCreditListSuccessDto = exports.AdjustableCreditDto = exports.TransactionErrorResponseDto = exports.TransactionErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const transaction_api_types_1 = require("../types/transaction-api.types");
class TransactionErrorFieldDto {
    field;
    message;
}
exports.TransactionErrorFieldDto = TransactionErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'partyId' }),
    __metadata("design:type", String)
], TransactionErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'partyId must be a UUID' }),
    __metadata("design:type", String)
], TransactionErrorFieldDto.prototype, "message", void 0);
class TransactionErrorResponseDto {
    success;
    message;
    errors;
}
exports.TransactionErrorResponseDto = TransactionErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], TransactionErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], TransactionErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TransactionErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], TransactionErrorResponseDto.prototype, "errors", void 0);
class AdjustableCreditDto {
    billId;
    billAccYear;
    billType;
    docRefno;
    docDate;
    billAmount;
    pendingAmount;
    status;
    drCr;
    srcModule;
    srcDocType;
    srcDocId;
    srcAccYear;
    narration;
    adjType;
    settlementMode;
}
exports.AdjustableCreditDto = AdjustableCreditDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'acc_bill_balance.abl_id — the key the adjustment posts against (abj_bill_id). Not a key on its own: post billAccYear alongside it as abj_bill_acc_year.',
    }),
    __metadata("design:type", String)
], AdjustableCreditDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2025-2026',
        minLength: 9,
        maxLength: 9,
        description: "The FY the credit originated in, and the second half of the bill key. A bill is never carried forward, so a March advance can settle an April invoice — this may differ from the entry screen's year.",
    }),
    __metadata("design:type", String)
], AdjustableCreditDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: transaction_api_types_1.AdjustableCreditBillType,
        enumName: 'AdjustableCreditBillType',
        description: 'Decides how the row settles; adjType and settlementMode below are derived from it.',
    }),
    __metadata("design:type", String)
], AdjustableCreditDto.prototype, "billType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'SO-2201', maxLength: 100 }),
    __metadata("design:type", String)
], AdjustableCreditDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date', example: '2026-03-27' }),
    __metadata("design:type", String)
], AdjustableCreditDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 50000,
        description: 'Face value. Display only — the adjustable ceiling is pendingAmount.',
    }),
    __metadata("design:type", Number)
], AdjustableCreditDto.prototype, "billAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 18500,
        description: 'What is LEFT: bill − allocated − discount − written off (generated column). Always > 0 on these rows.',
    }),
    __metadata("design:type", Number)
], AdjustableCreditDto.prototype, "pendingAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: transaction_api_types_1.AdjustableCreditStatus,
        enumName: 'AdjustableCreditStatus',
        description: 'CLOSED credits are never returned.',
    }),
    __metadata("design:type", String)
], AdjustableCreditDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: transaction_api_types_1.AdjustableCreditSide,
        enumName: 'AdjustableCreditSide',
        description: "abl_dr_cr — the side this row sits on, echoing the request's type. ADVANCE on CR is the customer's money held; the same ADVANCE on DR is money paid to a supplier.",
    }),
    __metadata("design:type", String)
], AdjustableCreditDto.prototype, "drCr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'SALES', maxLength: 20 }),
    __metadata("design:type", Object)
], AdjustableCreditDto.prototype, "srcModule", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'SALES_ORDER', maxLength: 30 }),
    __metadata("design:type", Object)
], AdjustableCreditDto.prototype, "srcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The sale order / sales return this credit came from. The bill screen matches on it to pre-fill the panel when an order is imported.',
    }),
    __metadata("design:type", Object)
], AdjustableCreditDto.prototype, "srcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2025-2026', minLength: 9, maxLength: 9 }),
    __metadata("design:type", Object)
], AdjustableCreditDto.prototype, "srcAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Advance received on order' }),
    __metadata("design:type", Object)
], AdjustableCreditDto.prototype, "narration", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: transaction_api_types_1.BillAdjType,
        enumName: 'BillAdjType',
        description: 'acc_bill_adjustment.abj_adj_type to post for this row.',
    }),
    __metadata("design:type", String)
], AdjustableCreditDto.prototype, "adjType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: transaction_api_types_1.BillSettlementMode,
        enumName: 'BillSettlementMode',
        description: 'acc_bill_adjustment.abj_settlement_mode to post for this row.',
    }),
    __metadata("design:type", String)
], AdjustableCreditDto.prototype, "settlementMode", void 0);
class AdjustableCreditListSuccessDto {
    success;
    message;
    data;
}
exports.AdjustableCreditListSuccessDto = AdjustableCreditListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AdjustableCreditListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Party adjustable credits fetched successfully' }),
    __metadata("design:type", String)
], AdjustableCreditListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: AdjustableCreditDto,
        isArray: true,
        description: 'Oldest first (FIFO), tie-broken on docRefno. Empty when the party holds no credit.',
    }),
    __metadata("design:type", Array)
], AdjustableCreditListSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=adjustable-credit-response.dto.js.map