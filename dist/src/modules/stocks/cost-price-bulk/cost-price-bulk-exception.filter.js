"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostPriceBulkExceptionFilter = exports.VALUE_TOO_LARGE = void 0;
exports.overflowRefusal = overflowRefusal;
const common_1 = require("@nestjs/common");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const selling_price_bulk_exception_filter_1 = require("../selling-price-bulk/selling-price-bulk-exception.filter");
const cost_price_bulk_types_1 = require("./types/cost-price-bulk.types");
exports.VALUE_TOO_LARGE = 'VALUE_TOO_LARGE';
let CostPriceBulkExceptionFilter = class CostPriceBulkExceptionFilter extends selling_price_bulk_exception_filter_1.SellingPriceBulkExceptionFilter {
    catch(exception, host) {
        super.catch(overflowRefusal(exception) ?? exception, host);
    }
};
exports.CostPriceBulkExceptionFilter = CostPriceBulkExceptionFilter;
exports.CostPriceBulkExceptionFilter = CostPriceBulkExceptionFilter = __decorate([
    (0, common_1.Catch)()
], CostPriceBulkExceptionFilter);
function overflowRefusal(exception) {
    if (exception instanceof common_1.HttpException) {
        return null;
    }
    const detail = (0, module_shared_utils_1.numericOverflowOf)(exception);
    if (detail === null) {
        return null;
    }
    const markup = /precision 9, scale 3/.test(detail);
    const message = markup
        ? 'A new cost is so low that the profit on its prices cannot be stored. Check the New Cost.'
        : 'A price, cost or MRP is too large to save. Check the figures you typed.';
    return new common_1.HttpException({
        success: false,
        message,
        errors: [
            {
                field: 'rows',
                code: markup ? cost_price_bulk_types_1.COST_BULK.COST_TOO_LOW : exports.VALUE_TOO_LARGE,
                message: `${message} (${detail})`,
            },
        ],
    }, common_1.HttpStatus.UNPROCESSABLE_ENTITY);
}
//# sourceMappingURL=cost-price-bulk-exception.filter.js.map