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
exports.SaveOpeningBalanceDto = exports.SaveOpeningBalanceRowDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const opening_balance_enum_1 = require("../types/opening-balance-enum");
class SaveOpeningBalanceRowDto {
    opId;
    opLedgerId;
    opAmount;
    opDrCr;
    opSource;
    opRemarks;
}
exports.SaveOpeningBalanceRowDto = SaveOpeningBalanceRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Present = update that row; absent = insert. The upsert is the edit (§5.5).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveOpeningBalanceRowDto.prototype, "opId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveOpeningBalanceRowDto.prototype, "opLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 124500.0,
        minimum: 0,
        description: 'ALWAYS POSITIVE — the side is opDrCr, never a sign. 0 writes no row at all: absence ' +
            'is the zero (§5.1 rule 4).',
    }),
    (0, dtoDecorators_1.RequiredNumber)(),
    __metadata("design:type", Number)
], SaveOpeningBalanceRowDto.prototype, "opAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: opening_balance_enum_1.OpeningDrCr, description: "ONE character. acc_bill_balance uses two — do not unify them." }),
    (0, class_validator_1.IsIn)(Object.values(opening_balance_enum_1.OpeningDrCr)),
    __metadata("design:type", String)
], SaveOpeningBalanceRowDto.prototype, "opDrCr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: opening_balance_enum_1.OpeningSource,
        default: opening_balance_enum_1.OpeningSource.MANUAL,
        description: 'Echo back what the list returned. The service overrides it when an edit to a ' +
            'CARRY_FORWARD figure makes it MANUAL (§5.5 rule 1) — what is sent here cannot keep a ' +
            'corrected figure generated.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(Object.values(opening_balance_enum_1.OpeningSource)),
    __metadata("design:type", String)
], SaveOpeningBalanceRowDto.prototype, "opSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], SaveOpeningBalanceRowDto.prototype, "opRemarks", void 0);
class SaveOpeningBalanceDto {
    opCompanyId;
    opBranchId;
    opAccYear;
    opTenantId;
    rows;
    replace;
}
exports.SaveOpeningBalanceDto = SaveOpeningBalanceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveOpeningBalanceDto.prototype, "opCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Explicit null = the company-level set. Must be settable to null (§8 rule 4).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveOpeningBalanceDto.prototype, "opBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], SaveOpeningBalanceDto.prototype, "opAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true, description: 'Stamped onto every row written.' }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveOpeningBalanceDto.prototype, "opTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: () => SaveOpeningBalanceRowDto,
        isArray: true,
        description: 'The whole set. Required — send [] with replace:true to clear the year, but never omit ' +
            'the key.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(5000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaveOpeningBalanceRowDto),
    __metadata("design:type", Array)
], SaveOpeningBalanceDto.prototype, "rows", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'true = rows absent from the array are soft deleted. false = the array is a partial ' +
            'update and nothing is deleted.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveOpeningBalanceDto.prototype, "replace", void 0);
//# sourceMappingURL=save-opening-balance.dto.js.map