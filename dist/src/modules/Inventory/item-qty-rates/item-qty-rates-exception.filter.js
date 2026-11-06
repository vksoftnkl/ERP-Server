"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemQtyRatesExceptionFilter = exports.QTY_RATES_FIELD_PATTERN = void 0;
exports.qtyRatesFieldOf = qtyRatesFieldOf;
const common_1 = require("@nestjs/common");
const house_validation_1 = require("../../../common/validation/house-validation");
const selling_price_bulk_exception_filter_1 = require("../../stocks/selling-price-bulk/selling-price-bulk-exception.filter");
exports.QTY_RATES_FIELD_PATTERN = /\b(slabs\.\d+\.[A-Za-z0-9_]+|rates\.rows\.\d+(?:\.[A-Za-z0-9_]+)*|deleteSlabIds\.\d+|iqp_[A-Za-z0-9_]+|ipm[A-Za-z0-9_]+|scope|confirmed|bucketId|uomId|itemId|priceScope|companyId|branchId|slabs|rates|deleteSlabIds)\b/;
function qtyRatesFieldOf(message) {
    return exports.QTY_RATES_FIELD_PATTERN.exec(message)?.[1] ?? 'request';
}
let ItemQtyRatesExceptionFilter = class ItemQtyRatesExceptionFilter extends selling_price_bulk_exception_filter_1.SellingPriceBulkExceptionFilter {
    catch(exception, host) {
        super.catch(this.houseValidation(exception) ?? exception, host);
    }
    houseValidation(exception) {
        if (!(exception instanceof common_1.HttpException) || exception.getStatus() !== 400) {
            return null;
        }
        const body = exception.getResponse();
        if (typeof body !== 'object' || body === null) {
            return null;
        }
        const { errors, message } = body;
        if (Array.isArray(errors)) {
            return null;
        }
        const messages = Array.isArray(message)
            ? message.filter((entry) => typeof entry === 'string')
            : typeof message === 'string'
                ? [message]
                : [];
        if (!messages.length) {
            return null;
        }
        return new common_1.BadRequestException({
            success: false,
            message: 'Validation failed',
            errors: messages.map((entry) => ({
                field: qtyRatesFieldOf(entry),
                code: (0, house_validation_1.frameworkValidationCode)(entry),
                message: entry,
            })),
        });
    }
};
exports.ItemQtyRatesExceptionFilter = ItemQtyRatesExceptionFilter;
exports.ItemQtyRatesExceptionFilter = ItemQtyRatesExceptionFilter = __decorate([
    (0, common_1.Catch)()
], ItemQtyRatesExceptionFilter);
//# sourceMappingURL=item-qty-rates-exception.filter.js.map