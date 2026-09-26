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
exports.GenerateCountSheetQueryDto = exports.PhysicalStockVarianceQueryDto = exports.PhysicalStockVoucherRefQueryDto = exports.GetPhysicalStockVoucherQueryDto = exports.PhysicalStockVoucherScopeQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const stock_voucher_types_1 = require("../../stock-voucher/types/stock-voucher.types");
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
class PhysicalStockVoucherScopeQueryDto {
    companyId;
    branchId;
    accYear;
}
exports.PhysicalStockVoucherScopeQueryDto = PhysicalStockVoucherScopeQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PhysicalStockVoucherScopeQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PhysicalStockVoucherScopeQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', minLength: 9, maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' }),
    __metadata("design:type", String)
], PhysicalStockVoucherScopeQueryDto.prototype, "accYear", void 0);
class GetPhysicalStockVoucherQueryDto extends PhysicalStockVoucherScopeQueryDto {
    svhId;
    status;
    fromDate;
    toDate;
    search;
    limit;
    offset;
}
exports.GetPhysicalStockVoucherQueryDto = GetPhysicalStockVoucherQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Present = load this one count. Absent = list.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetPhysicalStockVoucherQueryDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: stock_voucher_types_1.STOCK_VOUCHER_STATUSES }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_VOUCHER_STATUSES, {
        message: `status must be one of ${stock_voucher_types_1.STOCK_VOUCHER_STATUSES.join(', ')}`,
    }),
    __metadata("design:type", String)
], GetPhysicalStockVoucherQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date' }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], GetPhysicalStockVoucherQueryDto.prototype, "fromDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date' }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], GetPhysicalStockVoucherQueryDto.prototype, "toDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Matches refno or the user reference' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], GetPhysicalStockVoucherQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 50, maximum: 500 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 500),
    __metadata("design:type", Number)
], GetPhysicalStockVoucherQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalQueryInt)(0),
    __metadata("design:type", Number)
], GetPhysicalStockVoucherQueryDto.prototype, "offset", void 0);
class PhysicalStockVoucherRefQueryDto extends PhysicalStockVoucherScopeQueryDto {
    svhId;
}
exports.PhysicalStockVoucherRefQueryDto = PhysicalStockVoucherRefQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PhysicalStockVoucherRefQueryDto.prototype, "svhId", void 0);
class PhysicalStockVarianceQueryDto extends PhysicalStockVoucherRefQueryDto {
    limit;
    offset;
}
exports.PhysicalStockVarianceQueryDto = PhysicalStockVarianceQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 200, maximum: 1000 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 1000),
    __metadata("design:type", Number)
], PhysicalStockVarianceQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalQueryInt)(0),
    __metadata("design:type", Number)
], PhysicalStockVarianceQueryDto.prototype, "offset", void 0);
class GenerateCountSheetQueryDto extends PhysicalStockVoucherScopeQueryDto {
    godownId;
    bucket;
    itemGroupId;
    includeZero;
    limit;
    offset;
}
exports.GenerateCountSheetQueryDto = GenerateCountSheetQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'inventory.godown_locations.gdl_id — the shelf being counted.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GenerateCountSheetQueryDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.STOCK_BUCKETS,
        description: 'Count one bucket at a time. All of them when omitted.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_BUCKETS, {
        message: `bucket must be one of ${stock_voucher_types_1.STOCK_BUCKETS.join(', ')}`,
    }),
    __metadata("design:type", String)
], GenerateCountSheetQueryDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'inventory.item_group_master.item_group_id — count one aisle rather than the warehouse.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GenerateCountSheetQueryDto.prototype, "itemGroupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'Holdings the book says are empty are INCLUDED by default: a holding the book says is empty is exactly where a count finds something. Set false for the operator who does not want them.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], GenerateCountSheetQueryDto.prototype, "includeZero", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 200,
        maximum: 1000,
        description: 'A main warehouse is tens of thousands of holdings, so the sheet is paged. lineNo continues across pages — page 2 is lines 201-400 of one sheet, not a second sheet numbered from 1.',
    }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 1000),
    __metadata("design:type", Number)
], GenerateCountSheetQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalQueryInt)(0),
    __metadata("design:type", Number)
], GenerateCountSheetQueryDto.prototype, "offset", void 0);
//# sourceMappingURL=list-physical-stock-voucher-query.dto.js.map