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
exports.ResolveTaxRateQueryDto = exports.ListTaxRateQueryDto = exports.DeleteTaxRateQueryDto = exports.TaxRateIdQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class TaxRateIdQueryDto {
    tax_id;
}
exports.TaxRateIdQueryDto = TaxRateIdQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TaxRateIdQueryDto.prototype, "tax_id", void 0);
class DeleteTaxRateQueryDto extends TaxRateIdQueryDto {
    tax_modified_by;
}
exports.DeleteTaxRateQueryDto = DeleteTaxRateQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], DeleteTaxRateQueryDto.prototype, "tax_modified_by", void 0);
class ListTaxRateQueryDto {
    search;
    tax_taxability;
    tax_rate_perc;
    active_only;
}
exports.ListTaxRateQueryDto = ListTaxRateQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Case-insensitive substring of tax_name or tax_code.',
        example: '18',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], ListTaxRateQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['TAXABLE', 'EXEMPT', 'NIL_RATED', 'NON_GST', 'ZERO_RATED'],
        description: 'Narrow to one taxability.',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(15),
    __metadata("design:type", String)
], ListTaxRateQueryDto.prototype, "tax_taxability", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 18,
        description: 'Exact total rate — 18 finds the 18% slab, not the 18% cess.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], ListTaxRateQueryDto.prototype, "tax_rate_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Default true — the picker wants live rates. Send false to include deactivated ones, ' +
            'which a maintenance screen needs in order to switch them back on.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListTaxRateQueryDto.prototype, "active_only", void 0);
class ResolveTaxRateQueryDto extends TaxRateIdQueryDto {
    supply_nature;
    company_id;
    branch_id;
}
exports.ResolveTaxRateQueryDto = ResolveTaxRateQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['INTRA', 'INTER'],
        description: 'The supply nature to resolve for. Omit to resolve the nature-neutral answer — the row ' +
            'that serves both. It changes nothing for the tax roles: CGST and SGST exist only on an ' +
            'intra-state sale and IGST only on an inter-state one, so those roles already say it.',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(5),
    __metadata("design:type", String)
], ResolveTaxRateQueryDto.prototype, "supply_nature", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'RESERVED — every acc_ledger_map row is global today, so this changes no answer. Present ' +
            'because a company-scoped mapping, once one exists, is preferred over the global one.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ResolveTaxRateQueryDto.prototype, "company_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'RESERVED — see company_id.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ResolveTaxRateQueryDto.prototype, "branch_id", void 0);
//# sourceMappingURL=tax-rate-query.dto.js.map