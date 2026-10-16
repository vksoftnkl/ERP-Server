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
exports.PartyCreditSummarySuccessDto = exports.PartyCreditSummaryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class PartyCreditSummaryDto {
    partyId;
    partyName;
    accYear;
    asOnDate;
    pendingAmount;
    pendingBillCount;
    overdueAmount;
    overdueBillCount;
    oldestOverdueDueDate;
    maxOverdueDays;
    creditAmtLimit;
    creditBillLimit;
    availableCreditAmount;
    availableBillCount;
    isAmtLimitExceeded;
    isBillLimitExceeded;
    isCreditCheckEnabled;
}
exports.PartyCreditSummaryDto = PartyCreditSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '0197f3a1-2b4c-7d8e-9f01-23456789abcd' }),
    __metadata("design:type", String)
], PartyCreditSummaryDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Sri Balaji Stores' }),
    __metadata("design:type", Object)
], PartyCreditSummaryDto.prototype, "partyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: '2025-2026',
        description: 'Echoed from the request, null when omitted. Does not scope the outstanding figures below.',
    }),
    __metadata("design:type", Object)
], PartyCreditSummaryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'date',
        example: '2026-08-11',
        description: 'The database server\'s date, which the overdue split was measured against. Read-only — there is no as-on-date parameter; it is reported so the client knows which "today" produced these numbers.',
    }),
    __metadata("design:type", String)
], PartyCreditSummaryDto.prototype, "asOnDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 125000,
        description: 'Net outstanding — open receivables (DR) less advances and credit notes (CR). Negative when the party is in credit. Exact to two decimals.',
    }),
    __metadata("design:type", Number)
], PartyCreditSummaryDto.prototype, "pendingAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 12,
        description: 'Open receivables only; advances and credit notes are not bills owed.',
    }),
    __metadata("design:type", Number)
], PartyCreditSummaryDto.prototype, "pendingBillCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 45000 }),
    __metadata("design:type", Number)
], PartyCreditSummaryDto.prototype, "overdueAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 4 }),
    __metadata("design:type", Number)
], PartyCreditSummaryDto.prototype, "overdueBillCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'date',
        nullable: true,
        example: '2026-05-12',
        description: 'Null when nothing is overdue.',
    }),
    __metadata("design:type", Object)
], PartyCreditSummaryDto.prototype, "oldestOverdueDueDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 91,
        description: 'asOnDate − oldestOverdueDueDate; 0 when nothing is overdue.',
    }),
    __metadata("design:type", Number)
], PartyCreditSummaryDto.prototype, "maxOverdueDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 200000, description: 'customers.cus_credit_amt_limit' }),
    __metadata("design:type", Number)
], PartyCreditSummaryDto.prototype, "creditAmtLimit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20, description: 'customers.cus_credit_bill_limit' }),
    __metadata("design:type", Number)
], PartyCreditSummaryDto.prototype, "creditBillLimit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 75000,
        description: 'creditAmtLimit − pendingAmount. Deliberately NOT clamped at zero — the negative value is what the entry screen renders as "limit exceeded by ₹X". Null when isCreditCheckEnabled is false.',
    }),
    __metadata("design:type", Object)
], PartyCreditSummaryDto.prototype, "availableCreditAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 8,
        description: 'creditBillLimit − pendingBillCount, not clamped at zero. Null when isCreditCheckEnabled is false.',
    }),
    __metadata("design:type", Object)
], PartyCreditSummaryDto.prototype, "availableBillCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PartyCreditSummaryDto.prototype, "isAmtLimitExceeded", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PartyCreditSummaryDto.prototype, "isBillLimitExceeded", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'customers.cus_credit_allowed. False means no ceiling is configured for this party: both available* fields come back null and neither exceeded flag can trip.',
    }),
    __metadata("design:type", Boolean)
], PartyCreditSummaryDto.prototype, "isCreditCheckEnabled", void 0);
class PartyCreditSummarySuccessDto {
    success;
    message;
    data;
}
exports.PartyCreditSummarySuccessDto = PartyCreditSummarySuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PartyCreditSummarySuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Party credit summary fetched successfully' }),
    __metadata("design:type", String)
], PartyCreditSummarySuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PartyCreditSummaryDto }),
    __metadata("design:type", PartyCreditSummaryDto)
], PartyCreditSummarySuccessDto.prototype, "data", void 0);
//# sourceMappingURL=party-credit-summary-response.dto.js.map