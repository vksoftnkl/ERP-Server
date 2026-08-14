"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasRequestPayload = void 0;
exports.validateDto = validateDto;
exports.validateSingleOrArrayDto = validateSingleOrArrayDto;
const common_1 = require("@nestjs/common");
const dtoValidationPipe = new common_1.ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
        enableImplicitConversion: true,
    },
});
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
        throw new common_1.BadRequestException({
            message: ['Request payload is required'],
        });
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
        throw new common_1.BadRequestException({
            message: ['Request payload is required'],
        });
    }
    if (!Array.isArray(value)) {
        return validateDto(value, metatype, options);
    }
    if (value.length === 0) {
        throw new common_1.BadRequestException({
            message: ['Request payload should not be an empty array'],
        });
    }
    const validatedItems = [];
    const validationMessages = [];
    for (const [index, item] of value.entries()) {
        try {
            const validatedItem = await validateDto(item, metatype, options);
            if (validatedItem) {
                validatedItems.push(validatedItem);
            }
        }
        catch (error) {
            const messages = extractValidationMessages(error);
            validationMessages.push(...messages.map((message) => `items[${index}] ${message}`));
        }
    }
    if (validationMessages.length > 0) {
        throw new common_1.BadRequestException({
            message: validationMessages,
        });
    }
    return validatedItems;
}
function extractValidationMessages(error) {
    if (error instanceof common_1.BadRequestException) {
        const response = error.getResponse();
        if (typeof response === 'string') {
            return [response];
        }
        if (typeof response === 'object' && response !== null && 'message' in response) {
            const message = response.message;
            if (Array.isArray(message)) {
                return message.filter((entry) => typeof entry === 'string');
            }
            if (typeof message === 'string') {
                return [message];
            }
        }
    }
    if (error instanceof Error && error.message) {
        return [error.message];
    }
    return ['Request payload is invalid'];
}
//# sourceMappingURL=request-payload-validation.util.js.map