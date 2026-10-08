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
exports.UpdatePaymentHeaderDto = exports.SaveDraftPaymentDto = exports.SavePaymentDto = exports.SavePaymentOtherLineDto = exports.SavePaymentTenderDto = exports.PaymentBeneficiaryDto = exports.SavePaymentChequeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_tender_detail_dto_1 = require("../../tenderDetail/dto/save-tender-detail.dto");
const post_receipt_dto_1 = require("../../receipt/dto/post-receipt.dto");
const payment_enum_1 = require("../types/payment-enum");
class SavePaymentChequeDto extends save_tender_detail_dto_1.TenderChequeDetailDto {
    chequeBookId;
    favouring;
    acPayee;
}
exports.SavePaymentChequeDto = SavePaymentChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'accounts.acc_cheque_book.acb_id — the book the leaf comes from. The bank the cheque is ' +
            "drawn on is the book's. Required on a cheque row.",
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePaymentChequeDto.prototype, "chequeBookId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 150,
        description: 'Who the cheque is made out to. Defaults to the party name.',
    }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], SavePaymentChequeDto.prototype, "favouring", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true, description: 'A/c payee crossing.' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SavePaymentChequeDto.prototype, "acPayee", void 0);
class PaymentBeneficiaryDto {
    name;
    accountNo;
    ifsc;
}
exports.PaymentBeneficiaryDto = PaymentBeneficiaryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 150 }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], PaymentBeneficiaryDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 50 }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], PaymentBeneficiaryDto.prototype, "accountNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 11 }),
    (0, dtoDecorators_1.NullableString)(11),
    __metadata("design:type", Object)
], PaymentBeneficiaryDto.prototype, "ifsc", void 0);
class SavePaymentTenderDto {
    tdId;
    tdRowNo;
    tdTenderId;
    tdTenderTypeId;
    tdTenderLedgerId;
    tdAmount;
    tdReceivedAmt;
    tdChangeAmt;
    tdMdrAmt;
    tdRefNo;
    tdBankName;
    tdPayerVpa;
    tdInstrumentDate;
    tdNotes;
    cheque;
    beneficiary;
}
exports.SavePaymentTenderDto = SavePaymentTenderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Present = update that row.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SavePaymentTenderDto.prototype, "tdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, example: 1 }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], SavePaymentTenderDto.prototype, "tdRowNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'accounts.acc_tender_master.tnd_id.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePaymentTenderDto.prototype, "tdTenderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 6,
        description: 'acc_tender_types.ttm_type_id, checked against the master.',
    }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], SavePaymentTenderDto.prototype, "tdTenderTypeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The ledger the money leaves. A snapshot of the tender master unless tnd_edit_ledger is ' +
            "set. On a CHEQUE row it is always the book's bank and this field is ignored.",
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SavePaymentTenderDto.prototype, "tdTenderLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5000, minimum: 0, description: 'The face value. Must be > 0.' }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], SavePaymentTenderDto.prototype, "tdAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 5000, minimum: 0, description: 'Cash only.' }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SavePaymentTenderDto.prototype, "tdReceivedAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, minimum: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SavePaymentTenderDto.prototype, "tdChangeAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 10,
        minimum: 0,
        description: "The bank's charge on this transfer, INSIDE tdAmount: tdAmount is what leaves our bank " +
            '(the bank leg is credited gross of its charge) and the party receives tdAmount − ' +
            'tdMdrAmt — the mirror of a receipt, where the customer pays tdAmount and the acquirer ' +
            'keeps tdMdrAmt. The server seeds a BANK_CHARGES (DR) other-line from it if the client did ' +
            'not, and refuses one that disagrees. TDS is worked out on what the party receives.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SavePaymentTenderDto.prototype, "tdMdrAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 100,
        example: 'UTR445123',
        description: 'The UTR / transaction id on a transfer. NOT accepted on a cheque row — the leaf is taken at post.',
    }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SavePaymentTenderDto.prototype, "tdRefNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 150, example: 'KVB' }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], SavePaymentTenderDto.prototype, "tdBankName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SavePaymentTenderDto.prototype, "tdPayerVpa", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '2026-09-20',
        description: 'The date on the cheque. Defaults to the payment date. Later than the payment date makes ' +
            'it post-dated, which gives it a voucher of its own dated this day (R2).',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SavePaymentTenderDto.prototype, "tdInstrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 250 }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SavePaymentTenderDto.prototype, "tdNotes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => SavePaymentChequeDto,
        description: 'Cheque detail. Required on a cheque row (the book), ignored on any other.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SavePaymentChequeDto),
    __metadata("design:type", SavePaymentChequeDto)
], SavePaymentTenderDto.prototype, "cheque", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => PaymentBeneficiaryDto,
        description: "The supplier's account a transfer goes to. Ignored on cash and on a cheque.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PaymentBeneficiaryDto),
    __metadata("design:type", PaymentBeneficiaryDto)
], SavePaymentTenderDto.prototype, "beneficiary", void 0);
class SavePaymentOtherLineDto {
    role;
    ledgerId;
    drCr;
    amount;
    settlesBill;
    narration;
    approvedBy;
}
exports.SavePaymentOtherLineDto = SavePaymentOtherLineDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'INTEREST_PAID',
        description: 'One of TDS_PAYABLE, BANK_CHARGES, INTEREST_PAID, BALANCES_WRITTEN_BACK.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.UpperMaxString)(30),
    __metadata("design:type", String)
], SavePaymentOtherLineDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'A ledger chosen by hand, when no role fits. Never the party.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SavePaymentOtherLineDto.prototype, "ledgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: payment_enum_1.DrCr,
        description: 'Checked against the role: an expense on top is DR, a deduction that settles is CR. ' +
            'A line claiming the wrong side is refused.',
    }),
    (0, class_validator_1.IsIn)(Object.values(payment_enum_1.DrCr)),
    __metadata("design:type", String)
], SavePaymentOtherLineDto.prototype, "drCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 200, minimum: 0 }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], SavePaymentOtherLineDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Does this line REDUCE what we owe on a bill? True for TDS and a balance written back — ' +
            'the bill closes for its full face and the withheld part goes to a ledger. A DR line never ' +
            'settles and the flag is ignored on one.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SavePaymentOtherLineDto.prototype, "settlesBill", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 250 }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SavePaymentOtherLineDto.prototype, "narration", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Who authorised a BALANCES_WRITTEN_BACK line above accounts.writeoff_approval_above ' +
            '(whose default of 0 means every one).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], SavePaymentOtherLineDto.prototype, "approvedBy", void 0);
