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
exports.PaymentDeleteSuccessDto = exports.PaymentDeletePayloadDto = exports.PaymentCancelSuccessDto = exports.PaymentCancelPayloadDto = exports.PaymentAmendSuccessDto = exports.PaymentAmendPayloadDto = exports.PaymentAmendUnwoundDto = exports.PaymentPostSuccessDto = exports.PaymentPostPayloadDto = exports.PaymentIssuedLeafDto = exports.PaymentHeaderSuccessDto = exports.PaymentSuccessDto = exports.PaymentPayloadDto = exports.PaymentDraftSuccessDto = exports.PaymentDraftPayloadDto = exports.PaymentChequeDto = exports.PaymentOtherLineDto = exports.PaymentTenderDto = exports.PaymentTenderChequeDto = exports.PaymentBeneficiaryResponseDto = exports.PaymentPartyContextSuccessDto = exports.PaymentPartyContextPayloadDto = exports.PaymentPartyContextSummaryDto = exports.PartyChequeOutDto = exports.PartyRecentPaymentDto = exports.PaymentOpenItemsSuccessDto = exports.PaymentOpenItemsPayloadDto = exports.PaymentOpenItemsSummaryDto = exports.PaymentOpenItemsPartyDto = exports.PaymentBankDto = exports.PayableBillDto = exports.PaymentHeaderDto = exports.PaymentErrorResponseDto = exports.DuplicateCheckSuccessDto = exports.AdjacentVoucherSuccessDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const receipt_response_dto_1 = require("../../receipt/dto/receipt-response.dto");
Object.defineProperty(exports, "AdjacentVoucherSuccessDto", { enumerable: true, get: function () { return receipt_response_dto_1.AdjacentVoucherSuccessDto; } });
Object.defineProperty(exports, "DuplicateCheckSuccessDto", { enumerable: true, get: function () { return receipt_response_dto_1.DuplicateCheckSuccessDto; } });
Object.defineProperty(exports, "PaymentErrorResponseDto", { enumerable: true, get: function () { return receipt_response_dto_1.ReceiptErrorResponseDto; } });
Object.defineProperty(exports, "PaymentHeaderDto", { enumerable: true, get: function () { return receipt_response_dto_1.ReceiptHeaderDto; } });
const payment_enum_1 = require("../types/payment-enum");
class PayableBillDto {
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
    pdcHeld;
    ppdSuggested;
}
exports.PayableBillDto = PayableBillDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PayableBillDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], PayableBillDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: payment_enum_1.BillType, example: payment_enum_1.BillType.PURCHASE }),
    __metadata("design:type", String)
], PayableBillDto.prototype, "billType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'pur00031', description: 'OUR reference — the purchase voucher.' }),
    __metadata("design:type", String)
], PayableBillDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 'INV/2026/1187',
        description: "The SUPPLIER's bill number.",
    }),
    __metadata("design:type", Object)
], PayableBillDto.prototype, "usrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-08' }),
    __metadata("design:type", String)
], PayableBillDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '2026-10-08' }),
    __metadata("design:type", Object)
], PayableBillDto.prototype, "dueDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 48600 }),
    __metadata("design:type", Number)
], PayableBillDto.prototype, "billAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 48600 }),
    __metadata("design:type", Number)
], PayableBillDto.prototype, "pendingAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: payment_enum_1.BillStatus, example: payment_enum_1.BillStatus.OPEN }),
    __metadata("design:type", String)
], PayableBillDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PayableBillDto.prototype, "daysOverdue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: 'Our post-dated cheques already promised against this bill.',
    }),
    __metadata("design:type", Number)
], PayableBillDto.prototype, "pdcHeld", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'R16 — what accounts.ppd_slabs suggests. A suggestion.' }),
    __metadata("design:type", Number)
], PayableBillDto.prototype, "ppdSuggested", void 0);
class PaymentBankDto {
    name;
    accountNo;
    ifsc;
}
exports.PaymentBankDto = PaymentBankDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'KVB' }),
    __metadata("design:type", String)
], PaymentBankDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1234567890' }),
    __metadata("design:type", String)
], PaymentBankDto.prototype, "accountNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'KVBL0001234' }),
    __metadata("design:type", Object)
], PaymentBankDto.prototype, "ifsc", void 0);
class PaymentOpenItemsPartyDto {
    ledId;
    ledName;
    groupName;
    isBillByBill;
    isMoneyLedger;
    isTdsApplicable;
    tdsSection;
    tdsDeducteeType;
    tdsRate;
    tdsRateSource;
    tdsThresholdSingle;
    tdsThresholdAnnual;
    tdsPaidThisYear;
    panPresent;
    bank;
    favouringName;
}
exports.PaymentOpenItemsPartyDto = PaymentOpenItemsPartyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PaymentOpenItemsPartyDto.prototype, "ledId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sundaram Facility Services' }),
    __metadata("design:type", String)
], PaymentOpenItemsPartyDto.prototype, "ledName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Sundry Creditors' }),
    __metadata("design:type", Object)
], PaymentOpenItemsPartyDto.prototype, "groupName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentOpenItemsPartyDto.prototype, "isBillByBill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'notes (56): a payment to a cash / bank ledger is a Contra, and is refused.',
    }),
    __metadata("design:type", Boolean)
], PaymentOpenItemsPartyDto.prototype, "isMoneyLedger", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentOpenItemsPartyDto.prototype, "isTdsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '194C' }),
    __metadata("design:type", Object)
], PaymentOpenItemsPartyDto.prototype, "tdsSection", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'FIRM' }),
    __metadata("design:type", Object)
], PaymentOpenItemsPartyDto.prototype, "tdsDeducteeType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        example: 2,
        description: 'The rate in force today. Null when none is configured.',
    }),
    __metadata("design:type", Object)
], PaymentOpenItemsPartyDto.prototype, "tdsRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, enum: ['MASTER', 'NO_PAN'], example: 'MASTER' }),
    __metadata("design:type", Object)
], PaymentOpenItemsPartyDto.prototype, "tdsRateSource", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 30000 }),
    __metadata("design:type", Object)
], PaymentOpenItemsPartyDto.prototype, "tdsThresholdSingle", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 100000 }),
    __metadata("design:type", Object)
], PaymentOpenItemsPartyDto.prototype, "tdsThresholdAnnual", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Σ base already deducted this year under the section.' }),
    __metadata("design:type", Number)
], PaymentOpenItemsPartyDto.prototype, "tdsPaidThisYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentOpenItemsPartyDto.prototype, "panPresent", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: PaymentBankDto,
        nullable: true,
        description: "The party's default bank account.",
    }),
    __metadata("design:type", Object)
], PaymentOpenItemsPartyDto.prototype, "bank", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Sundaram Facility Services',
        description: 'Who a cheque is made out to.',
    }),
    __metadata("design:type", String)
], PaymentOpenItemsPartyDto.prototype, "favouringName", void 0);
class PaymentOpenItemsSummaryDto {
    totalPending;
    billCount;
    overdueCount;
    creditsHeld;
    pdcHeld;
}
exports.PaymentOpenItemsSummaryDto = PaymentOpenItemsSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 60750 }),
    __metadata("design:type", Number)
], PaymentOpenItemsSummaryDto.prototype, "totalPending", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], PaymentOpenItemsSummaryDto.prototype, "billCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PaymentOpenItemsSummaryDto.prototype, "overdueCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 4000,
        description: 'Σ pending on the debits we hold — advances paid, debit notes. Named as on /receipts: ' +
            'on a payment the held items are the DR side.',
    }),
    __metadata("design:type", Number)
], PaymentOpenItemsSummaryDto.prototype, "creditsHeld", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PaymentOpenItemsSummaryDto.prototype, "pdcHeld", void 0);
class PaymentOpenItemsPayloadDto {
    bills;
    credits;
    summary;
    party;
}
exports.PaymentOpenItemsPayloadDto = PaymentOpenItemsPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: PayableBillDto, isArray: true, description: 'Never paged.' }),
    __metadata("design:type", Array)
], PaymentOpenItemsPayloadDto.prototype, "bills", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: receipt_response_dto_1.OpenCreditDto,
        isArray: true,
        description: 'The debits we hold. drCr is DR on every row.',
    }),
    __metadata("design:type", Array)
], PaymentOpenItemsPayloadDto.prototype, "credits", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentOpenItemsSummaryDto }),
    __metadata("design:type", PaymentOpenItemsSummaryDto)
], PaymentOpenItemsPayloadDto.prototype, "summary", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentOpenItemsPartyDto }),
    __metadata("design:type", PaymentOpenItemsPartyDto)
], PaymentOpenItemsPayloadDto.prototype, "party", void 0);
class PaymentOpenItemsSuccessDto {
    success;
    message;
    data;
}
exports.PaymentOpenItemsSuccessDto = PaymentOpenItemsSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentOpenItemsSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2 open bill(s) and 1 debit(s) held for Sundaram Facility Services' }),
    __metadata("design:type", String)
], PaymentOpenItemsSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentOpenItemsPayloadDto }),
    __metadata("design:type", PaymentOpenItemsPayloadDto)
], PaymentOpenItemsSuccessDto.prototype, "data", void 0);
class PartyRecentPaymentDto {
    voucherId;
    accYear;
    voucherRefno;
    voucherDate;
    docAmount;
    adjustAmount;
    instruments;
}
exports.PartyRecentPaymentDto = PartyRecentPaymentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PartyRecentPaymentDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], PartyRecentPaymentDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'pmt00017' }),
    __metadata("design:type", Object)
], PartyRecentPaymentDto.prototype, "voucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-02' }),
    __metadata("design:type", String)
], PartyRecentPaymentDto.prototype, "voucherDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20000 }),
    __metadata("design:type", Number)
], PartyRecentPaymentDto.prototype, "docAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20000 }),
    __metadata("design:type", Number)
], PartyRecentPaymentDto.prototype, "adjustAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Cheque, NEFT' }),
    __metadata("design:type", Object)
], PartyRecentPaymentDto.prototype, "instruments", void 0);
class PartyChequeOutDto {
    pdcId;
    accYear;
    instrumentNo;
    instrumentDate;
    amount;
    bankName;
    bookNo;
    status;
    voucherId;
    voucherRefno;
}
exports.PartyChequeOutDto = PartyChequeOutDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PartyChequeOutDto.prototype, "pdcId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], PartyChequeOutDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '000123', description: 'The leaf.' }),
    __metadata("design:type", String)
], PartyChequeOutDto.prototype, "instrumentNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20' }),
    __metadata("design:type", String)
], PartyChequeOutDto.prototype, "instrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50000 }),
    __metadata("design:type", Number)
], PartyChequeOutDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'KVB' }),
    __metadata("design:type", Object)
], PartyChequeOutDto.prototype, "bankName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'KVB-2026-A' }),
    __metadata("design:type", Object)
], PartyChequeOutDto.prototype, "bookNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: payment_enum_1.PdcStatus, example: payment_enum_1.PdcStatus.HELD }),
    __metadata("design:type", String)
], PartyChequeOutDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], PartyChequeOutDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'pmt00018' }),
    __metadata("design:type", Object)
], PartyChequeOutDto.prototype, "voucherRefno", void 0);
class PaymentPartyContextSummaryDto {
    totalBalance;
    totalOutstanding;
    totalCredits;
    chequesOutstanding;
}
exports.PaymentPartyContextSummaryDto = PaymentPartyContextSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 56750,
        description: 'What we owe NET: payables less the debits we hold.',
    }),
    __metadata("design:type", Number)
], PaymentPartyContextSummaryDto.prototype, "totalBalance", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 60750 }),
    __metadata("design:type", Number)
], PaymentPartyContextSummaryDto.prototype, "totalOutstanding", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 4000,
        description: 'Σ pending on the debits we hold against them (DR). Named as on /receipts.',
    }),
    __metadata("design:type", Number)
], PaymentPartyContextSummaryDto.prototype, "totalCredits", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 50000,
        description: 'Our post-dated cheques to this party, not yet matured.',
    }),
    __metadata("design:type", Number)
], PaymentPartyContextSummaryDto.prototype, "chequesOutstanding", void 0);
class PaymentPartyContextPayloadDto {
    partyId;
    partyName;
    summary;
    lastPayments;
    ourChequesOut;
}
exports.PaymentPartyContextPayloadDto = PaymentPartyContextPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PaymentPartyContextPayloadDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sundaram Facility Services' }),
    __metadata("design:type", String)
], PaymentPartyContextPayloadDto.prototype, "partyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentPartyContextSummaryDto }),
    __metadata("design:type", PaymentPartyContextSummaryDto)
], PaymentPartyContextPayloadDto.prototype, "summary", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: PartyRecentPaymentDto,
        isArray: true,
        description: 'The last ten POSTED payments.',
    }),
    __metadata("design:type", Array)
], PaymentPartyContextPayloadDto.prototype, "lastPayments", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: PartyChequeOutDto,
        isArray: true,
        description: 'Our cheques to them still HELD.',
    }),
    __metadata("design:type", Array)
], PaymentPartyContextPayloadDto.prototype, "ourChequesOut", void 0);
class PaymentPartyContextSuccessDto {
    success;
    message;
    data;
}
exports.PaymentPartyContextSuccessDto = PaymentPartyContextSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentPartyContextSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Party context fetched successfully' }),
    __metadata("design:type", String)
], PaymentPartyContextSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentPartyContextPayloadDto }),
    __metadata("design:type", PaymentPartyContextPayloadDto)
], PaymentPartyContextSuccessDto.prototype, "data", void 0);
class PaymentBeneficiaryResponseDto {
    name;
    accountNo;
    ifsc;
}
exports.PaymentBeneficiaryResponseDto = PaymentBeneficiaryResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Sundaram Facility Services' }),
    __metadata("design:type", Object)
], PaymentBeneficiaryResponseDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '1234567890' }),
    __metadata("design:type", Object)
], PaymentBeneficiaryResponseDto.prototype, "accountNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'KVBL0001234' }),
    __metadata("design:type", Object)
], PaymentBeneficiaryResponseDto.prototype, "ifsc", void 0);
class PaymentTenderChequeDto {
    chequeBookId;
    bookNo;
    favouring;
    acPayee;
    bankBranch;
    ifsc;
    micr;
    drawerName;
}
exports.PaymentTenderChequeDto = PaymentTenderChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The book the leaf comes from (or came from).' }),
    __metadata("design:type", String)
], PaymentTenderChequeDto.prototype, "chequeBookId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'CB-0007' }),
    __metadata("design:type", Object)
], PaymentTenderChequeDto.prototype, "bookNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Sundaram Facility Services' }),
    __metadata("design:type", Object)
], PaymentTenderChequeDto.prototype, "favouring", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentTenderChequeDto.prototype, "acPayee", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], PaymentTenderChequeDto.prototype, "bankBranch", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], PaymentTenderChequeDto.prototype, "ifsc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], PaymentTenderChequeDto.prototype, "micr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], PaymentTenderChequeDto.prototype, "drawerName", void 0);
class PaymentTenderDto extends receipt_response_dto_1.ReceiptTenderDto {
    beneficiary;
    cheque;
}
exports.PaymentTenderDto = PaymentTenderDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: PaymentBeneficiaryResponseDto,
        nullable: true,
        description: 'On a transfer row: who the money went to. Null on cash and on a cheque.',
    }),
    __metadata("design:type", Object)
], PaymentTenderDto.prototype, "beneficiary", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: PaymentTenderChequeDto,
        nullable: true,
        description: "On a cheque row: the book and how the cheque is made out — the save's own `cheque {}`, " +
            'sent back so a reopened draft can be saved without picking the book again. From the ' +
            "draft's stored detail, or once posted from the register row. Null on every other row.",
    }),
    __metadata("design:type", Object)
], PaymentTenderDto.prototype, "cheque", void 0);
class PaymentOtherLineDto extends receipt_response_dto_1.ReceiptOtherLineDto {
    approvedBy;
}
exports.PaymentOtherLineDto = PaymentOtherLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        format: 'uuid',
        description: 'Who authorised a BALANCES_WRITTEN_BACK line.',
    }),
    __metadata("design:type", Object)
], PaymentOtherLineDto.prototype, "approvedBy", void 0);
class PaymentChequeDto {
    pdcId;
    accYear;
    tenderRowNo;
    instrumentType;
    instrumentNo;
    instrumentDate;
    amount;
    bankName;
    bankLedgerId;
    chequeBookId;
    bookNo;
    favouring;
    acPayee;
    printed;
    printCount;
    status;
    voucherId;
}
exports.PaymentChequeDto = PaymentChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PaymentChequeDto.prototype, "pdcId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], PaymentChequeDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 1 }),
    __metadata("design:type", Object)
], PaymentChequeDto.prototype, "tenderRowNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CHEQUE' }),
    __metadata("design:type", String)
], PaymentChequeDto.prototype, "instrumentType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '000123', description: 'The leaf the book handed out at post.' }),
    __metadata("design:type", String)
], PaymentChequeDto.prototype, "instrumentNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-28' }),
    __metadata("design:type", String)
], PaymentChequeDto.prototype, "instrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50000 }),
    __metadata("design:type", Number)
], PaymentChequeDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'KVB' }),
    __metadata("design:type", Object)
], PaymentChequeDto.prototype, "bankName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        format: 'uuid',
        description: 'The account the cheque is drawn on.',
    }),
    __metadata("design:type", Object)
], PaymentChequeDto.prototype, "bankLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], PaymentChequeDto.prototype, "chequeBookId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'KVB-2026-A' }),
    __metadata("design:type", Object)
], PaymentChequeDto.prototype, "bookNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Sundaram Facility Services' }),
    __metadata("design:type", Object)
], PaymentChequeDto.prototype, "favouring", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentChequeDto.prototype, "acPayee", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PaymentChequeDto.prototype, "printed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PaymentChequeDto.prototype, "printCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: payment_enum_1.PdcStatus, example: payment_enum_1.PdcStatus.HELD }),
    __metadata("design:type", String)
], PaymentChequeDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], PaymentChequeDto.prototype, "voucherId", void 0);
class PaymentDraftPayloadDto {
    header;
    tenders;
    otherLines;
    expectedRoles;
}
exports.PaymentDraftPayloadDto = PaymentDraftPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: receipt_response_dto_1.ReceiptHeaderDto }),
    __metadata("design:type", receipt_response_dto_1.ReceiptHeaderDto)
], PaymentDraftPayloadDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentTenderDto, isArray: true }),
    __metadata("design:type", Array)
], PaymentDraftPayloadDto.prototype, "tenders", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: PaymentOtherLineDto,
        isArray: true,
        description: "The server's canonical set — the client's lines plus BANK_CHARGES and TDS_PAYABLE it seeded.",
    }),
    __metadata("design:type", Array)
], PaymentDraftPayloadDto.prototype, "otherLines", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: String,
        isArray: true,
        example: [],
        description: 'Always empty on a payment: TDS is seeded, not reported.',
    }),
    __metadata("design:type", Array)
], PaymentDraftPayloadDto.prototype, "expectedRoles", void 0);
class PaymentDraftSuccessDto {
    success;
    message;
    data;
}
exports.PaymentDraftSuccessDto = PaymentDraftSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentDraftSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Payment draft saved successfully' }),
    __metadata("design:type", String)
], PaymentDraftSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentDraftPayloadDto }),
    __metadata("design:type", PaymentDraftPayloadDto)
], PaymentDraftSuccessDto.prototype, "data", void 0);
class PaymentPayloadDto {
    header;
    tenders;
    otherLines;
    legs;
    allocations;
    creditsApplied;
    chequesIssued;
    pdcVouchers;
    advanceBills;
}
exports.PaymentPayloadDto = PaymentPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: receipt_response_dto_1.ReceiptHeaderDto }),
    __metadata("design:type", receipt_response_dto_1.ReceiptHeaderDto)
], PaymentPayloadDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentTenderDto, isArray: true }),
    __metadata("design:type", Array)
], PaymentPayloadDto.prototype, "tenders", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: PaymentOtherLineDto,
        isArray: true,
        description: 'Empty once posted — the lines are legs now.',
    }),
    __metadata("design:type", Array)
], PaymentPayloadDto.prototype, "otherLines", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: receipt_response_dto_1.ReceiptLegDto, isArray: true }),
    __metadata("design:type", Array)
], PaymentPayloadDto.prototype, "legs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: receipt_response_dto_1.ReceiptAllocationDto,
        isArray: true,
        description: 'Rows that settle a bill with money or a deduction.',
    }),
    __metadata("design:type", Array)
], PaymentPayloadDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: receipt_response_dto_1.ReceiptAllocationDto,
        isArray: true,
        description: 'The debit PAIRS — two per debit applied.',
    }),
    __metadata("design:type", Array)
], PaymentPayloadDto.prototype, "creditsApplied", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: PaymentChequeDto,
        isArray: true,
        description: 'One register row per cheque issued.',
    }),
    __metadata("design:type", Array)
], PaymentPayloadDto.prototype, "chequesIssued", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: receipt_response_dto_1.ReceiptPdcVoucherDto, isArray: true }),
    __metadata("design:type", Array)
], PaymentPayloadDto.prototype, "pdcVouchers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: receipt_response_dto_1.ReceiptAdvanceBillDto,
        isArray: true,
        description: 'One ADVANCE (DR) bill per voucher with a remainder.',
    }),
    __metadata("design:type", Array)
], PaymentPayloadDto.prototype, "advanceBills", void 0);
class PaymentSuccessDto {
    success;
    message;
    data;
}
exports.PaymentSuccessDto = PaymentSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Payment fetched successfully' }),
    __metadata("design:type", String)
], PaymentSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentPayloadDto }),
    __metadata("design:type", PaymentPayloadDto)
], PaymentSuccessDto.prototype, "data", void 0);
class PaymentHeaderSuccessDto {
    success;
    message;
    data;
}
exports.PaymentHeaderSuccessDto = PaymentHeaderSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentHeaderSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Payment header updated successfully' }),
    __metadata("design:type", String)
], PaymentHeaderSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: receipt_response_dto_1.ReceiptHeaderDto }),
    __metadata("design:type", receipt_response_dto_1.ReceiptHeaderDto)
], PaymentHeaderSuccessDto.prototype, "data", void 0);
class PaymentIssuedLeafDto {
    tdRowNo;
    apdId;
    apdAccYear;
    leaf;
    bookNo;
}
exports.PaymentIssuedLeafDto = PaymentIssuedLeafDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PaymentIssuedLeafDto.prototype, "tdRowNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PaymentIssuedLeafDto.prototype, "apdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], PaymentIssuedLeafDto.prototype, "apdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '000123' }),
    __metadata("design:type", String)
], PaymentIssuedLeafDto.prototype, "leaf", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'KVB-2026-A' }),
    __metadata("design:type", String)
], PaymentIssuedLeafDto.prototype, "bookNo", void 0);
class PaymentPostPayloadDto extends PaymentPayloadDto {
    numberedVouchers;
    billsAfter;
    totalOnAccount;
    cheques;
}
exports.PaymentPostPayloadDto = PaymentPostPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: receipt_response_dto_1.ReceiptNumberedVoucherDto, isArray: true }),
    __metadata("design:type", Array)
], PaymentPostPayloadDto.prototype, "numberedVouchers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: receipt_response_dto_1.ReceiptBillAfterDto, isArray: true }),
    __metadata("design:type", Array)
], PaymentPostPayloadDto.prototype, "billsAfter", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PaymentPostPayloadDto.prototype, "totalOnAccount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: PaymentIssuedLeafDto,
        isArray: true,
        description: 'The leaf each cheque row got.',
    }),
    __metadata("design:type", Array)
], PaymentPostPayloadDto.prototype, "cheques", void 0);
class PaymentPostSuccessDto {
    success;
    message;
    data;
}
exports.PaymentPostSuccessDto = PaymentPostSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentPostSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Payment pmt00018 posted' }),
    __metadata("design:type", String)
], PaymentPostSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentPostPayloadDto }),
    __metadata("design:type", PaymentPostPayloadDto)
], PaymentPostSuccessDto.prototype, "data", void 0);
class PaymentAmendUnwoundDto {
    adjustmentsReversed;
    legsRemoved;
    pdcVouchersRemoved;
    chequesRemoved;
    advanceBillsRemoved;
    tendersRemoved;
    tdsReversed;
}
exports.PaymentAmendUnwoundDto = PaymentAmendUnwoundDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], PaymentAmendUnwoundDto.prototype, "adjustmentsReversed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 4 }),
    __metadata("design:type", Number)
], PaymentAmendUnwoundDto.prototype, "legsRemoved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PaymentAmendUnwoundDto.prototype, "pdcVouchersRemoved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 1,
        description: 'Leaves of the old post now CANCELLED ("Amended into revision N"). They stay on the ' +
            'register and in the book — a leaf once out is never handed out again. Each carries ' +
            'apd_amended_into_revision = N, so it does not block a later cancel or amend (notes 63).',
    }),
    __metadata("design:type", Number)
], PaymentAmendUnwoundDto.prototype, "chequesRemoved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PaymentAmendUnwoundDto.prototype, "advanceBillsRemoved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], PaymentAmendUnwoundDto.prototype, "tendersRemoved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'TDS register rows reversed.' }),
    __metadata("design:type", Number)
], PaymentAmendUnwoundDto.prototype, "tdsReversed", void 0);
class PaymentAmendPayloadDto extends PaymentPostPayloadDto {
    fromRevision;
    toRevision;
    editRemark;
    unwound;
}
exports.PaymentAmendPayloadDto = PaymentAmendPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PaymentAmendPayloadDto.prototype, "fromRevision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PaymentAmendPayloadDto.prototype, "toRevision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'paid to the wrong bank account' }),
    __metadata("design:type", String)
], PaymentAmendPayloadDto.prototype, "editRemark", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentAmendUnwoundDto }),
    __metadata("design:type", PaymentAmendUnwoundDto)
], PaymentAmendPayloadDto.prototype, "unwound", void 0);
class PaymentAmendSuccessDto {
    success;
    message;
    data;
}
exports.PaymentAmendSuccessDto = PaymentAmendSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentAmendSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Payment pmt00018 amended — now revision 1' }),
    __metadata("design:type", String)
], PaymentAmendSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentAmendPayloadDto }),
    __metadata("design:type", PaymentAmendPayloadDto)
], PaymentAmendSuccessDto.prototype, "data", void 0);
class PaymentCancelPayloadDto extends receipt_response_dto_1.ReceiptStatusPayloadDto {
    reversals;
    billsReopened;
    chequesCancelled;
    advanceBillsRemoved;
    tdsReversed;
}
exports.PaymentCancelPayloadDto = PaymentCancelPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: receipt_response_dto_1.ReceiptReversalDto, isArray: true }),
    __metadata("design:type", Array)
], PaymentCancelPayloadDto.prototype, "reversals", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: receipt_response_dto_1.ReceiptBillReopenedDto, isArray: true }),
    __metadata("design:type", Array)
], PaymentCancelPayloadDto.prototype, "billsReopened", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, isArray: true, format: 'uuid' }),
    __metadata("design:type", Array)
], PaymentCancelPayloadDto.prototype, "chequesCancelled", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, isArray: true, format: 'uuid' }),
    __metadata("design:type", Array)
], PaymentCancelPayloadDto.prototype, "advanceBillsRemoved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PaymentCancelPayloadDto.prototype, "tdsReversed", void 0);
class PaymentCancelSuccessDto {
    success;
    message;
    data;
}
exports.PaymentCancelSuccessDto = PaymentCancelSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentCancelSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Payment pmt00018 cancelled — 1 voucher(s) reversed' }),
    __metadata("design:type", String)
], PaymentCancelSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentCancelPayloadDto }),
    __metadata("design:type", PaymentCancelPayloadDto)
], PaymentCancelSuccessDto.prototype, "data", void 0);
class PaymentDeletePayloadDto {
    avhVoucherId;
    avhAccYear;
    avhVoucherRefno;
    status;
    deletedOn;
    deletedBy;
    tendersDeleted;
    otherLinesDeleted;
}
exports.PaymentDeletePayloadDto = PaymentDeletePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PaymentDeletePayloadDto.prototype, "avhVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], PaymentDeletePayloadDto.prototype, "avhAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, nullable: true, example: null }),
    __metadata("design:type", Object)
], PaymentDeletePayloadDto.prototype, "avhVoucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: payment_enum_1.VoucherStatus, example: payment_enum_1.VoucherStatus.DRAFT }),
    __metadata("design:type", String)
], PaymentDeletePayloadDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-28T13:40:02.000Z' }),
    __metadata("design:type", String)
], PaymentDeletePayloadDto.prototype, "deletedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PaymentDeletePayloadDto.prototype, "deletedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], PaymentDeletePayloadDto.prototype, "tendersDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PaymentDeletePayloadDto.prototype, "otherLinesDeleted", void 0);
class PaymentDeleteSuccessDto {
    success;
    message;
    data;
}
exports.PaymentDeleteSuccessDto = PaymentDeleteSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaymentDeleteSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Draft payment deleted — 2 tender row(s) removed' }),
    __metadata("design:type", String)
], PaymentDeleteSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentDeletePayloadDto }),
    __metadata("design:type", PaymentDeletePayloadDto)
], PaymentDeleteSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=payment-response.dto.js.map