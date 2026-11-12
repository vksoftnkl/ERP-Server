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
exports.ItemLedgerQueryDto = exports.ItemLedgerExportDto = exports.ItemLedgerScopeDto = exports.ItemLedgerMonthsDto = exports.ItemLedgerOptionsDto = exports.ITEM_LEDGER_DEFAULT_LIMIT = exports.ITEM_LEDGER_MAX_LIMIT = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../../common/dto/dtoDecorators");
const item_ledger_rules_1 = require("../item-ledger.rules");
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
exports.ITEM_LEDGER_MAX_LIMIT = 5_000;
exports.ITEM_LEDGER_DEFAULT_LIMIT = 1_000;
const upper = ({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value;
const lower = ({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value;
const LowerCaseId = () => (0, class_transformer_1.Transform)(lower);
function toTypeList({ obj, key }) {
    const raw = obj?.[key];
    if (raw === undefined || raw === null)
        return undefined;
    const list = Array.isArray(raw) ? raw : [raw];
    const parts = list
        .flatMap((v) => (typeof v === 'string' ? v.split(',') : [v]))
        .map((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
        .filter((v) => v !== '');
    return [...new Set(parts)];
}
class ItemLedgerOptionsDto {
    companyId;
    branchId;
    itemId;
}
exports.ItemLedgerOptionsDto = ItemLedgerOptionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], ItemLedgerOptionsDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'One branch: branch_master.br_comp_id must be companyId.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], ItemLedgerOptionsDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'inventory.item_master — live, this company’s or shared.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], ItemLedgerOptionsDto.prototype, "itemId", void 0);
class ItemLedgerMonthsDto extends ItemLedgerOptionsDto {
    to;
    godownId;
    bucket;
    lotId;
    unitId;
    valueAt;
    types;
    showReversed;
}
exports.ItemLedgerMonthsDto = ItemLedgerMonthsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-10', description: 'YYYY-MM-DD, a calendar date.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' }),
    (0, class_validator_1.IsISO8601)({ strict: true, strictSeparator: true }, { message: 'to must be a calendar date' }),
    __metadata("design:type", String)
], ItemLedgerMonthsDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Scope: one godown of the branch (godown_locations.gdl_branch_id). Absent = all godowns.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], ItemLedgerMonthsDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: item_ledger_rules_1.BUCKET_CHOICES,
        default: 'SALEABLE',
        description: 'Scope: one stock bucket, or ALL.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(item_ledger_rules_1.BUCKET_CHOICES),
    __metadata("design:type", String)
], ItemLedgerMonthsDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Scope: one lot (stock_lot.slt_item_id must be itemId). Absent = all batches.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], ItemLedgerMonthsDto.prototype, "lotId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Qty in: an item_unit_conversion.iuc_id of the item (live). Absent = the base unit. ' +
            'Quantities ÷ its to-base factor, rates × it.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], ItemLedgerMonthsDto.prototype, "unitId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: item_ledger_rules_1.VALUE_AT,
        default: 'WITHOUT_TAX',
        description: 'Cost basis: the ledger’s _wot columns (default, Q3) or the tax-inclusive ones.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(item_ledger_rules_1.VALUE_AT),
    __metadata("design:type", String)
], ItemLedgerMonthsDto.prototype, "valueAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        example: 'SALE,PURCHASE',
        description: 'Row filter: report type codes, comma-separated (or repeated). Absent = all. Balances never ' +
            `move with it. Codes: ${item_ledger_rules_1.REPORT_TYPE_CODES.join(', ')}.`,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(toTypeList),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(item_ledger_rules_1.REPORT_TYPE_CODES.length),
    (0, class_validator_1.IsIn)(item_ledger_rules_1.REPORT_TYPE_CODES, { each: true }),
    __metadata("design:type", Array)
], ItemLedgerMonthsDto.prototype, "types", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'Row filter: false hides the cancelled / amended pairs whose quantity AND value net to 0. ' +
            'A partial revaluation reversal always shows.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ItemLedgerMonthsDto.prototype, "showReversed", void 0);
class ItemLedgerScopeDto extends ItemLedgerMonthsDto {
    from;
}
exports.ItemLedgerScopeDto = ItemLedgerScopeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-01', description: 'YYYY-MM-DD, a calendar date; ≤ to.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' }),
    (0, class_validator_1.IsISO8601)({ strict: true, strictSeparator: true }, { message: 'from must be a calendar date' }),
    __metadata("design:type", String)
], ItemLedgerScopeDto.prototype, "from", void 0);
class ItemLedgerExportDto extends ItemLedgerScopeDto {
    order;
}
exports.ItemLedgerExportDto = ItemLedgerExportDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: item_ledger_rules_1.ORDERS,
        default: 'asc',
        description: 'Posting order (asc) or newest first (desc). Balances are always the ascending ones.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(lower),
    (0, class_validator_1.IsIn)(item_ledger_rules_1.ORDERS),
    __metadata("design:type", String)
], ItemLedgerExportDto.prototype, "order", void 0);
class ItemLedgerQueryDto extends ItemLedgerExportDto {
    page;
    limit;
}
exports.ItemLedgerQueryDto = ItemLedgerQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1),
    __metadata("design:type", Number)
], ItemLedgerQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: exports.ITEM_LEDGER_MAX_LIMIT,
        default: exports.ITEM_LEDGER_DEFAULT_LIMIT,
    }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, exports.ITEM_LEDGER_MAX_LIMIT),
    __metadata("design:type", Number)
], ItemLedgerQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=item-ledger-query.dto.js.map