class SavePaymentDto {
    avhVoucherId;
    avhCompanyId;
    avhBranchId;
    avhAccYear;
    avhTenantId;
    avhVoucherDate;
    avhPartyId;
    avhEmployeeId;
    avhUsrRefno;
    avhDocRefno;
    avhDocDate;
    avhRemarks;
    avhDeviceType;
    avhDeviceId;
    avhSessionId;
    avhUserId;
    tenders;
    otherLines;
    replace;
}
exports.SavePaymentDto = SavePaymentDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Present = edit that DRAFT.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SavePaymentDto.prototype, "avhVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePaymentDto.prototype, "avhCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePaymentDto.prototype, "avhBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], SavePaymentDto.prototype, "avhAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], SavePaymentDto.prototype, "avhTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-28', description: 'Must fall in an OPEN, unlocked year.' }),
    (0, dtoDecorators_1.UpperMaxString)(10),
    __metadata("design:type", String)
], SavePaymentDto.prototype, "avhVoucherDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The payee — a supplier id, a customer id (a refund) or a ledger id, all the same value. ' +
            'Any live party ledger is accepted (D1). A cash or bank ledger is refused: that is a Contra.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePaymentDto.prototype, "avhPartyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        format: 'uuid',
        description: 'Paid by. ONE employee; mandatory when accounts.payment_salesman_mandatory is on.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(5),
    __metadata("design:type", Array)
], SavePaymentDto.prototype, "avhEmployeeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SavePaymentDto.prototype, "avhUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SavePaymentDto.prototype, "avhDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-09-28' }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SavePaymentDto.prototype, "avhDocDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(2000),
    __metadata("design:type", Object)
], SavePaymentDto.prototype, "avhRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: payment_enum_1.VoucherDeviceType }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(Object.values(payment_enum_1.VoucherDeviceType)),
    __metadata("design:type", String)
], SavePaymentDto.prototype, "avhDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SavePaymentDto.prototype, "avhDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], SavePaymentDto.prototype, "avhSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Falls back to the authenticated user.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SavePaymentDto.prototype, "avhUserId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => SavePaymentTenderDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SavePaymentTenderDto),
    __metadata("design:type", Array)
], SavePaymentDto.prototype, "tenders", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: () => SavePaymentOtherLineDto, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SavePaymentOtherLineDto),
    __metadata("design:type", Array)
], SavePaymentDto.prototype, "otherLines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'true — the arrays ARE the document. false leaves unmentioned tender rows alone.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SavePaymentDto.prototype, "replace", void 0);
class SaveDraftPaymentDto extends SavePaymentDto {
    allocations;
    creditsApplied;
}
exports.SaveDraftPaymentDto = SaveDraftPaymentDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => post_receipt_dto_1.PostReceiptAllocationDto,
        isArray: true,
        description: 'The bill-wise settlement as the operator left it, REMEMBERED, never applied or validated. ' +
            'Omit the key to leave what is remembered alone; send [] to clear it.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => post_receipt_dto_1.PostReceiptAllocationDto),
    __metadata("design:type", Array)
], SaveDraftPaymentDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => post_receipt_dto_1.PostReceiptCreditDto,
        isArray: true,
        description: 'The debits we hold that the operator ticked, remembered on the same terms.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => post_receipt_dto_1.PostReceiptCreditDto),
    __metadata("design:type", Array)
], SaveDraftPaymentDto.prototype, "creditsApplied", void 0);
class UpdatePaymentHeaderDto extends post_receipt_dto_1.ReceiptKeysDto {
    avhRemarks;
    avhUsrRefno;
    avhDocRefno;
    avhDocDate;
    avhEmployeeId;
    editRemark;
}
exports.UpdatePaymentHeaderDto = UpdatePaymentHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(2000),
    __metadata("design:type", Object)
], UpdatePaymentHeaderDto.prototype, "avhRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], UpdatePaymentHeaderDto.prototype, "avhUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], UpdatePaymentHeaderDto.prototype, "avhDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-09-28' }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], UpdatePaymentHeaderDto.prototype, "avhDocDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], format: 'uuid', description: 'Paid by. One id.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(5),
    __metadata("design:type", Array)
], UpdatePaymentHeaderDto.prototype, "avhEmployeeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 500, description: 'Why. Appended to the status trail.' }),
    (0, dtoDecorators_1.UpperMaxString)(500),
    __metadata("design:type", String)
], UpdatePaymentHeaderDto.prototype, "editRemark", void 0);
//# sourceMappingURL=save-payment.dto.js.map