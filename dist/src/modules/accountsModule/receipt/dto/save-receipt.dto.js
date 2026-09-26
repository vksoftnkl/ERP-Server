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
exports.RegularisePdcDto = exports.UpdateReceiptHeaderDto = exports.SaveDraftReceiptDto = exports.SaveReceiptDto = exports.SaveReceiptOtherLineDto = exports.SaveReceiptTenderDto = exports.SaveReceiptChequeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const receipt_enum_1 = require("../types/receipt-enum");
const post_receipt_dto_1 = require("./post-receipt.dto");
const save_tender_detail_dto_1 = require("../../tenderDetail/dto/save-tender-detail.dto");
class SaveReceiptChequeDto extends save_tender_detail_dto_1.TenderChequeDetailDto {
    bankLedgerId;
}
exports.SaveReceiptChequeDto = SaveReceiptChequeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The bank the cheque will be banked into. Null until the deposit is decided.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], SaveReceiptChequeDto.prototype, "bankLedgerId", void 0);
class SaveReceiptTenderDto {
    tdId;
    tdRowNo;
    tdTenderId;
    tdTenderTypeId;
    tdTenderLedgerId;
    tdAmount;
    tdReceivedAmt;
    tdChangeAmt;
    tdMdrAmt;
    tdSurchargePerc;
    tdSurchargeAmt;
    tdRefNo;
    tdAuthCode;
    tdCardLast4;
    tdBankName;
    tdPayerVpa;
    tdInstrumentDate;
    tdNotes;
    cheque;
}
exports.SaveReceiptTenderDto = SaveReceiptTenderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Present = update that row.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveReceiptTenderDto.prototype, "tdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, example: 1 }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], SaveReceiptTenderDto.prototype, "tdRowNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'accounts.acc_tender_master.tnd_id.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveReceiptTenderDto.prototype, "tdTenderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 5,
        description: 'accounts.acc_tender_types.ttm_type_id. Checked against the master — a row claiming a type ' +
            'its tender does not have is refused rather than silently corrected.',
    }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], SaveReceiptTenderDto.prototype, "tdTenderTypeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The ledger the money lands in. A SNAPSHOT of the tender master unless tnd_edit_ledger is ' +
            "set, in which case this is honoured. Omit it and the server takes the master's.",
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveReceiptTenderDto.prototype, "tdTenderLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5000, minimum: 0, description: 'The face value. Must be > 0.' }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], SaveReceiptTenderDto.prototype, "tdAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 5000,
        minimum: 0,
        description: 'Cash only. received − change must equal tdAmount (ck_td_cash_change).',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveReceiptTenderDto.prototype, "tdReceivedAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, minimum: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveReceiptTenderDto.prototype, "tdChangeAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 10,
        minimum: 0,
        description: "The acquirer's cut, which never reaches the bank. The server seeds a BANK_CHARGES " +
            'other-line from it if the client did not, and refuses one that disagrees.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveReceiptTenderDto.prototype, "tdMdrAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        description: 'What the CUSTOMER was charged for paying this way — income, and not the same figure as ' +
            'tdMdrAmt. Taken from the master unless tnd_edit_surcharge is set.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveReceiptTenderDto.prototype, "tdSurchargePerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveReceiptTenderDto.prototype, "tdSurchargeAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100, example: '445123' }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveReceiptTenderDto.prototype, "tdRefNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 50 }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveReceiptTenderDto.prototype, "tdAuthCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 4, example: '4242' }),
    (0, dtoDecorators_1.NullableString)(4),
    __metadata("design:type", Object)
], SaveReceiptTenderDto.prototype, "tdCardLast4", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 150, example: 'KVB' }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], SaveReceiptTenderDto.prototype, "tdBankName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveReceiptTenderDto.prototype, "tdPayerVpa", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '2026-09-20',
        description: 'The date on the instrument. REQUIRED on a cheque. Later than the receipt date makes it ' +
            'post-dated, which gives it a voucher of its own dated this day (R2).',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveReceiptTenderDto.prototype, "tdInstrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 250 }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveReceiptTenderDto.prototype, "tdNotes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => SaveReceiptChequeDto,
        description: 'Cheque detail. Ignored on a non-cheque row.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SaveReceiptChequeDto),
    __metadata("design:type", SaveReceiptChequeDto)
], SaveReceiptTenderDto.prototype, "cheque", void 0);
class SaveReceiptOtherLineDto {
    role;
    ledgerId;
    drCr;
    amount;
    settlesBill;
    narration;
}
exports.SaveReceiptOtherLineDto = SaveReceiptOtherLineDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'TDS_RECEIVABLE',
        description: 'accounts.acc_ledger_role.alr_role. One of TDS_RECEIVABLE, BANK_CHARGES, ' +
            'SURCHARGE_RECOVERED, CLAIMS_ALLOWED, INTEREST_INCOME, TCS_PAYABLE.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.UpperMaxString)(30),
    __metadata("design:type", String)
], SaveReceiptOtherLineDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'A ledger chosen by hand, when no role fits. Must be live, visible to the company, and NOT ' +
            'the party — a line pointing at the party would settle their bill with their own balance.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveReceiptOtherLineDto.prototype, "ledgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: receipt_enum_1.DrCr,
        description: 'Checked against the role: an expense or asset is DR, income and a tax payable are CR. A ' +
            'line claiming the wrong side is refused rather than silently unbalancing the voucher.',
    }),
    (0, class_validator_1.IsIn)(Object.values(receipt_enum_1.DrCr)),
    __metadata("design:type", String)
], SaveReceiptOtherLineDto.prototype, "drCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 700, minimum: 0 }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], SaveReceiptOtherLineDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Does this line REDUCE what the party owes on a bill? True for TDS and a claim — the bill ' +
            'closes for its full face and the withheld part goes to a ledger. False for a line that is ' +
            'merely part of the money moving; it then flows to on account instead of settling anything. ' +
            'A CR line never settles and the flag is ignored on one.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveReceiptOtherLineDto.prototype, "settlesBill", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 250, example: 'damage claim CN-88' }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveReceiptOtherLineDto.prototype, "narration", void 0);
