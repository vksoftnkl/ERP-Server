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
exports.GetBulkItemStockListQueryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const toRequiredString = (value) => {
    if (typeof value !== 'string')
        return value;
    return value.trim();
};
const toOptionalString = (value) => {
    if (value === undefined || value === null || value === '')
        return undefined;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
    }
    return value;
};
class GetBulkItemStockListQueryDto {
    isb_acc_year;
    isb_company_id;
    isb_branch_id;
    isb_godown_id;
    item_group_id;
    item_brand_id;
    item_section_id;
    item_category_id;
    stock_type;
    isb_stock_bucket;
    limit;
}
exports.GetBulkItemStockListQueryDto = GetBulkItemStockListQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 9, example: '2025-2026' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], GetBulkItemStockListQueryDto.prototype, "isb_acc_year", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], GetBulkItemStockListQueryDto.prototype, "isb_company_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], GetBulkItemStockListQueryDto.prototype, "isb_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], GetBulkItemStockListQueryDto.prototype, "isb_godown_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Filter by item group' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], GetBulkItemStockListQueryDto.prototype, "item_group_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Filter by item brand' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], GetBulkItemStockListQueryDto.prototype, "item_brand_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Filter by item section' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], GetBulkItemStockListQueryDto.prototype, "item_section_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Filter by item category' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], GetBulkItemStockListQueryDto.prototype, "item_category_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['ALL', 'NEGATIVE', 'ZERO'],
        description: 'ALL = all stocks, NEGATIVE = closing qty < 0, ZERO = closing qty = 0',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['ALL', 'NEGATIVE', 'ZERO']),
    __metadata("design:type", String)
], GetBulkItemStockListQueryDto.prototype, "stock_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'SALEABLE' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], GetBulkItemStockListQueryDto.prototype, "isb_stock_bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '500', description: 'Max rows to return (capped at 2000)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalString(value)),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GetBulkItemStockListQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=get-bulk-item-stock-list-query.dto.js.map