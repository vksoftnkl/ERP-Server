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
exports.LedgerStatementVoucherLegsDto = exports.LedgerStatementLedgersDto = exports.LedgerStatementVouchersDto = exports.LedgerStatementExportDto = exports.LedgerStatementRangeDto = exports.LedgerStatementScopeDto = exports.LedgerStatementYearDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
class LedgerStatementYearDto {
    companyId;
    accYear;
    branchId;
}
exports.LedgerStatementYearDto = LedgerStatementYearDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LedgerStatementYearDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', description: "'YYYY-YYYY', second half = first + 1." }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' }),
    __metadata("design:type", String)
], LedgerStatementYearDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "Absent = All branches: every opening set (company-level + every branch's) and every " +
            "branch's legs. A branch = that branch's opening set and legs only.",
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], LedgerStatementYearDto.prototype, "branchId", void 0);
class LedgerStatementScopeDto extends LedgerStatementYearDto {
    ledgerId;
}
exports.LedgerStatementScopeDto = LedgerStatementScopeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'accounts.acc_ledger_master.led_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LedgerStatementScopeDto.prototype, "ledgerId", void 0);
class LedgerStatementRangeDto extends LedgerStatementScopeDto {
    fromDate;
    toDate;
}
exports.LedgerStatementRangeDto = LedgerStatementRangeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-08-01', description: 'YYYY-MM-DD, inside the fiscal year.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'fromDate must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], LedgerStatementRangeDto.prototype, "fromDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-09-25',
        description: 'YYYY-MM-DD, inside the fiscal year, ≥ fromDate.',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'toDate must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], LedgerStatementRangeDto.prototype, "toDate", void 0);
class LedgerStatementExportDto extends LedgerStatementRangeDto {
    includeCancelled;
    withBillRefs;
    withLegs;
}
exports.LedgerStatementExportDto = LedgerStatementExportDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'false hides a cancelled pair — BOTH halves, and only when both fall inside the range. A ' +
            'lone half is shown regardless (pairOutsideRange: true): it moves this period’s balance.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LedgerStatementExportDto.prototype, "includeCancelled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true, description: 'Fill billRefs[] (§8).' }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LedgerStatementExportDto.prototype, "withBillRefs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'L4 — inline every leg of each row’s voucher (the Contra legs checkbox).',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LedgerStatementExportDto.prototype, "withLegs", void 0);
class LedgerStatementVouchersDto extends LedgerStatementExportDto {
    page;
    pageSize;
}
exports.LedgerStatementVouchersDto = LedgerStatementVouchersDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, minimum: 1 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1),
    __metadata("design:type", Number)
], LedgerStatementVouchersDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 200, minimum: 1, maximum: 1000 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 1000),
    __metadata("design:type", Number)
], LedgerStatementVouchersDto.prototype, "pageSize", void 0);
class LedgerStatementLedgersDto {
    companyId;
    search;
    groupId;
    limit;
}
exports.LedgerStatementLedgersDto = LedgerStatementLedgersDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LedgerStatementLedgersDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Matches name, alias, short name, GSTIN or phone (case-insensitive, contains).',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], LedgerStatementLedgersDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'accounts.acc_group_master.acc_group_id — PgUp / PgDn walk one group.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], LedgerStatementLedgersDto.prototype, "groupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 30, minimum: 1, maximum: 100 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 100),
    __metadata("design:type", Number)
], LedgerStatementLedgersDto.prototype, "limit", void 0);
class LedgerStatementVoucherLegsDto {
    companyId;
    accYear;
    voucherId;
    ledgerId;
}
exports.LedgerStatementVoucherLegsDto = LedgerStatementVoucherLegsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LedgerStatementVoucherLegsDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    (0, class_validator_1.MaxLength)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' }),
    __metadata("design:type", String)
], LedgerStatementVoucherLegsDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'accounts.acc_voucher_header.avh_voucher_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LedgerStatementVoucherLegsDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The statement’s ledger — marks isThisLedger.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LedgerStatementVoucherLegsDto.prototype, "ledgerId", void 0);
//# sourceMappingURL=ledger-statement-query.dto.js.map