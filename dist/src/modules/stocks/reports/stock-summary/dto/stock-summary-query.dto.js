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
exports.StockSummaryExportDto = exports.StockSummaryItemDto = exports.StockSummaryBranchesDto = exports.StockSummaryGroupsDto = exports.StockSummaryGodownsDto = exports.StockSummaryRowsDto = exports.StockSummaryRunDto = exports.StockSummaryQueryDto = exports.StockSummaryViewDto = exports.StockSummaryScopeDto = exports.StockSummaryOptionsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../../common/dto/dtoDecorators");
const item_ledger_rules_1 = require("../../item-ledger/item-ledger.rules");
const stock_summary_rules_1 = require("../stock-summary.rules");
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_OR_NONE = /^(NONE|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const upper = ({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value;
const lower = ({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value;
const trimmed = ({ value }) => typeof value === 'string' ? value.trim() : value;
const LowerCaseId = () => (0, class_transformer_1.Transform)(lower);
const SORT_BY_LOWER = new Map(stock_summary_rules_1.SORT_KEYS.map((k) => [k.toLowerCase(), k]));
const sortKey = ({ value }) => typeof value === 'string' ? (SORT_BY_LOWER.get(value.trim().toLowerCase()) ?? value) : value;
const groupKey = ({ value }) => {
    if (typeof value !== 'string')
        return value;
    const v = value.trim().toLowerCase();
    return v === stock_summary_rules_1.NO_KEY.toLowerCase() ? stock_summary_rules_1.NO_KEY : v;
};
class StockSummaryOptionsDto {
    companyId;
    branchId;
}
exports.StockSummaryOptionsDto = StockSummaryOptionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'Any company (Q2: the page has a Company dropdown, as the Item Ledger).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], StockSummaryOptionsDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'One branch: branch_master.br_comp_id must be companyId.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], StockSummaryOptionsDto.prototype, "branchId", void 0);
class StockSummaryScopeDto extends StockSummaryOptionsDto {
    from;
    to;
    godownId;
    groupId;
    brandId;
    bucket;
    valueAt;
    qtyIn;
    noSaleDays;
}
exports.StockSummaryScopeDto = StockSummaryScopeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-01', description: 'YYYY-MM-DD, a calendar date; ≤ to.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' }),
    (0, class_validator_1.IsISO8601)({ strict: true, strictSeparator: true }, { message: 'from must be a calendar date' }),
    __metadata("design:type", String)
], StockSummaryScopeDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-14', description: 'YYYY-MM-DD, a calendar date.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' }),
    (0, class_validator_1.IsISO8601)({ strict: true, strictSeparator: true }, { message: 'to must be a calendar date' }),
    __metadata("design:type", String)
], StockSummaryScopeDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Scope: one godown of the branch (gdl_branch_id). Absent = all godowns.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], StockSummaryScopeDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Item filter: the group and its whole subtree (by parent). Absent = all groups.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], StockSummaryScopeDto.prototype, "groupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Item filter: the brand and its whole subtree (by parent). Absent = all brands.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], StockSummaryScopeDto.prototype, "brandId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: stock_summary_rules_1.SUMMARY_BUCKET_CHOICES, default: 'SALEABLE' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(stock_summary_rules_1.SUMMARY_BUCKET_CHOICES),
    __metadata("design:type", String)
], StockSummaryScopeDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: item_ledger_rules_1.VALUE_AT,
        default: 'WITHOUT_TAX',
        description: 'Cost basis: the _wot columns (default, D5) or the tax-inclusive ones.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(item_ledger_rules_1.VALUE_AT),
    __metadata("design:type", String)
], StockSummaryScopeDto.prototype, "valueAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_summary_rules_1.QTY_IN,
        default: 'BASE',
        description: 'Quantities in the base unit, or each item’s default unit (rates follow).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(stock_summary_rules_1.QTY_IN),
    __metadata("design:type", String)
], StockSummaryScopeDto.prototype, "qtyIn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: 3650,
        default: stock_summary_rules_1.DEFAULT_NO_SALE_DAYS,
        description: 'The NO SALE chip: closing > 0 and no sale for this many days up to `to` (D2).',
    }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 3650),
    __metadata("design:type", Number)
], StockSummaryScopeDto.prototype, "noSaleDays", void 0);
class StockSummaryViewDto {
    sort;
    dir;
    page;
    limit;
    hideZero;
    onlyNegative;
    show;
    find;
    groupBy;
    groupKey;
}
exports.StockSummaryViewDto = StockSummaryViewDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: stock_summary_rules_1.SORT_KEYS, default: 'name' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(sortKey),
    (0, class_validator_1.IsIn)(stock_summary_rules_1.SORT_KEYS),
    __metadata("design:type", String)
], StockSummaryViewDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['asc', 'desc'], default: 'asc' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(lower),
    (0, class_validator_1.IsIn)(['asc', 'desc']),
    __metadata("design:type", String)
], StockSummaryViewDto.prototype, "dir", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1),
    __metadata("design:type", Number)
], StockSummaryViewDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: stock_summary_rules_1.MAX_LIMIT, default: stock_summary_rules_1.DEFAULT_LIMIT }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, stock_summary_rules_1.MAX_LIMIT),
    __metadata("design:type", Number)
], StockSummaryViewDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'Hide rows whose opening, inward, outward, closing, reserved and in transit are all 0 (D26).',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], StockSummaryViewDto.prototype, "hideZero", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Only rows with closing < 0.' }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], StockSummaryViewDto.prototype, "onlyNegative", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: stock_summary_rules_1.SHOW_CHOICES, default: 'ALL', description: 'A tile filter (D31).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(stock_summary_rules_1.SHOW_CHOICES),
    __metadata("design:type", String)
], StockSummaryViewDto.prototype, "show", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 60,
        description: 'Code, name, barcode or SKU contains this (case-insensitive).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trimmed),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], StockSummaryViewDto.prototype, "find", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_summary_rules_1.GROUP_BY,
        description: 'The Group summary drill (with groupKey): only the rows of that group / brand / section / ' +
            'category. On /export with tab=GROUPS it is the "Summarise by" instead.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(stock_summary_rules_1.GROUP_BY),
    __metadata("design:type", String)
], StockSummaryViewDto.prototype, "groupBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'The drill key: a /groups row key (uuid), or NONE for its "(No …)" line.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(groupKey),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(UUID_OR_NONE, { message: 'groupKey must be a uuid or NONE' }),
    __metadata("design:type", String)
], StockSummaryViewDto.prototype, "groupKey", void 0);
class StockSummaryQueryDto extends (0, swagger_1.IntersectionType)(StockSummaryScopeDto, StockSummaryViewDto) {
}
exports.StockSummaryQueryDto = StockSummaryQueryDto;
class StockSummaryRunDto {
    runId;
    companyId;
}
exports.StockSummaryRunDto = StockSummaryRunDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'head.runId of a Show (Item-wise or Branch-wise).' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], StockSummaryRunDto.prototype, "runId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Optional: when sent it must be the run’s company, else 410 (as an unknown run).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], StockSummaryRunDto.prototype, "companyId", void 0);
class StockSummaryRowsDto extends (0, swagger_1.IntersectionType)(StockSummaryRunDto, StockSummaryViewDto) {
}
exports.StockSummaryRowsDto = StockSummaryRowsDto;
class StockSummaryGodownsDto extends StockSummaryRowsDto {
}
exports.StockSummaryGodownsDto = StockSummaryGodownsDto;
class StockSummaryGroupsDto extends StockSummaryRunDto {
    groupBy;
    hideZero;
    onlyNegative;
    show;
}
exports.StockSummaryGroupsDto = StockSummaryGroupsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: stock_summary_rules_1.GROUP_BY, default: 'GROUP', description: 'Summarise by.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(stock_summary_rules_1.GROUP_BY),
    __metadata("design:type", String)
], StockSummaryGroupsDto.prototype, "groupBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], StockSummaryGroupsDto.prototype, "hideZero", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], StockSummaryGroupsDto.prototype, "onlyNegative", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: stock_summary_rules_1.SHOW_CHOICES, default: 'ALL' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(stock_summary_rules_1.SHOW_CHOICES),
    __metadata("design:type", String)
], StockSummaryGroupsDto.prototype, "show", void 0);
class StockSummaryBranchesDto extends (0, swagger_1.IntersectionType)((0, swagger_1.OmitType)(StockSummaryScopeDto, ['godownId']), StockSummaryViewDto) {
}
exports.StockSummaryBranchesDto = StockSummaryBranchesDto;
class StockSummaryItemDto extends StockSummaryScopeDto {
    itemId;
    runId;
}
exports.StockSummaryItemDto = StockSummaryItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'inventory.item_master — live, this company’s or shared.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], StockSummaryItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Optional: the Show’s run, to check the panes against the grid row (ties.row).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], StockSummaryItemDto.prototype, "runId", void 0);
class StockSummaryExportDto extends StockSummaryRowsDto {
    tab;
}
exports.StockSummaryExportDto = StockSummaryExportDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: stock_summary_rules_1.EXPORT_TABS,
        description: 'BRANCHES needs a Branch-wise run, the rest an Item-wise one.',
    }),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(stock_summary_rules_1.EXPORT_TABS),
    __metadata("design:type", String)
], StockSummaryExportDto.prototype, "tab", void 0);
//# sourceMappingURL=stock-summary-query.dto.js.map