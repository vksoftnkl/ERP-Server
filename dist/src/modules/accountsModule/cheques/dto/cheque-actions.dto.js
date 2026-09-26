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
exports.ReturnChequeDto = exports.ReplaceChequeDto = exports.ReplacementChequeDto = exports.RepresentChequeDto = exports.BounceChequeDto = exports.ClearChequeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const receipt_enum_1 = require("../../receipt/types/receipt-enum");
const cheque_keys_dto_1 = require("./cheque-keys.dto");
class ClearChequeDto extends cheque_keys_dto_1.ChequeKeysDto {
    clearDate;
    bankDate;
    allocations = [];
    remarks;
}
exports.ClearChequeDto = ClearChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-09-22',
        description: 'The day the money became ours. On or after the deposit date (ck_apd_seq) and not in the ' +
            'future.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(10),
    __metadata("design:type", String)
], ClearChequeDto.prototype, "clearDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-09-22',
        nullable: true,
        description: 'The date the BANK says it happened, which is not always the day we recorded it. Goes to ' +
            'av_recon_date on the bank leg — the hook bank reconciliation hangs off. Defaults to ' +
            'clearDate.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(10),
    __metadata("design:type", Object)
], ClearChequeDto.prototype, "bankDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => cheque_keys_dto_1.ChequeAllocationDto,
        isArray: true,
        description: 'ON_CLEARING rows ONLY — under ON_RECEIPT the receipt already settled the bills and this ' +
            'must be empty. An empty array on an ON_CLEARING row means auto-FIFO, not "settle ' +
            'nothing": money that arrives always goes somewhere, and the remainder becomes an ADVANCE.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => cheque_keys_dto_1.ChequeAllocationDto),
    __metadata("design:type", Array)
], ClearChequeDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 500 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(500),
    __metadata("design:type", Object)
], ClearChequeDto.prototype, "remarks", void 0);
class BounceChequeDto extends cheque_keys_dto_1.ChequeKeysDto {
    bounceDate;
    reason;
    reasonText;
    bankCharge;
    partyCharge;
}
exports.BounceChequeDto = BounceChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-09-14',
        description: 'On or after the deposit date (ck_apd_seq) and not in the future.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(10),
    __metadata("design:type", String)
], BounceChequeDto.prototype, "bounceDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 150,
        example: 'Funds insufficient',
        description: 'Why the bank sent it back. ck_apd_bounced refuses a BOUNCED row without one. ' +
            'accounts.bounce_reasons is a PRE-FILL and not a whitelist — any non-blank reason is ' +
            'accepted, because a bank returns cheques for reasons no list anticipates.',
    }),
    (0, dtoDecorators_1.TrimmedString)(150),
    __metadata("design:type", String)
], BounceChequeDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 500,
        description: 'The free text behind a reason of "Other", or whatever the bank actually wrote.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(500),
    __metadata("design:type", Object)
], BounceChequeDto.prototype, "reasonText", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        default: 0,
        minimum: 0,
        example: 250,
        description: 'What the BANK charged US to return it. An expense we bear — posts DR BANK_CHARGES / ' +
            'CR the bank. 0 skips both legs and resolves no role.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], BounceChequeDto.prototype, "bankCharge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        default: 0,
        minimum: 0,
        example: 300,
        description: 'What WE charge the party for bouncing. Income — posts DR party / CR ' +
            'BOUNCE_CHARGES_RECOVERED and raises a JOURNAL bill they now owe. NOT the same number as ' +
            'bankCharge. 0 skips the legs, the bill and the role.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], BounceChequeDto.prototype, "partyCharge", void 0);
