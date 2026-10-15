"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasRequestPayload = void 0;
exports.validateDto = validateDto;
exports.validateSingleOrArrayDto = validateSingleOrArrayDto;
const common_1 = require("@nestjs/common");
const house_validation_1 = require("../validation/house-validation");
const module_shared_utils_1 = require("./module-shared.utils");
const dtoValidationPipe = (0, house_validation_1.createHouseValidationPipe)();
const hasRequestPayload = (value) => {
    if (value === undefined || value === null) {
        return false;
    }
    if (Array.isArray(value)) {
        return true;
    }
    if (typeof value !== 'object') {
        return true;
    }
    return Object.keys(value).length > 0;
};
exports.hasRequestPayload = hasRequestPayload;
async function validateDto(value, metatype, options = {}) {
    if (!(0, exports.hasRequestPayload)(value)) {
        if (options.optional) {
            return undefined;
        }
        throw payloadRefusal('VALIDATION_PAYLOAD_REQUIRED', 'Request payload is required');
    }
    return (await dtoValidationPipe.transform(value, {
        type: options.type ?? 'body',
        metatype,
        data: undefined,
    }));
}
async function validateSingleOrArrayDto(value, metatype, options = {}) {
    if (!(0, exports.hasRequestPayload)(value)) {
        if (options.optional) {
            return undefined;
        }
        throw payloadRefusal('VALIDATION_PAYLOAD_REQUIRED', 'Request payload is required');
    }
    if (!Array.isArray(value)) {
        return validateDto(value, metatype, options);
    }
    if (value.length === 0) {
        throw payloadRefusal('VALIDATION_PAYLOAD_EMPTY_ARRAY', 'Request payload should not be an empty array');
    }
    const validatedItems = [];
    const details = [];
    for (const [index, item] of value.entries()) {
        try {
            const validatedItem = await validateDto(item, metatype, options);
            if (validatedItem) {
                validatedItems.push(validatedItem);
            }
        }
        catch (error) {
            details.push(...extractValidationDetails(error).map((d) => ({
                field: `items.${index}.${d.field}`,
                code: d.code,
                message: `items[${index}] ${d.message}`,
            })));
        }
    }
    if (details.length > 0) {
        throw new common_1.BadRequestException((0, module_shared_utils_1.buildErrorResponse)('Validation failed', details));
    }
    return validatedItems;
}
function payloadRefusal(code, message) {
    return new common_1.BadRequestException((0, module_shared_utils_1.buildErrorResponse)('Validation failed', [
        { field: 'request', code, message },
    ]));
}
function extractValidationDetails(error) {
    if (error instanceof common_1.BadRequestException) {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null && 'errors' in response) {
            const errors = response.errors;
            if (Array.isArray(errors)) {
                return errors;
            }
        }
        if (typeof response === 'string') {
            return [{ field: 'request', code: 'VALIDATION_FAILED', message: response }];
        }
    }
    if (error instanceof Error && error.message) {
        return [{ field: 'request', code: 'VALIDATION_FAILED', message: error.message }];
    }
    return [{ field: 'request', code: 'VALIDATION_FAILED', message: 'Request payload is invalid' }];
}
//# sourceMappingURL=request-payload-validation.util.js.map