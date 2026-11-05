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
exports.TaxRateSuccessResolveDto = exports.TaxRateResolutionDto = exports.TaxRateResolvedLedgerDto = exports.TaxRateSuccessDeleteDto = exports.TaxRateSuccessListDto = exports.TaxRateSuccessSingleDto = exports.TaxRateDeleteResultDto = exports.TaxRatePayloadDto = exports.TaxRateLedgerPayloadDto = exports.TaxRateErrorResponseDto = exports.TaxRateErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "TaxRateErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "TaxRateErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
class TaxRateLedgerPayloadDto {
    trl_id;
    trl_tax_id;
    trl_role;
    trl_role_label;
    trl_supply_nature;
    trl_ledger_id;
    trl_ledger_name;
    trl_remarks;
    trl_is_active;
    trl_is_deleted;
    trl_sync_date;
    trl_created_on;
    trl_created_by;
    trl_modified_on;
    trl_modified_by;
}
exports.TaxRateLedgerPayloadDto = TaxRateLedgerPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TaxRateLedgerPayloadDto.prototype, "trl_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TaxRateLedgerPayloadDto.prototype, "trl_tax_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30, example: 'OUTPUT_CGST' }),
    __metadata("design:type", String)
], TaxRateLedgerPayloadDto.prototype, "trl_role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Output CGST',
        description: 'acc_ledger_role.alr_label — resolved on the read paths, ignored on write',
    }),
    __metadata("design:type", Object)
], TaxRateLedgerPayloadDto.prototype, "trl_role_label", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, enum: ['INTRA', 'INTER'], example: null }),
    __metadata("design:type", Object)
], TaxRateLedgerPayloadDto.prototype, "trl_supply_nature", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TaxRateLedgerPayloadDto.prototype, "trl_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'CGST Output',
        description: 'acc_ledger_master.led_name — resolved on the read paths, ignored on write',
    }),
    __metadata("design:type", Object)
], TaxRateLedgerPayloadDto.prototype, "trl_ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], TaxRateLedgerPayloadDto.prototype, "trl_remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TaxRateLedgerPayloadDto.prototype, "trl_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], TaxRateLedgerPayloadDto.prototype, "trl_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TaxRateLedgerPayloadDto.prototype, "trl_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TaxRateLedgerPayloadDto.prototype, "trl_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TaxRateLedgerPayloadDto.prototype, "trl_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TaxRateLedgerPayloadDto.prototype, "trl_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TaxRateLedgerPayloadDto.prototype, "trl_modified_by", void 0);
class TaxRatePayloadDto {
    tax_id;
    tax_name;
    tax_code;
    tax_sort_order;
    tax_taxability;
    tax_is_reverse_charge;
    tax_rate_perc;
    tax_cgst_perc;
    tax_sgst_perc;
    tax_igst_perc;
    tax_cess_basis;
    tax_cess_perc;
    tax_cess_per_unit;
    tax_acess_basis;
    tax_acess_perc;
    tax_acess_per_unit;
    tax_supersedes_id;
    tax_supersedes_name;
    tax_is_active;
    tax_is_deleted;
    tax_sync_date;
    tax_created_on;
    tax_created_by;
    tax_modified_on;
    tax_modified_by;
    lines;
}
exports.TaxRatePayloadDto = TaxRatePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' }),
    __metadata("design:type", String)
], TaxRatePayloadDto.prototype, "tax_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100, example: 'GST 18%' }),
    __metadata("design:type", String)
], TaxRatePayloadDto.prototype, "tax_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true, example: 'GST18' }),
    __metadata("design:type", Object)
], TaxRatePayloadDto.prototype, "tax_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 60 }),
    __metadata("design:type", Number)
], TaxRatePayloadDto.prototype, "tax_sort_order", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 15, example: 'TAXABLE' }),
    __metadata("design:type", String)
], TaxRatePayloadDto.prototype, "tax_taxability", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], TaxRatePayloadDto.prototype, "tax_is_reverse_charge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18, description: 'The total GST rate' }),
    __metadata("design:type", Number)
], TaxRatePayloadDto.prototype, "tax_rate_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 9,
        description: 'GENERATED from tax_rate_perc by the database — read-only',
    }),
    __metadata("design:type", Object)
], TaxRatePayloadDto.prototype, "tax_cgst_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 9, description: 'GENERATED — read-only' }),
    __metadata("design:type", Object)
], TaxRatePayloadDto.prototype, "tax_sgst_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 18, description: 'GENERATED — read-only' }),
    __metadata("design:type", Object)
], TaxRatePayloadDto.prototype, "tax_igst_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 10, example: 'NONE' }),
    __metadata("design:type", String)
], TaxRatePayloadDto.prototype, "tax_cess_basis", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], TaxRatePayloadDto.prototype, "tax_cess_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], TaxRatePayloadDto.prototype, "tax_cess_per_unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 10, example: 'NONE' }),
    __metadata("design:type", String)
], TaxRatePayloadDto.prototype, "tax_acess_basis", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], TaxRatePayloadDto.prototype, "tax_acess_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], TaxRatePayloadDto.prototype, "tax_acess_per_unit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TaxRatePayloadDto.prototype, "tax_supersedes_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'GST 12%',
        description: 'Name of the superseded rate — resolved on the read paths, ignored on write',
    }),
    __metadata("design:type", Object)
], TaxRatePayloadDto.prototype, "tax_supersedes_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TaxRatePayloadDto.prototype, "tax_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], TaxRatePayloadDto.prototype, "tax_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TaxRatePayloadDto.prototype, "tax_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TaxRatePayloadDto.prototype, "tax_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TaxRatePayloadDto.prototype, "tax_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TaxRatePayloadDto.prototype, "tax_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TaxRatePayloadDto.prototype, "tax_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: TaxRateLedgerPayloadDto,
        isArray: true,
        description: 'The ledger overrides. Empty is the normal case, not a misconfiguration.',
    }),
    __metadata("design:type", Array)
], TaxRatePayloadDto.prototype, "lines", void 0);
class TaxRateDeleteResultDto {
    tax_id;
    deleted;
    lines_deleted;
}
exports.TaxRateDeleteResultDto = TaxRateDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TaxRateDeleteResultDto.prototype, "tax_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TaxRateDeleteResultDto.prototype, "deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Live ledger overrides deleted with the header' }),
    __metadata("design:type", Number)
], TaxRateDeleteResultDto.prototype, "lines_deleted", void 0);
class TaxRateSuccessSingleDto {
    success;
    message;
    data;
}
exports.TaxRateSuccessSingleDto = TaxRateSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TaxRateSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tax rate fetched successfully' }),
    __metadata("design:type", String)
], TaxRateSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TaxRatePayloadDto }),
    __metadata("design:type", TaxRatePayloadDto)
], TaxRateSuccessSingleDto.prototype, "data", void 0);
class TaxRateSuccessListDto {
    success;
    message;
    data;
}
exports.TaxRateSuccessListDto = TaxRateSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TaxRateSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tax rates fetched successfully' }),
    __metadata("design:type", String)
], TaxRateSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TaxRatePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], TaxRateSuccessListDto.prototype, "data", void 0);
class TaxRateSuccessDeleteDto {
    success;
    message;
    data;
}
exports.TaxRateSuccessDeleteDto = TaxRateSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TaxRateSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tax rate deleted successfully' }),
    __metadata("design:type", String)
], TaxRateSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TaxRateDeleteResultDto }),
    __metadata("design:type", TaxRateDeleteResultDto)
], TaxRateSuccessDeleteDto.prototype, "data", void 0);
class TaxRateResolvedLedgerDto {
    role;
    role_label;
    role_group;
    supply_nature;
    ledger_id;
    ledger_name;
    source;
    source_row_id;
}
exports.TaxRateResolvedLedgerDto = TaxRateResolvedLedgerDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30, example: 'OUTPUT_CGST' }),
    __metadata("design:type", String)
], TaxRateResolvedLedgerDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Output CGST' }),
    __metadata("design:type", String)
], TaxRateResolvedLedgerDto.prototype, "role_label", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'OUTPUT_TAX', description: 'acc_ledger_role.alr_group' }),
    __metadata("design:type", String)
], TaxRateResolvedLedgerDto.prototype, "role_group", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, enum: ['INTRA', 'INTER'], example: null }),
    __metadata("design:type", Object)
], TaxRateResolvedLedgerDto.prototype, "supply_nature", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TaxRateResolvedLedgerDto.prototype, "ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'CGST Output' }),
    __metadata("design:type", Object)
], TaxRateResolvedLedgerDto.prototype, "ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['OVERRIDE', 'DEFAULT', 'UNMAPPED'],
        example: 'DEFAULT',
        description: 'OVERRIDE — this rate carries a row of its own. DEFAULT — it inherits ' +
            'accounts.acc_ledger_map. UNMAPPED — nothing answers, and a voucher touching this role ' +
            'cannot be posted yet.',
    }),
    __metadata("design:type", String)
], TaxRateResolvedLedgerDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'trl_id or alm_id — the row that answered.',
    }),
    __metadata("design:type", Object)
], TaxRateResolvedLedgerDto.prototype, "source_row_id", void 0);
class TaxRateResolutionDto {
    tax_id;
    tax_name;
    supply_nature;
    roles;
}
exports.TaxRateResolutionDto = TaxRateResolutionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TaxRateResolutionDto.prototype, "tax_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'GST 18%' }),
    __metadata("design:type", String)
], TaxRateResolutionDto.prototype, "tax_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, enum: ['INTRA', 'INTER'], example: null }),
    __metadata("design:type", Object)
], TaxRateResolutionDto.prototype, "supply_nature", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TaxRateResolvedLedgerDto, isArray: true }),
    __metadata("design:type", Array)
], TaxRateResolutionDto.prototype, "roles", void 0);
class TaxRateSuccessResolveDto {
    success;
    message;
    data;
}
exports.TaxRateSuccessResolveDto = TaxRateSuccessResolveDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TaxRateSuccessResolveDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tax rate ledgers resolved successfully' }),
    __metadata("design:type", String)
], TaxRateSuccessResolveDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TaxRateResolutionDto }),
    __metadata("design:type", TaxRateResolutionDto)
], TaxRateSuccessResolveDto.prototype, "data", void 0);
//# sourceMappingURL=tax-rate-response.dto.js.map