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
exports.PickStockQueryDto = exports.CancelStockAdjustmentDto = exports.StockAdjustmentRefDto = exports.StockAdjustmentRefQueryDto = exports.StockAdjustmentScopeQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const stock_voucher_types_1 = require("../../stock-voucher/types/stock-voucher.types");
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
class StockAdjustmentScopeQueryDto {
    companyId;
    branchId;
    accYear;
}
exports.StockAdjustmentScopeQueryDto = StockAdjustmentScopeQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockAdjustmentScopeQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockAdjustmentScopeQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', minLength: 9, maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' }),
    __metadata("design:type", String)
], StockAdjustmentScopeQueryDto.prototype, "accYear", void 0);
class StockAdjustmentRefQueryDto extends StockAdjustmentScopeQueryDto {
    svhId;
}
exports.StockAdjustmentRefQueryDto = StockAdjustmentRefQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockAdjustmentRefQueryDto.prototype, "svhId", void 0);
class StockAdjustmentRefDto {
    svhId;
    accYear;
    companyId;
    branchId;
    userId;
}
exports.StockAdjustmentRefDto = StockAdjustmentRefDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockAdjustmentRefDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', minLength: 9, maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' }),
    __metadata("design:type", String)
], StockAdjustmentRefDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockAdjustmentRefDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockAdjustmentRefDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Falls back to the authenticated user.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], StockAdjustmentRefDto.prototype, "userId", void 0);
class CancelStockAdjustmentDto extends StockAdjustmentRefDto {
    reason;
}
exports.CancelStockAdjustmentDto = CancelStockAdjustmentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 3, maxLength: 250, description: 'Why the document is being reversed.' }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.MinLength)(3, { message: 'reason must say something — at least 3 characters.' }),
    __metadata("design:type", String)
], CancelStockAdjustmentDto.prototype, "reason", void 0);
class PickStockQueryDto {
    companyId;
    branchId;
    godownId;
    itemId;
    bucket;
    search;
    limit;
}
exports.PickStockQueryDto = PickStockQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PickStockQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PickStockQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PickStockQueryDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'One item, or every item in the godown.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], PickStockQueryDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.STOCK_BUCKETS,
        description: 'One bucket, or every bucket when absent — each row says its own `bucket`, so one call answers "where is this lot" across SALEABLE, DAMAGED and the rest.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_BUCKETS),
    __metadata("design:type", String)
], PickStockQueryDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, description: 'Item name, item code or batch number, contains.' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], PickStockQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 200, maximum: 1000 }),
    (0, dtoDecorators_1.OptionalInteger)(1, 1000),
    __metadata("design:type", Number)
], PickStockQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=stock-adjustment-query.dto.js.map