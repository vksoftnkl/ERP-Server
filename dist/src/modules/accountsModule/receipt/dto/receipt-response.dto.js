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
exports.DuplicateCheckSuccessDto = exports.DuplicateCheckPayloadDto = exports.DuplicateReceiptDto = exports.AdjacentVoucherSuccessDto = exports.AdjacentVoucherPayloadDto = exports.AdjacentVoucherDto = exports.RegularisePdcSuccessDto = exports.RegularisePdcPayloadDto = exports.ReceiptDeleteSuccessDto = exports.ReceiptDeletePayloadDto = exports.ReceiptCancelSuccessDto = exports.ReceiptCancelPayloadDto = exports.ReceiptBillReopenedDto = exports.ReceiptReversalDto = exports.ReceiptStatusPayloadDto = exports.ReceiptAmendSuccessDto = exports.ReceiptAmendPayloadDto = exports.ReceiptAmendUnwoundDto = exports.ReceiptPostSuccessDto = exports.ReceiptPostPayloadDto = exports.ReceiptBillAfterDto = exports.ReceiptNumberedVoucherDto = exports.ReceiptSuccessDto = exports.ReceiptHeaderSuccessDto = exports.ReceiptPayloadDto = exports.ReceiptDraftSuccessDto = exports.ReceiptDraftPayloadDto = exports.ReceiptHeaderDto = exports.ReceiptAdvanceBillDto = exports.ReceiptPdcVoucherDto = exports.ReceiptChequeDto = exports.ReceiptAllocationDto = exports.ReceiptLegDto = exports.ReceiptOtherLineDto = exports.ReceiptTenderDto = exports.PartyContextSuccessDto = exports.PartyContextPayloadDto = exports.PartyContextSummaryDto = exports.PartyPendingChequeDto = exports.PartyRecentReceiptDto = exports.OpenItemsSuccessDto = exports.OpenItemsPayloadDto = exports.OpenItemsPartyDto = exports.OpenItemsSummaryDto = exports.OpenCreditDto = exports.OpenBillDto = exports.ReceiptErrorResponseDto = exports.ReceiptErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const receipt_enum_1 = require("../types/receipt-enum");
class ReceiptErrorFieldDto {
    field;
    message;
}
exports.ReceiptErrorFieldDto = ReceiptErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'allocations.1.amount',
        description: 'The API field the error belongs to, including its array index, so the screen can put the ' +
            'message beside the box that is wrong.',
    }),
    __metadata("design:type", String)
], ReceiptErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Bill SB/2026/0412 has 12150.00 pending, but this receipt settles 12650.00 against it',
    }),
    __metadata("design:type", String)
], ReceiptErrorFieldDto.prototype, "message", void 0);
class ReceiptErrorResponseDto {
    success;
    message;
    errors;
}
exports.ReceiptErrorResponseDto = ReceiptErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ReceiptErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Validation failed',
        description: 'The envelope. The detail an operator reads is on the field errors below.',
    }),
    __metadata("design:type", String)
], ReceiptErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], ReceiptErrorResponseDto.prototype, "errors", void 0);
class OpenBillDto {
    billId;
    billAccYear;
    billType;
    docRefno;
    usrRefno;
    docDate;
    dueDate;
    billAmount;
    pendingAmount;
    status;
    daysOverdue;
    billProfit;
    billProfitPreTax;
    pdcHeld;
    ppdSuggested;
    tcsAmount;
    tcsPending;
}
exports.OpenBillDto = OpenBillDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpenBillDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-2027',
        description: 'Post it back alongside billId — the table is partitioned on it.',
    }),
    __metadata("design:type", String)
], OpenBillDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.BillType, example: receipt_enum_1.BillType.SALES }),
    __metadata("design:type", String)
], OpenBillDto.prototype, "billType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'bil00031' }),
    __metadata("design:type", String)
], OpenBillDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 'PO/2026/1187',
        description: "R-B8 — the CUSTOMER's own reference, from the invoice behind the bill. docRefno is OURS; " +
            'this is theirs, and it is what an operator holding a remittance advice matches on. Null ' +
            'when the bill has no source document to read it from — an OPENING balance, a JOURNAL ' +
            'reference, an ADVANCE.',
    }),
    __metadata("design:type", Object)
], OpenBillDto.prototype, "usrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-08' }),
    __metadata("design:type", String)
], OpenBillDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '2026-10-08' }),
    __metadata("design:type", Object)
], OpenBillDto.prototype, "dueDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 48600 }),
    __metadata("design:type", Number)
], OpenBillDto.prototype, "billAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 48600, description: 'GENERATED: bill − alloc − disc − writeoff.' }),
    __metadata("design:type", Number)
], OpenBillDto.prototype, "pendingAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.BillStatus, example: receipt_enum_1.BillStatus.OPEN }),
    __metadata("design:type", String)
], OpenBillDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: '0 when the bill has no due date — nothing to be late against.',
    }),
    __metadata("design:type", Number)
], OpenBillDto.prototype, "daysOverdue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 1841.25,
        description: 'R-B7 — the margin this bill earned, TAX INCLUSIVE, so the operator can see whether the ' +
            'settlement discount they are about to type costs it.\n\n' +
            '**Derived, not stored.** Nothing holds a profit per bill: sale_bill_item holds ' +
            "sbi_item_profit PER UNIT, and this is Σ (per-unit profit × net qty) over the invoice's " +
            'live lines. The per-unit figure is not computed by the server either — it arrives on ' +
            '/bills/create from the billing screen and is stored as sent.\n\n' +
            '**null means "not answerable" — show it blank, never as 0.** Either the bill has no sale ' +
            'bill behind it (OPENING, JOURNAL, ADVANCE, a return), or at least one live line carries no ' +
            'profit figure. A partial sum is worse than none: it UNDERSTATES the margin, and would talk ' +
            'an operator out of a discount they could afford.',
    }),
    __metadata("design:type", Object)
], OpenBillDto.prototype, "billProfit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 1560.38,
        description: 'The same figure PRE-TAX, null on exactly the same terms. Both are given because they ' +
            'answer different questions: a settlement discount comes off the gross, so billProfit is ' +
            'what it eats into, while this is what a margin report means by profit.',
    }),
    __metadata("design:type", Object)
], OpenBillDto.prototype, "billProfitPreTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: 'Post-dated money already promised against this bill and not yet matured. Without it, a bill ' +
            'settled by a cheque maturing next week is indistinguishable from an unpaid one, and it ' +
            'gets collected twice.',
    }),
    __metadata("design:type", Number)
], OpenBillDto.prototype, "pdcHeld", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 200,
        description: 'R16 — what accounts.ppd_slabs suggests for this bill at onDate, based on what is LEFT. ' +
            '0 when nothing qualifies. A SUGGESTION: whatever the operator leaves in the box is what ' +
            'posts, and the server never re-seeds it.',
    }),
    __metadata("design:type", Number)
], OpenBillDto.prototype, "ppdSuggested", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: "§2.13 — TCS under 206C(1H) already charged INSIDE this bill's amount. **0 unless " +
            'accounts.tcs_basis is SALES**: on the RECEIPT basis the invoice carries no TCS and the ' +
            'receipt collects it as a TCS_PAYABLE leg instead. The two never both apply, so a non-zero ' +
            'figure here is what tells the screen not to expect that leg.',
    }),
    __metadata("design:type", Number)
], OpenBillDto.prototype, "tcsAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: 'How much of tcsAmount has not been collected yet — pro-rata of what is still pending on ' +
            'the bill (accounts.v_bill_tcs). Pro-rata because a part payment pays the WHOLE bill ' +
            'proportionally: the customer does not get to pay for the goods and withhold the tax. ' +
            'This is the figure that makes bill-wise TCS outstanding answerable.',
    }),
    __metadata("design:type", Number)
], OpenBillDto.prototype, "tcsPending", void 0);
class OpenCreditDto {
    billId;
    billAccYear;
    billType;
    docRefno;
    docDate;
    billAmount;
    pendingAmount;
    srcModule;
    srcDocType;
    srcDocId;
    srcAccYear;
    narration;
    status;
    drCr;
    adjType;
    settlementMode;
}
exports.OpenCreditDto = OpenCreditDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpenCreditDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], OpenCreditDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.BillType, example: receipt_enum_1.BillType.ADVANCE }),
    __metadata("design:type", String)
], OpenCreditDto.prototype, "billType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'rct00012' }),
    __metadata("design:type", String)
], OpenCreditDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-08-02' }),
    __metadata("design:type", String)
], OpenCreditDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 4000,
        description: 'Face value. Tooltip only — the panel adjusts against what is left.',
    }),
    __metadata("design:type", Number)
], OpenCreditDto.prototype, "billAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 4000 }),
    __metadata("design:type", Number)
], OpenCreditDto.prototype, "pendingAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'ACCOUNTS' }),
    __metadata("design:type", Object)
], OpenCreditDto.prototype, "srcModule", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'RECEIPT_ADVANCE' }),
    __metadata("design:type", Object)
], OpenCreditDto.prototype, "srcDocType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], OpenCreditDto.prototype, "srcDocId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '2026-2027' }),
    __metadata("design:type", Object)
], OpenCreditDto.prototype, "srcAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], OpenCreditDto.prototype, "narration", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.BillStatus, example: receipt_enum_1.BillStatus.OPEN }),
    __metadata("design:type", String)
], OpenCreditDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: receipt_enum_1.DrCr,
        example: receipt_enum_1.DrCr.CR,
        description: 'CR = the company owes the party. ADVANCE is bidirectional in this schema, so the side is a ' +
            'filter in its own right, not something derivable from billType.',
    }),
    __metadata("design:type", String)
], OpenCreditDto.prototype, "drCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: receipt_enum_1.BillAdjType,
        example: receipt_enum_1.BillAdjType.ADVANCE_ADJUST,
        description: 'How it settles. Decided server-side so a client cannot drift from ck_abj_adj_type.',
    }),
    __metadata("design:type", String)
], OpenCreditDto.prototype, "adjType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.BillSettlementMode, example: receipt_enum_1.BillSettlementMode.ADVANCE }),
    __metadata("design:type", String)
], OpenCreditDto.prototype, "settlementMode", void 0);
class OpenItemsSummaryDto {
    totalPending;
    billCount;
    overdueCount;
    creditsHeld;
    pdcHeld;
}
exports.OpenItemsSummaryDto = OpenItemsSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 60750, description: 'Receivables only. Credits are their own figure.' }),
    __metadata("design:type", Number)
], OpenItemsSummaryDto.prototype, "totalPending", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], OpenItemsSummaryDto.prototype, "billCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], OpenItemsSummaryDto.prototype, "overdueCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 4000 }),
    __metadata("design:type", Number)
], OpenItemsSummaryDto.prototype, "creditsHeld", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], OpenItemsSummaryDto.prototype, "pdcHeld", void 0);
class OpenItemsPartyDto {
    ledId;
    ledName;
    groupName;
    isBillByBill;
    isTdsApplicable;
    tdsDeducteeType;
    isTcsApplicable;
    tcsBasis;
    tanNo;
}
exports.OpenItemsPartyDto = OpenItemsPartyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpenItemsPartyDto.prototype, "ledId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sri Krishna Traders' }),
    __metadata("design:type", String)
], OpenItemsPartyDto.prototype, "ledName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Sundry Debtors' }),
    __metadata("design:type", Object)
], OpenItemsPartyDto.prototype, "groupName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpenItemsPartyDto.prototype, "isBillByBill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], OpenItemsPartyDto.prototype, "isTdsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Company' }),
    __metadata("design:type", Object)
], OpenItemsPartyDto.prototype, "tdsDeducteeType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], OpenItemsPartyDto.prototype, "isTcsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: receipt_enum_1.TcsBasis,
        example: receipt_enum_1.TcsBasis.RECEIPT,
        description: 'Echoes accounts.tcs_basis, so the client seeds the same line the server would.',
    }),
    __metadata("design:type", String)
], OpenItemsPartyDto.prototype, "tcsBasis", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], OpenItemsPartyDto.prototype, "tanNo", void 0);
class OpenItemsPayloadDto {
    bills;
    credits;
    summary;
    party;
}
exports.OpenItemsPayloadDto = OpenItemsPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: OpenBillDto,
        isArray: true,
        description: 'Never paged. A capped list is a wrong collection.',
    }),
    __metadata("design:type", Array)
], OpenItemsPayloadDto.prototype, "bills", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpenCreditDto, isArray: true }),
    __metadata("design:type", Array)
], OpenItemsPayloadDto.prototype, "credits", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpenItemsSummaryDto }),
    __metadata("design:type", OpenItemsSummaryDto)
], OpenItemsPayloadDto.prototype, "summary", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpenItemsPartyDto }),
    __metadata("design:type", OpenItemsPartyDto)
], OpenItemsPayloadDto.prototype, "party", void 0);
class OpenItemsSuccessDto {
    success;
    message;
    data;
}
exports.OpenItemsSuccessDto = OpenItemsSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpenItemsSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2 open bill(s) and 1 credit(s) for Sri Krishna Traders' }),
    __metadata("design:type", String)
], OpenItemsSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpenItemsPayloadDto }),
    __metadata("design:type", OpenItemsPayloadDto)
], OpenItemsSuccessDto.prototype, "data", void 0);
class PartyRecentReceiptDto {
    voucherId;
    accYear;
    voucherRefno;
    voucherDate;
    docAmount;
    adjustAmount;
    instruments;
}
exports.PartyRecentReceiptDto = PartyRecentReceiptDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PartyRecentReceiptDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], PartyRecentReceiptDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'rct00017' }),
    __metadata("design:type", Object)
], PartyRecentReceiptDto.prototype, "voucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-02' }),
    __metadata("design:type", String)
], PartyRecentReceiptDto.prototype, "voucherDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20000 }),
    __metadata("design:type", Number)
], PartyRecentReceiptDto.prototype, "docAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20000 }),
    __metadata("design:type", Number)
], PartyRecentReceiptDto.prototype, "adjustAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Cash, UPI' }),
    __metadata("design:type", Object)
], PartyRecentReceiptDto.prototype, "instruments", void 0);
class PartyPendingChequeDto {
    pdcId;
    accYear;
    instrumentNo;
    instrumentDate;
    amount;
    bankName;
    status;
    voucherId;
    voucherRefno;
}
exports.PartyPendingChequeDto = PartyPendingChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PartyPendingChequeDto.prototype, "pdcId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], PartyPendingChequeDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '445123' }),
    __metadata("design:type", String)
], PartyPendingChequeDto.prototype, "instrumentNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20' }),
    __metadata("design:type", String)
], PartyPendingChequeDto.prototype, "instrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50000 }),
    __metadata("design:type", Number)
], PartyPendingChequeDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'KVB' }),
    __metadata("design:type", Object)
], PartyPendingChequeDto.prototype, "bankName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: receipt_enum_1.PdcStatus,
        example: receipt_enum_1.PdcStatus.HELD,
        description: 'HELD or DEPOSITED — money still in flight.',
    }),
    __metadata("design:type", String)
], PartyPendingChequeDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], PartyPendingChequeDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'rct00018' }),
    __metadata("design:type", Object)
], PartyPendingChequeDto.prototype, "voucherRefno", void 0);
class PartyContextSummaryDto {
    totalBalance;
    totalOutstanding;
    totalCredits;
    chequesOutstanding;
}
exports.PartyContextSummaryDto = PartyContextSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 56750,
        description: 'R-B9 — what the party owes NET across everything, whatever year each row was raised in: ' +
            'every open receivable less every credit of theirs the company holds. Negative when we ' +
            'hold more of their money than they owe, which is ordinary after an advance.\n\n' +
            'Not derivable from /receipts/open-items, which answers the narrower question of what a ' +
            'RECEIPT may settle and spend.',
    }),
    __metadata("design:type", Number)
], PartyContextSummaryDto.prototype, "totalBalance", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 60750, description: 'Σ pending on the open receivables.' }),
    __metadata("design:type", Number)
], PartyContextSummaryDto.prototype, "totalOutstanding", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 4000, description: 'Σ pending on the credits the company holds.' }),
    __metadata("design:type", Number)
], PartyContextSummaryDto.prototype, "totalCredits", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 50000,
        description: 'Money promised by post-dated instruments that have NOT matured — what the bill-wise ' +
            "pdcHeld column adds up to. Counted from the party's own adjustment rows, so it stays " +
            'right whatever bills the open-items list happens to contain.',
    }),
    __metadata("design:type", Number)
], PartyContextSummaryDto.prototype, "chequesOutstanding", void 0);
class PartyContextPayloadDto {
    partyId;
    partyName;
    summary;
    lastReceipts;
    pendingCheques;
}
exports.PartyContextPayloadDto = PartyContextPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PartyContextPayloadDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sri Krishna Traders' }),
    __metadata("design:type", String)
], PartyContextPayloadDto.prototype, "partyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PartyContextSummaryDto }),
    __metadata("design:type", PartyContextSummaryDto)
], PartyContextPayloadDto.prototype, "summary", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: PartyRecentReceiptDto,
        isArray: true,
        description: 'The last ten POSTED receipts.',
    }),
    __metadata("design:type", Array)
], PartyContextPayloadDto.prototype, "lastReceipts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PartyPendingChequeDto, isArray: true }),
    __metadata("design:type", Array)
], PartyContextPayloadDto.prototype, "pendingCheques", void 0);
class PartyContextSuccessDto {
    success;
    message;
    data;
}
exports.PartyContextSuccessDto = PartyContextSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PartyContextSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Party context fetched successfully' }),
    __metadata("design:type", String)
], PartyContextSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PartyContextPayloadDto }),
    __metadata("design:type", PartyContextPayloadDto)
], PartyContextSuccessDto.prototype, "data", void 0);
class ReceiptTenderDto {
    tdId;
    tdRowNo;
    tdTenderId;
    tdTenderName;
    tdTenderTypeId;
    tdTenderLedgerId;
    tdAmount;
    tdSurchargePerc;
    tdSurchargeAmt;
    tdMdrAmt;
    tdReceivedAmt;
    tdChangeAmt;
    tdRefNo;
    tdBankName;
    tdPayerVpa;
    tdInstrumentDate;
    tdIsPdc;
    tdVoucherId;
}
exports.ReceiptTenderDto = ReceiptTenderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptTenderDto.prototype, "tdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ReceiptTenderDto.prototype, "tdRowNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptTenderDto.prototype, "tdTenderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Cheque' }),
    __metadata("design:type", Object)
], ReceiptTenderDto.prototype, "tdTenderName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], ReceiptTenderDto.prototype, "tdTenderTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptTenderDto.prototype, "tdTenderLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50000 }),
    __metadata("design:type", Number)
], ReceiptTenderDto.prototype, "tdAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ReceiptTenderDto.prototype, "tdSurchargePerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: 'What the CUSTOMER was charged for paying this way. Income.',
    }),
    __metadata("design:type", Number)
], ReceiptTenderDto.prototype, "tdSurchargeAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 10,
        description: "The acquirer's cut, which never reaches the bank. Our expense.",
    }),
    __metadata("design:type", Number)
], ReceiptTenderDto.prototype, "tdMdrAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ReceiptTenderDto.prototype, "tdReceivedAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ReceiptTenderDto.prototype, "tdChangeAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '445123' }),
    __metadata("design:type", Object)
], ReceiptTenderDto.prototype, "tdRefNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'KVB' }),
    __metadata("design:type", Object)
], ReceiptTenderDto.prototype, "tdBankName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReceiptTenderDto.prototype, "tdPayerVpa", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '2026-09-20' }),
    __metadata("design:type", Object)
], ReceiptTenderDto.prototype, "tdInstrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'COMPUTED from tdInstrumentDate against the receipt date. Never sent by a client.',
    }),
    __metadata("design:type", Boolean)
], ReceiptTenderDto.prototype, "tdIsPdc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        format: 'uuid',
        description: 'The voucher carrying THIS instrument — which for a post-dated cheque is not the receipt. ' +
            'NULL until post.',
    }),
    __metadata("design:type", Object)
], ReceiptTenderDto.prototype, "tdVoucherId", void 0);
class ReceiptOtherLineDto {
    lineNo;
    role;
    ledgerId;
    ledgerName;
    drCr;
    amount;
    settlesBill;
    narration;
}
exports.ReceiptOtherLineDto = ReceiptOtherLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 1,
        description: '1-based and stable — otherLineBills[].lineNo refers to it.',
    }),
    __metadata("design:type", Number)
], ReceiptOtherLineDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 'TDS_RECEIVABLE',
        description: 'NULL on a free-ledger line, which is then invisible to every role-based report.',
    }),
    __metadata("design:type", Object)
], ReceiptOtherLineDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptOtherLineDto.prototype, "ledgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'TDS Receivable' }),
    __metadata("design:type", Object)
], ReceiptOtherLineDto.prototype, "ledgerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.DrCr, example: receipt_enum_1.DrCr.DR }),
    __metadata("design:type", String)
], ReceiptOtherLineDto.prototype, "drCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 700 }),
    __metadata("design:type", Number)
], ReceiptOtherLineDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'Does this line REDUCE what the party owes on a bill? A DR line that settles nothing still ' +
            'credits the party — it simply flows to on account instead.',
    }),
    __metadata("design:type", Boolean)
], ReceiptOtherLineDto.prototype, "settlesBill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'damage claim CN-88' }),
    __metadata("design:type", Object)
], ReceiptOtherLineDto.prototype, "narration", void 0);
class ReceiptLegDto {
    avId;
    avRowNo;
    avDrCr;
    avLedgerId;
    avLedgerName;
    avAmount;
    avRole;
    avRemarks;
}
exports.ReceiptLegDto = ReceiptLegDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptLegDto.prototype, "avId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ReceiptLegDto.prototype, "avRowNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.DrCr, example: receipt_enum_1.DrCr.DR }),
    __metadata("design:type", String)
], ReceiptLegDto.prototype, "avDrCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptLegDto.prototype, "avLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'KVB Current A/c' }),
    __metadata("design:type", Object)
], ReceiptLegDto.prototype, "avLedgerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 14990 }),
    __metadata("design:type", Number)
], ReceiptLegDto.prototype, "avAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 'BANK_CHARGES',
        description: 'WHY this leg exists. NULL on the party leg and on every instrument leg; set on every ' +
            'other-ledger leg, so "TDS deducted this quarter" is a WHERE clause.',
    }),
    __metadata("design:type", Object)
], ReceiptLegDto.prototype, "avRole", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReceiptLegDto.prototype, "avRemarks", void 0);
class ReceiptAllocationDto {
    abjId;
    billId;
    billAccYear;
    docRefno;
    docDate;
    billType;
    billAmount;
    pendingAmount;
    dueDate;
    status;
    adjType;
    settlementMode;
    drCr;
    amount;
    adjDate;
    isPostDated;
    matured;
    voucherId;
    chequeId;
    againstBillId;
    againstBillRefno;
    reversalOfId;
    isReversed;
    approvedBy;
    remarks;
}
exports.ReceiptAllocationDto = ReceiptAllocationDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        nullable: true,
        description: '**Null on a DRAFT** — the settlement is remembered, not written, and no ' +
            'acc_bill_adjustment row exists for it. Never send that null back.',
    }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "abjId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptAllocationDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ReceiptAllocationDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'bil00031' }),
    __metadata("design:type", String)
], ReceiptAllocationDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: '2026-09-08',
        description: 'Null when the bill behind a remembered DRAFT row can no longer be read.',
    }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        enum: receipt_enum_1.BillType,
        example: receipt_enum_1.BillType.SALES,
        description: "The bill's own type, read from acc_bill_balance at the moment of this read. Null only " +
            'when the bill can no longer be read, which on a POSTED row cannot happen.',
    }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "billType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 15500,
        description: "The bill's full value. Here because a POSTED receipt is painted from this payload alone " +
            '— the screen does not call /receipts/open-items for one, since what a receipt shows is ' +
            'what it DID, not what the party owes today.',
    }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "billAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 14500,
        description: 'Pending **as it stands NOW**, after this receipt. The client derives what it was before ' +
            "by adding this row's own settlement back; deriving it the other way round is impossible, " +
            'which is why this is the figure sent.',
    }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "pendingAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: '2026-10-18',
        description: 'Null when the bill has no due date — there is nothing for it to be late against.',
    }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "dueDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        enum: receipt_enum_1.BillStatus,
        example: receipt_enum_1.BillStatus.PARTIAL,
        description: 'abl_status as it stands now — OPEN / PARTIAL / CLOSED.',
    }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.BillAdjType, example: receipt_enum_1.BillAdjType.ALLOCATION }),
    __metadata("design:type", String)
], ReceiptAllocationDto.prototype, "adjType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        enum: receipt_enum_1.BillSettlementMode,
        example: receipt_enum_1.BillSettlementMode.MIXED,
    }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "settlementMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.DrCr, example: receipt_enum_1.DrCr.CR }),
    __metadata("design:type", String)
], ReceiptAllocationDto.prototype, "drCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 48600 }),
    __metadata("design:type", Number)
], ReceiptAllocationDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-09-20',
        description: "The receipt's date, except on a post-dated cheque's rows, which are dated the CHEQUE.",
    }),
    __metadata("design:type", String)
], ReceiptAllocationDto.prototype, "adjDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ReceiptAllocationDto.prototype, "isPostDated", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'A post-dated row whose date has arrived — it now counts against the bill. Until then it is ' +
            'a promise, and the bill stays open.',
    }),
    __metadata("design:type", Boolean)
], ReceiptAllocationDto.prototype, "matured", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid', description: 'acc_pdc_register.apd_id.' }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "chequeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        format: 'uuid',
        description: 'Set only on a credit pair — the opposite bill. ck_abj_against demands it.',
    }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "againstBillId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "againstBillRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        format: 'uuid',
        description: 'The row this one RETRACTS. acc_bill_adjustment never rewrites a row and never soft-deletes ' +
            'one: an amend or a cancel inserts the exact negative of it, so an amended receipt answers ' +
            'with the original row, its negative AND the replacement, and netting per bill is the ' +
            "reader's job. Null on every ordinary row.",
    }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "reversalOfId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'This row has been retracted by a later one. Asked of the database, not inferred from the ' +
            'rows in this payload: an AMEND files its negatives on the receipt itself, but a CANCEL ' +
            'files them on the reversal voucher, which is not in this payload at all.',
    }),
    __metadata("design:type", Boolean)
], ReceiptAllocationDto.prototype, "isReversed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "approvedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReceiptAllocationDto.prototype, "remarks", void 0);
class ReceiptChequeDto {
    pdcId;
    accYear;
    tenderRowNo;
    instrumentType;
    instrumentNo;
    instrumentDate;
    amount;
    bankName;
    bankBranch;
    ifsc;
    drawerName;
    bankLedgerId;
    status;
    postingMode;
    voucherId;
}
exports.ReceiptChequeDto = ReceiptChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptChequeDto.prototype, "pdcId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ReceiptChequeDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 3 }),
    __metadata("design:type", Object)
], ReceiptChequeDto.prototype, "tenderRowNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CHEQUE' }),
    __metadata("design:type", String)
], ReceiptChequeDto.prototype, "instrumentType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '445123' }),
    __metadata("design:type", String)
], ReceiptChequeDto.prototype, "instrumentNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20' }),
    __metadata("design:type", String)
], ReceiptChequeDto.prototype, "instrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50000 }),
    __metadata("design:type", Number)
], ReceiptChequeDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'KVB' }),
    __metadata("design:type", Object)
], ReceiptChequeDto.prototype, "bankName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Trichy' }),
    __metadata("design:type", Object)
], ReceiptChequeDto.prototype, "bankBranch", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'KVBL0001234' }),
    __metadata("design:type", Object)
], ReceiptChequeDto.prototype, "ifsc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Sri Krishna Traders' }),
    __metadata("design:type", Object)
], ReceiptChequeDto.prototype, "drawerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ReceiptChequeDto.prototype, "bankLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.PdcStatus, example: receipt_enum_1.PdcStatus.HELD }),
    __metadata("design:type", String)
], ReceiptChequeDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ON_RECEIPT' }),
    __metadata("design:type", String)
], ReceiptChequeDto.prototype, "postingMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ReceiptChequeDto.prototype, "voucherId", void 0);
class ReceiptPdcVoucherDto {
    voucherId;
    accYear;
    voucherRefno;
    voucherDate;
    docAmount;
    adjustAmount;
    status;
    legs;
}
exports.ReceiptPdcVoucherDto = ReceiptPdcVoucherDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptPdcVoucherDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ReceiptPdcVoucherDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'rct00019' }),
    __metadata("design:type", Object)
], ReceiptPdcVoucherDto.prototype, "voucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20', description: 'Dated the CHEQUE, not the receipt (R2).' }),
    __metadata("design:type", String)
], ReceiptPdcVoucherDto.prototype, "voucherDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50000 }),
    __metadata("design:type", Number)
], ReceiptPdcVoucherDto.prototype, "docAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 35550 }),
    __metadata("design:type", Number)
], ReceiptPdcVoucherDto.prototype, "adjustAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.VoucherStatus, example: receipt_enum_1.VoucherStatus.POSTED }),
    __metadata("design:type", String)
], ReceiptPdcVoucherDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptLegDto, isArray: true }),
    __metadata("design:type", Array)
], ReceiptPdcVoucherDto.prototype, "legs", void 0);
class ReceiptAdvanceBillDto {
    billId;
    billAccYear;
    docRefno;
    docDate;
    billAmount;
    pendingAmount;
    voucherId;
}
exports.ReceiptAdvanceBillDto = ReceiptAdvanceBillDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptAdvanceBillDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ReceiptAdvanceBillDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'rct00019',
        description: "The voucher's own number — unique by construction.",
    }),
    __metadata("design:type", String)
], ReceiptAdvanceBillDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20' }),
    __metadata("design:type", String)
], ReceiptAdvanceBillDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 14450 }),
    __metadata("design:type", Number)
], ReceiptAdvanceBillDto.prototype, "billAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 14450 }),
    __metadata("design:type", Number)
], ReceiptAdvanceBillDto.prototype, "pendingAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ReceiptAdvanceBillDto.prototype, "voucherId", void 0);
class ReceiptHeaderDto {
    avhVoucherId;
    avhCompanyId;
    avhBranchId;
    avhTenantId;
    avhAccYear;
    avhVoucherTypeId;
    avhVoucherNo;
    avhVoucherSlno;
    avhVoucherRefno;
    avhVoucherDate;
    avhPartyId;
    avhPartyName;
    avhEmployeeId;
    avhUsrRefno;
    avhDocRefno;
    avhDocDate;
    avhDocAmount;
    avhAdjustAmount;
    avhRoundOff;
    avhTotalDebit;
    avhTotalCredit;
    avhRemarks;
    avhVoucherStatus;
    avhStatusOn;
    avhStatusBy;
    avhPostedOn;
    avhCancelReason;
    avhRevisionNo;
    avhReversalVoucherId;
    avhAgainstVoucherId;
    avhPrintCount;
    avhDeviceType;
    avhUserId;
    avhCreatedOn;
    avhCreatedBy;
    avhModifiedOn;
    avhModifiedBy;
}
exports.ReceiptHeaderDto = ReceiptHeaderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptHeaderDto.prototype, "avhVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptHeaderDto.prototype, "avhCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptHeaderDto.prototype, "avhBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ReceiptHeaderDto.prototype, "avhAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 10,
        description: "Resolved from vchr_type_code 'Rct' — the id is a serial.",
    }),
    __metadata("design:type", Number)
], ReceiptHeaderDto.prototype, "avhVoucherTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: '18',
        description: 'BigInt, carried as a string — JSON has no 64-bit integer.',
    }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhVoucherNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '412' }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhVoucherSlno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 'rct00018',
        description: 'NULL only on a DRAFT that has never been approved — ck_avh_no permits that, and only that.',
    }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhVoucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-14' }),
    __metadata("design:type", String)
], ReceiptHeaderDto.prototype, "avhVoucherDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptHeaderDto.prototype, "avhPartyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Sri Krishna Traders' }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhPartyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: String,
        isArray: true,
        format: 'uuid',
        description: 'Collected by. One salesman; more is refused.',
    }),
    __metadata("design:type", Array)
], ReceiptHeaderDto.prototype, "avhEmployeeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '2026-09-14' }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhDocDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 70000,
        description: 'Σ tdAmount. Derived, never accepted from a client.',
    }),
    __metadata("design:type", Number)
], ReceiptHeaderDto.prototype, "avhDocAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 55550, description: "Σ of this voucher's settling rows. Derived." }),
    __metadata("design:type", Number)
], ReceiptHeaderDto.prototype, "avhAdjustAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: 'A receipt collects what the bills say. Nothing to round.',
    }),
    __metadata("design:type", Number)
], ReceiptHeaderDto.prototype, "avhRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 25550,
        description: 'Derived from the legs before the status moves to POSTED.',
    }),
    __metadata("design:type", Number)
], ReceiptHeaderDto.prototype, "avhTotalDebit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 25550 }),
    __metadata("design:type", Number)
], ReceiptHeaderDto.prototype, "avhTotalCredit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.VoucherStatus, example: receipt_enum_1.VoucherStatus.POSTED }),
    __metadata("design:type", String)
], ReceiptHeaderDto.prototype, "avhVoucherStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhStatusOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhStatusBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhPostedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhCancelReason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: 'R20 — how many times this POSTED receipt has been restated in place by /receipts/amend. ' +
            '0 is "as first posted". A client that intends to amend HOLDS this value and sends it ' +
            'straight back as baseRevision: it is the optimistic lock, and an amend carries the whole ' +
            'document, so without it one correction silently undoes another.',
    }),
    __metadata("design:type", Number)
], ReceiptHeaderDto.prototype, "avhRevisionNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhReversalVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        format: 'uuid',
        description: 'Set on a post-dated cheque voucher — it points back at its receipt, and is why it does not list separately.',
    }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhAgainstVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: 'A cache of COUNT(*) over print_log. Refresh with /sync-print-count.',
    }),
    __metadata("design:type", Number)
], ReceiptHeaderDto.prototype, "avhPrintCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'DESKTOP' }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptHeaderDto.prototype, "avhUserId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], ReceiptHeaderDto.prototype, "avhCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ReceiptHeaderDto.prototype, "avhModifiedBy", void 0);
class ReceiptDraftPayloadDto {
    header;
    tenders;
    otherLines;
    expectedRoles;
}
exports.ReceiptDraftPayloadDto = ReceiptDraftPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptHeaderDto }),
    __metadata("design:type", ReceiptHeaderDto)
], ReceiptDraftPayloadDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptTenderDto, isArray: true }),
    __metadata("design:type", Array)
], ReceiptDraftPayloadDto.prototype, "tenders", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ReceiptOtherLineDto,
        isArray: true,
        description: "The server's canonical set — the client's lines plus the BANK_CHARGES / SURCHARGE_RECOVERED " +
            'splits it seeds from the tenders. Held in avh_draft_lines until post.',
    }),
    __metadata("design:type", Array)
], ReceiptDraftPayloadDto.prototype, "otherLines", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: String,
        isArray: true,
        example: ['TDS_RECEIVABLE'],
        description: "Roles the PARTY's own flags imply a line for, that this draft has none of. REPORTED rather " +
            'than seeded because there is no TDS or TCS RATE anywhere in this schema — only the ' +
            'booleans — so the server has no amount to put on the line. The screen prompts and the ' +
            'operator keys what the customer actually withheld.',
    }),
    __metadata("design:type", Array)
], ReceiptDraftPayloadDto.prototype, "expectedRoles", void 0);
class ReceiptDraftSuccessDto {
    success;
    message;
    data;
}
exports.ReceiptDraftSuccessDto = ReceiptDraftSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ReceiptDraftSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Receipt draft saved successfully' }),
    __metadata("design:type", String)
], ReceiptDraftSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptDraftPayloadDto }),
    __metadata("design:type", ReceiptDraftPayloadDto)
], ReceiptDraftSuccessDto.prototype, "data", void 0);
class ReceiptPayloadDto {
    header;
    tenders;
    otherLines;
    legs;
    allocations;
    creditsApplied;
    cheques;
    pdcVouchers;
    advanceBills;
}
exports.ReceiptPayloadDto = ReceiptPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptHeaderDto }),
    __metadata("design:type", ReceiptHeaderDto)
], ReceiptPayloadDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptTenderDto, isArray: true }),
    __metadata("design:type", Array)
], ReceiptPayloadDto.prototype, "tenders", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ReceiptOtherLineDto,
        isArray: true,
        description: 'Empty once posted — the lines are legs now.',
    }),
    __metadata("design:type", Array)
], ReceiptPayloadDto.prototype, "otherLines", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ReceiptLegDto,
        isArray: true,
        description: "The RECEIPT voucher's legs. A PDC voucher's are on its own row.",
    }),
    __metadata("design:type", Array)
], ReceiptPayloadDto.prototype, "legs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ReceiptAllocationDto,
        isArray: true,
        description: 'The rows that settle a bill with money or a deduction — those naming no opposite bill.',
    }),
    __metadata("design:type", Array)
], ReceiptPayloadDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ReceiptAllocationDto,
        isArray: true,
        description: 'The credit PAIRS — every row naming an opposite bill. Two per credit applied: one on the ' +
            'bill being settled, one on the credit being spent.',
    }),
    __metadata("design:type", Array)
], ReceiptPayloadDto.prototype, "creditsApplied", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ReceiptChequeDto,
        isArray: true,
        description: 'One acc_pdc_register row per cheque, post-dated or not.',
    }),
    __metadata("design:type", Array)
], ReceiptPayloadDto.prototype, "cheques", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptPdcVoucherDto, isArray: true }),
    __metadata("design:type", Array)
], ReceiptPayloadDto.prototype, "pdcVouchers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ReceiptAdvanceBillDto,
        isArray: true,
        description: 'R7 — one per voucher that had a remainder.',
    }),
    __metadata("design:type", Array)
], ReceiptPayloadDto.prototype, "advanceBills", void 0);
class ReceiptHeaderSuccessDto {
    success;
    message;
    data;
}
exports.ReceiptHeaderSuccessDto = ReceiptHeaderSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ReceiptHeaderSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Receipt header updated successfully' }),
    __metadata("design:type", String)
], ReceiptHeaderSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptHeaderDto }),
    __metadata("design:type", ReceiptHeaderDto)
], ReceiptHeaderSuccessDto.prototype, "data", void 0);
class ReceiptSuccessDto {
    success;
    message;
    data;
}
exports.ReceiptSuccessDto = ReceiptSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ReceiptSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Receipt fetched successfully' }),
    __metadata("design:type", String)
], ReceiptSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptPayloadDto }),
    __metadata("design:type", ReceiptPayloadDto)
], ReceiptSuccessDto.prototype, "data", void 0);
class ReceiptNumberedVoucherDto {
    voucherId;
    accYear;
    voucherRefno;
    voucherDate;
    docAmount;
    adjustAmount;
    isPdcVoucher;
}
exports.ReceiptNumberedVoucherDto = ReceiptNumberedVoucherDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptNumberedVoucherDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ReceiptNumberedVoucherDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'rct00018' }),
    __metadata("design:type", Object)
], ReceiptNumberedVoucherDto.prototype, "voucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-14' }),
    __metadata("design:type", String)
], ReceiptNumberedVoucherDto.prototype, "voucherDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20000 }),
    __metadata("design:type", Number)
], ReceiptNumberedVoucherDto.prototype, "docAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 24700 }),
    __metadata("design:type", Number)
], ReceiptNumberedVoucherDto.prototype, "adjustAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false, description: 'True on a post-dated cheque voucher.' }),
    __metadata("design:type", Boolean)
], ReceiptNumberedVoucherDto.prototype, "isPdcVoucher", void 0);
class ReceiptBillAfterDto {
    billId;
    billAccYear;
    docRefno;
    billAmount;
    pendingAmount;
    postDatedHeld;
}
exports.ReceiptBillAfterDto = ReceiptBillAfterDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptBillAfterDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ReceiptBillAfterDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'bil00031' }),
    __metadata("design:type", String)
], ReceiptBillAfterDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 48600 }),
    __metadata("design:type", Number)
], ReceiptBillAfterDto.prototype, "billAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 23900 }),
    __metadata("design:type", Number)
], ReceiptBillAfterDto.prototype, "pendingAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 23900,
        description: 'Promised but not yet matured — pending will fall by this on the day the cheque matures.',
    }),
    __metadata("design:type", Number)
], ReceiptBillAfterDto.prototype, "postDatedHeld", void 0);
class ReceiptPostPayloadDto extends ReceiptPayloadDto {
    numberedVouchers;
    billsAfter;
    totalOnAccount;
}
exports.ReceiptPostPayloadDto = ReceiptPostPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptNumberedVoucherDto, isArray: true }),
    __metadata("design:type", Array)
], ReceiptPostPayloadDto.prototype, "numberedVouchers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ReceiptBillAfterDto,
        isArray: true,
        description: 'The proof the settlement landed.',
    }),
    __metadata("design:type", Array)
], ReceiptPostPayloadDto.prototype, "billsAfter", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 14450 }),
    __metadata("design:type", Number)
], ReceiptPostPayloadDto.prototype, "totalOnAccount", void 0);
class ReceiptPostSuccessDto {
    success;
    message;
    data;
}
exports.ReceiptPostSuccessDto = ReceiptPostSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ReceiptPostSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Receipt rct00018 posted with 1 post-dated cheque voucher(s)' }),
    __metadata("design:type", String)
], ReceiptPostSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptPostPayloadDto }),
    __metadata("design:type", ReceiptPostPayloadDto)
], ReceiptPostSuccessDto.prototype, "data", void 0);
class ReceiptAmendUnwoundDto {
    adjustmentsReversed;
    legsRemoved;
    pdcVouchersRemoved;
    chequesRemoved;
    advanceBillsRemoved;
    tendersRemoved;
}
exports.ReceiptAmendUnwoundDto = ReceiptAmendUnwoundDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 3,
        description: 'Negative rows written — one per live adjustment the old post made.',
    }),
    __metadata("design:type", Number)
], ReceiptAmendUnwoundDto.prototype, "adjustmentsReversed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 4,
        description: 'Legs retired, across the receipt and its old PDC vouchers.',
    }),
    __metadata("design:type", Number)
], ReceiptAmendUnwoundDto.prototype, "legsRemoved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 1,
        description: 'Old post-dated cheque vouchers retired. Their numbers are NOT reused.',
    }),
    __metadata("design:type", Number)
], ReceiptAmendUnwoundDto.prototype, "pdcVouchersRemoved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 1,
        description: 'Old acc_pdc_register rows retired — freeing their instrument numbers, which is what lets ' +
            'the corrected cheque be keyed as the number it should have been.',
    }),
    __metadata("design:type", Number)
], ReceiptAmendUnwoundDto.prototype, "chequesRemoved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 1,
        description: 'Old ADVANCE bills retired. Each was proven unspent first.',
    }),
    __metadata("design:type", Number)
], ReceiptAmendUnwoundDto.prototype, "advanceBillsRemoved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Tender rows the new payload replaced.' }),
    __metadata("design:type", Number)
], ReceiptAmendUnwoundDto.prototype, "tendersRemoved", void 0);
class ReceiptAmendPayloadDto extends ReceiptPostPayloadDto {
    fromRevision;
    toRevision;
    editRemark;
    unwound;
}
exports.ReceiptAmendPayloadDto = ReceiptAmendPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'The revision the client sent as baseRevision.' }),
    __metadata("design:type", Number)
], ReceiptAmendPayloadDto.prototype, "fromRevision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Always fromRevision + 1. The slip prints "rev 2".' }),
    __metadata("design:type", Number)
], ReceiptAmendPayloadDto.prototype, "toRevision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'cheque no keyed 55491, actual 55419' }),
    __metadata("design:type", String)
], ReceiptAmendPayloadDto.prototype, "editRemark", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptAmendUnwoundDto }),
    __metadata("design:type", ReceiptAmendUnwoundDto)
], ReceiptAmendPayloadDto.prototype, "unwound", void 0);
class ReceiptAmendSuccessDto {
    success;
    message;
    data;
}
exports.ReceiptAmendSuccessDto = ReceiptAmendSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ReceiptAmendSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Receipt rct00018 amended — now revision 2' }),
    __metadata("design:type", String)
], ReceiptAmendSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptAmendPayloadDto }),
    __metadata("design:type", ReceiptAmendPayloadDto)
], ReceiptAmendSuccessDto.prototype, "data", void 0);
class ReceiptStatusPayloadDto {
    avhVoucherId;
    avhAccYear;
    avhVoucherRefno;
    fromStatus;
    toStatus;
    avhStatusOn;
    avhStatusBy;
}
exports.ReceiptStatusPayloadDto = ReceiptStatusPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptStatusPayloadDto.prototype, "avhVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ReceiptStatusPayloadDto.prototype, "avhAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'rct00018' }),
    __metadata("design:type", Object)
], ReceiptStatusPayloadDto.prototype, "avhVoucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.VoucherStatus, example: receipt_enum_1.VoucherStatus.DRAFT }),
    __metadata("design:type", String)
], ReceiptStatusPayloadDto.prototype, "fromStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.VoucherStatus, example: receipt_enum_1.VoucherStatus.APPROVED }),
    __metadata("design:type", String)
], ReceiptStatusPayloadDto.prototype, "toStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], ReceiptStatusPayloadDto.prototype, "avhStatusOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ReceiptStatusPayloadDto.prototype, "avhStatusBy", void 0);
class ReceiptReversalDto {
    ofVoucherId;
    reversalVoucherId;
    accYear;
    voucherRefno;
    legCount;
    adjustmentCount;
}
exports.ReceiptReversalDto = ReceiptReversalDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The voucher that was reversed.' }),
    __metadata("design:type", String)
], ReceiptReversalDto.prototype, "ofVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptReversalDto.prototype, "reversalVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ReceiptReversalDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'rct00020' }),
    __metadata("design:type", Object)
], ReceiptReversalDto.prototype, "voucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 8 }),
    __metadata("design:type", Number)
], ReceiptReversalDto.prototype, "legCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 7 }),
    __metadata("design:type", Number)
], ReceiptReversalDto.prototype, "adjustmentCount", void 0);
class ReceiptBillReopenedDto {
    billId;
    billAccYear;
    docRefno;
    pendingAmount;
}
exports.ReceiptBillReopenedDto = ReceiptBillReopenedDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptBillReopenedDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ReceiptBillReopenedDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '' }),
    __metadata("design:type", String)
], ReceiptBillReopenedDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 48600 }),
    __metadata("design:type", Number)
], ReceiptBillReopenedDto.prototype, "pendingAmount", void 0);
class ReceiptCancelPayloadDto extends ReceiptStatusPayloadDto {
    reversals;
    billsReopened;
    chequesCancelled;
    advanceBillsRemoved;
}
exports.ReceiptCancelPayloadDto = ReceiptCancelPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ReceiptReversalDto,
        isArray: true,
        description: 'One per voucher — the receipt AND every post-dated cheque voucher.',
    }),
    __metadata("design:type", Array)
], ReceiptCancelPayloadDto.prototype, "reversals", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptBillReopenedDto, isArray: true }),
    __metadata("design:type", Array)
], ReceiptCancelPayloadDto.prototype, "billsReopened", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: String,
        isArray: true,
        format: 'uuid',
        description: 'Register rows moved to CANCELLED.',
    }),
    __metadata("design:type", Array)
], ReceiptCancelPayloadDto.prototype, "chequesCancelled", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, isArray: true, format: 'uuid' }),
    __metadata("design:type", Array)
], ReceiptCancelPayloadDto.prototype, "advanceBillsRemoved", void 0);
class ReceiptCancelSuccessDto {
    success;
    message;
    data;
}
exports.ReceiptCancelSuccessDto = ReceiptCancelSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ReceiptCancelSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Receipt rct00018 cancelled — 2 voucher(s) reversed' }),
    __metadata("design:type", String)
], ReceiptCancelSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptCancelPayloadDto }),
    __metadata("design:type", ReceiptCancelPayloadDto)
], ReceiptCancelSuccessDto.prototype, "data", void 0);
class ReceiptDeletePayloadDto {
    avhVoucherId;
    avhAccYear;
    avhVoucherRefno;
    status;
    deletedOn;
    deletedBy;
    tendersDeleted;
    otherLinesDeleted;
}
exports.ReceiptDeletePayloadDto = ReceiptDeletePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptDeletePayloadDto.prototype, "avhVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], ReceiptDeletePayloadDto.prototype, "avhAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: String,
        nullable: true,
        example: null,
        description: 'Always null — a draft never took a number, which is the whole of R10.',
    }),
    __metadata("design:type", Object)
], ReceiptDeletePayloadDto.prototype, "avhVoucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: receipt_enum_1.VoucherStatus,
        example: receipt_enum_1.VoucherStatus.DRAFT,
        description: 'DRAFT, unchanged. A delete is not a status move: the row leaves play through ' +
            'avh_is_deleted and avh_voucher_status has no DELETED value to stamp.',
    }),
    __metadata("design:type", String)
], ReceiptDeletePayloadDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-17T13:40:02.000Z' }),
    __metadata("design:type", String)
], ReceiptDeletePayloadDto.prototype, "deletedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ReceiptDeletePayloadDto.prototype, "deletedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Tender rows soft-deleted with the header.' }),
    __metadata("design:type", Number)
], ReceiptDeletePayloadDto.prototype, "tendersDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'Other-ledger lines that were in avh_draft_lines.' }),
    __metadata("design:type", Number)
], ReceiptDeletePayloadDto.prototype, "otherLinesDeleted", void 0);
class ReceiptDeleteSuccessDto {
    success;
    message;
    data;
}
exports.ReceiptDeleteSuccessDto = ReceiptDeleteSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ReceiptDeleteSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Draft receipt deleted — 2 tender row(s) removed' }),
    __metadata("design:type", String)
], ReceiptDeleteSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ReceiptDeletePayloadDto }),
    __metadata("design:type", ReceiptDeletePayloadDto)
], ReceiptDeleteSuccessDto.prototype, "data", void 0);
class RegularisePdcPayloadDto {
    asOf;
    billsRegularised;
    billsExamined;
    companyId;
}
exports.RegularisePdcPayloadDto = RegularisePdcPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20' }),
    __metadata("design:type", String)
], RegularisePdcPayloadDto.prototype, "asOf", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 3,
        description: 'R-B1 — bills whose stored figures actually MOVED. **0 on a second run over the same ' +
            'data**, which is how an operator tells a real run from a repeat. It used to be the size ' +
            'of the batch, so a no-op sweep reported work it had not done.',
    }),
    __metadata("design:type", Number)
], RegularisePdcPayloadDto.prototype, "billsRegularised", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 3,
        description: 'Bills examined — every bill in scope holding a matured post-dated row, changed or not. ' +
            'Here so that a 0 above reads as "nothing left to do" rather than as "nothing ran".',
    }),
    __metadata("design:type", Number)
], RegularisePdcPayloadDto.prototype, "billsExamined", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The company swept. Echoed because scope is the point.',
    }),
    __metadata("design:type", String)
], RegularisePdcPayloadDto.prototype, "companyId", void 0);
class RegularisePdcSuccessDto {
    success;
    message;
    data;
}
exports.RegularisePdcSuccessDto = RegularisePdcSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], RegularisePdcSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '3 of 3 bill(s) regularised as at 2026-09-20' }),
    __metadata("design:type", String)
], RegularisePdcSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: RegularisePdcPayloadDto }),
    __metadata("design:type", RegularisePdcPayloadDto)
], RegularisePdcSuccessDto.prototype, "data", void 0);
class AdjacentVoucherDto {
    voucherId;
    accYear;
    companyId;
    branchId;
    voucherRefno;
    voucherDate;
    partyId;
    partyName;
    docAmount;
    status;
}
exports.AdjacentVoucherDto = AdjacentVoucherDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AdjacentVoucherDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], AdjacentVoucherDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AdjacentVoucherDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AdjacentVoucherDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'rct00051' }),
    __metadata("design:type", Object)
], AdjacentVoucherDto.prototype, "voucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-17' }),
    __metadata("design:type", String)
], AdjacentVoucherDto.prototype, "voucherDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AdjacentVoucherDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Sri Krishna Traders' }),
    __metadata("design:type", Object)
], AdjacentVoucherDto.prototype, "partyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5000 }),
    __metadata("design:type", Number)
], AdjacentVoucherDto.prototype, "docAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: receipt_enum_1.VoucherStatus, example: receipt_enum_1.VoucherStatus.POSTED }),
    __metadata("design:type", String)
], AdjacentVoucherDto.prototype, "status", void 0);
class AdjacentVoucherPayloadDto {
    direction;
    fromVoucherId;
    voucher;
}
exports.AdjacentVoucherPayloadDto = AdjacentVoucherPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['prev', 'next'], example: 'prev' }),
    __metadata("design:type", String)
], AdjacentVoucherPayloadDto.prototype, "direction", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Echoed, so a reply about a stale row is obvious.' }),
    __metadata("design:type", String)
], AdjacentVoucherPayloadDto.prototype, "fromVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: AdjacentVoucherDto,
        nullable: true,
        description: 'Null at the end of the register under the filters that were applied — and that null is ' +
            'what greys the key out.',
    }),
    __metadata("design:type", Object)
], AdjacentVoucherPayloadDto.prototype, "voucher", void 0);
class AdjacentVoucherSuccessDto {
    success;
    message;
    data;
}
exports.AdjacentVoucherSuccessDto = AdjacentVoucherSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AdjacentVoucherSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'rct00051 is the prev receipt' }),
    __metadata("design:type", String)
], AdjacentVoucherSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AdjacentVoucherPayloadDto }),
    __metadata("design:type", AdjacentVoucherPayloadDto)
], AdjacentVoucherSuccessDto.prototype, "data", void 0);
class DuplicateReceiptDto {
    voucherId;
    accYear;
    branchId;
    voucherRefno;
    voucherDate;
    docAmount;
    status;
    createdBy;
    createdOn;
}
exports.DuplicateReceiptDto = DuplicateReceiptDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], DuplicateReceiptDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], DuplicateReceiptDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'So a match keyed on another beat is visible as one.',
    }),
    __metadata("design:type", String)
], DuplicateReceiptDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'rct00052' }),
    __metadata("design:type", Object)
], DuplicateReceiptDto.prototype, "voucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-18' }),
    __metadata("design:type", String)
], DuplicateReceiptDto.prototype, "voucherDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5000 }),
    __metadata("design:type", Number)
], DuplicateReceiptDto.prototype, "docAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: receipt_enum_1.VoucherStatus,
        example: receipt_enum_1.VoucherStatus.POSTED,
        description: 'DRAFT, APPROVED or POSTED. CANCELLED never matches — it is not money paid.',
    }),
    __metadata("design:type", String)
], DuplicateReceiptDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, description: 'Who keyed it. Often the whole answer.' }),
    __metadata("design:type", Object)
], DuplicateReceiptDto.prototype, "createdBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-18T09:14:03.412Z' }),
    __metadata("design:type", String)
], DuplicateReceiptDto.prototype, "createdOn", void 0);
class DuplicateCheckPayloadDto {
    isDuplicate;
    matches;
}
exports.DuplicateCheckPayloadDto = DuplicateCheckPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'matches.length > 0 — the one thing the client branches on.',
    }),
    __metadata("design:type", Boolean)
], DuplicateCheckPayloadDto.prototype, "isDuplicate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: DuplicateReceiptDto,
        isArray: true,
        description: 'At most ten. Anything past a handful is the same answer: go and look. **A warning for the ' +
            'client to raise, never a refusal** — two equal cheques on one day is ordinary business.',
    }),
    __metadata("design:type", Array)
], DuplicateCheckPayloadDto.prototype, "matches", void 0);
class DuplicateCheckSuccessDto {
    success;
    message;
    data;
}
exports.DuplicateCheckSuccessDto = DuplicateCheckSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DuplicateCheckSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'No matching receipt — this does not look like a duplicate' }),
    __metadata("design:type", String)
], DuplicateCheckSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DuplicateCheckPayloadDto }),
    __metadata("design:type", DuplicateCheckPayloadDto)
], DuplicateCheckSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=receipt-response.dto.js.map