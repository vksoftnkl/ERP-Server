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
exports.ReplaceChequeDto = exports.VoidChequeDto = exports.ReverseChequeDto = exports.PresentedChequeDto = exports.IssuedChequeKeysDto = exports.CloseChequeBookDto = exports.SaveChequeBookDto = exports.ChequeBookKeysDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
class ChequeBookKeysDto {
    companyId;
    chequeBookId;
}
exports.ChequeBookKeysDto = ChequeBookKeysDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ChequeBookKeysDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ChequeBookKeysDto.prototype, "chequeBookId", void 0);
class SaveChequeBookDto {
    chequeBookId;
    companyId;
    branchId;
    bankLedgerId;
    bookNo;
    leafFrom;
    leafTo;
    leafWidth;
    format;
    remarks;
}
exports.SaveChequeBookDto = SaveChequeBookDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Omit to open a new book.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], SaveChequeBookDto.prototype, "chequeBookId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveChequeBookDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Keep the book for one branch; null / omitted = every branch.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveChequeBookDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The bank account (Bank Accounts / Bank OD) the leaves are drawn on.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveChequeBookDto.prototype, "bankLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30, example: 'KVB-2026-03' }),
    (0, dtoDecorators_1.TrimmedString)(30),
    __metadata("design:type", String)
], SaveChequeBookDto.prototype, "bookNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100001, description: 'The first leaf number, as printed.' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(999_999_999_999),
    __metadata("design:type", Number)
], SaveChequeBookDto.prototype, "leafFrom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100050, description: 'The last leaf number (inclusive).' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(999_999_999_999),
    __metadata("design:type", Number)
], SaveChequeBookDto.prototype, "leafTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 6,
        minimum: 1,
        maximum: 12,
        description: 'Leaves print zero-padded to this many digits.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(12),
    __metadata("design:type", Number)
], SaveChequeBookDto.prototype, "leafWidth", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 30,
        description: 'The print layout the leaves take (printing is a later phase).',
    }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveChequeBookDto.prototype, "format", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 250 }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveChequeBookDto.prototype, "remarks", void 0);
class CloseChequeBookDto extends ChequeBookKeysDto {
    reason;
}
exports.CloseChequeBookDto = CloseChequeBookDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250, example: 'Book damaged — unused leaves destroyed' }),
    (0, dtoDecorators_1.TrimmedString)(250),
    __metadata("design:type", String)
], CloseChequeBookDto.prototype, "reason", void 0);
class IssuedChequeKeysDto {
    apdId;
    apdAccYear;
    companyId;
    branchId;
}
exports.IssuedChequeKeysDto = IssuedChequeKeysDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], IssuedChequeKeysDto.prototype, "apdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], IssuedChequeKeysDto.prototype, "apdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], IssuedChequeKeysDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], IssuedChequeKeysDto.prototype, "branchId", void 0);
class PresentedChequeDto extends IssuedChequeKeysDto {
    date;
    remarks;
}
exports.PresentedChequeDto = PresentedChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-10-02',
        description: 'The day the bank paid it (the statement date). Not before the cheque’s date.',
    }),
    (0, class_validator_1.Matches)(ISO_DATE),
    __metadata("design:type", String)
], PresentedChequeDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 250 }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], PresentedChequeDto.prototype, "remarks", void 0);
class ReverseChequeDto extends IssuedChequeKeysDto {
    date;
    reason;
    charges;
}
exports.ReverseChequeDto = ReverseChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-10-02',
        description: 'The day it happened; the reversal voucher is dated this.',
    }),
    (0, class_validator_1.Matches)(ISO_DATE),
    __metadata("design:type", String)
], ReverseChequeDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, example: 'Funds insufficient' }),
    (0, dtoDecorators_1.TrimmedString)(200),
    __metadata("design:type", String)
], ReverseChequeDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 0,
        description: 'What the bank charged us for it (return / stop-payment fee): DR BANK_CHARGES / CR the bank, ' +
            'on the same voucher.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ReverseChequeDto.prototype, "charges", void 0);
class VoidChequeDto extends IssuedChequeKeysDto {
    date;
    reason;
}
exports.VoidChequeDto = VoidChequeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-10-02',
        description: 'The day it was voided; omitted = today. The reversal voucher is dated this.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(ISO_DATE),
    __metadata("design:type", String)
], VoidChequeDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, example: 'Leaf spoilt while writing' }),
    (0, dtoDecorators_1.TrimmedString)(200),
    __metadata("design:type", String)
], VoidChequeDto.prototype, "reason", void 0);
class ReplaceChequeDto extends IssuedChequeKeysDto {
    date;
    chequeBookId;
    bankLedgerId;
    instrumentDate;
    favouring;
    acPayee;
    reason;
}
exports.ReplaceChequeDto = ReplaceChequeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-10-03',
        description: 'The new Payment Voucher’s date (and the stop’s, when the old cheque is still out).',
    }),
    (0, class_validator_1.Matches)(ISO_DATE),
    __metadata("design:type", String)
], ReplaceChequeDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The book the new leaf comes from.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ReplaceChequeDto.prototype, "chequeBookId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The bank the new cheque is drawn on. Omitted = the book’s bank.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], ReplaceChequeDto.prototype, "bankLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '2026-10-03',
        description: 'The date on the new cheque. Omitted = `date`; later = post-dated.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.Matches)(ISO_DATE),
    __metadata("design:type", Object)
], ReplaceChequeDto.prototype, "instrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 150,
        description: 'Omitted = the old cheque’s.',
    }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], ReplaceChequeDto.prototype, "favouring", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Omitted = the old cheque’s.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Object)
], ReplaceChequeDto.prototype, "acPayee", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, example: 'Supplier lost the cheque' }),
    (0, dtoDecorators_1.TrimmedString)(200),
    __metadata("design:type", String)
], ReplaceChequeDto.prototype, "reason", void 0);
//# sourceMappingURL=issued-cheques.dto.js.map