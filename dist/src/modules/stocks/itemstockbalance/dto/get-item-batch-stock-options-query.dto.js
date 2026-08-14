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
exports.GetItemBatchStockOptionsQueryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const toRequiredString = (value) => {
    if (typeof value !== 'string') {
        return value;
    }
    return value.trim();
};
const toOptionalString = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
    }
    return value;
};
class GetItemBatchStockOptionsQueryDto {
    ibs_acc_year;
    ibs_company_id;
    ibs_branch_id;
    ibs_godown_id;
    ibs_item_id;
    ibs_unit_id;
    ibs_stock_bucket;
    search;
    limit;
}
exports.GetItemBatchStockOptionsQueryDto = GetItemBatchStockOptionsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 9, example: '2025-2026' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], GetItemBatchStockOptionsQueryDto.prototype, "ibs_acc_year", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], GetItemBatchStockOptionsQueryDto.prototype, "ibs_company_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], GetItemBatchStockOptionsQueryDto.prototype, "ibs_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], GetItemBatchStockOptionsQueryDto.prototype, "ibs_godown_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], GetItemBatchStockOptionsQueryDto.prototype, "ibs_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], GetItemBatchStockOptionsQueryDto.prototype, "ibs_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'SALEABLE',
        description: 'Optional stock bucket filter. Omit to return all matching buckets.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], GetItemBatchStockOptionsQueryDto.prototype, "ibs_stock_bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'BATCH-001' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], GetItemBatchStockOptionsQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '50' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(3),
    __metadata("design:type", String)
], GetItemBatchStockOptionsQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=get-item-batch-stock-options-query.dto.js.map