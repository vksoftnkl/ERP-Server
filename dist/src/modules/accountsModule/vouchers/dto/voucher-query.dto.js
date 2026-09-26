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
exports.AdjacentVoucherQueryDto = exports.TaxRatesQueryDto = exports.OpenBillsQueryDto = exports.PartyFactsQueryDto = exports.LedgerBalanceQueryDto = exports.LedgerPickQueryDto = exports.VoucherTypesQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class VoucherTypesQueryDto {
    companyId;
    menuId;
}
exports.VoucherTypesQueryDto = VoucherTypesQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherTypesQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'The menu the screen was opened from. A type’s own menu (101 … 261) returns that type only; ' +
            'the Voucher Register menu (or none) returns every type the caller may view.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], VoucherTypesQueryDto.prototype, "menuId", void 0);
class LedgerPickQueryDto {
    companyId;
    branchId;
    typeCode;
    side;
    q;
    limit;
}
exports.LedgerPickQueryDto = LedgerPickQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LedgerPickQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LedgerPickQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'PurA' }),
    (0, dtoDecorators_1.TrimmedString)(20),
    __metadata("design:type", String)
], LedgerPickQueryDto.prototype, "typeCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['DR', 'CR'] }),
    (0, class_validator_1.IsIn)(['DR', 'CR']),
    __metadata("design:type", String)
], LedgerPickQueryDto.prototype, "side", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Type-ahead on the ledger name / alias.' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], LedgerPickQueryDto.prototype, "q", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 50, maximum: 500 }),
    (0, dtoDecorators_1.OptionalInteger)(1, 500),
    __metadata("design:type", Number)
], LedgerPickQueryDto.prototype, "limit", void 0);
class LedgerBalanceQueryDto {
    companyId;
    branchId;
    accYear;
    ledgerId;
    asOn;
}
exports.LedgerBalanceQueryDto = LedgerBalanceQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LedgerBalanceQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Omit for the company as a whole.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], LedgerBalanceQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{4}$/),
    __metadata("design:type", String)
], LedgerBalanceQueryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LedgerBalanceQueryDto.prototype, "ledgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-15' }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], LedgerBalanceQueryDto.prototype, "asOn", void 0);
class PartyFactsQueryDto {
    companyId;
    partyId;
    asOn;
}
exports.PartyFactsQueryDto = PartyFactsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PartyFactsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PartyFactsQueryDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-15', description: 'The TDS rate in force on this date.' }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], PartyFactsQueryDto.prototype, "asOn", void 0);
class OpenBillsQueryDto {
    companyId;
    partyId;
    side;
}
exports.OpenBillsQueryDto = OpenBillsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OpenBillsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OpenBillsQueryDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['DR', 'CR'],
        description: 'The bills’ side: DR = what the party owes, CR = what they hold.',
    }),
    (0, class_validator_1.IsIn)(['DR', 'CR']),
    __metadata("design:type", String)
], OpenBillsQueryDto.prototype, "side", void 0);
class TaxRatesQueryDto {
    companyId;
    includeInactive;
}
exports.TaxRatesQueryDto = TaxRatesQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TaxRatesQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Include inactive rates.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== undefined),
    __metadata("design:type", String)
], TaxRatesQueryDto.prototype, "includeInactive", void 0);
class AdjacentVoucherQueryDto {
    companyId;
    branchId;
    accYear;
    voucherId;
    direction;
    typeCode;
    status;
    fromDate;
    toDate;
}
exports.AdjacentVoucherQueryDto = AdjacentVoucherQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{4}$/),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The voucher on screen. Omit on an empty screen: prev → the newest voucher, next → the oldest.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['prev', 'next'],
        description: 'prev = the voucher entered just BEFORE this one (older); next = just after.',
    }),
    (0, class_validator_1.IsIn)(['prev', 'next']),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "direction", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Jrnl',
        description: 'A type menu (103 Journal, 163 PurA, …) walks its own type only. Omit for the register ' +
            '(menu 262): every register type the caller may view.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "typeCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['DRAFT', 'POSTED', 'CANCELLED'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['DRAFT', 'POSTED', 'CANCELLED']),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-01', description: "The list's from-date, if set." }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "fromDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-30', description: "The list's to-date, if set." }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "toDate", void 0);
//# sourceMappingURL=voucher-query.dto.js.map