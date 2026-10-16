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
const stock_error_codes_1 = require("../types/stock-error-codes");
const CONSTRAINT_MESSAGES = {
    ex_ipm_overlap: 'Another price already covers this bucket at this scope for an overlapping period. ' +
        'Reload the row and try again — someone else may have priced it a moment ago.',
    ck_ipm_not_above_mrp: 'A selling price cannot be above the MRP of the bucket it prices.',
    ck_ipm_bucket_mrp_is_max: "A bucket row's MRP and its max price must be the same figure.",
    ck_ipm_bucket_mrp: 'An MRP bucket must be above zero.',
    ck_ipm_bucket_sp: 'A sale-price bucket must be above zero.',
    chk_ipm_nonnegative: 'A selling price cannot be negative.',
};
const CONSTRAINT_CODES = {
    ex_ipm_overlap: stock_error_codes_1.StockErrorCode.PRICE_OVERLAP,
    ck_ipm_not_above_mrp: stock_error_codes_1.StockErrorCode.PRICE_ABOVE_MRP,
    ck_ipm_bucket_mrp_is_max: stock_error_codes_1.StockErrorCode.PRICE_BUCKET_MRP_MISMATCH,
    ck_ipm_bucket_mrp: stock_error_codes_1.StockErrorCode.PRICE_BUCKET_MRP_ZERO,
    ck_ipm_bucket_sp: stock_error_codes_1.StockErrorCode.PRICE_BUCKET_SP_ZERO,
    chk_ipm_nonnegative: stock_error_codes_1.StockErrorCode.PRICE_NEGATIVE,
};
let SellingPriceBulkExceptionFilter = class SellingPriceBulkExceptionFilter extends module_exception_filter_utils_1.StockExceptionFilter {
    constructor() {
        super(/\b(ipm[A-Za-z0-9_]+|scope|confirmed|bucketId|uomId|itemId|priceScope)\b/);
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
            {
                field: named ?? 'request',
                code: named ? CONSTRAINT_CODES[named] : stock_error_codes_1.STOCK_DB_ERROR_CODES[sqlState],
                message: named ? `${message} (${engineMessage})` : message,
            },
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