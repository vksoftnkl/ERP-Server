"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AllExceptionsFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const house_validation_1 = require("../validation/house-validation");
const error_wording_1 = require("../error-wording/error-wording");
let AllExceptionsFilter = AllExceptionsFilter_1 = class AllExceptionsFilter {
    logger = new common_1.Logger(AllExceptionsFilter_1.name);
    catch(exception, host) {
        const context = host.switchToHttp();
        const request = context.getRequest();
        const response = (0, error_wording_1.wordedResponse)(context.getResponse(), request);
        const statusCode = exception instanceof common_1.HttpException ? exception.getStatus() : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const message = exception instanceof common_1.HttpException ? exception.getResponse() : 'Internal server error';
        if (statusCode >= 500) {
            this.logger.error(`${request.method} ${request.url}`, exception instanceof Error ? exception.stack : JSON.stringify(exception));
        }
        if (isHouseErrorBody(message)) {
            response.status(statusCode).json({
                ...message,
                statusCode,
                path: request.url,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        response.status(statusCode).json({
            success: false,
            statusCode,
            message,
            ...(statusCode >= 500
                ? {
                    errors: [
                        { field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' },
                    ],
                }
                : statusCode === 400
                    ? { errors: frameworkErrors(message) }
                    : {}),
            path: request.url,
            timestamp: new Date().toISOString(),
        });
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = AllExceptionsFilter_1 = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
function isHouseErrorBody(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const body = value;
    return body.success === false && typeof body.message === 'string' && Array.isArray(body.errors);
}
function frameworkErrors(body) {
    const raw = typeof body === 'string'
        ? body
        : typeof body === 'object' && body !== null
            ? body.message
            : undefined;
    const messages = (Array.isArray(raw) ? raw : [raw]).filter((m) => typeof m === 'string' && m.length > 0);
    return messages.map((message) => ({
        field: 'request',
        code: (0, house_validation_1.frameworkValidationCode)(message),
        message,
    }));
}
//# sourceMappingURL=all-exceptions.filter.js.map