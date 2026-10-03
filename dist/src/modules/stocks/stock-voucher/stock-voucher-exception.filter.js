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
exports.StockVoucherExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const module_exception_filter_utils_1 = require("../../../common/utils/module-exception-filter.utils");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_voucher_types_1 = require("./types/stock-voucher.types");
let StockVoucherExceptionFilter = class StockVoucherExceptionFilter extends module_exception_filter_utils_1.StockExceptionFilter {
    constructor() {
        super(/\b((?:svh|svi)[A-Za-z0-9]+|accYear|toGodownId|deviceId|voucherType)\b/);
    }
    catch(exception, host) {
        const translated = this.translateEngineError(exception);
        super.catch(translated ?? exception, host);
    }
    translateEngineError(exception) {
        if (exception instanceof common_1.HttpException) {
            return null;
        }
        const meta = this.readMeta(exception);
        if (!meta) {
            return null;
        }
        const sqlState = typeof meta.code === 'string' ? meta.code : null;
        if (!sqlState) {
            return null;
        }
        const engineMessage = typeof meta.message === 'string' && meta.message.trim()
            ? meta.message.trim()
            : `The stock engine refused this document (SQLSTATE ${sqlState}).`;
        const status = this.resolveStatus(sqlState, engineMessage);
        if (status === null) {
            return null;
        }
        return new common_1.HttpException((0, module_service_utils_1.buildStockErrorResponse)(engineMessage, [
            { field: 'request', message: engineMessage },
        ]), status);
    }
    resolveStatus(sqlState, engineMessage) {
        if (sqlState === '23514' &&
            engineMessage.toLowerCase().includes(stock_voucher_types_1.NEGATIVE_STOCK_MESSAGE_FRAGMENT)) {
            return 409;
        }
        return stock_voucher_types_1.STOCK_ENGINE_SQLSTATE_STATUS[sqlState] ?? null;
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
exports.StockVoucherExceptionFilter = StockVoucherExceptionFilter;
exports.StockVoucherExceptionFilter = StockVoucherExceptionFilter = __decorate([
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [])
], StockVoucherExceptionFilter);
//# sourceMappingURL=stock-voucher-exception.filter.js.map