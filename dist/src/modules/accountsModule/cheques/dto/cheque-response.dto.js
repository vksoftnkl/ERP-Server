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
exports.ChequeErrorResponseDto = exports.ChequeErrorDetailDto = exports.DepositSlipSuccessDto = exports.DepositSlipPayloadDto = exports.DepositSlipLineDto = exports.DepositSlipBankAccountDto = exports.ChequeReturnSuccessDto = exports.ChequeReturnPayloadDto = exports.ChequeReplaceSuccessDto = exports.ChequeReplacePayloadDto = exports.ChequeRepresentSuccessDto = exports.ChequeRepresentPayloadDto = exports.ChequeBounceSuccessDto = exports.ChequeBouncePayloadDto = exports.ChequeCascadeReportDto = exports.CascadeBillRefDto = exports.ChequeClearSuccessDto = exports.ChequeClearPayloadDto = exports.ChequeDepositSuccessDto = exports.ChequeDepositPayloadDto = exports.DepositSlipSummaryDto = exports.ChequeHistorySuccessDto = exports.ChequeHistoryPayloadDto = exports.ChequeHistoryEntryDto = exports.ChequeDetailSuccessDto = exports.ChequeDetailPayloadDto = exports.ChequeListSuccessDto = exports.ChequeListPayloadDto = exports.ChequeListSummaryDto = exports.ChequeBillRefDto = exports.ChequeVoucherLegDto = exports.ChequeVoucherRefDto = exports.ChequeRowDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const receipt_enum_1 = require("../../receipt/types/receipt-enum");
const cheque_enum_1 = require("../types/cheque-enum");
class ChequeRowDto {
    apdId;
    apdAccYear;
    apdCompanyId;
    apdBranchId;
    apdTraType;
    apdPartyId;
    partyName;
    apdInstrumentType;
    apdInstrumentNo;
    apdInstrumentDate;
    apdAmount;
    apdBankName;
    apdBankBranch;
    apdIfsc;
    apdMicr;
    apdDrawerName;
    apdReceivedOn;
    apdBankLedgerId;
    bankLedgerName;
    apdPostingMode;
    apdStatus;
    dueBucket;
    apdPresentCount;
    apdDepositDate;
    apdDepositSlipNo;
    apdClearDate;
    apdBounceDate;
    apdBounceReason;
    apdBounceCharges;
    apdRemarks;
    apdStatusOn;
    apdStatusBy;
}
exports.ChequeRowDto = ChequeRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChequeRowDto.prototype, "apdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ChequeRowDto.prototype, "apdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChequeRowDto.prototype, "apdCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChequeRowDto.prototype, "apdBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'R', description: 'R = received. This screen never shows P.' }),
    __metadata("design:type", String)
], ChequeRowDto.prototype, "apdTraType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChequeRowDto.prototype, "apdPartyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Anand Stores' }),
    __metadata("design:type", String)
], ChequeRowDto.prototype, "partyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CHEQUE' }),
    __metadata("design:type", String)
], ChequeRowDto.prototype, "apdInstrumentType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '221870' }),
    __metadata("design:type", String)
], ChequeRowDto.prototype, "apdInstrumentNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-09-20',
        description: 'The POST-DATE written on the cheque — the maturity the due list works from.',
    }),
    __metadata("design:type", String)
], ChequeRowDto.prototype, "apdInstrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18500 }),
    __metadata("design:type", Number)
], ChequeRowDto.prototype, "apdAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Karur Vysya Bank' }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdBankName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdBankBranch", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'KVBL0001234' }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdIfsc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdMicr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdDrawerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-04' }),
    __metadata("design:type", String)
], ChequeRowDto.prototype, "apdReceivedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdBankLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "bankLedgerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.PdcPostingMode }),
    __metadata("design:type", String)
], ChequeRowDto.prototype, "apdPostingMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.PdcStatus }),
    __metadata("design:type", String)
], ChequeRowDto.prototype, "apdStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: cheque_enum_1.ChequeDueBucket,
        nullable: true,
        description: 'Computed from the instrument date and TODAY — never stored (§10). NULL once the cheque ' +
            'has left play: a CLEARED cheque is not "overdue", it is finished.',
    }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "dueBucket", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'How many times it has gone to the bank.' }),
    __metadata("design:type", Number)
], ChequeRowDto.prototype, "apdPresentCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '2026-09-21' }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdDepositDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'D-121' }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdDepositSlipNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdClearDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdBounceDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdBounceReason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ChequeRowDto.prototype, "apdBounceCharges", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdStatusOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ChequeRowDto.prototype, "apdStatusBy", void 0);
class ChequeVoucherRefDto {
    voucherId;
    accYear;
    voucherRefno;
    voucherDate;
    voucherStatus;
    totalDebit;
    totalCredit;
}
exports.ChequeVoucherRefDto = ChequeVoucherRefDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChequeVoucherRefDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ChequeVoucherRefDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'chqclr00004' }),
    __metadata("design:type", Object)
], ChequeVoucherRefDto.prototype, "voucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-22' }),
    __metadata("design:type", String)
], ChequeVoucherRefDto.prototype, "voucherDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'POSTED' }),
    __metadata("design:type", String)
], ChequeVoucherRefDto.prototype, "voucherStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18500 }),
    __metadata("design:type", Number)
], ChequeVoucherRefDto.prototype, "totalDebit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18500 }),
    __metadata("design:type", Number)
], ChequeVoucherRefDto.prototype, "totalCredit", void 0);
class ChequeVoucherLegDto {
    rowNo;
    drCr;
    ledgerId;
    ledgerName;
    amount;
    role;
    remarks;
}
exports.ChequeVoucherLegDto = ChequeVoucherLegDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ChequeVoucherLegDto.prototype, "rowNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DR' }),
    __metadata("design:type", String)
], ChequeVoucherLegDto.prototype, "drCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChequeVoucherLegDto.prototype, "ledgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Kvb Current A/c' }),
    __metadata("design:type", String)
], ChequeVoucherLegDto.prototype, "ledgerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18500 }),
    __metadata("design:type", Number)
], ChequeVoucherLegDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 'BANK_CHARGES',
        description: 'The role this posted under, so the answer survives a remap.',
    }),
    __metadata("design:type", Object)
], ChequeVoucherLegDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ChequeVoucherLegDto.prototype, "remarks", void 0);
class ChequeBillRefDto {
    billId;
    billAccYear;
    billType;
    docRefno;
    docDate;
    dueDate;
    billAmount;
    pendingAmount;
    settledByThisCheque;
}
exports.ChequeBillRefDto = ChequeBillRefDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChequeBillRefDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ChequeBillRefDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'SALES' }),
    __metadata("design:type", String)
], ChequeBillRefDto.prototype, "billType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'bil00022' }),
    __metadata("design:type", String)
], ChequeBillRefDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-08-14' }),
    __metadata("design:type", String)
], ChequeBillRefDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '2026-09-13' }),
    __metadata("design:type", Object)
], ChequeBillRefDto.prototype, "dueDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 12500 }),
    __metadata("design:type", Number)
], ChequeBillRefDto.prototype, "billAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 12500,
        description: 'Recomputed inside the transaction that changed it — not a cached column.',
    }),
    __metadata("design:type", Number)
], ChequeBillRefDto.prototype, "pendingAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: "The NET of this cheque's rows on the bill. A bill settled and then reversed by a bounce " +
            'comes back 0 — "what is it paying now", not "what did it once pay".',
    }),
    __metadata("design:type", Number)
], ChequeBillRefDto.prototype, "settledByThisCheque", void 0);
class ChequeListSummaryDto {
    inHandCount;
    inHandAmount;
    withBankCount;
    withBankAmount;
    bouncedCount;
    bouncedAmount;
    clearedCount;
    clearedAmount;
}
exports.ChequeListSummaryDto = ChequeListSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 14 }),
    __metadata("design:type", Number)
], ChequeListSummaryDto.prototype, "inHandCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 218400 }),
    __metadata("design:type", Number)
], ChequeListSummaryDto.prototype, "inHandAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 6 }),
    __metadata("design:type", Number)
], ChequeListSummaryDto.prototype, "withBankCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 91000 }),
    __metadata("design:type", Number)
], ChequeListSummaryDto.prototype, "withBankAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ChequeListSummaryDto.prototype, "bouncedCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18500 }),
    __metadata("design:type", Number)
], ChequeListSummaryDto.prototype, "bouncedAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 42 }),
    __metadata("design:type", Number)
], ChequeListSummaryDto.prototype, "clearedCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 786500 }),
    __metadata("design:type", Number)
], ChequeListSummaryDto.prototype, "clearedAmount", void 0);
class ChequeListPayloadDto {
    rows;
    total;
    summary;
}
exports.ChequeListPayloadDto = ChequeListPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeRowDto, isArray: true }),
    __metadata("design:type", Array)
], ChequeListPayloadDto.prototype, "rows", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], ChequeListPayloadDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ChequeListSummaryDto,
        description: 'Over the WHOLE register for the scope, not the filtered page — the strip answers "what is ' +
            'in the drawer". §7: IN HAND + WITH THE BANK equals the Cheques In Hand ledger.',
    }),
    __metadata("design:type", ChequeListSummaryDto)
], ChequeListPayloadDto.prototype, "summary", void 0);
class ChequeListSuccessDto {
    success;
    message;
    data;
}
exports.ChequeListSuccessDto = ChequeListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChequeListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '20 cheque(s)' }),
    __metadata("design:type", String)
], ChequeListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeListPayloadDto }),
    __metadata("design:type", ChequeListPayloadDto)
], ChequeListSuccessDto.prototype, "data", void 0);
class ChequeDetailPayloadDto {
    cheque;
    chequesInHandLedgerId;
    chequesInHandLedgerName;
    receiptVoucher;
    clearVoucher;
    bounceVoucher;
    reissueVoucher;
    bills;
    chargeBill;
    replaces;
    replacedBy;
}
exports.ChequeDetailPayloadDto = ChequeDetailPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeRowDto }),
    __metadata("design:type", ChequeRowDto)
], ChequeDetailPayloadDto.prototype, "cheque", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        format: 'uuid',
        description: "From the cheque's OWN tender row (§5), never from today's tender master.",
    }),
    __metadata("design:type", Object)
], ChequeDetailPayloadDto.prototype, "chequesInHandLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ChequeDetailPayloadDto.prototype, "chequesInHandLedgerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeVoucherRefDto, nullable: true }),
    __metadata("design:type", Object)
], ChequeDetailPayloadDto.prototype, "receiptVoucher", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeVoucherRefDto, nullable: true }),
    __metadata("design:type", Object)
], ChequeDetailPayloadDto.prototype, "clearVoucher", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeVoucherRefDto, nullable: true }),
    __metadata("design:type", Object)
], ChequeDetailPayloadDto.prototype, "bounceVoucher", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeVoucherRefDto, nullable: true }),
    __metadata("design:type", Object)
], ChequeDetailPayloadDto.prototype, "reissueVoucher", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeBillRefDto, isArray: true }),
    __metadata("design:type", Array)
], ChequeDetailPayloadDto.prototype, "bills", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeBillRefDto, nullable: true }),
    __metadata("design:type", Object)
], ChequeDetailPayloadDto.prototype, "chargeBill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeRowDto, nullable: true }),
    __metadata("design:type", Object)
], ChequeDetailPayloadDto.prototype, "replaces", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeRowDto, nullable: true }),
    __metadata("design:type", Object)
], ChequeDetailPayloadDto.prototype, "replacedBy", void 0);
class ChequeDetailSuccessDto {
    success;
    message;
    data;
}
exports.ChequeDetailSuccessDto = ChequeDetailSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChequeDetailSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Cheque 221870 fetched successfully' }),
    __metadata("design:type", String)
], ChequeDetailSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeDetailPayloadDto }),
    __metadata("design:type", ChequeDetailPayloadDto)
], ChequeDetailSuccessDto.prototype, "data", void 0);
class ChequeHistoryEntryDto {
    seqNo;
    event;
    fromStatus;
    toStatus;
    changedOn;
    changedBy;
    remarks;
}
exports.ChequeHistoryEntryDto = ChequeHistoryEntryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], ChequeHistoryEntryDto.prototype, "seqNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'STATUS_CHANGED' }),
    __metadata("design:type", String)
], ChequeHistoryEntryDto.prototype, "event", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'DEPOSITED' }),
    __metadata("design:type", Object)
], ChequeHistoryEntryDto.prototype, "fromStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'BOUNCED' }),
    __metadata("design:type", String)
], ChequeHistoryEntryDto.prototype, "toStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-14T09:12:03.000Z' }),
    __metadata("design:type", String)
], ChequeHistoryEntryDto.prototype, "changedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChequeHistoryEntryDto.prototype, "changedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ChequeHistoryEntryDto.prototype, "remarks", void 0);
class ChequeHistoryPayloadDto {
    apdId;
    apdAccYear;
    apdInstrumentNo;
    entries;
}
exports.ChequeHistoryPayloadDto = ChequeHistoryPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChequeHistoryPayloadDto.prototype, "apdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ChequeHistoryPayloadDto.prototype, "apdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '221870' }),
    __metadata("design:type", String)
], ChequeHistoryPayloadDto.prototype, "apdInstrumentNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeHistoryEntryDto, isArray: true, description: 'Newest first.' }),
    __metadata("design:type", Array)
], ChequeHistoryPayloadDto.prototype, "entries", void 0);
class ChequeHistorySuccessDto {
    success;
    message;
    data;
}
exports.ChequeHistorySuccessDto = ChequeHistorySuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChequeHistorySuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '4 status step(s)' }),
    __metadata("design:type", String)
], ChequeHistorySuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeHistoryPayloadDto }),
    __metadata("design:type", ChequeHistoryPayloadDto)
], ChequeHistorySuccessDto.prototype, "data", void 0);
class DepositSlipSummaryDto {
    bankLedgerId;
    bankLedgerName;
    depositDate;
    slipNo;
    chequeCount;
    totalAmount;
}
exports.DepositSlipSummaryDto = DepositSlipSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], DepositSlipSummaryDto.prototype, "bankLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Kvb Current A/c' }),
    __metadata("design:type", String)
], DepositSlipSummaryDto.prototype, "bankLedgerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-15' }),
    __metadata("design:type", String)
], DepositSlipSummaryDto.prototype, "depositDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'D-121' }),
    __metadata("design:type", String)
], DepositSlipSummaryDto.prototype, "slipNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], DepositSlipSummaryDto.prototype, "chequeCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 31000 }),
    __metadata("design:type", Number)
], DepositSlipSummaryDto.prototype, "totalAmount", void 0);
class ChequeDepositPayloadDto {
    rows;
    slip;
}
exports.ChequeDepositPayloadDto = ChequeDepositPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeRowDto, isArray: true }),
    __metadata("design:type", Array)
], ChequeDepositPayloadDto.prototype, "rows", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DepositSlipSummaryDto }),
    __metadata("design:type", DepositSlipSummaryDto)
], ChequeDepositPayloadDto.prototype, "slip", void 0);
class ChequeDepositSuccessDto {
    success;
    message;
    data;
}
exports.ChequeDepositSuccessDto = ChequeDepositSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChequeDepositSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2 cheque(s) deposited on slip D-121' }),
    __metadata("design:type", String)
], ChequeDepositSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeDepositPayloadDto }),
    __metadata("design:type", ChequeDepositPayloadDto)
], ChequeDepositSuccessDto.prototype, "data", void 0);
class ChequeClearPayloadDto {
    cheque;
    voucher;
    legs;
    billsSettled;
}
exports.ChequeClearPayloadDto = ChequeClearPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeRowDto }),
    __metadata("design:type", ChequeRowDto)
], ChequeClearPayloadDto.prototype, "cheque", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeVoucherRefDto }),
    __metadata("design:type", ChequeVoucherRefDto)
], ChequeClearPayloadDto.prototype, "voucher", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeVoucherLegDto, isArray: true }),
    __metadata("design:type", Array)
], ChequeClearPayloadDto.prototype, "legs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ChequeBillRefDto,
        isArray: true,
        description: 'Empty under ON_RECEIPT — the receipt settled the bills weeks ago.',
    }),
    __metadata("design:type", Array)
], ChequeClearPayloadDto.prototype, "billsSettled", void 0);
class ChequeClearSuccessDto {
    success;
    message;
    data;
}
exports.ChequeClearSuccessDto = ChequeClearSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChequeClearSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Cheque 221870 cleared' }),
    __metadata("design:type", String)
], ChequeClearSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeClearPayloadDto }),
    __metadata("design:type", ChequeClearPayloadDto)
], ChequeClearSuccessDto.prototype, "data", void 0);
class CascadeBillRefDto {
    billId;
    billAccYear;
    docRefno;
}
exports.CascadeBillRefDto = CascadeBillRefDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CascadeBillRefDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], CascadeBillRefDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ADV/221870' }),
    __metadata("design:type", String)
], CascadeBillRefDto.prototype, "docRefno", void 0);
class ChequeCascadeReportDto {
    advanceBillsRemoved;
    advanceApplicationsReversed;
    advancesLeftMixed;
}
exports.ChequeCascadeReportDto = ChequeCascadeReportDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: CascadeBillRefDto, isArray: true }),
    __metadata("design:type", Array)
], ChequeCascadeReportDto.prototype, "advanceBillsRemoved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], ChequeCascadeReportDto.prototype, "advanceApplicationsReversed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: CascadeBillRefDto,
        isArray: true,
        description: 'An advance this cheque PART-funded, left alone because the voucher behind it carried ' +
            'other money too. Named rather than silently removed or silently kept — see the README.',
    }),
    __metadata("design:type", Array)
], ChequeCascadeReportDto.prototype, "advancesLeftMixed", void 0);
class ChequeBouncePayloadDto {
    cheque;
    voucher;
    legs;
    billsReopened;
    cascade;
    chargeBill;
    bankCharge;
    partyCharge;
}
exports.ChequeBouncePayloadDto = ChequeBouncePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeRowDto }),
    __metadata("design:type", ChequeRowDto)
], ChequeBouncePayloadDto.prototype, "cheque", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeVoucherRefDto }),
    __metadata("design:type", ChequeVoucherRefDto)
], ChequeBouncePayloadDto.prototype, "voucher", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ChequeVoucherLegDto,
        isArray: true,
        description: 'Five under ON_RECEIPT with both charges; the charge legs only under ON_CLEARING.',
    }),
    __metadata("design:type", Array)
], ChequeBouncePayloadDto.prototype, "legs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeBillRefDto, isArray: true }),
    __metadata("design:type", Array)
], ChequeBouncePayloadDto.prototype, "billsReopened", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeCascadeReportDto }),
    __metadata("design:type", ChequeCascadeReportDto)
], ChequeBouncePayloadDto.prototype, "cascade", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeBillRefDto, nullable: true }),
    __metadata("design:type", Object)
], ChequeBouncePayloadDto.prototype, "chargeBill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 250 }),
    __metadata("design:type", Number)
], ChequeBouncePayloadDto.prototype, "bankCharge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 300 }),
    __metadata("design:type", Number)
], ChequeBouncePayloadDto.prototype, "partyCharge", void 0);
class ChequeBounceSuccessDto {
    success;
    message;
    data;
}
exports.ChequeBounceSuccessDto = ChequeBounceSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChequeBounceSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Cheque 221870 bounced — Funds insufficient' }),
    __metadata("design:type", String)
], ChequeBounceSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeBouncePayloadDto }),
    __metadata("design:type", ChequeBouncePayloadDto)
], ChequeBounceSuccessDto.prototype, "data", void 0);
class ChequeRepresentPayloadDto {
    cheque;
    reissueVoucher;
    legs;
    billsAllocated;
    slip;
}
exports.ChequeRepresentPayloadDto = ChequeRepresentPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeRowDto }),
    __metadata("design:type", ChequeRowDto)
], ChequeRepresentPayloadDto.prototype, "cheque", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ChequeVoucherRefDto,
        nullable: true,
        description: 'Null under ON_CLEARING: nothing was posted, so nothing is re-issued.',
    }),
    __metadata("design:type", Object)
], ChequeRepresentPayloadDto.prototype, "reissueVoucher", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeVoucherLegDto, isArray: true }),
    __metadata("design:type", Array)
], ChequeRepresentPayloadDto.prototype, "legs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeBillRefDto, isArray: true }),
    __metadata("design:type", Array)
], ChequeRepresentPayloadDto.prototype, "billsAllocated", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DepositSlipSummaryDto }),
    __metadata("design:type", DepositSlipSummaryDto)
], ChequeRepresentPayloadDto.prototype, "slip", void 0);
class ChequeRepresentSuccessDto {
    success;
    message;
    data;
}
exports.ChequeRepresentSuccessDto = ChequeRepresentSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChequeRepresentSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Cheque 221870 re-presented (presentation 2)' }),
    __metadata("design:type", String)
], ChequeRepresentSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeRepresentPayloadDto }),
    __metadata("design:type", ChequeRepresentPayloadDto)
], ChequeRepresentSuccessDto.prototype, "data", void 0);
class ChequeReplacePayloadDto {
    oldCheque;
    newCheque;
    reversalVoucher;
    reissueVoucher;
    legs;
    billsAllocated;
    cascade;
}
exports.ChequeReplacePayloadDto = ChequeReplacePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeRowDto, description: 'Now REPLACED, pointing at the new row.' }),
    __metadata("design:type", ChequeRowDto)
], ChequeReplacePayloadDto.prototype, "oldCheque", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeRowDto }),
    __metadata("design:type", ChequeRowDto)
], ChequeReplacePayloadDto.prototype, "newCheque", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ChequeVoucherRefDto,
        nullable: true,
        description: 'Present only when replacing from HELD, which returns the old cheque first.',
    }),
    __metadata("design:type", Object)
], ChequeReplacePayloadDto.prototype, "reversalVoucher", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeVoucherRefDto, nullable: true }),
    __metadata("design:type", Object)
], ChequeReplacePayloadDto.prototype, "reissueVoucher", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeVoucherLegDto, isArray: true }),
    __metadata("design:type", Array)
], ChequeReplacePayloadDto.prototype, "legs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeBillRefDto, isArray: true }),
    __metadata("design:type", Array)
], ChequeReplacePayloadDto.prototype, "billsAllocated", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeCascadeReportDto }),
    __metadata("design:type", ChequeCascadeReportDto)
], ChequeReplacePayloadDto.prototype, "cascade", void 0);
class ChequeReplaceSuccessDto {
    success;
    message;
    data;
}
exports.ChequeReplaceSuccessDto = ChequeReplaceSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChequeReplaceSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Cheque 221870 replaced by 221955' }),
    __metadata("design:type", String)
], ChequeReplaceSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeReplacePayloadDto }),
    __metadata("design:type", ChequeReplacePayloadDto)
], ChequeReplaceSuccessDto.prototype, "data", void 0);
class ChequeReturnPayloadDto {
    cheque;
    reversalVoucher;
    legs;
    billsReopened;
    cascade;
}
exports.ChequeReturnPayloadDto = ChequeReturnPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeRowDto }),
    __metadata("design:type", ChequeRowDto)
], ChequeReturnPayloadDto.prototype, "cheque", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeVoucherRefDto, nullable: true }),
    __metadata("design:type", Object)
], ChequeReturnPayloadDto.prototype, "reversalVoucher", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeVoucherLegDto, isArray: true }),
    __metadata("design:type", Array)
], ChequeReturnPayloadDto.prototype, "legs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeBillRefDto, isArray: true }),
    __metadata("design:type", Array)
], ChequeReturnPayloadDto.prototype, "billsReopened", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeCascadeReportDto }),
    __metadata("design:type", ChequeCascadeReportDto)
], ChequeReturnPayloadDto.prototype, "cascade", void 0);
class ChequeReturnSuccessDto {
    success;
    message;
    data;
}
exports.ChequeReturnSuccessDto = ChequeReturnSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChequeReturnSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Cheque 221870 returned to the party' }),
    __metadata("design:type", String)
], ChequeReturnSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeReturnPayloadDto }),
    __metadata("design:type", ChequeReturnPayloadDto)
], ChequeReturnSuccessDto.prototype, "data", void 0);
class DepositSlipBankAccountDto {
    ledgerId;
    ledgerName;
    accountHolder;
    bankName;
    branchName;
    accountNo;
    ifscCode;
    micrCode;
}
exports.DepositSlipBankAccountDto = DepositSlipBankAccountDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], DepositSlipBankAccountDto.prototype, "ledgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Kvb Current A/c' }),
    __metadata("design:type", String)
], DepositSlipBankAccountDto.prototype, "ledgerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], DepositSlipBankAccountDto.prototype, "accountHolder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], DepositSlipBankAccountDto.prototype, "bankName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], DepositSlipBankAccountDto.prototype, "branchName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], DepositSlipBankAccountDto.prototype, "accountNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], DepositSlipBankAccountDto.prototype, "ifscCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], DepositSlipBankAccountDto.prototype, "micrCode", void 0);
class DepositSlipLineDto {
    lineNo;
    apdId;
    apdAccYear;
    instrumentType;
    instrumentNo;
    instrumentDate;
    drawnOnBank;
    drawnOnBranch;
    micr;
    drawerName;
    partyName;
    amount;
}
exports.DepositSlipLineDto = DepositSlipLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], DepositSlipLineDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], DepositSlipLineDto.prototype, "apdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], DepositSlipLineDto.prototype, "apdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CHEQUE' }),
    __metadata("design:type", String)
], DepositSlipLineDto.prototype, "instrumentType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '221870' }),
    __metadata("design:type", String)
], DepositSlipLineDto.prototype, "instrumentNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20' }),
    __metadata("design:type", String)
], DepositSlipLineDto.prototype, "instrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], DepositSlipLineDto.prototype, "drawnOnBank", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], DepositSlipLineDto.prototype, "drawnOnBranch", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], DepositSlipLineDto.prototype, "micr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], DepositSlipLineDto.prototype, "drawerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Anand Stores' }),
    __metadata("design:type", String)
], DepositSlipLineDto.prototype, "partyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18500 }),
    __metadata("design:type", Number)
], DepositSlipLineDto.prototype, "amount", void 0);
class DepositSlipPayloadDto {
    companyId;
    branchId;
    depositDate;
    slipNo;
    bankAccount;
    lines;
    chequeCount;
    totalAmount;
}
exports.DepositSlipPayloadDto = DepositSlipPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], DepositSlipPayloadDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], DepositSlipPayloadDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-15' }),
    __metadata("design:type", String)
], DepositSlipPayloadDto.prototype, "depositDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'D-121' }),
    __metadata("design:type", String)
], DepositSlipPayloadDto.prototype, "slipNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DepositSlipBankAccountDto }),
    __metadata("design:type", DepositSlipBankAccountDto)
], DepositSlipPayloadDto.prototype, "bankAccount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DepositSlipLineDto, isArray: true }),
    __metadata("design:type", Array)
], DepositSlipPayloadDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], DepositSlipPayloadDto.prototype, "chequeCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 31000 }),
    __metadata("design:type", Number)
], DepositSlipPayloadDto.prototype, "totalAmount", void 0);
class DepositSlipSuccessDto {
    success;
    message;
    data;
}
exports.DepositSlipSuccessDto = DepositSlipSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DepositSlipSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Slip D-121: 2 cheque(s)' }),
    __metadata("design:type", String)
], DepositSlipSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DepositSlipPayloadDto }),
    __metadata("design:type", DepositSlipPayloadDto)
], DepositSlipSuccessDto.prototype, "data", void 0);
class ChequeErrorDetailDto {
    field;
    message;
}
exports.ChequeErrorDetailDto = ChequeErrorDetailDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'bounceDate',
        description: 'The request field this is about — the box the operator is looking at.',
    }),
    __metadata("design:type", String)
], ChequeErrorDetailDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Bounce 221870 on or after 21-09, the day it was deposited' }),
    __metadata("design:type", String)
], ChequeErrorDetailDto.prototype, "message", void 0);
class ChequeErrorResponseDto {
    success;
    message;
    errors;
}
exports.ChequeErrorResponseDto = ChequeErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ChequeErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], ChequeErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChequeErrorDetailDto, isArray: true }),
    __metadata("design:type", Array)
], ChequeErrorResponseDto.prototype, "errors", void 0);
//# sourceMappingURL=cheque-response.dto.js.map