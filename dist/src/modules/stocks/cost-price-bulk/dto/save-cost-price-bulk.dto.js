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
exports.SaveCostPriceBulkDto = exports.CostBulkOverrideDto = exports.CostBulkRowInputDto = exports.CostBulkLevelInputDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const cost_price_bulk_types_1 = require("../types/cost-price-bulk.types");
class CostBulkLevelInputDto {
    level;
    price;
}
exports.CostBulkLevelInputDto = CostBulkLevelInputDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, maximum: 4, description: 'Price level 1–4 → ipm_sales_price_a … d.' }),
    (0, dtoDecorators_1.RequiredInteger)(1, 4),
    __metadata("design:type", Number)
], CostBulkLevelInputDto.prototype, "level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 167.5,
        description: 'The new shelf price, tax inclusive, as the client computed it (rule, round-up, or typed). ' +
            'Written as sent; its w/o-tax figure and markup are recomputed from it and the new cost.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], CostBulkLevelInputDto.prototype, "price", void 0);
class CostBulkRowInputDto {
    lineNo;
    ipmId;
    rowToken;
    costPrice;
    mrp;
    minPrice;
    profitType;
    levels;
}
exports.CostBulkRowInputDto = CostBulkRowInputDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        minimum: 1,
        description: 'The grid line (1-based). Every note names it as `line`; overrides[] match on it.',
    }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], CostBulkRowInputDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: "The price row loaded (the GET row's ipmId)." }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CostBulkRowInputDto.prototype, "ipmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '6f1d0c2b9a7e4d0e8b1f2a3c4d5e6f70',
        description: "The GET row's rowToken, sent back unchanged — md5 of the row's business columns. Differs → " +
            'COST_BULK_ROW_CHANGED (someone changed the row since it was loaded).',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CostBulkRowInputDto.prototype, "rowToken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 152,
        description: 'The new cost of one of this unit, tax inclusive. Send the loaded cost when it is not changing.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], CostBulkRowInputDto.prototype, "costPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Number,
        nullable: true,
        example: 199,
        description: 'New MRP (ipm_max_price) for this unit only. Absent / null = unchanged. 0 = no MRP.',
    }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], CostBulkRowInputDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Number,
        nullable: true,
        description: 'New Min (ipm_min_price). Absent / null = unchanged.',
    }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], CostBulkRowInputDto.prototype, "minPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: cost_price_bulk_types_1.PROFIT_TYPES,
        nullable: true,
        description: "The unit's rule, saved to ipm_profit_type. Absent / null = unchanged.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(cost_price_bulk_types_1.PROFIT_TYPES),
    __metadata("design:type", Object)
], CostBulkRowInputDto.prototype, "profitType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: CostBulkLevelInputDto,
        isArray: true,
        description: 'New prices. A level not sent keeps its stored price (its markup is still recomputed against the new cost).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(4),
    (0, class_validator_1.ArrayUnique)((level) => level.level),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CostBulkLevelInputDto),
    __metadata("design:type", Array)
], CostBulkRowInputDto.prototype, "levels", void 0);
class CostBulkOverrideDto {
    code;
    line;
}
exports.CostBulkOverrideDto = CostBulkOverrideDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'COST_BULK_BELOW_COST',
        description: 'A warning code: COST_BULK_BELOW_COST or COST_BULK_BY_USER_PRICES_KEPT.',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], CostBulkOverrideDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Number,
        nullable: true,
        example: 6,
        description: 'The line the tick is for. Absent / null = every line with that code (NexWarningStrip.overrides() sends codes only).',
    }),
    (0, dtoDecorators_1.NullableInteger)(1),
    __metadata("design:type", Object)
], CostBulkOverrideDto.prototype, "line", void 0);
class SaveCostPriceBulkDto {
    companyId;
    branchId;
    overrides;
    rows;
}
exports.SaveCostPriceBulkDto = SaveCostPriceBulkDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveCostPriceBulkDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The branch the rows were loaded at.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveCostPriceBulkDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: CostBulkOverrideDto,
        isArray: true,
        description: 'The warnings ticked in the NexWarningStrip popup. Ticking needs only the menu 298 Edit right.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CostBulkOverrideDto),
    __metadata("design:type", Array)
], SaveCostPriceBulkDto.prototype, "overrides", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: CostBulkRowInputDto,
        isArray: true,
        description: `The CHANGED rows, at most ${cost_price_bulk_types_1.MAX_COST_BULK_ROWS} (more → 422 COST_BULK_TOO_MANY_ROWS; the client saves in parts). One price row once.`,
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ArrayUnique)((row) => row.ipmId),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CostBulkRowInputDto),
    __metadata("design:type", Array)
], SaveCostPriceBulkDto.prototype, "rows", void 0);
//# sourceMappingURL=save-cost-price-bulk.dto.js.map