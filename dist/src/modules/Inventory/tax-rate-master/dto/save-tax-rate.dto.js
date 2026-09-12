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
exports.SaveTaxRateDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_tax_rate_ledger_dto_1 = require("./save-tax-rate-ledger.dto");
class SaveTaxRateDto {
    tax_id;
    tax_name;
    tax_code;
    tax_sort_order;
    tax_taxability;
    tax_is_reverse_charge;
    tax_rate_perc;
    tax_cess_basis;
    tax_cess_perc;
    tax_cess_per_unit;
    tax_acess_basis;
    tax_acess_perc;
    tax_acess_per_unit;
    tax_supersedes_id;
    tax_is_active;
    lines;
    tax_created_by;
    tax_modified_by;
}
exports.SaveTaxRateDto = SaveTaxRateDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Omit to create; send it to update the existing rate.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTaxRateDto.prototype, "tax_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 100,
        example: 'GST 18%',
        description: 'Unique among live rates, case-insensitively. A soft-deleted name is reusable.',
    }),
    (0, dtoDecorators_1.TrimmedString)(100),
    __metadata("design:type", String)
], SaveTaxRateDto.prototype, "tax_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        nullable: true,
        example: 'GST18',
        description: 'Unique among live rates, case-insensitively, when present.',
    }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveTaxRateDto.prototype, "tax_code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, description: "The picker's display order." }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveTaxRateDto.prototype, "tax_sort_order", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['TAXABLE', 'EXEMPT', 'NIL_RATED', 'NON_GST', 'ZERO_RATED'],
        default: 'TAXABLE',
        description: 'EXEMPT / NIL_RATED / NON_GST must charge nothing at all. ZERO_RATED must not be used for ' +
            'them: an export is taxable at 0% and has to stay distinguishable on the return.',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(15),
    __metadata("design:type", String)
], SaveTaxRateDto.prototype, "tax_taxability", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTaxRateDto.prototype, "tax_is_reverse_charge", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 18,
        default: 0,
        description: 'The TOTAL GST rate, 0…100. CGST, SGST and IGST are derived from it by the database.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTaxRateDto.prototype, "tax_rate_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['NONE', 'PERCENT', 'PER_UNIT', 'BOTH'],
        default: 'NONE',
        description: 'Says which of the two cess figures is in play, so a zero is never ambiguous. The basis and ' +
            'the figures must agree: PERCENT needs tax_cess_perc > 0 and tax_cess_per_unit = 0, ' +
            'PER_UNIT the reverse, BOTH needs both > 0, NONE needs both = 0.',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(10),
    __metadata("design:type", String)
], SaveTaxRateDto.prototype, "tax_cess_basis", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTaxRateDto.prototype, "tax_cess_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTaxRateDto.prototype, "tax_cess_per_unit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['NONE', 'PERCENT', 'PER_UNIT', 'BOTH'],
        default: 'NONE',
        description: 'The SECOND, state cess — Kerala flood cess beside compensation cess is the standard ' +
            'example. Same agreement rule as tax_cess_basis.',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(10),
    __metadata("design:type", String)
], SaveTaxRateDto.prototype, "tax_acess_basis", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTaxRateDto.prototype, "tax_acess_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTaxRateDto.prototype, "tax_acess_per_unit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The rate this one replaced. A rate change makes a NEW row rather than editing the old ' +
            'one, and this keeps the chain followable. Must not point at itself or close a loop.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTaxRateDto.prototype, "tax_supersedes_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTaxRateDto.prototype, "tax_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => save_tax_rate_ledger_dto_1.SaveTaxRateLedgerDto,
        isArray: true,
        description: 'The ledger overrides. Sending the key REPLACES the grid: lines carrying trl_id are ' +
            'updated, lines without one are inserted, and lines already on the rate but missing from ' +
            'the array are soft deleted. OMIT the key to leave the grid untouched — `"lines": []` ' +
            'means "delete every override", which is not the same thing.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_tax_rate_ledger_dto_1.SaveTaxRateLedgerDto),
    __metadata("design:type", Array)
], SaveTaxRateDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveTaxRateDto.prototype, "tax_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveTaxRateDto.prototype, "tax_modified_by", void 0);
//# sourceMappingURL=save-tax-rate.dto.js.map