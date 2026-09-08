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
exports.StockTransferInboundQueryDto = exports.StockTransferPrefillQueryDto = exports.StockTransferRefQueryDto = exports.GetStockTransferQueryDto = exports.StockTransferScopeQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const stock_voucher_types_1 = require("../../stock-voucher/types/stock-voucher.types");
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
class StockTransferScopeQueryDto {
    companyId;
    branchId;
    accYear;
}
exports.StockTransferScopeQueryDto = StockTransferScopeQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockTransferScopeQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockTransferScopeQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', minLength: 9, maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' }),
    __metadata("design:type", String)
], StockTransferScopeQueryDto.prototype, "accYear", void 0);
class GetStockTransferQueryDto extends StockTransferScopeQueryDto {
    svhId;
    status;
    fromDate;
    toDate;
    search;
    limit;
    offset;
}
exports.GetStockTransferQueryDto = GetStockTransferQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Present = load this one document (with its transit rows). Absent = list.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetStockTransferQueryDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.STOCK_VOUCHER_STATUSES,
        description: 'Omit for all. An inter-branch despatch is IN_TRANSIT, never POSTED — filtering to POSTED hides every transfer on a lorry.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_VOUCHER_STATUSES, {
        message: `status must be one of ${stock_voucher_types_1.STOCK_VOUCHER_STATUSES.join(', ')}`,
    }),
    __metadata("design:type", String)
], GetStockTransferQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date' }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], GetStockTransferQueryDto.prototype, "fromDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date' }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], GetStockTransferQueryDto.prototype, "toDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Matches refno or the user reference' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], GetStockTransferQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 50, maximum: 500 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 500),
    __metadata("design:type", Number)
], GetStockTransferQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalQueryInt)(0),
    __metadata("design:type", Number)
], GetStockTransferQueryDto.prototype, "offset", void 0);
class StockTransferRefQueryDto extends StockTransferScopeQueryDto {
    svhId;
}
exports.StockTransferRefQueryDto = StockTransferRefQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockTransferRefQueryDto.prototype, "svhId", void 0);
class StockTransferPrefillQueryDto {
    companyId;
    branchId;
    outVoucherId;
    accYear;
}
exports.StockTransferPrefillQueryDto = StockTransferPrefillQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockTransferPrefillQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "The RECEIVING branch — must be the OUT's destination.",
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockTransferPrefillQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The TRANSFER_OUT being received against.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockTransferPrefillQueryDto.prototype, "outVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-2027',
        minLength: 9,
        maxLength: 9,
        description: "The DESPATCH's accounting year, which may not be the receipt's.",
    }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' }),
    __metadata("design:type", String)
], StockTransferPrefillQueryDto.prototype, "accYear", void 0);
class StockTransferInboundQueryDto {
    companyId;
    branchId;
    limit;
    offset;
}
exports.StockTransferInboundQueryDto = StockTransferInboundQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockTransferInboundQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Me — the branch stock is coming to.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockTransferInboundQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 100, maximum: 500 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 500),
    __metadata("design:type", Number)
], StockTransferInboundQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalQueryInt)(0),
    __metadata("design:type", Number)
], StockTransferInboundQueryDto.prototype, "offset", void 0);
//# sourceMappingURL=list-stock-transfer-query.dto.js.map