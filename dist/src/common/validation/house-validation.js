"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOUSE_VALIDATION_OPTIONS = void 0;
exports.validationCode = validationCode;
exports.validationErrorDetails = validationErrorDetails;
exports.frameworkValidationCode = frameworkValidationCode;
exports.houseValidationException = houseValidationException;
exports.createHouseValidationPipe = createHouseValidationPipe;
const common_1 = require("@nestjs/common");
exports.HOUSE_VALIDATION_OPTIONS = {
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
        enableImplicitConversion: true,
    },
};
const CONSTRAINT_CODES = {
    whitelistValidation: 'VALIDATION_WHITELIST',
};
function validationCode(constraint) {
    return (CONSTRAINT_CODES[constraint] ??
        `VALIDATION_${constraint
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[^A-Za-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .toUpperCase()}`);
}
function validationErrorDetails(errors, parent = '') {
    const out = [];
    for (const error of errors) {
        const field = parent ? `${parent}.${error.property}` : error.property;
        const constraints = Object.entries(error.constraints ?? {});
        if (constraints.length > 0) {
            const [name, message] = constraints[0];
            out.push({ field, code: validationCode(name), message });
        }
        if (error.children && error.children.length > 0) {
            out.push(...validationErrorDetails(error.children, field));
        }
    }
    return out;
}
function frameworkValidationCode(message) {
    if (/should not exist$/.test(message)) {
        return 'VALIDATION_WHITELIST';
    }
    const expected = /^Validation failed \((.+) is expected\)$/.exec(message)?.[1] ?? '';
    if (/^uuid\b/.test(expected)) {
        return 'VALIDATION_IS_UUID';
    }
    if (/^numeric string\b/.test(expected)) {
        return 'VALIDATION_IS_INT';
    }
    if (/^(boolean string)\b/.test(expected)) {
        return 'VALIDATION_IS_BOOLEAN';
    }
    if (/^enum string\b/.test(expected)) {
        return 'VALIDATION_IS_ENUM';
    }
    if (/^(float|numeric)\b/.test(expected)) {
        return 'VALIDATION_IS_NUMBER';
    }
    return 'VALIDATION_FAILED';
}
function houseValidationException(errors) {
    const details = validationErrorDetails(errors);
    return new common_1.BadRequestException({
        success: false,
        message: 'Validation failed',
        errors: details.length > 0
            ? details
            : [{ field: 'request', code: 'VALIDATION_FAILED', message: 'Validation failed' }],
    });
}
function createHouseValidationPipe(overrides = {}) {
    return new common_1.ValidationPipe({
        ...exports.HOUSE_VALIDATION_OPTIONS,
        exceptionFactory: houseValidationException,
        ...overrides,
    });
}
//# sourceMappingURL=house-validation.js.map