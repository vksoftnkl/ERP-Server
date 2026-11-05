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
exports.DeleteReceiptDto = exports.GetReceiptQueryDto = exports.CancelReceiptDto = exports.PostReceiptDto = exports.PostReceiptOtherLinePinDto = exports.PostReceiptCreditDto = exports.PostReceiptAllocationDto = exports.ReceiptKeysDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class ReceiptKeysDto {
    avhVoucherId;
    avhCompanyId;
    avhBranchId;
    avhAccYear;
}
exports.ReceiptKeysDto = ReceiptKeysDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ReceiptKeysDto.prototype, "avhVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ReceiptKeysDto.prototype, "avhCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ReceiptKeysDto.prototype, "avhBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], ReceiptKeysDto.prototype, "avhAccYear", void 0);
class PostReceiptAllocationDto {
    billId;
    billAccYear;
    amount;
    discount;
    writeoff;
    roundoff;
    writeoffApprovedBy;
}
exports.PostReceiptAllocationDto = PostReceiptAllocationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'accounts.acc_bill_balance.abl_id.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PostReceiptAllocationDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-2027',
        description: 'The bill is keyed on (id, year) — the table is partitioned, so both travel.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], PostReceiptAllocationDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 48600,
        minimum: 0,
        description: "This bill's TOTAL settlement by this receipt, EXCLUDING discount and write-off — money, " +
            'TDS, claims and credits together. The engine splits it into rows; the client does not say ' +
            'which source pays which part.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], PostReceiptAllocationDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 0,
        minimum: 0,
        description: 'The prompt-payment discount AS THE OPERATOR LEFT IT. open-items suggested a figure; if ' +
            'they cleared it, send 0 and 0 is what posts. The server NEVER re-seeds (§12).',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PostReceiptAllocationDto.prototype, "discount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, minimum: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PostReceiptAllocationDto.prototype, "writeoff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 0,
        minimum: 0,
        example: 0.4,
        description: 'The paise this bill is rounded off by — 4,999.60 collected as 5,000. Sits beside ' +
            '`discount` and behaves exactly like it: it SETTLES the bill, it posts its own leg to the ' +
            'ROUND_OFF ledger, and it is **not money received**.\n\n' +
            '**Do not fold it into `amount`.** `amount` is money, and a round-off folded into it makes ' +
            'the receipt claim to have collected more than it did — which §5.2 step 4 refuses, out by ' +
            'exactly the round-off.\n\n' +
            "Positive only, in the customer's favour. Collecting MORE than the bill is not expressible " +
            'here and is not meant to be: ck_abj_reversal_sign refuses a negative adjustment row, and ' +
            'an overpayment is already what `onAccount` is for.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PostReceiptAllocationDto.prototype, "roundoff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Who authorised the write-off. Required whenever writeoff > 0 and above ' +
            'accounts.writeoff_approval_above — whose default of 0 means always.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], PostReceiptAllocationDto.prototype, "writeoffApprovedBy", void 0);
class PostReceiptCreditDto {
    billId;
    billAccYear;
    amount;
}
exports.PostReceiptCreditDto = PostReceiptCreditDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The ADVANCE or SALES_RETURN bill being spent.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PostReceiptCreditDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], PostReceiptCreditDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 4000,
        minimum: 0,
        description: 'How much of it to apply. It must all land on bills — a credit cannot be held on account ' +
            'again, because moving a number between two rows of the same table changes nothing and ' +
            'produces a trail saying money arrived when none did.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], PostReceiptCreditDto.prototype, "amount", void 0);
class PostReceiptOtherLinePinDto {
    lineNo;
    billId;
    billAccYear;
    amount;
}
exports.PostReceiptOtherLinePinDto = PostReceiptOtherLinePinDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 1,
        description: "The other-line's 1-based position in the DRAFT's otherLines array.",
    }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], PostReceiptOtherLinePinDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PostReceiptOtherLinePinDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], PostReceiptOtherLinePinDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 700, minimum: 0 }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], PostReceiptOtherLinePinDto.prototype, "amount", void 0);
class PostReceiptDto extends ReceiptKeysDto {
    allocations;
    creditsApplied = [];
    otherLineBills = [];
    onAccount;
}
exports.PostReceiptDto = PostReceiptDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: () => PostReceiptAllocationDto,
        isArray: true,
        description: 'IN ORDER. The order is the order money fills the bills, and it is the order open-items ' +
            'returned them in — which is what accounts.receipt_bill_sort asked for.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PostReceiptAllocationDto),
    __metadata("design:type", Array)
], PostReceiptDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: () => PostReceiptCreditDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PostReceiptCreditDto),
    __metadata("design:type", Array)
], PostReceiptDto.prototype, "creditsApplied", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: () => PostReceiptOtherLinePinDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PostReceiptOtherLinePinDto),
    __metadata("design:type", Array)
], PostReceiptDto.prototype, "otherLineBills", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 14450,
        minimum: 0,
        description: 'What is left over and will be held as an ADVANCE bill (R7). Recomputed server-side and ' +
            'refused if it disagrees — this is the single figure that proves the client and the server ' +
            'read the same receipt.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], PostReceiptDto.prototype, "onAccount", void 0);
class CancelReceiptDto extends ReceiptKeysDto {
    reason;
}
exports.CancelReceiptDto = CancelReceiptDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 250,
        description: 'Why. ck_avh_cancel refuses a CANCELLED voucher without one.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(250),
    __metadata("design:type", String)
], CancelReceiptDto.prototype, "reason", void 0);
class GetReceiptQueryDto extends ReceiptKeysDto {
}
exports.GetReceiptQueryDto = GetReceiptQueryDto;
class DeleteReceiptDto extends ReceiptKeysDto {
}
exports.DeleteReceiptDto = DeleteReceiptDto;
//# sourceMappingURL=post-receipt.dto.js.map