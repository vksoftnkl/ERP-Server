"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptionalUuidField = OptionalUuidField;
exports.RequiredUuidField = RequiredUuidField;
exports.OptionalStringField = OptionalStringField;
exports.RequiredStringField = RequiredStringField;
exports.OptionalDateField = OptionalDateField;
exports.OptionalBooleanField = OptionalBooleanField;
exports.OptionalEnumField = OptionalEnumField;
exports.OptionalIntField = OptionalIntField;
exports.OptionalDecimalField = OptionalDecimalField;
exports.OptionalSignedDecimalField = OptionalSignedDecimalField;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const constants_1 = require("./constants");
const UUID_EXAMPLE = '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a11';
function OptionalUuidField(options) {
    return (0, common_1.applyDecorators)((0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'uuid',
        example: options?.example ?? UUID_EXAMPLE,
        description: options?.description,
    }), (0, class_transformer_1.Transform)(({ value }) => constants_1.UuidUtil.toOptional(value)), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)('all'));
}
function RequiredUuidField(options) {
    return (0, common_1.applyDecorators)((0, swagger_1.ApiProperty)({
        type: String,
        format: 'uuid',
        example: options?.example ?? UUID_EXAMPLE,
        description: options?.description,
    }), (0, class_transformer_1.Transform)(({ value }) => constants_1.UuidUtil.toOptional(value)), (0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.IsUUID)('all'));
}
function OptionalStringField(options) {
    const decorators = [
        (0, swagger_1.ApiPropertyOptional)({
            type: String,
            maxLength: options?.maxLength,
            example: options?.example,
            description: options?.description,
        }),
        (0, class_transformer_1.Transform)(({ value }) => constants_1.StringUtil.toNullable(value)),
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
    ];
    if (options?.maxLength) {
        decorators.push((0, class_validator_1.MaxLength)(options.maxLength));
    }
    return (0, common_1.applyDecorators)(...decorators);
}
function RequiredStringField(options) {
    const decorators = [
        (0, swagger_1.ApiProperty)({
            type: String,
            maxLength: options?.maxLength,
            example: options?.example,
            description: options?.description,
        }),
        (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string' ? value.trim() : value),
        (0, class_validator_1.IsString)(),
        (0, class_validator_1.IsNotEmpty)(),
    ];
    if (options?.maxLength) {
        decorators.push((0, class_validator_1.MaxLength)(options.maxLength));
    }
    return (0, common_1.applyDecorators)(...decorators);
}
function OptionalDateField(options) {
    return (0, common_1.applyDecorators)((0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: options?.format ?? 'date-time',
        example: options?.example ??
            (options?.format === 'date'
                ? '2026-05-07'
                : '2026-05-07T10:30:00.000Z'),
        default: options?.default,
        description: options?.description,
    }), (0, class_transformer_1.Transform)(({ value }) => constants_1.DateUtil.toOptionalDate(value)), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDate)());
}
function OptionalBooleanField(options) {
    return (0, common_1.applyDecorators)((0, swagger_1.ApiPropertyOptional)({
        type: Boolean,
        default: options?.default ?? false,
        example: options?.example ?? options?.default ?? false,
        description: options?.description,
    }), (0, class_transformer_1.Transform)(({ value }) => constants_1.BooleanUtil.toOptional(value)), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)());
}
function OptionalEnumField(enumObject, options) {
    return (0, common_1.applyDecorators)((0, swagger_1.ApiPropertyOptional)({
        enum: enumObject,
        default: options?.default,
        example: options?.example ?? options?.default,
        description: options?.description,
    }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enumObject));
}
function OptionalIntField(options) {
    return (0, common_1.applyDecorators)((0, swagger_1.ApiPropertyOptional)({
        type: Number,
        default: options?.default ?? 0,
        example: options?.example ?? 0,
        description: options?.description,
    }), (0, class_transformer_1.Transform)(({ value }) => constants_1.NumberUtil.toOptional(value)), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(options?.min ?? 0));
}
function OptionalDecimalField(options) {
    return (0, common_1.applyDecorators)((0, swagger_1.ApiPropertyOptional)({
        type: Number,
        default: options?.default ?? 0,
        example: options?.example ?? 0,
        description: options?.description,
    }), (0, class_transformer_1.Transform)(({ value }) => constants_1.NumberUtil.toOptional(value)), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)({
        maxDecimalPlaces: options?.maxDecimalPlaces ?? 2,
    }), (0, class_validator_1.Min)(options?.min ?? 0));
}
function OptionalSignedDecimalField(options) {
    return (0, common_1.applyDecorators)((0, swagger_1.ApiPropertyOptional)({
        type: Number,
        default: options?.default ?? 0,
        example: options?.example ?? 0,
        description: options?.description,
    }), (0, class_transformer_1.Transform)(({ value }) => constants_1.NumberUtil.toOptional(value)), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)({
        maxDecimalPlaces: options?.maxDecimalPlaces ?? 2,
    }));
}
//# sourceMappingURL=dto-field.decorator.js.map