"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptionalStockBucket = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const stock_voucher_types_1 = require("../../stocks/stock-voucher/types/stock-voucher.types");
const OptionalStockBucket = () => (0, common_1.applyDecorators)((0, swagger_1.ApiPropertyOptional)({
    enum: stock_voucher_types_1.STOCK_BUCKETS,
    default: 'SALEABLE',
    description: 'Omit for SALEABLE. The column is NOT NULL: null is refused.',
}), (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value), (0, class_validator_1.ValidateIf)((_, value) => value !== undefined), (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_BUCKETS, {
    message: `$property must be one of ${stock_voucher_types_1.STOCK_BUCKETS.join(', ')} — omit it for SALEABLE`,
}));
exports.OptionalStockBucket = OptionalStockBucket;
//# sourceMappingURL=sales-dto.decorators.js.map