class RepresentChequeDto extends cheque_keys_dto_1.ChequeKeysDto {
    bankLedgerId;
    depositDate;
    slipNo;
    allocations = [];
    remarks;
}
exports.RepresentChequeDto = RepresentChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'A live BANK ledger of this company.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], RepresentChequeDto.prototype, "bankLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-25' }),
    (0, dtoDecorators_1.UpperMaxString)(10),
    __metadata("design:type", String)
], RepresentChequeDto.prototype, "depositDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50, example: 'D-137' }),
    (0, dtoDecorators_1.TrimmedString)(50),
    __metadata("design:type", String)
], RepresentChequeDto.prototype, "slipNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => cheque_keys_dto_1.ChequeAllocationDto,
        isArray: true,
        description: 'ON_RECEIPT only, and optional — an OVERRIDE, for the rare case where the operator really ' +
            'is re-pointing the money at different bills.\n\n' +
            'LEAVE IT OUT and the re-issued credit goes back on the bills the bounce took it off, ' +
            'with the amounts it took — a re-presentation is the same money for the same debt, and ' +
            'the per-bill split lives in the reversed adjustment rows. It is NOT auto-FIFO: settling ' +
            "whichever of the party's invoices sorts first would pay a bill this cheque was never " +
            'against. If a bill cannot take its share back — deleted, or paid by something else since ' +
            'the bounce — the whole re-presentation is refused with a 409 naming that bill, rather ' +
            'than the money landing somewhere else.\n\n' +
            "The bounce-charge bill is in the party's open items, so it may be named here like any " +
            'other.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => cheque_keys_dto_1.ChequeAllocationDto),
    __metadata("design:type", Array)
], RepresentChequeDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 500 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(500),
    __metadata("design:type", Object)
], RepresentChequeDto.prototype, "remarks", void 0);
class ReplacementChequeDto {
    instrumentNo;
    instrumentDate;
    amount;
    bankName;
    bankBranch;
    ifsc;
    micr;
    drawerName;
}
exports.ReplacementChequeDto = ReplacementChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30, example: '221955' }),
    (0, dtoDecorators_1.TrimmedString)(30),
    __metadata("design:type", String)
], ReplacementChequeDto.prototype, "instrumentNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-10-05',
        description: 'ck_apd_dates: within three months before and one year after today, because the new row ' +
            'is received TODAY.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(10),
    __metadata("design:type", String)
], ReplacementChequeDto.prototype, "instrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 12300,
        minimum: 0,
        description: 'The NEW amount, which need not equal the old one — a party often replaces a bounced ' +
            'cheque with a smaller one and pays the rest another way.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], ReplacementChequeDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", Object)
], ReplacementChequeDto.prototype, "bankName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", Object)
], ReplacementChequeDto.prototype, "bankBranch", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 11 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(11),
    __metadata("design:type", Object)
], ReplacementChequeDto.prototype, "ifsc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 9 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(9),
    __metadata("design:type", Object)
], ReplacementChequeDto.prototype, "micr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 150 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(150),
    __metadata("design:type", Object)
], ReplacementChequeDto.prototype, "drawerName", void 0);
class ReplaceChequeDto extends cheque_keys_dto_1.ChequeKeysDto {
    newCheque;
    allocations = [];
    reason;
}
exports.ReplaceChequeDto = ReplaceChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => ReplacementChequeDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ReplacementChequeDto),
    __metadata("design:type", ReplacementChequeDto)
], ReplaceChequeDto.prototype, "newCheque", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => cheque_keys_dto_1.ChequeAllocationDto,
        isArray: true,
        description: 'ON_RECEIPT only. Which bills the re-issued credit settles. Empty = auto-FIFO.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => cheque_keys_dto_1.ChequeAllocationDto),
    __metadata("design:type", Array)
], ReplaceChequeDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 250,
        description: 'Required in practice when replacing from HELD, because that path RETURNS the old cheque ' +
            'first and ck_apd_cancelled refuses a RETURNED row with no reason. Defaults to a sentence ' +
            'naming the replacement.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(250),
    __metadata("design:type", Object)
], ReplaceChequeDto.prototype, "reason", void 0);
class ReturnChequeDto extends cheque_keys_dto_1.ChequeKeysDto {
    action;
    reason;
    remarks;
}
exports.ReturnChequeDto = ReturnChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: [receipt_enum_1.PdcStatus.RETURNED, receipt_enum_1.PdcStatus.CANCELLED],
        example: receipt_enum_1.PdcStatus.RETURNED,
        description: 'RETURNED — the paper went back to the party and they have it. CANCELLED — it is void, ' +
            'nobody has it, and ux_apd_instrument excludes CANCELLED so the same cheque number may be ' +
            'keyed again.',
    }),
    (0, class_validator_1.IsIn)([receipt_enum_1.PdcStatus.RETURNED, receipt_enum_1.PdcStatus.CANCELLED]),
    __metadata("design:type", String)
], ReturnChequeDto.prototype, "action", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 250,
        description: 'Why. ck_apd_cancelled refuses either status without one.',
    }),
    (0, dtoDecorators_1.TrimmedString)(250),
    __metadata("design:type", String)
], ReturnChequeDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 500 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(500),
    __metadata("design:type", Object)
], ReturnChequeDto.prototype, "remarks", void 0);
//# sourceMappingURL=cheque-actions.dto.js.map