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
exports.MobileReceiptStatusSuccessDto = exports.MobileReceiptStatusPayloadDto = exports.MobileOpenBillsSuccessDto = exports.MobileOpenBillsDto = exports.MobileReceiptCreateSuccessDto = exports.MobileReceiptCreateResultDto = exports.MobileReceiptOptionsSuccessDto = exports.MobileReceiptOptionsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const mobile_receipt_plan_1 = require("../mobile-receipt-plan");
class MobileReceiptTenderOptionDto {
    tenderId;
    typeId;
    typeCode;
    name;
    shortName;
    needsRef;
    refLabel;
    isDefault;
    surchargePerc;
    surchargeAmount;
    requiresBank;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Send it as tdTenderId' }),
    __metadata("design:type", String)
], MobileReceiptTenderOptionDto.prototype, "tenderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3, description: 'Send it as tdTenderTypeId' }),
    __metadata("design:type", Number)
], MobileReceiptTenderOptionDto.prototype, "typeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'UPI',
        description: "The tender type's name: CASH, CARD, UPI, WALLET, CHEQUE, BANK, VOUCHER, ... (never CREDIT, LOYALTY, TEMP_CR, RRN or ADJUST)",
    }),
    __metadata("design:type", String)
], MobileReceiptTenderOptionDto.prototype, "typeCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'UPI' }),
    __metadata("design:type", String)
], MobileReceiptTenderOptionDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReceiptTenderOptionDto.prototype, "shortName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The row needs tdRefNo. A CHEQUE always does, and tdBankName and tdInstrumentDate too; a ' +
            "card's reference is its last 4 digits",
    }),
    __metadata("design:type", Boolean)
], MobileReceiptTenderOptionDto.prototype, "needsRef", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: 'UTR No' }),
    __metadata("design:type", Object)
], MobileReceiptTenderOptionDto.prototype, "refLabel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileReceiptTenderOptionDto.prototype, "isDefault", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '1.000',
        description: 'Surcharge the customer pays for this tender, INSIDE tdAmount (200 by UPI at 1% is tdAmount 202.00, of which 2.00 is surcharge and settles no bill)',
    }),
    __metadata("design:type", String)
], MobileReceiptTenderOptionDto.prototype, "surchargePerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '0.00', description: 'Flat surcharge when there is no percentage' }),
    __metadata("design:type", String)
], MobileReceiptTenderOptionDto.prototype, "surchargeAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The row needs tdBankName (with tdRefNo and tdInstrumentDate): true for a cheque',
    }),
    __metadata("design:type", Boolean)
], MobileReceiptTenderOptionDto.prototype, "requiresBank", void 0);
class MobileReceiptSettingsDto {
    receiptBillSort;
    salesmanMandatory;
    pdcPostingMode;
    ppdEnabled;
}
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['DUE_DATE', 'BILL_DATE'],
        description: "accounts.receipt_bill_sort, the company's: the order open bills are listed and filled in",
    }),
    __metadata("design:type", String)
], MobileReceiptSettingsDto.prototype, "receiptBillSort", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "accounts.receipt_salesman_mandatory at the receipt's branch: a receipt must name its collector",
    }),
    __metadata("design:type", Boolean)
], MobileReceiptSettingsDto.prototype, "salesmanMandatory", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['ON_RECEIPT', 'ON_CLEARING'],
        description: "accounts.pdc_posting_mode at the receipt's branch",
    }),
    __metadata("design:type", String)
], MobileReceiptSettingsDto.prototype, "pdcPostingMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "accounts.ppd_slabs (the company's) has a slab: open bills carry a ppdSchedule",
    }),
    __metadata("design:type", Boolean)
], MobileReceiptSettingsDto.prototype, "ppdEnabled", void 0);
class MobileReceiptOptionsDto {
    companyId;
    branchId;
    tenders;
    settings;
}
exports.MobileReceiptOptionsDto = MobileReceiptOptionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReceiptOptionsDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "The branch the phone's receipts for this company land in: the phone's own branch when " +
            "it belongs to the company, else the company's default branch, else its only branch",
    }),
    __metadata("design:type", String)
], MobileReceiptOptionsDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [MobileReceiptTenderOptionDto],
        description: "The company's live, active tenders of that branch (or of every branch) in force today, " +
            'with a ledger, of every type the desktop Receipt screen offers, in display order',
    }),
    __metadata("design:type", Array)
], MobileReceiptOptionsDto.prototype, "tenders", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReceiptSettingsDto }),
    __metadata("design:type", MobileReceiptSettingsDto)
], MobileReceiptOptionsDto.prototype, "settings", void 0);
class MobileReceiptOptionsSuccessDto {
    success;
    message;
    data;
}
exports.MobileReceiptOptionsSuccessDto = MobileReceiptOptionsSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileReceiptOptionsSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReceiptOptionsSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReceiptOptionsDto }),
    __metadata("design:type", MobileReceiptOptionsDto)
], MobileReceiptOptionsSuccessDto.prototype, "data", void 0);
class MobileReceiptAllocationDto {
    billId;
    billAccYear;
    docRefno;
    amount;
    discount;
    roundoff;
    pendingAmount;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'accounts.acc_bill_balance.abl_id' }),
    __metadata("design:type", String)
], MobileReceiptAllocationDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], MobileReceiptAllocationDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'bil01234', description: "The bill's number" }),
    __metadata("design:type", String)
], MobileReceiptAllocationDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '500.00',
        description: 'What this receipt settled on the bill: money and credits, not the discount or round-off',
    }),
    __metadata("design:type", String)
], MobileReceiptAllocationDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '10.00', description: 'The prompt-payment discount given on the bill' }),
    __metadata("design:type", String)
], MobileReceiptAllocationDto.prototype, "discount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '0.40', description: 'The round-off given on the bill' }),
    __metadata("design:type", String)
], MobileReceiptAllocationDto.prototype, "roundoff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        example: '680.00',
        description: 'What the bill still owes now',
    }),
    __metadata("design:type", Object)
], MobileReceiptAllocationDto.prototype, "pendingAmount", void 0);
class MobileReceiptCreditAppliedDto {
    billId;
    billAccYear;
    docRefno;
    amount;
    pendingAmount;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The credit (acc_bill_balance.abl_id)' }),
    __metadata("design:type", String)
], MobileReceiptCreditAppliedDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], MobileReceiptCreditAppliedDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ADV00012' }),
    __metadata("design:type", String)
], MobileReceiptCreditAppliedDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '400.00', description: 'How much of it this receipt applied to bills' }),
    __metadata("design:type", String)
], MobileReceiptCreditAppliedDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        example: '100.00',
        description: 'What the credit still holds now',
    }),
    __metadata("design:type", Object)
], MobileReceiptCreditAppliedDto.prototype, "pendingAmount", void 0);
class MobileReceiptPdcVoucherDto {
    voucherId;
    voucherRefno;
    chequeDate;
    amount;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReceiptPdcVoucherDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: 'RCT00043' }),
    __metadata("design:type", Object)
], MobileReceiptPdcVoucherDto.prototype, "voucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-30', description: "The cheque's date (the voucher's)" }),
    __metadata("design:type", String)
], MobileReceiptPdcVoucherDto.prototype, "chequeDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1500.00' }),
    __metadata("design:type", String)
], MobileReceiptPdcVoucherDto.prototype, "amount", void 0);
class MobileReceiptAdjustedDto {
    billId;
    billAccYear;
    docRefno;
    planned;
    applied;
    reason;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The bill or the credit' }),
    __metadata("design:type", String)
], MobileReceiptAdjustedDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], MobileReceiptAdjustedDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'bil01300' }),
    __metadata("design:type", String)
], MobileReceiptAdjustedDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '500.00', description: "The phone's amount for it" }),
    __metadata("design:type", String)
], MobileReceiptAdjustedDto.prototype, "planned", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '300.00', description: 'What was posted on it' }),
    __metadata("design:type", String)
], MobileReceiptAdjustedDto.prototype, "applied", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: mobile_receipt_plan_1.MobileReceiptAdjustReason,
        description: 'BILL_SETTLED: the bill was no longer open, nothing posted on it. BILL_REDUCED: it took ' +
            'less (it owed less now, or a credit it was to get was spent). CREDIT_REDUCED: the credit ' +
            'held less, or the bills could not take it all. PDC_ON_CLEARING: reserved, never sent today.',
    }),
    __metadata("design:type", String)
], MobileReceiptAdjustedDto.prototype, "reason", void 0);
class MobileReceiptCreateResultDto {
    avhVoucherId;
    avhCompanyId;
    avhBranchId;
    avhAccYear;
    avhVoucherRefno;
    avhUsrRefno;
    avhVoucherDate;
    avhDocAmount;
    avhVoucherStatus;
    allocations;
    onAccount;
    duplicate;
    avhIsDeleted;
    creditsApplied;
    pdcVouchers;
    adjusted;
    employeeId;
}
exports.MobileReceiptCreateResultDto = MobileReceiptCreateResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReceiptCreateResultDto.prototype, "avhVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReceiptCreateResultDto.prototype, "avhCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReceiptCreateResultDto.prototype, "avhBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], MobileReceiptCreateResultDto.prototype, "avhAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        example: 'RCT00042',
        description: "VK Nex's receipt number. Store it on the phone.",
    }),
    __metadata("design:type", Object)
], MobileReceiptCreateResultDto.prototype, "avhVoucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, description: "The phone's own number, as sent" }),
    __metadata("design:type", Object)
], MobileReceiptCreateResultDto.prototype, "avhUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-17' }),
    __metadata("design:type", String)
], MobileReceiptCreateResultDto.prototype, "avhVoucherDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1000.00', description: 'Σ tdAmount' }),
    __metadata("design:type", String)
], MobileReceiptCreateResultDto.prototype, "avhDocAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'POSTED',
        description: 'Now: POSTED when just saved; a resend reads the stored one (CANCELLED)',
    }),
    __metadata("design:type", String)
], MobileReceiptCreateResultDto.prototype, "avhVoucherStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [MobileReceiptAllocationDto],
        description: 'The bills it settles now, in the order the money filled them (open-items order). Empty once cancelled.',
    }),
    __metadata("design:type", Array)
], MobileReceiptCreateResultDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '320.00',
        description: 'What it holds on account (its ADVANCE bill); 0.00 when the bills took it all',
    }),
    __metadata("design:type", String)
], MobileReceiptCreateResultDto.prototype, "onAccount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'true = saved before under this avhClientUuid; nothing written now' }),
    __metadata("design:type", Boolean)
], MobileReceiptCreateResultDto.prototype, "duplicate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'A resend of a receipt the office has since deleted' }),
    __metadata("design:type", Boolean)
], MobileReceiptCreateResultDto.prototype, "avhIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [MobileReceiptCreditAppliedDto],
        description: 'The credits it spends now. Empty once cancelled.',
    }),
    __metadata("design:type", Array)
], MobileReceiptCreateResultDto.prototype, "creditsApplied", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [MobileReceiptPdcVoucherDto],
        description: "Its post-dated cheques' own vouchers, dated the cheque",
    }),
    __metadata("design:type", Array)
], MobileReceiptCreateResultDto.prototype, "pdcVouchers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [MobileReceiptAdjustedDto],
        description: "Where the server settled less than the phone planned (the plan against what the receipt settles now). Empty for an older phone's upload and once cancelled.",
    }),
    __metadata("design:type", Array)
], MobileReceiptCreateResultDto.prototype, "adjusted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        format: 'uuid',
        description: "The collector (employee_master.emp_id): the login's employee, or null",
    }),
    __metadata("design:type", Object)
], MobileReceiptCreateResultDto.prototype, "employeeId", void 0);
class MobileReceiptCreateSuccessDto {
    success;
    message;
    data;
}
exports.MobileReceiptCreateSuccessDto = MobileReceiptCreateSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileReceiptCreateSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReceiptCreateSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReceiptCreateResultDto }),
    __metadata("design:type", MobileReceiptCreateResultDto)
], MobileReceiptCreateSuccessDto.prototype, "data", void 0);
class MobilePpdStepDto {
    tillDate;
    perc;
    amount;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-26', description: 'The last receipt date this step applies to' }),
    __metadata("design:type", String)
], MobilePpdStepDto.prototype, "tillDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2.000', description: 'Percent of what is pending' }),
    __metadata("design:type", String)
], MobilePpdStepDto.prototype, "perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '13.60',
        description: "That percent of today's pending: the most a discount may be (D4)",
    }),
    __metadata("design:type", String)
], MobilePpdStepDto.prototype, "amount", void 0);
class MobileOpenBillDto {
    partyId;
    billId;
    billAccYear;
    billType;
    docRefno;
    docDate;
    dueDate;
    billAmount;
    pendingAmount;
    daysOverdue;
    kind;
    paidAmount;
    pdcHeld;
    ppdSchedule;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The customer id (= its ledger id)' }),
    __metadata("design:type", String)
], MobileOpenBillDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'accounts.acc_bill_balance.abl_id' }),
    __metadata("design:type", String)
], MobileOpenBillDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], MobileOpenBillDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['SALES', 'OPENING', 'INTEREST', 'JOURNAL', 'PURCHASE_RETURN', 'ADVANCE', 'SALES_RETURN'],
    }),
    __metadata("design:type", String)
], MobileOpenBillDto.prototype, "billType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'bil01300' }),
    __metadata("design:type", String)
], MobileOpenBillDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-17' }),
    __metadata("design:type", String)
], MobileOpenBillDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: '2026-12-17' }),
    __metadata("design:type", Object)
], MobileOpenBillDto.prototype, "dueDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1180.00' }),
    __metadata("design:type", String)
], MobileOpenBillDto.prototype, "billAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '680.00',
        description: 'What it still owes (on a credit: what it still holds, always > 0)',
    }),
    __metadata("design:type", String)
], MobileOpenBillDto.prototype, "pendingAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Days past the due date on onDate (0 on a credit)' }),
    __metadata("design:type", Number)
], MobileOpenBillDto.prototype, "daysOverdue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['BILL', 'ADVANCE', 'SALES_RETURN', 'OPENING_CR', 'JOURNAL_CR'] }),
    __metadata("design:type", String)
], MobileOpenBillDto.prototype, "kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '500.00',
        description: 'billAmount - pendingAmount: already settled (on a credit: already used)',
    }),
    __metadata("design:type", String)
], MobileOpenBillDto.prototype, "paidAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '0.00',
        description: 'Post-dated cheque money promised against the bill, not yet matured',
    }),
    __metadata("design:type", String)
], MobileOpenBillDto.prototype, "pdcHeld", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [MobilePpdStepDto],
        description: 'The prompt-payment discount steps still ahead of onDate. For a receipt dated D take the ' +
            'FIRST step whose tillDate >= D; none = no discount. [] without PPD and on a credit.',
    }),
    __metadata("design:type", Array)
], MobileOpenBillDto.prototype, "ppdSchedule", void 0);
class MobileOpenBillsDto {
    items;
    total;
    page;
    pageSize;
    hasMore;
    companyId;
    onDate;
}
exports.MobileOpenBillsDto = MobileOpenBillsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [MobileOpenBillDto],
        description: 'By party, then in /receipts/open-items order within the party (accounts.receipt_bill_sort), then by id',
    }),
    __metadata("design:type", Array)
], MobileOpenBillsDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Every open bill of the company's customers (with withCredits, and every held credit)",
    }),
    __metadata("design:type", Number)
], MobileOpenBillsDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileOpenBillsDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileOpenBillsDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileOpenBillsDto.prototype, "hasMore", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileOpenBillsDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-17', description: 'The day daysOverdue is measured on' }),
    __metadata("design:type", String)
], MobileOpenBillsDto.prototype, "onDate", void 0);
class MobileOpenBillsSuccessDto {
    success;
    message;
    data;
}
exports.MobileOpenBillsSuccessDto = MobileOpenBillsSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileOpenBillsSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileOpenBillsSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileOpenBillsDto }),
    __metadata("design:type", MobileOpenBillsDto)
], MobileOpenBillsSuccessDto.prototype, "data", void 0);
class MobileReceiptChequeDto {
    voucherId;
    voucherRefno;
    instrumentNo;
    chequeDate;
    amount;
    status;
    houseStatus;
    isPostDated;
}
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        format: 'uuid',
        description: "The voucher carrying it now: the receipt, or the post-dated cheque's own voucher",
    }),
    __metadata("design:type", Object)
], MobileReceiptChequeDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: 'RCT00043' }),
    __metadata("design:type", Object)
], MobileReceiptChequeDto.prototype, "voucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '445123' }),
    __metadata("design:type", String)
], MobileReceiptChequeDto.prototype, "instrumentNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-30' }),
    __metadata("design:type", String)
], MobileReceiptChequeDto.prototype, "chequeDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1500.00' }),
    __metadata("design:type", String)
], MobileReceiptChequeDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['HELD', 'CLEARED', 'BOUNCED', 'CANCELLED'],
        description: 'HELD (register HELD or DEPOSITED), CLEARED, BOUNCED, CANCELLED (RETURNED, CANCELLED, REPLACED)',
    }),
    __metadata("design:type", String)
], MobileReceiptChequeDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['HELD', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'RETURNED', 'CANCELLED', 'REPLACED'],
        description: 'acc_pdc_register.apd_status as is',
    }),
    __metadata("design:type", String)
], MobileReceiptChequeDto.prototype, "houseStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Dated after the receipt' }),
    __metadata("design:type", Boolean)
], MobileReceiptChequeDto.prototype, "isPostDated", void 0);
class MobileReceiptStatusDto {
    avhClientUuid;
    avhVoucherId;
    avhAccYear;
    avhVoucherRefno;
    avhVoucherStatus;
    cancelledOn;
    cancelReason;
    pdc;
    updatedOn;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReceiptStatusDto.prototype, "avhClientUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReceiptStatusDto.prototype, "avhVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], MobileReceiptStatusDto.prototype, "avhAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: 'RCT00042' }),
    __metadata("design:type", Object)
], MobileReceiptStatusDto.prototype, "avhVoucherRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'POSTED', enum: ['POSTED', 'CANCELLED', 'DRAFT', 'APPROVED'] }),
    __metadata("design:type", String)
], MobileReceiptStatusDto.prototype, "avhVoucherStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: '2026-11-19T09:30:00.000Z' }),
    __metadata("design:type", Object)
], MobileReceiptStatusDto.prototype, "cancelledOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileReceiptStatusDto.prototype, "cancelReason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReceiptChequeDto] }),
    __metadata("design:type", Array)
], MobileReceiptStatusDto.prototype, "pdc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-11-19T09:30:00.000Z',
        description: 'The last change to the receipt or one of its cheques',
    }),
    __metadata("design:type", String)
], MobileReceiptStatusDto.prototype, "updatedOn", void 0);
class MobileReceiptStatusPayloadDto {
    items;
    total;
    page;
    pageSize;
    hasMore;
    companyId;
    asOf;
}
exports.MobileReceiptStatusPayloadDto = MobileReceiptStatusPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReceiptStatusDto], description: 'Oldest change first' }),
    __metadata("design:type", Array)
], MobileReceiptStatusPayloadDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileReceiptStatusPayloadDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileReceiptStatusPayloadDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileReceiptStatusPayloadDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileReceiptStatusPayloadDto.prototype, "hasMore", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileReceiptStatusPayloadDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-11-19T09:25:00.000Z',
        description: "This read's time less a five-minute overlap: send it back as `since` (inclusive) next time",
    }),
    __metadata("design:type", String)
], MobileReceiptStatusPayloadDto.prototype, "asOf", void 0);
class MobileReceiptStatusSuccessDto {
    success;
    message;
    data;
}
exports.MobileReceiptStatusSuccessDto = MobileReceiptStatusSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileReceiptStatusSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileReceiptStatusSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileReceiptStatusPayloadDto }),
    __metadata("design:type", MobileReceiptStatusPayloadDto)
], MobileReceiptStatusSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=mobile-receipt-response.dto.js.map