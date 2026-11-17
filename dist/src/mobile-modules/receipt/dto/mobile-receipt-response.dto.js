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
exports.MobileOpenBillsSuccessDto = exports.MobileOpenBillsDto = exports.MobileReceiptCreateSuccessDto = exports.MobileReceiptCreateResultDto = exports.MobileReceiptOptionsSuccessDto = exports.MobileReceiptOptionsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
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
    (0, swagger_1.ApiProperty)({ enum: ['CASH', 'CARD', 'UPI', 'WALLET', 'CHEQUE', 'BANK'] }),
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
class MobileReceiptOptionsDto {
    companyId;
    branchId;
    tenders;
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
            'with a ledger, of type CASH / CARD / UPI / WALLET / CHEQUE / BANK, in display order',
    }),
    __metadata("design:type", Array)
], MobileReceiptOptionsDto.prototype, "tenders", void 0);
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
    (0, swagger_1.ApiProperty)({ example: '500.00', description: 'What this receipt settled on the bill' }),
    __metadata("design:type", String)
], MobileReceiptAllocationDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        example: '680.00',
        description: 'What the bill still owes now',
    }),
    __metadata("design:type", Object)
], MobileReceiptAllocationDto.prototype, "pendingAmount", void 0);
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
    (0, swagger_1.ApiProperty)({ enum: ['SALES', 'OPENING', 'INTEREST', 'JOURNAL', 'PURCHASE_RETURN'] }),
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
    (0, swagger_1.ApiProperty)({ example: '680.00', description: 'What it still owes' }),
    __metadata("design:type", String)
], MobileOpenBillDto.prototype, "pendingAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Days past the due date on onDate' }),
    __metadata("design:type", Number)
], MobileOpenBillDto.prototype, "daysOverdue", void 0);
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
    (0, swagger_1.ApiProperty)({ description: 'Every open bill of the company' }),
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
//# sourceMappingURL=mobile-receipt-response.dto.js.map