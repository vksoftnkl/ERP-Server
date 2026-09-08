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
exports.SellingPriceBulkExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const module_exception_filter_utils_1 = require("../../../common/utils/module-exception-filter.utils");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_voucher_types_1 = require("../stock-voucher/types/stock-voucher.types");
const CONSTRAINT_MESSAGES = {
    ex_smp_overlap: 'Another price already covers this bucket at this scope for an overlapping period. ' +
        'Reload the row and try again — someone else may have priced it a moment ago.',
    ck_smp_not_above_mrp: 'A selling price cannot be above the MRP of the bucket it prices.',
    ck_smp_prices_nonneg: 'A selling price cannot be negative.',
    ck_smp_identity: 'A bucket must carry an MRP or a sale price. An item that tracks neither is priced on its ' +
        'headline row, not on a bucket.',
};
let SellingPriceBulkExceptionFilter = class SellingPriceBulkExceptionFilter extends module_exception_filter_utils_1.StockExceptionFilter {
    constructor() {
        super(/\b((?:smp|ipm)[A-Za-z0-9_]+|scope|confirmed|bucketId|uomId|itemId|priceScope)\b/);
    }
    catch(exception, host) {
        super.catch(this.translateEngineError(exception) ?? exception, host);
    }
    translateEngineError(exception) {
        if (exception instanceof common_1.HttpException) {
            return null;
        }
        const meta = this.readMeta(exception);
        const sqlState = typeof meta?.code === 'string' ? meta.code : null;
        if (!sqlState) {
            return null;
        }
        const status = stock_voucher_types_1.STOCK_ENGINE_SQLSTATE_STATUS[sqlState];
        if (status === undefined) {
            return null;
        }
        const engineMessage = typeof meta?.message === 'string' && meta.message.trim()
            ? meta.message.trim()
            : `The database refused this price (SQLSTATE ${sqlState}).`;
        const named = Object.keys(CONSTRAINT_MESSAGES).find((constraint) => engineMessage.includes(constraint));
        const message = named ? CONSTRAINT_MESSAGES[named] : engineMessage;
        return new common_1.HttpException((0, module_service_utils_1.buildStockErrorResponse)(message, [
            { field: named ?? 'request', message: named ? `${message} (${engineMessage})` : message },
        ]), status);
    }
    readMeta(exception) {
        if (typeof exception !== 'object' || exception === null || !('meta' in exception)) {
            return null;
        }
        const { meta } = exception;
        if (typeof meta !== 'object' || meta === null) {
            return null;
        }
        return meta;
    }
};
exports.SellingPriceBulkExceptionFilter = SellingPriceBulkExceptionFilter;
exports.SellingPriceBulkExceptionFilter = SellingPriceBulkExceptionFilter = __decorate([
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [])
], SellingPriceBulkExceptionFilter);
//# sourceMappingURL=selling-price-bulk-exception.filter.js.map