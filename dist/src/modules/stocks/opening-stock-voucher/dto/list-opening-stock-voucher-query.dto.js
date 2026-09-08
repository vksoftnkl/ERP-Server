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
exports.OpeningStockReportQueryDto = exports.OpeningStockVoucherRefQueryDto = exports.GetOpeningStockVoucherQueryDto = exports.OpeningStockVoucherScopeQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
class OpeningStockVoucherScopeQueryDto {
    companyId;
    branchId;
    accYear;
}
exports.OpeningStockVoucherScopeQueryDto = OpeningStockVoucherScopeQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OpeningStockVoucherScopeQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OpeningStockVoucherScopeQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', minLength: 9, maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' }),
    __metadata("design:type", String)
], OpeningStockVoucherScopeQueryDto.prototype, "accYear", void 0);
class GetOpeningStockVoucherQueryDto extends OpeningStockVoucherScopeQueryDto {
    svhId;
}
exports.GetOpeningStockVoucherQueryDto = GetOpeningStockVoucherQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The document to load. REQUIRED — this route no longer lists.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GetOpeningStockVoucherQueryDto.prototype, "svhId", void 0);
class OpeningStockVoucherRefQueryDto extends OpeningStockVoucherScopeQueryDto {
    svhId;
}
exports.OpeningStockVoucherRefQueryDto = OpeningStockVoucherRefQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OpeningStockVoucherRefQueryDto.prototype, "svhId", void 0);
class OpeningStockReportQueryDto extends OpeningStockVoucherScopeQueryDto {
    limit;
    offset;
}
exports.OpeningStockReportQueryDto = OpeningStockReportQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 200, maximum: 1000 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 1000),
    __metadata("design:type", Number)
], OpeningStockReportQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalQueryInt)(0),
    __metadata("design:type", Number)
], OpeningStockReportQueryDto.prototype, "offset", void 0);
//# sourceMappingURL=list-opening-stock-voucher-query.dto.js.map