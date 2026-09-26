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
exports.OpeningBalanceDeleteSuccessDto = exports.CarryForwardSuccessDto = exports.OpeningBillsSaveSuccessDto = exports.OpeningBillsSuccessDto = exports.TrialBalanceSuccessDto = exports.OpeningBalanceSaveSuccessDto = exports.OpeningBalanceListSuccessDto = exports.OpeningBalanceDeletePayloadDto = exports.CarryForwardPayloadDto = exports.OpeningBillsSavePayloadDto = exports.OpeningBillsPayloadDto = exports.OpeningBillRowDto = exports.OpeningBalanceSavePayloadDto = exports.RetainedRowDto = exports.OpeningBalanceListPayloadDto = exports.UnclassifiedLedgerDto = exports.OpeningBalanceRowDto = exports.TrialBalanceDto = exports.OpeningBalanceErrorResponseDto = exports.OpeningBalanceErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const opening_balance_enum_1 = require("../types/opening-balance-enum");
class OpeningBalanceErrorFieldDto {
    field;
    message;
}
exports.OpeningBalanceErrorFieldDto = OpeningBalanceErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'rows.3.opAmount' }),
    __metadata("design:type", String)
], OpeningBalanceErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening amount cannot be negative for "Sundry Debtors"' }),
    __metadata("design:type", String)
], OpeningBalanceErrorFieldDto.prototype, "message", void 0);
class OpeningBalanceErrorResponseDto {
    success;
    message;
    errors;
}
exports.OpeningBalanceErrorResponseDto = OpeningBalanceErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], OpeningBalanceErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], OpeningBalanceErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningBalanceErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], OpeningBalanceErrorResponseDto.prototype, "errors", void 0);
class TrialBalanceDto {
    totalDebit;
    totalCredit;
    difference;
    isBalanced;
    unmappedCount;
    differenceLedgerId;
    differenceLedgerName;
}
exports.TrialBalanceDto = TrialBalanceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2184000.0 }),
    __metadata("design:type", Number)
], TrialBalanceDto.prototype, "totalDebit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2184000.0 }),
    __metadata("design:type", Number)
], TrialBalanceDto.prototype, "totalCredit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: 'debit - credit. Signed, so it says which side is short.',
    }),
    __metadata("design:type", Number)
], TrialBalanceDto.prototype, "difference", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TrialBalanceDto.prototype, "isBalanced", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Ledgers under a NULL-nature group. Not in the totals.' }),
    __metadata("design:type", Number)
], TrialBalanceDto.prototype, "unmappedCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The OPENING_DIFFERENCE ledger. Null = unmapped, and the plug cannot be offered.',
    }),
    __metadata("design:type", Object)
], TrialBalanceDto.prototype, "differenceLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TrialBalanceDto.prototype, "differenceLedgerName", void 0);
class OpeningBalanceRowDto {
    opId;
    ledId;
    ledName;
    groupName;
    groupNature;
    ledIsBillByBill;
    opAmount;
    opDrCr;
    opSource;
    opIsStale;
    opStaleSince;
    opStaleReason;
    opRemarks;
    priorClosingAmount;
    priorClosingDrCr;
    billCount;
}
exports.OpeningBalanceRowDto = OpeningBalanceRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Null = this ledger has no opening yet.',
    }),
    __metadata("design:type", Object)
], OpeningBalanceRowDto.prototype, "opId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningBalanceRowDto.prototype, "ledId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sundry Debtors' }),
    __metadata("design:type", String)
], OpeningBalanceRowDto.prototype, "ledName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningBalanceRowDto.prototype, "groupName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Assets' }),
    __metadata("design:type", Object)
], OpeningBalanceRowDto.prototype, "groupNature", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'When true the bills own the figure and the screen shows it read-only.',
    }),
    __metadata("design:type", Boolean)
], OpeningBalanceRowDto.prototype, "ledIsBillByBill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 124500.0, description: 'Always positive.' }),
    __metadata("design:type", Number)
], OpeningBalanceRowDto.prototype, "opAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: opening_balance_enum_1.OpeningDrCr, nullable: true }),
    __metadata("design:type", Object)
], OpeningBalanceRowDto.prototype, "opDrCr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: opening_balance_enum_1.OpeningSource, nullable: true }),
    __metadata("design:type", Object)
], OpeningBalanceRowDto.prototype, "opSource", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], OpeningBalanceRowDto.prototype, "opIsStale", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningBalanceRowDto.prototype, "opStaleSince", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: opening_balance_enum_1.OpeningStaleReason, nullable: true }),
    __metadata("design:type", Object)
], OpeningBalanceRowDto.prototype, "opStaleReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 500,
        example: 'counted at go-live',
        description: 'Whatever was typed in Remarks on /create. Round-trips.',
    }),
    __metadata("design:type", Object)
], OpeningBalanceRowDto.prototype, "opRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: "Last year's closing, for comparison." }),
    __metadata("design:type", Object)
], OpeningBalanceRowDto.prototype, "priorClosingAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: opening_balance_enum_1.OpeningDrCr, nullable: true }),
    __metadata("design:type", Object)
], OpeningBalanceRowDto.prototype, "priorClosingDrCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], OpeningBalanceRowDto.prototype, "billCount", void 0);
class UnclassifiedLedgerDto {
    ledId;
    ledName;
    groupName;
}
exports.UnclassifiedLedgerDto = UnclassifiedLedgerDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], UnclassifiedLedgerDto.prototype, "ledId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UnclassifiedLedgerDto.prototype, "ledName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UnclassifiedLedgerDto.prototype, "groupName", void 0);
class OpeningBalanceListPayloadDto {
    opCompanyId;
    opBranchId;
    opAccYear;
    rows;
    unclassified;
    trialBalance;
}
exports.OpeningBalanceListPayloadDto = OpeningBalanceListPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningBalanceListPayloadDto.prototype, "opCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningBalanceListPayloadDto.prototype, "opBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], OpeningBalanceListPayloadDto.prototype, "opAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningBalanceRowDto, isArray: true }),
    __metadata("design:type", Array)
], OpeningBalanceListPayloadDto.prototype, "rows", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: UnclassifiedLedgerDto,
        isArray: true,
        description: 'Ledgers under a group with no nature. A data problem the screen must surface.',
    }),
    __metadata("design:type", Array)
], OpeningBalanceListPayloadDto.prototype, "unclassified", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TrialBalanceDto }),
    __metadata("design:type", TrialBalanceDto)
], OpeningBalanceListPayloadDto.prototype, "trialBalance", void 0);
class RetainedRowDto {
    opId;
    ledId;
    ledName;
    billCount;
}
exports.RetainedRowDto = RetainedRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], RetainedRowDto.prototype, "opId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], RetainedRowDto.prototype, "ledId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], RetainedRowDto.prototype, "ledName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], RetainedRowDto.prototype, "billCount", void 0);
class OpeningBalanceSavePayloadDto {
    opCompanyId;
    opBranchId;
    opAccYear;
    created;
    updated;
    skippedZero;
    deleted;
    retainedWithBills;
    flippedToManual;
    trialBalance;
    staledAccYears;
}
exports.OpeningBalanceSavePayloadDto = OpeningBalanceSavePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningBalanceSavePayloadDto.prototype, "opCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningBalanceSavePayloadDto.prototype, "opBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], OpeningBalanceSavePayloadDto.prototype, "opAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 42 }),
    __metadata("design:type", Number)
], OpeningBalanceSavePayloadDto.prototype, "created", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], OpeningBalanceSavePayloadDto.prototype, "updated", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Zero-amount rows — no row is written for them.' }),
    __metadata("design:type", Number)
], OpeningBalanceSavePayloadDto.prototype, "skippedZero", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], OpeningBalanceSavePayloadDto.prototype, "deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: RetainedRowDto,
        isArray: true,
        description: 'Rows replace:true could not delete because they still have OPENING bills.',
    }),
    __metadata("design:type", Array)
], OpeningBalanceSavePayloadDto.prototype, "retainedWithBills", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: String,
        isArray: true,
        description: 'opIds whose source flipped CARRY_FORWARD -> MANUAL because the figure was edited.',
    }),
    __metadata("design:type", Array)
], OpeningBalanceSavePayloadDto.prototype, "flippedToManual", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TrialBalanceDto }),
    __metadata("design:type", TrialBalanceDto)
], OpeningBalanceSavePayloadDto.prototype, "trialBalance", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: String,
        isArray: true,
        description: 'Later years whose CARRY_FORWARD rows this write invalidated (§5.5 rule 4).',
    }),
    __metadata("design:type", Array)
], OpeningBalanceSavePayloadDto.prototype, "staledAccYears", void 0);
class OpeningBillRowDto {
    ablId;
    ablDocRefno;
    ablDocDate;
    ablDueDate;
    ablCreditDays;
    ablGraceDays;
    ablDrCr;
    ablBillAmount;
    ablAllocAmount;
    ablDiscAmount;
    ablWriteoffAmount;
    ablPendingAmount;
    ablStatus;
    ablNarration;
    isFrozen;
}
exports.OpeningBillRowDto = OpeningBillRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningBillRowDto.prototype, "ablId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'SB/2025/0412' }),
    __metadata("design:type", String)
], OpeningBillRowDto.prototype, "ablDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-01-12' }),
    __metadata("design:type", String)
], OpeningBillRowDto.prototype, "ablDocDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningBillRowDto.prototype, "ablDueDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningBillRowDto.prototype, "ablCreditDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningBillRowDto.prototype, "ablGraceDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: opening_balance_enum_1.BillDrCr }),
    __metadata("design:type", String)
], OpeningBillRowDto.prototype, "ablDrCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 48600.0 }),
    __metadata("design:type", Number)
], OpeningBillRowDto.prototype, "ablBillAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], OpeningBillRowDto.prototype, "ablAllocAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], OpeningBillRowDto.prototype, "ablDiscAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], OpeningBillRowDto.prototype, "ablWriteoffAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 48600.0, description: 'GENERATED — never sent on a write.' }),
    __metadata("design:type", Number)
], OpeningBillRowDto.prototype, "ablPendingAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'OPEN', description: 'GENERATED.' }),
    __metadata("design:type", Object)
], OpeningBillRowDto.prototype, "ablStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningBillRowDto.prototype, "ablNarration", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Settled against. Accepts only date / days / narration changes.' }),
    __metadata("design:type", Boolean)
], OpeningBillRowDto.prototype, "isFrozen", void 0);
class OpeningBillsPayloadDto {
    companyId;
    branchId;
    accYear;
    partyId;
    partyName;
    opId;
    bills;
    billTotalAmount;
    billTotalDrCr;
    openingAmount;
    openingDrCr;
    isTied;
}
exports.OpeningBillsPayloadDto = OpeningBillsPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningBillsPayloadDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningBillsPayloadDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], OpeningBillsPayloadDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningBillsPayloadDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningBillsPayloadDto.prototype, "partyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpeningBillsPayloadDto.prototype, "opId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningBillRowDto, isArray: true }),
    __metadata("design:type", Array)
], OpeningBillsPayloadDto.prototype, "bills", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 218400.0 }),
    __metadata("design:type", Number)
], OpeningBillsPayloadDto.prototype, "billTotalAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: opening_balance_enum_1.OpeningDrCr, nullable: true }),
    __metadata("design:type", Object)
], OpeningBillsPayloadDto.prototype, "billTotalDrCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 218400.0 }),
    __metadata("design:type", Number)
], OpeningBillsPayloadDto.prototype, "openingAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: opening_balance_enum_1.OpeningDrCr, nullable: true }),
    __metadata("design:type", Object)
], OpeningBillsPayloadDto.prototype, "openingDrCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The §7.2 tie. The bills endpoint keeps it true by construction.' }),
    __metadata("design:type", Boolean)
], OpeningBillsPayloadDto.prototype, "isTied", void 0);
class OpeningBillsSavePayloadDto extends OpeningBillsPayloadDto {
    created;
    updated;
    deleted;
    frozenUnchanged;
    staledAccYears;
}
exports.OpeningBillsSavePayloadDto = OpeningBillsSavePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningBillsSavePayloadDto.prototype, "created", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningBillsSavePayloadDto.prototype, "updated", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningBillsSavePayloadDto.prototype, "deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Frozen bills left exactly as they were.' }),
    __metadata("design:type", Number)
], OpeningBillsSavePayloadDto.prototype, "frozenUnchanged", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, isArray: true }),
    __metadata("design:type", Array)
], OpeningBillsSavePayloadDto.prototype, "staledAccYears", void 0);
class CarryForwardPayloadDto {
    runId;
    companyId;
    branchId;
    fromAccYear;
    toAccYear;
    created;
    updated;
    skippedManual;
    billsCarried;
    totalDebit;
    totalCredit;
    difference;
    isBalanced;
    profitAndLossResult;
    retainedEarningsLedgerId;
}
exports.CarryForwardPayloadDto = CarryForwardPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The acc_opening_run row that recorded this run.' }),
    __metadata("design:type", String)
], CarryForwardPayloadDto.prototype, "runId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CarryForwardPayloadDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CarryForwardPayloadDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-2026' }),
    __metadata("design:type", String)
], CarryForwardPayloadDto.prototype, "fromAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], CarryForwardPayloadDto.prototype, "toAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CarryForwardPayloadDto.prototype, "created", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CarryForwardPayloadDto.prototype, "updated", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'MANUAL / MIGRATION rows left alone. Always reported, even when zero.',
    }),
    __metadata("design:type", Number)
], CarryForwardPayloadDto.prototype, "skippedManual", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'OPENING bills written for bill-wise parties (§5.2 step 4).' }),
    __metadata("design:type", Number)
], CarryForwardPayloadDto.prototype, "billsCarried", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CarryForwardPayloadDto.prototype, "totalDebit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CarryForwardPayloadDto.prototype, "totalCredit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CarryForwardPayloadDto.prototype, "difference", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CarryForwardPayloadDto.prototype, "isBalanced", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "The previous year's net result, carried onto RETAINED_EARNINGS." }),
    __metadata("design:type", Number)
], CarryForwardPayloadDto.prototype, "profitAndLossResult", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CarryForwardPayloadDto.prototype, "retainedEarningsLedgerId", void 0);
class OpeningBalanceDeletePayloadDto {
    opId;
    opAccYear;
    deleted;
}
exports.OpeningBalanceDeletePayloadDto = OpeningBalanceDeletePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningBalanceDeletePayloadDto.prototype, "opId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], OpeningBalanceDeletePayloadDto.prototype, "opAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningBalanceDeletePayloadDto.prototype, "deleted", void 0);
class OpeningBalanceListSuccessDto {
    success;
    message;
    data;
}
exports.OpeningBalanceListSuccessDto = OpeningBalanceListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningBalanceListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening balances fetched successfully' }),
    __metadata("design:type", String)
], OpeningBalanceListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningBalanceListPayloadDto }),
    __metadata("design:type", OpeningBalanceListPayloadDto)
], OpeningBalanceListSuccessDto.prototype, "data", void 0);
class OpeningBalanceSaveSuccessDto {
    success;
    message;
    data;
}
exports.OpeningBalanceSaveSuccessDto = OpeningBalanceSaveSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningBalanceSaveSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening balances saved successfully' }),
    __metadata("design:type", String)
], OpeningBalanceSaveSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningBalanceSavePayloadDto }),
    __metadata("design:type", OpeningBalanceSavePayloadDto)
], OpeningBalanceSaveSuccessDto.prototype, "data", void 0);
class TrialBalanceSuccessDto {
    success;
    message;
    data;
}
exports.TrialBalanceSuccessDto = TrialBalanceSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TrialBalanceSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Trial balance fetched successfully' }),
    __metadata("design:type", String)
], TrialBalanceSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TrialBalanceDto }),
    __metadata("design:type", TrialBalanceDto)
], TrialBalanceSuccessDto.prototype, "data", void 0);
class OpeningBillsSuccessDto {
    success;
    message;
    data;
}
exports.OpeningBillsSuccessDto = OpeningBillsSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningBillsSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening bills fetched successfully' }),
    __metadata("design:type", String)
], OpeningBillsSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningBillsPayloadDto }),
    __metadata("design:type", OpeningBillsPayloadDto)
], OpeningBillsSuccessDto.prototype, "data", void 0);
class OpeningBillsSaveSuccessDto {
    success;
    message;
    data;
}
exports.OpeningBillsSaveSuccessDto = OpeningBillsSaveSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningBillsSaveSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening bills saved successfully' }),
    __metadata("design:type", String)
], OpeningBillsSaveSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningBillsSavePayloadDto }),
    __metadata("design:type", OpeningBillsSavePayloadDto)
], OpeningBillsSaveSuccessDto.prototype, "data", void 0);
class CarryForwardSuccessDto {
    success;
    message;
    data;
}
exports.CarryForwardSuccessDto = CarryForwardSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CarryForwardSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Carry forward completed successfully' }),
    __metadata("design:type", String)
], CarryForwardSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CarryForwardPayloadDto }),
    __metadata("design:type", CarryForwardPayloadDto)
], CarryForwardSuccessDto.prototype, "data", void 0);
class OpeningBalanceDeleteSuccessDto {
    success;
    message;
    data;
}
exports.OpeningBalanceDeleteSuccessDto = OpeningBalanceDeleteSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningBalanceDeleteSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening balance deleted successfully' }),
    __metadata("design:type", String)
], OpeningBalanceDeleteSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningBalanceDeletePayloadDto }),
    __metadata("design:type", OpeningBalanceDeletePayloadDto)
], OpeningBalanceDeleteSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=opening-balance-response.dto.js.map