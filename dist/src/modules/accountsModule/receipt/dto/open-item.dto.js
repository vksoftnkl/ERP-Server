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
exports.DuplicateCheckQueryDto = exports.AdjacentVoucherQueryDto = exports.PartyContextQueryDto = exports.ListOpenItemsQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const receipt_enum_1 = require("../types/receipt-enum");
class ListOpenItemsQueryDto {
    partyId;
    companyId;
    onDate;
    mobile;
}
exports.ListOpenItemsQueryDto = ListOpenItemsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The party. A customer id, a supplier id and an accounts.acc_ledger_master led_id are the ' +
            'same value — pass whichever one the screen is holding.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListOpenItemsQueryDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListOpenItemsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-09-14',
        description: "The RECEIPT's date, not today. It is what ppdSuggested is aged against and what " +
            'daysOverdue is measured to, so a receipt being keyed for last Friday must send last ' +
            'Friday or it will be offered a discount the customer has lost. Defaults to today.',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], ListOpenItemsQueryDto.prototype, "onDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        description: 'HANDOVER 2026-09-20 §7 — keep only the bills whose temporary credit was given to this ' +
            'mobile number (accounts.acc_temp_credit.atc_mobile). The person at the counter says who ' +
            'they are, not which bill.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], ListOpenItemsQueryDto.prototype, "mobile", void 0);
class PartyContextQueryDto {
    partyId;
    companyId;
}
exports.PartyContextQueryDto = PartyContextQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The party — the same id as the customer or supplier.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PartyContextQueryDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PartyContextQueryDto.prototype, "companyId", void 0);
class AdjacentVoucherQueryDto {
    voucherId;
    companyId;
    branchId;
    accYear;
    direction;
    status;
    fromDate;
    toDate;
}
exports.AdjacentVoucherQueryDto = AdjacentVoucherQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The receipt currently open.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "voucherId", void 0);
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
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['prev', 'next'],
        example: 'prev',
        description: 'prev = the receipt entered just BEFORE this one; next = the one entered just after. ' +
            'Named for the ordering key, not for the direction the register happens to be drawn in.',
    }),
    (0, class_validator_1.IsIn)(['prev', 'next']),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "direction", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: receipt_enum_1.VoucherStatus,
        description: "The register's status filter, when it has one. Omit to walk every status.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(Object.values(receipt_enum_1.VoucherStatus)),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-01', description: "The register's from-date, if set." }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "fromDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-30', description: "The register's to-date, if set." }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], AdjacentVoucherQueryDto.prototype, "toDate", void 0);
class DuplicateCheckQueryDto {
    partyId;
    companyId;
    accYear;
    voucherDate;
    amount;
    excludeVoucherId;
    branchId;
}
exports.DuplicateCheckQueryDto = DuplicateCheckQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The party the money is coming from.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DuplicateCheckQueryDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DuplicateCheckQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], DuplicateCheckQueryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-09-18',
        description: "The receipt's date — the date being checked, not today.",
    }),
    (0, dtoDecorators_1.UpperMaxString)(10),
    __metadata("design:type", String)
], DuplicateCheckQueryDto.prototype, "voucherDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 5000,
        minimum: 0,
        description: 'The total being received — Σ of the tender rows, the same figure that becomes ' +
            'avh_doc_amount. Matched EXACTLY: a near-miss is a different receipt, and a tolerance ' +
            'would warn on every second collection on a beat where most amounts are round.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], DuplicateCheckQueryDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The draft being keyed, so it does not report itself. Send it as soon as /create has ' +
            'returned an avhVoucherId — without it, every re-check after the first save warns.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], DuplicateCheckQueryDto.prototype, "excludeVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Narrow to one branch. Omit — the default — to ask the whole company.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], DuplicateCheckQueryDto.prototype, "branchId", void 0);
//# sourceMappingURL=open-item.dto.js.map