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
exports.ImportOpeningStockVoucherDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
class ImportOpeningStockVoucherDto {
    svhId;
    accYear;
    companyId;
    branchId;
    userId;
    file;
}
exports.ImportOpeningStockVoucherDto = ImportOpeningStockVoucherDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The existing DRAFT whose lines are being replaced.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ImportOpeningStockVoucherDto.prototype, "svhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', minLength: 9, maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' }),
    __metadata("design:type", String)
], ImportOpeningStockVoucherDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ImportOpeningStockVoucherDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ImportOpeningStockVoucherDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Falls back to the authenticated user from the request context.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ImportOpeningStockVoucherDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'binary',
        description: 'CSV. Required columns: item_code, unit_name, qty, cost_rate. Optional: line_no, split_no, godown, bucket, batch_no, mfg_date, expiry_date, mrp, sale_price, serial_no, supplier_code, free_qty, cost_rate_wot, tax_perc, remarks.',
    }),
    __metadata("design:type", Object)
], ImportOpeningStockVoucherDto.prototype, "file", void 0);
//# sourceMappingURL=import-opening-stock-voucher.dto.js.map