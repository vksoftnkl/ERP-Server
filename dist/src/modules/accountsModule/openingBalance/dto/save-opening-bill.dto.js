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
exports.ListOpeningBillsQueryDto = exports.SaveOpeningBillsDto = exports.SaveOpeningBillRowDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const opening_balance_enum_1 = require("../types/opening-balance-enum");
class SaveOpeningBillRowDto {
    ablId;
    ablDocRefno;
    ablDocDate;
    ablDueDate;
    ablCreditDays;
    ablGraceDays;
    ablDrCr;
    ablBillAmount;
    ablNarration;
}
exports.SaveOpeningBillRowDto = SaveOpeningBillRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Present = update, absent = insert.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveOpeningBillRowDto.prototype, "ablId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 50,
        example: 'SB/2025/0412',
        description: 'The ORIGINAL invoice number. Unique per company/party/type/year (ux_abl_doc_refno) — ' +
            'the same refno in the PREVIOUS year as a SALES bill is fine, different year and type.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(50),
    __metadata("design:type", String)
], SaveOpeningBillRowDto.prototype, "ablDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-01-12',
        description: 'The ORIGINAL invoice date — what ageing measures from.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(10),
    __metadata("design:type", String)
], SaveOpeningBillRowDto.prototype, "ablDocDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '2026-02-11',
        description: 'Must be >= ablDocDate (ck_abl_due_date).',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveOpeningBillRowDto.prototype, "ablDueDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, minimum: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveOpeningBillRowDto.prototype, "ablCreditDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, minimum: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveOpeningBillRowDto.prototype, "ablGraceDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: opening_balance_enum_1.BillDrCr,
        description: 'TWO characters here — acc_opening_balance uses one. Do not unify them.',
    }),
    (0, class_validator_1.IsIn)(Object.values(opening_balance_enum_1.BillDrCr)),
    __metadata("design:type", String)
], SaveOpeningBillRowDto.prototype, "ablDrCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 48600.0,
        minimum: 0,
        description: 'Strictly greater than zero (ck_abl_amount). Positive; the side is ablDrCr.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], SaveOpeningBillRowDto.prototype, "ablBillAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(2000),
    __metadata("design:type", Object)
], SaveOpeningBillRowDto.prototype, "ablNarration", void 0);
class SaveOpeningBillsDto {
    companyId;
    branchId;
    accYear;
    partyId;
    opId;
    tenantId;
    bills;
    replace;
}
exports.SaveOpeningBillsDto = SaveOpeningBillsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveOpeningBillsDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'REQUIRED, unlike a ledger opening. abl_branch_id is NOT NULL, so a bill always has a ' +
            "branch — a bill-wise party's company-level opening is the SUM of its branch bills " +
            '(DECISION 9a).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveOpeningBillsDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], SaveOpeningBillsDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'acc_ledger_master.led_id — the party ledger.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveOpeningBillsDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "The party's acc_opening_balance row, which every bill is linked to via abl_src_doc_id. " +
            'Omit on the first save — the service creates the opening row and links the bills to it.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveOpeningBillsDto.prototype, "opId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], SaveOpeningBillsDto.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => SaveOpeningBillRowDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(5000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaveOpeningBillRowDto),
    __metadata("design:type", Array)
], SaveOpeningBillsDto.prototype, "bills", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'true = bills absent from the array are soft deleted, unless they are frozen (§5.5 rule 3).',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveOpeningBillsDto.prototype, "replace", void 0);
class ListOpeningBillsQueryDto {
    partyId;
    companyId;
    accYear;
    branchId;
}
exports.ListOpeningBillsQueryDto = ListOpeningBillsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListOpeningBillsQueryDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListOpeningBillsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], ListOpeningBillsQueryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'REQUIRED — bills are always branch-scoped.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListOpeningBillsQueryDto.prototype, "branchId", void 0);
//# sourceMappingURL=save-opening-bill.dto.js.map