class SaveReceiptDto {
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
exports.SaveReceiptDto = SaveReceiptDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Present = edit that DRAFT. A POSTED receipt is refused here (R3).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveReceiptDto.prototype, "avhVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveReceiptDto.prototype, "avhCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveReceiptDto.prototype, "avhBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], SaveReceiptDto.prototype, "avhAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], SaveReceiptDto.prototype, "avhTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-14', description: 'Must fall in an OPEN, unlocked year.' }),
    (0, dtoDecorators_1.UpperMaxString)(10),
    __metadata("design:type", String)
], SaveReceiptDto.prototype, "avhVoucherDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The party — a customer id, a supplier id or a ledger id, which are all the same value. ' +
            'Any live ledger the company can see is accepted (R5); one holding no bills simply gets an ' +
            'empty panel.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveReceiptDto.prototype, "avhPartyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        format: 'uuid',
        description: 'Collected by (R6). An ARRAY because avh_employee_id is one, but a receipt names ONE ' +
            'salesman; more than one is refused. Mandatory when accounts.receipt_salesman_mandatory is on.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(5),
    __metadata("design:type", Array)
], SaveReceiptDto.prototype, "avhEmployeeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveReceiptDto.prototype, "avhUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 100,
        description: "The party's own reference. Unique per company/party/type/year (ux_avh_doc_refno).",
    }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveReceiptDto.prototype, "avhDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-09-14' }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveReceiptDto.prototype, "avhDocDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(2000),
    __metadata("design:type", Object)
], SaveReceiptDto.prototype, "avhRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: receipt_enum_1.VoucherDeviceType }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(Object.values(receipt_enum_1.VoucherDeviceType)),
    __metadata("design:type", String)
], SaveReceiptDto.prototype, "avhDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveReceiptDto.prototype, "avhDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], SaveReceiptDto.prototype, "avhSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Falls back to the authenticated user when omitted.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveReceiptDto.prototype, "avhUserId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => SaveReceiptTenderDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaveReceiptTenderDto),
    __metadata("design:type", Array)
], SaveReceiptDto.prototype, "tenders", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: () => SaveReceiptOtherLineDto, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaveReceiptOtherLineDto),
    __metadata("design:type", Array)
], SaveReceiptDto.prototype, "otherLines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'true — the default — means the arrays ARE the document: a tender row left out is removed. ' +
            'false leaves rows the payload did not mention alone.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveReceiptDto.prototype, "replace", void 0);
