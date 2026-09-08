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
exports.CancelStockTransferDto = exports.DespatchStockTransferDto = exports.StockTransferRefDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
class StockTransferRefDto {
    svhId;
    accYear;
    companyId;
    branchId;
    userId;
}
exports.StockTransferRefDto = StockTransferRefDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockTransferRefDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', minLength: 9, maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' }),
    __metadata("design:type", String)
], StockTransferRefDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockTransferRefDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockTransferRefDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Falls back to the authenticated user from the request context.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], StockTransferRefDto.prototype, "userId", void 0);
class DespatchStockTransferDto extends StockTransferRefDto {
    lrNo;
    vehicleNo;
    expectedOn;
}
exports.DespatchStockTransferDto = DespatchStockTransferDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true, description: 'Lorry receipt number.' }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], DespatchStockTransferDto.prototype, "lrNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], DespatchStockTransferDto.prototype, "vehicleNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', example: '2026-09-12' }),
    (0, dtoDecorators_1.NullableStringStrict)(10),
    __metadata("design:type", Object)
], DespatchStockTransferDto.prototype, "expectedOn", void 0);
class CancelStockTransferDto extends StockTransferRefDto {
    reason;
}
exports.CancelStockTransferDto = CancelStockTransferDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        minLength: 3,
        maxLength: 250,
        description: 'Required even though the column is nullable: a cancelled transfer with no reason is unanswerable three months later.',
    }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.MinLength)(3, { message: 'reason must say something — at least 3 characters.' }),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], CancelStockTransferDto.prototype, "reason", void 0);
//# sourceMappingURL=post-stock-transfer.dto.js.map