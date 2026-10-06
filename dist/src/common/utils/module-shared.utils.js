"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleExceptionFilter = exports.DEFAULT_LIMIT = exports.DEFAULT_PAGE = exports.DEFAULT_ACTOR = void 0;
exports.buildErrorResponse = buildErrorResponse;
exports.throwBadRequest = throwBadRequest;
exports.throwConflict = throwConflict;
exports.throwForbidden = throwForbidden;
exports.throwUnprocessable = throwUnprocessable;
exports.throwNotFound = throwNotFound;
exports.throwOnUniqueConstraintError = throwOnUniqueConstraintError;
exports.isUniqueConstraintError = isUniqueConstraintError;
exports.isForeignKeyConstraintError = isForeignKeyConstraintError;
exports.violatedConstraintOf = violatedConstraintOf;
exports.isExclusionConstraintError = isExclusionConstraintError;
exports.violatedCheckOf = violatedCheckOf;
exports.numericOverflowOf = numericOverflowOf;
exports.isPrismaErrorCode = isPrismaErrorCode;
exports.normalizeRequiredText = normalizeRequiredText;
exports.normalizeNullableString = normalizeNullableString;
exports.resolveActor = resolveActor;
exports.toNumber = toNumber;
exports.toNullableNumber = toNullableNumber;
exports.hasOwnProperty = hasOwnProperty;
exports.applyPresentFields = applyPresentFields;
const common_1 = require("@nestjs/common");
exports.DEFAULT_ACTOR = '00000000-0000-0000-0000-000000000000';
exports.DEFAULT_PAGE = 1;
exports.DEFAULT_LIMIT = 20;
const BAD_REQUEST_STATUS_CODE = 400;
function buildErrorResponse(message, errors = []) {
    return {
        success: false,
        message,
        errors,
    };
}
function throwBadRequest(message, errors) {
    throw new common_1.BadRequestException(buildErrorResponse(message, errors));
}
function throwConflict(message, errors) {
    throw new common_1.ConflictException(buildErrorResponse(message, errors));
}
function throwForbidden(message, errors) {
    throw new common_1.ForbiddenException(buildErrorResponse(message, errors));
}
function throwUnprocessable(message, errors) {
    throw new common_1.UnprocessableEntityException(buildErrorResponse(message, errors));
}
function throwNotFound(message, field, detailMessage) {
    throw new common_1.NotFoundException(buildErrorResponse(message, [
        { field, message: detailMessage },
    ]));
}
function throwOnUniqueConstraintError(error, message, errors) {
    if (isUniqueConstraintError(error)) {
        throwConflict(message, errors);
    }
}
function isUniqueConstraintError(error) {
    return isPrismaErrorCode(error, 'P2002');
}
function isForeignKeyConstraintError(error) {
    return isPrismaErrorCode(error, 'P2003');
}
function violatedConstraintOf(error) {
    if (typeof error !== 'object' || error === null || !('meta' in error)) {
        return null;
    }
    const meta = error.meta ?? {};
    for (const value of [meta.constraint, meta.target, meta.field_name]) {
        if (Array.isArray(value) && value.length) {
            return value.map(String).join(',');
        }
        if (typeof value === 'string' && value) {
            return value.replace(/ \(index\)$/, '');
        }
    }
    return null;
}
function isExclusionConstraintError(error) {
    if (typeof error !== 'object' || error === null || !('message' in error)) {
        return false;
    }
    const { message } = error;
    return typeof message === 'string' && message.includes('23P01');
}
function violatedCheckOf(error) {
    if (typeof error !== 'object' || error === null) {
        return null;
    }
    const { message, meta } = error;
    const texts = [meta?.code === '23514' ? meta.message : null, message].filter((text) => typeof text === 'string');
    for (const text of texts) {
        if (!text.includes('23514') && text !== meta?.message) {
            continue;
        }
        const match = /violates check constraint \\?"([A-Za-z0-9_]+)\\?"/.exec(text);
        if (match) {
            return match[1];
        }
    }
    return null;
}
function numericOverflowOf(error) {
    if (typeof error !== 'object' || error === null) {
        return null;
    }
    const { message, meta } = error;
    const text = typeof message === 'string' ? message : '';
    if (meta?.code !== '22003' && !text.includes('"22003"')) {
        return null;
    }
    const detail = /detail: Some\(\\?"(.+?)\\?"\)/.exec(text);
    return detail ? detail[1] : 'numeric field overflow';
}
function isPrismaErrorCode(error, code) {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
        return false;
    }
    return error.code === code;
}
function normalizeRequiredText(value, field, message = `${field} must not be empty`) {
    const trimmed = value.trim();
    if (!trimmed) {
        throwBadRequest('Validation failed', [
            { field, message },
        ]);
    }
    return trimmed;
}
function normalizeNullableString(value) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
function resolveActor(value, userId = null) {
    if (value) {
        const trimmed = value.trim();
        if (trimmed)
            return trimmed;
    }
    if (userId) {
        const trimmedUserId = userId.trim();
        if (trimmedUserId)
            return trimmedUserId;
    }
    return exports.DEFAULT_ACTOR;
}
function toNumber(value) {
    if (typeof value === 'number') {
        return value;
    }
    return Number(value.toString());
}
function toNullableNumber(value) {
    if (value === null) {
        return null;
    }
    return toNumber(value);
}
function hasOwnProperty(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}
function applyPresentFields(target, source, fields, transforms = {}) {
    const targetRecord = target;
    const sourceRecord = source;
    for (const field of fields) {
        if (!hasOwnProperty(source, field)) {
            continue;
        }
        const value = sourceRecord[field];
        const transform = transforms[field];
        targetRecord[field] = transform ? transform(value) : value;
    }
}
class ModuleExceptionFilter {
    fieldNamePattern;
    logger = new common_1.Logger(ModuleExceptionFilter.name);
    constructor(fieldNamePattern) {
        this.fieldNamePattern = fieldNamePattern;
    }
    catch(exception, host) {
        const httpContext = host.switchToHttp();
        const response = httpContext.getResponse();
        if (exception instanceof common_1.HttpException) {
            const statusCode = exception.getStatus();
            const rawResponse = exception.getResponse();
            if (this.isErrorResponse(rawResponse)) {
                response.status(statusCode).json(rawResponse);
                return;
            }
            if (statusCode === BAD_REQUEST_STATUS_CODE && this.isValidationPayload(rawResponse)) {
                response.status(statusCode).json(this.mapValidationPayload(rawResponse));
                return;
            }
            response
                .status(statusCode)
                .json(buildErrorResponse(this.resolveErrorMessage(rawResponse, exception.message)));
            return;
        }
        const request = httpContext.getRequest();
        this.logger.error(`${request.method} ${request.url}`, exception instanceof Error ? exception.stack : JSON.stringify(exception));
        const overflow = numericOverflowOf(exception);
        if (overflow) {
            response
                .status(common_1.HttpStatus.UNPROCESSABLE_ENTITY)
                .json(buildErrorResponse(`A value is too large to save: ${overflow}`));
            return;
        }
        response
            .status(common_1.HttpStatus.INTERNAL_SERVER_ERROR)
            .json(buildErrorResponse('Internal server error'));
    }
    isErrorResponse(value) {
        if (typeof value !== 'object' || value === null) {
            return false;
        }
        const candidate = value;
        return (candidate.success === false &&
            typeof candidate.message === 'string' &&
            Array.isArray(candidate.errors));
    }
    isValidationPayload(value) {
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
        return buildErrorResponse('Validation failed', errors);
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
        const fieldMatch = message.match(this.fieldNamePattern);
        if (fieldMatch) {
            return fieldMatch[1];
        }
        return 'request';
    }
}
exports.ModuleExceptionFilter = ModuleExceptionFilter;
//# sourceMappingURL=module-shared.utils.js.map