"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemStockBalanceExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let ItemStockBalanceExceptionFilter = class ItemStockBalanceExceptionFilter {
    catch(exception, host) {
        const response = host.switchToHttp().getResponse();
        if (exception instanceof common_1.HttpException) {
            const statusCode = exception.getStatus();
            const rawResponse = exception.getResponse();
            if (this.isItemStockBalanceErrorResponse(rawResponse)) {
                response.status(statusCode).json(rawResponse);
                return;
            }
            if (statusCode === 400 && this.isValidationExceptionPayload(rawResponse)) {
                response.status(statusCode).json(this.mapValidationPayload(rawResponse));
                return;
            }
            response.status(statusCode).json({
                success: false,
                message: this.resolveErrorMessage(rawResponse, exception.message),
                errors: [],
            });
            return;
        }
        response.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Internal server error',
            errors: [],
        });
    }
    isItemStockBalanceErrorResponse(value) {
        if (typeof value !== 'object' || value === null) {
            return false;
        }
        const candidate = value;
        return (candidate.success === false &&
            typeof candidate.message === 'string' &&
            Array.isArray(candidate.errors));
    }
    isValidationExceptionPayload(value) {
        if (typeof value !== 'object' || value === null) {
            return false;
        }
        const candidate = value;
        return typeof candidate.message === 'string' || Array.isArray(candidate.message);
    }
    mapValidationPayload(payload) {
        const messages = Array.isArray(payload.message)
            ? payload.message
            : payload.message
                ? [payload.message]
                : ['Validation failed'];
        const errors = messages.map((message) => ({
            field: this.inferFieldName(message),
            message,
        }));
        return {
            success: false,
            message: 'Validation failed',
            errors,
        };
    }
    resolveErrorMessage(rawResponse, fallback) {
        if (typeof rawResponse === 'string') {
            return rawResponse;
        }
        if (typeof rawResponse === 'object' && rawResponse !== null && 'message' in rawResponse) {
            const message = rawResponse.message;
            if (typeof message === 'string') {
                return message;
            }
        }
        return fallback || 'Request failed';
    }
    inferFieldName(message) {
        const fieldMatch = message.match(/\b(isb_acc_year|isb_company_id|isb_branch_id|isb_godown_id|isb_item_id|isb_unit_id|isb_stock_bucket)\b/i);
        if (fieldMatch) {
            return fieldMatch[1];
        }
        return 'request';
    }
};
exports.ItemStockBalanceExceptionFilter = ItemStockBalanceExceptionFilter;
exports.ItemStockBalanceExceptionFilter = ItemStockBalanceExceptionFilter = __decorate([
    (0, common_1.Catch)()
], ItemStockBalanceExceptionFilter);
//# sourceMappingURL=itemStockBalanceExceptionFilter.js.map