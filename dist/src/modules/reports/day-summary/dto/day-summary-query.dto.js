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
exports.DaySummaryCheckDetailDto = exports.DaySummaryGroupLedgersDto = exports.DaySummaryVouchersDto = exports.DaySummaryExportDto = exports.DaySummaryScopeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const day_summary_types_1 = require("../types/day-summary.types");
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const upper = ({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value;
class DaySummaryScopeDto {
    companyId;
    accYear;
    branchId;
    fromDate;
    toDate;
    voucherTypeId;
    clearingAsBank;
    groupLevel;
    zeroRows;
}
exports.DaySummaryScopeDto = DaySummaryScopeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DaySummaryScopeDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', description: "'YYYY-YYYY', second half = first + 1." }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' }),
    __metadata("design:type", String)
], DaySummaryScopeDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "Absent = All branches: every branch's legs and every opening set (company-level + " +
            "every branch's). A branch = that branch's legs and opening set only.",
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], DaySummaryScopeDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-10-09', description: 'YYYY-MM-DD, inside the fiscal year.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'fromDate must be YYYY-MM-DD' }),
    (0, class_validator_1.IsISO8601)({ strict: true }, { message: 'fromDate is not a calendar date' }),
    __metadata("design:type", String)
], DaySummaryScopeDto.prototype, "fromDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-10-09',
        description: 'YYYY-MM-DD, ≥ fromDate, same fiscal year. Absent = fromDate (one day).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'toDate must be YYYY-MM-DD' }),
    (0, class_validator_1.IsISO8601)({ strict: true }, { message: 'toDate is not a calendar date' }),
    __metadata("design:type", String)
], DaySummaryScopeDto.prototype, "toDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'accounts.acc_voucher_types.vchr_type_id. Absent = all types. With a type, money ' +
            'opening / closing are null — a balance has no voucher type.',
    }),
    (0, dtoDecorators_1.OptionalQueryInt)(1),
    __metadata("design:type", Number)
], DaySummaryScopeDto.prototype, "voucherTypeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'Fold CLEARING ledgers into the type grid’s Bank in / Bank out (and the Day-wise bank ' +
            'columns). The money grid always lists clearing ledgers separately.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], DaySummaryScopeDto.prototype, "clearingAsBank", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: day_summary_types_1.GROUP_LEVELS,
        default: 'REPORT',
        description: "REPORT = the root's child on the ledger's chain (the root itself for a ledger sitting " +
            "in a root); PRIMARY = the root; LEDGER_GROUP = the ledger's own group.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(day_summary_types_1.GROUP_LEVELS),
    __metadata("design:type", String)
], DaySummaryScopeDto.prototype, "groupLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: '/summary: every accounting voucher type and every money ledger of the company, even ' +
            'with nothing in the range. /daily: every calendar day of the range.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], DaySummaryScopeDto.prototype, "zeroRows", void 0);
class DaySummaryExportDto extends DaySummaryScopeDto {
    includeCancelledPairs;
    natureFilter;
    moneyKind;
    withLegs;
}
exports.DaySummaryExportDto = DaySummaryExportDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'List both halves of a cancelled pair that falls wholly inside the range (they are left ' +
            'out of every /summary figure). false hides them. A lone half is always listed.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], DaySummaryExportDto.prototype, "includeCancelledPairs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: day_summary_types_1.VOUCHER_NATURES,
        description: 'Only voucher types of this nature (a tile / row drill).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(day_summary_types_1.VOUCHER_NATURES),
    __metadata("design:type", String)
], DaySummaryExportDto.prototype, "natureFilter", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: day_summary_types_1.MONEY_KINDS,
        description: 'Only vouchers with a counted leg on a money ledger of this kind. BANK includes ' +
            'CLEARING while clearingAsBank is true.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(day_summary_types_1.MONEY_KINDS),
    __metadata("design:type", String)
], DaySummaryExportDto.prototype, "moneyKind", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Inline every leg of each voucher. Default false on /vouchers, true on /export.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], DaySummaryExportDto.prototype, "withLegs", void 0);
class DaySummaryVouchersDto extends DaySummaryExportDto {
    page;
    pageSize;
    draftsOnly;
}
exports.DaySummaryVouchersDto = DaySummaryVouchersDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, minimum: 1 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1),
    __metadata("design:type", Number)
], DaySummaryVouchersDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 200, minimum: 1, maximum: 500 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 500),
    __metadata("design:type", Number)
], DaySummaryVouchersDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Return the DRAFT headers dated in the range instead (no number, no legs; amount = ' +
            'avh_doc_amount).',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], DaySummaryVouchersDto.prototype, "draftsOnly", void 0);
class DaySummaryGroupLedgersDto extends DaySummaryScopeDto {
    groupId;
}
exports.DaySummaryGroupLedgersDto = DaySummaryGroupLedgersDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'accounts.acc_group_master.acc_group_id — a row of /summary groups[].',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DaySummaryGroupLedgersDto.prototype, "groupId", void 0);
class DaySummaryCheckDetailDto extends DaySummaryScopeDto {
    code;
}
exports.DaySummaryCheckDetailDto = DaySummaryCheckDetailDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: day_summary_types_1.CHECK_CODES }),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DaySummaryCheckDetailDto.prototype, "code", void 0);
//# sourceMappingURL=day-summary-query.dto.js.map