class SaveDraftReceiptDto extends SaveReceiptDto {
    allocations;
    creditsApplied;
}
exports.SaveDraftReceiptDto = SaveDraftReceiptDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => post_receipt_dto_1.PostReceiptAllocationDto,
        isArray: true,
        description: 'The bill-wise settlement as the operator left it, REMEMBERED so reopening the draft does ' +
            'not lose it. Same shape /receipts/post takes.\n\n' +
            '**Nothing is applied.** No acc_bill_adjustment row is written and no abl_pending_amount ' +
            'moves (R10) — a draft still touches no bill, which is what lets two people hold drafts ' +
            "against the same party without reserving each other's outstanding.\n\n" +
            '**Nothing is validated.** A remembered figure can go stale between saving and reopening ' +
            'if somebody else settles the same bill, and it is handed back exactly as it was stored. ' +
            'Re-read /receipts/open-items on reopen and clamp each figure to what the bill can still ' +
            'take — refusing the load here would cost the whole draft to save one number.\n\n' +
            'OMIT the key to leave whatever is already remembered alone; send `[]` to clear it. A ' +
            'client that has never heard of this field cannot wipe it.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => post_receipt_dto_1.PostReceiptAllocationDto),
    __metadata("design:type", Array)
], SaveDraftReceiptDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => post_receipt_dto_1.PostReceiptCreditDto,
        isArray: true,
        description: 'The credits the operator had ticked, remembered on the same terms as `allocations` — not ' +
            'applied, not validated, and omitted rather than emptied to leave them alone.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => post_receipt_dto_1.PostReceiptCreditDto),
    __metadata("design:type", Array)
], SaveDraftReceiptDto.prototype, "creditsApplied", void 0);
class UpdateReceiptHeaderDto extends post_receipt_dto_1.ReceiptKeysDto {
    avhRemarks;
    avhUsrRefno;
    avhDocRefno;
    avhDocDate;
    avhEmployeeId;
    editRemark;
}
exports.UpdateReceiptHeaderDto = UpdateReceiptHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(2000),
    __metadata("design:type", Object)
], UpdateReceiptHeaderDto.prototype, "avhRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], UpdateReceiptHeaderDto.prototype, "avhUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], UpdateReceiptHeaderDto.prototype, "avhDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-09-14' }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], UpdateReceiptHeaderDto.prototype, "avhDocDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        format: 'uuid',
        description: 'Collected by (R6). **One id, exactly as /receipts/create requires** — the column is an ' +
            "array because every voucher header's is, not because a collection may be shared. Sending " +
            'an empty array clears it, and is refused when accounts.receipt_salesman_mandatory is on.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(5),
    __metadata("design:type", Array)
], UpdateReceiptHeaderDto.prototype, "avhEmployeeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 500,
        description: "Why. Appended to the document's status trail; not optional.",
    }),
    (0, dtoDecorators_1.UpperMaxString)(500),
    __metadata("design:type", String)
], UpdateReceiptHeaderDto.prototype, "editRemark", void 0);
class RegularisePdcDto {
    companyId;
    branchId;
    accYear;
    asOf;
}
exports.RegularisePdcDto = RegularisePdcDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The company to sweep. Required: a sweep is a write, and writes are scoped.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], RegularisePdcDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Narrow the sweep to one branch. **Omit it for the nightly run.** A bill raised at one ' +
            'branch is settled at another all the time and outstanding is company-wide, so a sweep ' +
            'pinned to a branch leaves matured cheques uncounted.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], RegularisePdcDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-2027',
        description: 'Narrow the sweep to settlements booked in one accounting year. **Omit it for the nightly ' +
            'run.** acc_bill_balance is partitioned by the year a bill ORIGINATED in and is never ' +
            'carried forward, so a sweep pinned to this year walks past every bill raised before it.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], RegularisePdcDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-09-20',
        description: 'Regularise every post-dated settlement maturing ON OR BEFORE this date. Defaults to today. ' +
            'Idempotent, and a run after an outage repairs every day that was missed.',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], RegularisePdcDto.prototype, "asOf", void 0);
//# sourceMappingURL=save-receipt.dto.js.map