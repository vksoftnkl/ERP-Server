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
exports.CostBulkErrorResponseDto = exports.CostBulkErrorDetailDto = exports.CostBulkSaveSuccessDto = exports.CostBulkSaveDataDto = exports.CostBulkSavedRowDto = exports.CostBulkValidateSuccessDto = exports.CostBulkValidateDataDto = exports.CostBulkCountsDto = exports.CostBulkNoteDto = exports.CostBulkListSuccessDto = exports.CostBulkListDataDto = exports.CostBulkLeftOutCountsDto = exports.CostBulkLeftOutDto = exports.CostBulkRowDto = exports.CostBulkRightsDto = exports.CostBulkLevelDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const cost_price_bulk_types_1 = require("../types/cost-price-bulk.types");
class CostBulkLevelDto {
    level;
    price;
    priceWot;
    markupPerc;
    active;
}
exports.CostBulkLevelDto = CostBulkLevelDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, minimum: 1, maximum: 4 }),
    __metadata("design:type", Number)
], CostBulkLevelDto.prototype, "level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 154, description: 'ipm_sales_price_<a-d>, tax inclusive.' }),
    __metadata("design:type", Number)
], CostBulkLevelDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 146.666667, description: 'ipm_price_<a-d>_wot, as stored.' }),
    __metadata("design:type", Number)
], CostBulkLevelDto.prototype, "priceWot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 10,
        description: 'ipm_price_<a-d>_markup_perc, as stored: (price − cost) ÷ cost × 100.',
    }),
    __metadata("design:type", Number)
], CostBulkLevelDto.prototype, "markupPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'fixed.price_levels.price_lvl_is_active (and not deleted). Show only active levels; an inactive one is ' +
            'never checked (MRP / Min / cost) and keeps its price on save.',
    }),
    __metadata("design:type", Boolean)
], CostBulkLevelDto.prototype, "active", void 0);
class CostBulkRightsDto {
    view;
    edit;
    override;
}
exports.CostBulkRightsDto = CostBulkRightsDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CostBulkRightsDto.prototype, "view", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CostBulkRightsDto.prototype, "edit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Ticking a warning: the same as edit (no separate Override right on menu 298).',
    }),
    __metadata("design:type", Boolean)
], CostBulkRightsDto.prototype, "override", void 0);
class CostBulkRowDto {
    lineNo;
    ipmId;
    itemId;
    itemCode;
    itemName;
    barcode;
    uomId;
    unitName;
    unitSlno;
    parentUomId;
    parentUnitName;
    unitsPerParent;
    toBaseFactor;
    unitFactor;
    factorsAgree;
    priceScope;
    companyShared;
    profitType;
    roundOff;
    taxPerc;
    costPrice;
    costWot;
    mrp;
    minPrice;
    levels;
    scheduledFrom;
    hasQtySlabs;
    updatedOn;
    rowToken;
}
exports.CostBulkRowDto = CostBulkRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '1-based over the whole filter.' }),
    __metadata("design:type", Number)
], CostBulkRowDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'inventory.item_price_master.ipm_id — the row in force today.',
    }),
    __metadata("design:type", String)
], CostBulkRowDto.prototype, "ipmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CostBulkRowDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], CostBulkRowDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CostBulkRowDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], CostBulkRowDto.prototype, "barcode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'item_unit_conversion.iuc_id' }),
    __metadata("design:type", String)
], CostBulkRowDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], CostBulkRowDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'iuc_unit_slno — the rows of an item come in this order.' }),
    __metadata("design:type", Number)
], CostBulkRowDto.prototype, "unitSlno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'uuid',
        nullable: true,
        description: 'The unit above (previous active slno); null on the top unit.',
    }),
    __metadata("design:type", Object)
], CostBulkRowDto.prototype, "parentUomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], CostBulkRowDto.prototype, "parentUnitName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Number,
        nullable: true,
        example: 12,
        description: 'How many of this unit make one parent: iuc_unit_factor when it agrees with parent to-base ÷ this to-base (2 dp), else the ratio. Child cost = parent cost ÷ this.',
    }),
    __metadata("design:type", Object)
], CostBulkRowDto.prototype, "unitsPerParent", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'iuc_to_base_factor' }),
    __metadata("design:type", Number)
], CostBulkRowDto.prototype, "toBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'iuc_unit_factor' }),
    __metadata("design:type", Number)
], CostBulkRowDto.prototype, "unitFactor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'False when the to-base ratio and iuc_unit_factor disagree.' }),
    __metadata("design:type", Boolean)
], CostBulkRowDto.prototype, "factorsAgree", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['BRANCH', 'CHAIN'],
        description: 'CHAIN = the all-branches row (the ALL BR chip); saving it needs HQ.',
    }),
    __metadata("design:type", String)
], CostBulkRowDto.prototype, "priceScope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The row in force is shared by every company (ipm_company_id NULL). Saving it leaves it as it ' +
            "is and writes this company's own row (the saved row then has companyCopy true and a new ipmId).",
    }),
    __metadata("design:type", Boolean)
], CostBulkRowDto.prototype, "companyShared", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: cost_price_bulk_types_1.PROFIT_TYPES, description: "ipm_profit_type — the unit's rule." }),
    __metadata("design:type", String)
], CostBulkRowDto.prototype, "profitType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ipm_round_off — the round-up step (0 = up to 0.01). Never written by this screen.',
    }),
    __metadata("design:type", Number)
], CostBulkRowDto.prototype, "roundOff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 5,
        description: 'Tax % as of today (item_tax_history, else the item default).',
    }),
    __metadata("design:type", Number)
], CostBulkRowDto.prototype, "taxPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 140, description: 'ipm_cost_price, tax inclusive.' }),
    __metadata("design:type", Number)
], CostBulkRowDto.prototype, "costPrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ipm_cost_wot' }),
    __metadata("design:type", Number)
], CostBulkRowDto.prototype, "costWot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 185, description: 'ipm_max_price. 0 = no MRP.' }),
    __metadata("design:type", Number)
], CostBulkRowDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ipm_min_price. 0 = no Min.' }),
    __metadata("design:type", Number)
], CostBulkRowDto.prototype, "minPrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: CostBulkLevelDto,
        isArray: true,
        description: 'Always the four levels, 1–4.',
    }),
    __metadata("design:type", Array)
], CostBulkRowDto.prototype, "levels", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'date',
        nullable: true,
        description: 'A later row of the same key starts that day (the SCHEDULED chip).',
    }),
    __metadata("design:type", Object)
], CostBulkRowDto.prototype, "scheduledFrom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'A live qty-wise slab prices this item and unit here (left as it is by the save).',
    }),
    __metadata("design:type", Boolean)
], CostBulkRowDto.prototype, "hasQtySlabs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'date-time',
        nullable: true,
        description: 'ipm_updated_on — display only.',
    }),
    __metadata("design:type", Object)
], CostBulkRowDto.prototype, "updatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The concurrency token to send back on validate / save.' }),
    __metadata("design:type", String)
], CostBulkRowDto.prototype, "rowToken", void 0);
class CostBulkLeftOutDto {
    itemId;
    itemCode;
    itemName;
    unitName;
    uomId;
    trackedAs;
    reasonCode;
    reason;
}
exports.CostBulkLeftOutDto = CostBulkLeftOutDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CostBulkLeftOutDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], CostBulkLeftOutDto.prototype, "itemCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CostBulkLeftOutDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Null = the whole item.' }),
    __metadata("design:type", Object)
], CostBulkLeftOutDto.prototype, "unitName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CostBulkLeftOutDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Batch + expiry + MRP (supermarket)',
        description: 'The effective preset, or "Plain stock".',
    }),
    __metadata("design:type", String)
], CostBulkLeftOutDto.prototype, "trackedAs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: cost_price_bulk_types_1.LEFT_OUT_REASONS }),
    __metadata("design:type", String)
], CostBulkLeftOutDto.prototype, "reasonCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CostBulkLeftOutDto.prototype, "reason", void 0);
class CostBulkLeftOutCountsDto {
    NOT_PLAIN_STOCK;
    OLD_BATCH_TICK;
    NO_PRICE_ROW;
    INACTIVE;
}
exports.CostBulkLeftOutCountsDto = CostBulkLeftOutCountsDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkLeftOutCountsDto.prototype, "NOT_PLAIN_STOCK", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkLeftOutCountsDto.prototype, "OLD_BATCH_TICK", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkLeftOutCountsDto.prototype, "NO_PRICE_ROW", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkLeftOutCountsDto.prototype, "INACTIVE", void 0);
class CostBulkListDataDto {
    items;
    total;
    totalItems;
    page;
    limit;
    leftOut;
    leftOutTotal;
    leftOutCounts;
    today;
    belowCostPolicy;
    rights;
}
exports.CostBulkListDataDto = CostBulkListDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: CostBulkRowDto, isArray: true }),
    __metadata("design:type", Array)
], CostBulkListDataDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Grid rows for the whole filter (all pages).' }),
    __metadata("design:type", Number)
], CostBulkListDataDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Distinct items among them.' }),
    __metadata("design:type", Number)
], CostBulkListDataDto.prototype, "totalItems", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkListDataDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkListDataDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: CostBulkLeftOutDto,
        isArray: true,
        description: 'Page 1 only (else []), at most 1,000.',
    }),
    __metadata("design:type", Array)
], CostBulkListDataDto.prototype, "leftOut", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkListDataDto.prototype, "leftOutTotal", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CostBulkLeftOutCountsDto }),
    __metadata("design:type", CostBulkLeftOutCountsDto)
], CostBulkListDataDto.prototype, "leftOutCounts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date' }),
    __metadata("design:type", String)
], CostBulkListDataDto.prototype, "today", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['restrict', 'warning', 'allow'],
        description: 'inventory.below_cost_price for this caller.',
    }),
    __metadata("design:type", String)
], CostBulkListDataDto.prototype, "belowCostPolicy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CostBulkRightsDto }),
    __metadata("design:type", CostBulkRightsDto)
], CostBulkListDataDto.prototype, "rights", void 0);
class CostBulkListSuccessDto {
    success;
    message;
    data;
}
exports.CostBulkListSuccessDto = CostBulkListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CostBulkListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CostBulkListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CostBulkListDataDto }),
    __metadata("design:type", CostBulkListDataDto)
], CostBulkListSuccessDto.prototype, "data", void 0);
class CostBulkNoteDto {
    code;
    level;
    message;
    field;
    line;
    ipmId;
    overridable;
}
exports.CostBulkNoteDto = CostBulkNoteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'COST_BULK_BELOW_COST' }),
    __metadata("design:type", String)
], CostBulkNoteDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['REFUSE', 'WARN'] }),
    __metadata("design:type", String)
], CostBulkNoteDto.prototype, "level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CostBulkNoteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'rows.0.levels' }),
    __metadata("design:type", String)
], CostBulkNoteDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 6, description: "The row's lineNo as sent." }),
    __metadata("design:type", Number)
], CostBulkNoteDto.prototype, "line", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CostBulkNoteDto.prototype, "ipmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CostBulkNoteDto.prototype, "overridable", void 0);
class CostBulkCountsDto {
    rows;
    changed;
    unchanged;
    refused;
    warned;
}
exports.CostBulkCountsDto = CostBulkCountsDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkCountsDto.prototype, "rows", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkCountsDto.prototype, "changed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkCountsDto.prototype, "unchanged", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkCountsDto.prototype, "refused", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkCountsDto.prototype, "warned", void 0);
class CostBulkValidateDataDto {
    ok;
    refusals;
    warnings;
    rights;
    counts;
    belowCostPolicy;
}
exports.CostBulkValidateDataDto = CostBulkValidateDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'A save with these overrides would go through.' }),
    __metadata("design:type", Boolean)
], CostBulkValidateDataDto.prototype, "ok", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CostBulkNoteDto, isArray: true }),
    __metadata("design:type", Array)
], CostBulkValidateDataDto.prototype, "refusals", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CostBulkNoteDto, isArray: true }),
    __metadata("design:type", Array)
], CostBulkValidateDataDto.prototype, "warnings", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CostBulkRightsDto }),
    __metadata("design:type", CostBulkRightsDto)
], CostBulkValidateDataDto.prototype, "rights", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CostBulkCountsDto }),
    __metadata("design:type", CostBulkCountsDto)
], CostBulkValidateDataDto.prototype, "counts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CostBulkValidateDataDto.prototype, "belowCostPolicy", void 0);
class CostBulkValidateSuccessDto {
    success;
    message;
    data;
}
exports.CostBulkValidateSuccessDto = CostBulkValidateSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CostBulkValidateSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CostBulkValidateSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CostBulkValidateDataDto }),
    __metadata("design:type", CostBulkValidateDataDto)
], CostBulkValidateSuccessDto.prototype, "data", void 0);
class CostBulkSavedRowDto extends CostBulkRowDto {
    written;
    sourceIpmId;
    companyCopy;
}
exports.CostBulkSavedRowDto = CostBulkSavedRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'This save wrote the row (false: it was unchanged).' }),
    __metadata("design:type", Boolean)
], CostBulkSavedRowDto.prototype, "written", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The ipmId the request sent (ipmId differs only on a company copy).',
    }),
    __metadata("design:type", String)
], CostBulkSavedRowDto.prototype, "sourceIpmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "The sent row was company-shared: ipmId is this company's new row." }),
    __metadata("design:type", Boolean)
], CostBulkSavedRowDto.prototype, "companyCopy", void 0);
class CostBulkSaveDataDto {
    saved;
    unchanged;
    rows;
    warnings;
    refusals;
    rights;
    counts;
    belowCostPolicy;
}
exports.CostBulkSaveDataDto = CostBulkSaveDataDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkSaveDataDto.prototype, "saved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CostBulkSaveDataDto.prototype, "unchanged", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: CostBulkSavedRowDto,
        isArray: true,
        description: 'Every row sent, read back, lineNo as sent.',
    }),
    __metadata("design:type", Array)
], CostBulkSaveDataDto.prototype, "rows", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: CostBulkNoteDto,
        isArray: true,
        description: 'The ticked warnings the save went through with.',
    }),
    __metadata("design:type", Array)
], CostBulkSaveDataDto.prototype, "warnings", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CostBulkNoteDto, isArray: true, description: 'Always empty on a 200.' }),
    __metadata("design:type", Array)
], CostBulkSaveDataDto.prototype, "refusals", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CostBulkRightsDto }),
    __metadata("design:type", CostBulkRightsDto)
], CostBulkSaveDataDto.prototype, "rights", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CostBulkCountsDto }),
    __metadata("design:type", CostBulkCountsDto)
], CostBulkSaveDataDto.prototype, "counts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CostBulkSaveDataDto.prototype, "belowCostPolicy", void 0);
class CostBulkSaveSuccessDto {
    success;
    message;
    data;
}
exports.CostBulkSaveSuccessDto = CostBulkSaveSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CostBulkSaveSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CostBulkSaveSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CostBulkSaveDataDto }),
    __metadata("design:type", CostBulkSaveDataDto)
], CostBulkSaveSuccessDto.prototype, "data", void 0);
class CostBulkErrorDetailDto {
    field;
    code;
    message;
    line;
    level;
    reasonCode;
    trackedAs;
}
exports.CostBulkErrorDetailDto = CostBulkErrorDetailDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'rows.0.levels' }),
    __metadata("design:type", String)
], CostBulkErrorDetailDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'COST_BULK_ABOVE_MRP' }),
    __metadata("design:type", String)
], CostBulkErrorDetailDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CostBulkErrorDetailDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: "The row's lineNo (notes only)." }),
    __metadata("design:type", Number)
], CostBulkErrorDetailDto.prototype, "line", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['REFUSE', 'WARN'] }),
    __metadata("design:type", String)
], CostBulkErrorDetailDto.prototype, "level", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: cost_price_bulk_types_1.LEFT_OUT_REASONS, description: 'One-item 422 only.' }),
    __metadata("design:type", String)
], CostBulkErrorDetailDto.prototype, "reasonCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'One-item 422 only.' }),
    __metadata("design:type", String)
], CostBulkErrorDetailDto.prototype, "trackedAs", void 0);
class CostBulkErrorResponseDto {
    success;
    message;
    errors;
    refusals;
    warnings;
}
exports.CostBulkErrorResponseDto = CostBulkErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], CostBulkErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CostBulkErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: CostBulkErrorDetailDto,
        isArray: true,
        description: 'Every refusal and every un-ticked warning (save 422).',
    }),
    __metadata("design:type", Array)
], CostBulkErrorResponseDto.prototype, "errors", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: CostBulkNoteDto,
        isArray: true,
        description: 'Save 422: the refusals, for NexWarningStrip.',
    }),
    __metadata("design:type", Array)
], CostBulkErrorResponseDto.prototype, "refusals", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: CostBulkNoteDto,
        isArray: true,
        description: 'Save 422: every warning (ticked or not), for NexWarningStrip.',
    }),
    __metadata("design:type", Array)
], CostBulkErrorResponseDto.prototype, "warnings", void 0);
//# sourceMappingURL=cost-price-bulk-response.dto.js.map